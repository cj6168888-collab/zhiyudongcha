import Foundation
import Speech
import AVFoundation

class SpeechRecognitionService: NSObject, ObservableObject {
    static let shared = SpeechRecognitionService()
    
    @Published var isRecording = false
    @Published var transcript = ""
    @Published var interimTranscript = ""
    @Published var error: String?
    @Published var authorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    private var useServerASR = false
    private var audioChunkSequence = 0
    
    override init() {
        super.init()
        requestAuthorization()
    }
    
    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                self?.authorizationStatus = status
                if status != .authorized {
                    self?.useServerASR = true
                }
            }
        }
        
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            if !granted {
                DispatchQueue.main.async {
                    self.error = "需要麦克风权限才能使用语音功能"
                }
            }
        }
    }
    
    func startRecording() {
        guard !isRecording else { return }
        
        error = nil
        transcript = ""
        interimTranscript = ""
        
        if useServerASR || authorizationStatus != .authorized {
            startServerASR()
        } else {
            startLocalASR()
        }
    }
    
    func stopRecording() {
        if useServerASR {
            stopServerASR()
        } else {
            stopLocalASR()
        }
        isRecording = false
    }
    
    private func startLocalASR() {
        guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
            useServerASR = true
            startServerASR()
            return
        }
        
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            
            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            recognitionRequest?.shouldReportPartialResults = true
            recognitionRequest?.requiresOnDeviceRecognition = false
            
            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }
            
            audioEngine.prepare()
            try audioEngine.start()
            
            recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest!) { [weak self] result, error in
                guard let self = self else { return }
                
                if let result = result {
                    let text = result.bestTranscription.formattedString
                    if result.isFinal {
                        DispatchQueue.main.async {
                            self.transcript = text
                            self.interimTranscript = ""
                        }
                    } else {
                        DispatchQueue.main.async {
                            self.interimTranscript = text
                        }
                    }
                }
                
                if let error = error {
                    DispatchQueue.main.async {
                        self.error = error.localizedDescription
                    }
                    self.stopLocalASR()
                }
            }
            
            isRecording = true
            
        } catch {
            self.error = error.localizedDescription
            useServerASR = true
            startServerASR()
        }
    }
    
    private func stopLocalASR() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        
        try? AVAudioSession.sharedInstance().setActive(false)
    }
    
    private func startServerASR() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            
            NetworkManager.shared.startASR()
            audioChunkSequence = 0
            
            let inputNode = audioEngine.inputNode
            let recordingFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
            
            let converter = AVAudioConverter(from: inputNode.outputFormat(forBus: 0), to: recordingFormat)!
            
            inputNode.installTap(onBus: 0, bufferSize: 4096, format: inputNode.outputFormat(forBus: 0)) { [weak self] buffer, _ in
                guard let self = self else { return }
                
                let frameCount = AVAudioFrameCount(recordingFormat.sampleRate * 0.1)
                guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: recordingFormat, frameCapacity: frameCount) else { return }
                
                var error: NSError?
                converter.convert(to: convertedBuffer, error: &error) { inNumPackets, outStatus in
                    outStatus.pointee = .haveData
                    return buffer
                }
                
                if let channelData = convertedBuffer.int16ChannelData {
                    let data = Data(bytes: channelData[0], count: Int(convertedBuffer.frameLength) * 2)
                    self.audioChunkSequence += 1
                    NetworkManager.shared.sendAudioChunk(data, sequence: self.audioChunkSequence, isFinal: false)
                }
            }
            
            audioEngine.prepare()
            try audioEngine.start()
            
            isRecording = true
            
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleASRResult),
                name: .asrResult,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleASRInterim),
                name: .asrInterim,
                object: nil
            )
            
        } catch {
            self.error = "无法启动语音识别: \(error.localizedDescription)"
        }
    }
    
    private func stopServerASR() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        NetworkManager.shared.stopASR()
        
        NotificationCenter.default.removeObserver(self, name: .asrResult, object: nil)
        NotificationCenter.default.removeObserver(self, name: .asrInterim, object: nil)
        
        try? AVAudioSession.sharedInstance().setActive(false)
    }
    
    @objc private func handleASRResult(_ notification: Notification) {
        guard let text = notification.userInfo?["text"] as? String else { return }
        DispatchQueue.main.async {
            self.transcript += (self.transcript.isEmpty ? "" : "\n") + text
            self.interimTranscript = ""
        }
    }
    
    @objc private func handleASRInterim(_ notification: Notification) {
        guard let text = notification.userInfo?["text"] as? String else { return }
        DispatchQueue.main.async {
            self.interimTranscript = text
        }
    }
}

extension SpeechRecognitionService {
    var isAuthorized: Bool {
        authorizationStatus == .authorized
    }
    
    var statusDescription: String {
        switch authorizationStatus {
        case .authorized: return "已授权"
        case .denied: return "已拒绝（使用云端识别）"
        case .restricted: return "受限（使用云端识别）"
        case .notDetermined: return "未确定"
        @unknown default: return "未知"
        }
    }
}

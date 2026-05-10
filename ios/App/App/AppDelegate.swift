import UIKit
import Capacitor
import Speech
import AVFoundation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    var speechRecognizer: SFSpeechRecognizer?
    var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    var recognitionTask: SFSpeechRecognitionTask?
    let audioEngine = AVAudioEngine()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize speech recognizer
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))

        // Register plugins
        registerPlugin(LocalLLMPlugin.self)

        // Request permissions
        requestSpeechPermission()
        requestMicrophonePermission()

        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }

    private func requestSpeechPermission() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                switch status {
                case .authorized:
                    print("Speech recognition authorized")
                case .denied:
                    print("Speech recognition denied")
                    self?.showPermissionAlert(title: "语音识别被禁用", message: "请在设置中启用语音识别以使用语音功能")
                case .restricted:
                    print("Speech recognition restricted")
                case .notDetermined:
                    print("Speech recognition not determined")
                @unknown default:
                    break
                }
            }
        }
    }

    private func requestMicrophonePermission() {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            if !granted {
                DispatchQueue.main.async {
                    self.showPermissionAlert(title: "麦克风权限被禁用", message: "请在设置中启用麦克风权限以使用语音输入功能")
                }
            }
        }
    }

    private func showPermissionAlert(title: String, message: String) {
        guard let rootViewController = window?.rootViewController else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "去设置", style: .default) { _ in
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        })
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        rootViewController.present(alert, animated: true)
    }

    // MARK: - Speech Recognition

    func startSpeechRecognition() {
        // Check authorization
        guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
            notifyVoiceError("Speech recognizer not available")
            return
        }

        // Cancel previous task
        recognitionTask?.cancel()
        recognitionTask = nil

        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            notifyVoiceError("Failed to configure audio session")
            return
        }

        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

        guard let recognitionRequest = recognitionRequest else {
            notifyVoiceError("Failed to create recognition request")
            return
        }

        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.requiresOnDeviceRecognition = false

        // Create recognition task
        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let isFinal = result.isFinal
                let transcript = result.bestTranscription.formattedString

                if isFinal {
                    self.notifyVoiceResult(transcript)
                    self.notifyVoiceState("stopped")
                } else {
                    self.notifyVoicePartialResult(transcript)
                    self.notifyVoiceState("listening")
                }
            }

            if let error = error {
                self.notifyVoiceError(error.localizedDescription)
                self.stopSpeechRecognition()
            }
        }

        // Configure audio input
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            notifyVoiceState("ready")
        } catch {
            notifyVoiceError("Failed to start audio engine")
        }
    }

    func stopSpeechRecognition() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        notifyVoiceState("stopped")
    }

    private func notifyVoiceState(_ state: String) {
        notifyPlugin(method: "voiceState", data: ["state": state])
    }

    private func notifyVoiceResult(_ text: String) {
        notifyPlugin(method: "voiceResult", data: ["text": text])
    }

    private func notifyVoicePartialResult(_ text: String) {
        notifyPlugin(method: "voicePartialResult", data: ["text": text])
    }

    private func notifyVoiceError(_ error: String) {
        notifyPlugin(method: "voiceError", data: ["error": error])
    }

    private func notifyPlugin(method: String, data: [String: Any]) {
        NotificationCenter.default.post(
            name: Notification.Name("voiceEvent"),
            object: nil,
            userInfo: ["method": method, "data": data]
        )
    }
}

import Foundation
import Combine

class NetworkManager: NSObject, ObservableObject {
    static let shared = NetworkManager()
    
    @Published var isConnected = false
    @Published var connectionError: String?
    
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession!
    private var cancellables = Set<AnyCancellable>()
    private var pingTimer: Timer?
    
    private let baseURL: String
    private let wsURL: String
    
    override init() {
        #if DEBUG
        self.baseURL = "http://localhost:5000"
        self.wsURL = "ws://localhost:5000/ws/mobile"
        #else
        self.baseURL = "https://your-domain.replit.app"
        self.wsURL = "wss://your-domain.replit.app/ws/mobile"
        #endif
        
        super.init()
        self.session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
    }
    
    func connect() {
        guard let url = URL(string: "\(wsURL)?deviceId=\(DeviceManager.deviceId)&role=MASTER&platform=iOS") else {
            return
        }
        
        webSocket = session.webSocketTask(with: url)
        webSocket?.resume()
        receiveMessage()
        startPingTimer()
    }
    
    func disconnect() {
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        isConnected = false
        stopPingTimer()
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                self?.receiveMessage()
            case .failure(let error):
                self?.connectionError = error.localizedDescription
                self?.isConnected = false
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseServerMessage(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseServerMessage(text)
            }
        @unknown default:
            break
        }
    }
    
    private func parseServerMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        switch type {
        case "pong":
            break
        case "asr_result":
            handleASRResult(json)
        case "asr_interim":
            handleASRInterim(json)
        case "ai_reply_chunk":
            handleAIReplyChunk(json)
        case "reminder":
            handleReminder(json)
        case "sync_required":
            handleSyncRequired(json)
        default:
            print("[WS] Unknown message type: \(type)")
        }
    }
    
    private func handleASRResult(_ json: [String: Any]) {
        guard let text = json["text"] as? String else { return }
        NotificationCenter.default.post(
            name: .asrResult,
            object: nil,
            userInfo: ["text": text, "isFinal": json["isFinal"] as? Bool ?? true]
        )
    }
    
    private func handleASRInterim(_ json: [String: Any]) {
        guard let text = json["text"] as? String else { return }
        NotificationCenter.default.post(
            name: .asrInterim,
            object: nil,
            userInfo: ["text": text]
        )
    }
    
    private func handleAIReplyChunk(_ json: [String: Any]) {
        guard let text = json["text"] as? String else { return }
        NotificationCenter.default.post(
            name: .aiReplyChunk,
            object: nil,
            userInfo: ["text": text, "isFinal": json["isFinal"] as? Bool ?? false]
        )
    }
    
    private func handleReminder(_ json: [String: Any]) {
        guard let data = json["data"] as? [String: Any] else { return }
        NotificationManager.shared.showLocalNotification(
            title: data["title"] as? String ?? "提醒",
            body: data["body"] as? String ?? ""
        )
    }
    
    private func handleSyncRequired(_ json: [String: Any]) {
        NotificationCenter.default.post(name: .syncRequired, object: nil)
    }
    
    func send(_ message: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let text = String(data: data, encoding: .utf8) else {
            return
        }
        webSocket?.send(.string(text)) { error in
            if let error = error {
                print("[WS] Send error: \(error)")
            }
        }
    }
    
    func sendAudioChunk(_ audioData: Data, sequence: Int, isFinal: Bool) {
        let message: [String: Any] = [
            "type": "audio_chunk",
            "data": audioData.base64EncodedString(),
            "sequence": sequence,
            "final": isFinal
        ]
        send(message)
    }
    
    func startASR() {
        send(["type": "asr_start", "format": "pcm", "sampleRate": 16000])
    }
    
    func stopASR() {
        send(["type": "asr_stop"])
    }
    
    private func startPingTimer() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.send(["type": "ping"])
        }
    }
    
    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }
}

extension NetworkManager: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        DispatchQueue.main.async {
            self.isConnected = true
            self.connectionError = nil
        }
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        DispatchQueue.main.async {
            self.isConnected = false
        }
    }
}

extension NetworkManager {
    func request<T: Decodable>(_ endpoint: String, method: String = "GET", body: [String: Any]? = nil) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("MASTER", forHTTPHeaderField: "X-User-Role")
        request.setValue(DeviceManager.deviceId, forHTTPHeaderField: "X-Device-Id")
        request.setValue("iOS", forHTTPHeaderField: "X-Platform")
        request.setValue(Bundle.main.appVersion, forHTTPHeaderField: "X-App-Version")
        
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            if let error = try? JSONDecoder().decode(APIError.self, from: data) {
                throw NetworkError.apiError(error.error)
            }
            throw NetworkError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    func chat(message: String, sessionId: String? = nil) async throws -> ChatResponse {
        var body: [String: Any] = ["message": message]
        if let sessionId = sessionId {
            body["sessionId"] = sessionId
        }
        return try await request("/api/conversation/chat", method: "POST", body: body)
    }
}

enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case apiError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "无效的URL"
        case .invalidResponse: return "无效的响应"
        case .httpError(let code): return "HTTP错误: \(code)"
        case .apiError(let message): return message
        }
    }
}

struct APIError: Decodable {
    let error: String
    let code: String?
}

struct ChatResponse: Decodable {
    let reply: String
    let sessionId: String
    let toolCalls: [ToolCall]?
    let intent: String?
    let confidence: Double?
    
    struct ToolCall: Decodable {
        let tool: String
        let args: [String: AnyCodable]?
        let result: [String: AnyCodable]?
    }
}

struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else {
            try container.encodeNil()
        }
    }
}

extension Notification.Name {
    static let asrResult = Notification.Name("asrResult")
    static let asrInterim = Notification.Name("asrInterim")
    static let aiReplyChunk = Notification.Name("aiReplyChunk")
    static let syncRequired = Notification.Name("syncRequired")
}

extension Bundle {
    var appVersion: String {
        infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
}

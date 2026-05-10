import Foundation
import Combine

class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private let speechService = SpeechRecognitionService.shared
    private var cancellables = Set<AnyCancellable>()
    private var currentSessionId: String?
    private var streamingReply = ""
    
    init() {
        setupObservers()
        loadWelcomeMessage()
    }
    
    private func setupObservers() {
        speechService.$transcript
            .dropFirst()
            .filter { !$0.isEmpty }
            .sink { [weak self] transcript in
                self?.handleVoiceInput(transcript)
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: .aiReplyChunk)
            .sink { [weak self] notification in
                self?.handleAIReplyChunk(notification)
            }
            .store(in: &cancellables)
    }
    
    private func loadWelcomeMessage() {
        let welcome = ChatMessage(
            content: "爸爸好！我是小智，您的数字生命助手。有什么我可以帮您的吗？",
            isFromUser: false
        )
        messages.append(welcome)
    }
    
    func sendMessage(_ text: String) {
        let userMessage = ChatMessage(content: text, isFromUser: true)
        messages.append(userMessage)
        
        isLoading = true
        
        Task {
            do {
                let response = try await NetworkManager.shared.chat(
                    message: text,
                    sessionId: currentSessionId
                )
                
                await MainActor.run {
                    self.currentSessionId = response.sessionId
                    
                    var toolCall: ToolCallInfo?
                    if let calls = response.toolCalls, let first = calls.first {
                        toolCall = ToolCallInfo(
                            tool: first.tool,
                            description: self.describeToolCall(first.tool),
                            icon: self.iconForTool(first.tool)
                        )
                    }
                    
                    let aiMessage = ChatMessage(
                        content: response.reply,
                        isFromUser: false,
                        toolCall: toolCall
                    )
                    self.messages.append(aiMessage)
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    private func handleVoiceInput(_ transcript: String) {
        sendMessage(transcript)
    }
    
    private func handleAIReplyChunk(_ notification: Notification) {
        guard let text = notification.userInfo?["text"] as? String,
              let isFinal = notification.userInfo?["isFinal"] as? Bool else { return }
        
        streamingReply += text
        
        if isFinal {
            let aiMessage = ChatMessage(content: streamingReply, isFromUser: false)
            messages.append(aiMessage)
            streamingReply = ""
        }
    }
    
    func startRecording() {
        speechService.startRecording()
    }
    
    func stopRecording() {
        speechService.stopRecording()
    }
    
    private func describeToolCall(_ tool: String) -> String {
        switch tool {
        case "create_contact": return "已创建联系人"
        case "search_contacts": return "搜索联系人"
        case "create_project": return "已创建项目"
        case "search_projects": return "搜索项目"
        case "create_reminder": return "已设置提醒"
        case "create_calendar_event": return "已创建日程"
        case "get_daily_summary": return "获取日报"
        case "get_current_time": return "获取时间"
        case "get_weather": return "查询天气"
        case "calculator": return "计算结果"
        default: return "执行操作"
        }
    }
    
    private func iconForTool(_ tool: String) -> String {
        switch tool {
        case "create_contact", "search_contacts": return "person.fill"
        case "create_project", "search_projects": return "folder.fill"
        case "create_reminder": return "bell.fill"
        case "create_calendar_event": return "calendar"
        case "get_daily_summary": return "doc.text.fill"
        case "get_current_time": return "clock.fill"
        case "get_weather": return "cloud.sun.fill"
        case "calculator": return "function"
        default: return "gear"
        }
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let content: String
    let isFromUser: Bool
    let timestamp = Date()
    var toolCall: ToolCallInfo?
}

struct ToolCallInfo {
    let tool: String
    let description: String
    let icon: String
}

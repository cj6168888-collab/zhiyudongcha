import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ChatView()
                .tabItem {
                    Image(systemName: "message.fill")
                    Text("对话")
                }
                .tag(0)
            
            InsightListenerView()
                .tabItem {
                    Image(systemName: "ear.fill")
                    Text("洞察")
                }
                .tag(1)
            
            ContactsView()
                .tabItem {
                    Image(systemName: "person.2.fill")
                    Text("人脉")
                }
                .tag(2)
            
            ProjectsView()
                .tabItem {
                    Image(systemName: "folder.fill")
                    Text("项目")
                }
                .tag(3)
            
            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("设置")
                }
                .tag(4)
        }
        .accentColor(.orange)
    }
}

struct ChatView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var inputText = ""
    @State private var isVoiceMode = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.messages) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: viewModel.messages.count) { _ in
                        if let lastId = viewModel.messages.last?.id {
                            withAnimation {
                                proxy.scrollTo(lastId, anchor: .bottom)
                            }
                        }
                    }
                }
                
                Divider()
                
                inputBar
            }
            .navigationTitle("小智")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    ConnectionIndicator()
                }
            }
        }
    }
    
    private var inputBar: some View {
        HStack(spacing: 12) {
            if isVoiceMode {
                VoiceInputButton(viewModel: viewModel)
            } else {
                TextField("输入消息...", text: $inputText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        sendMessage()
                    }
                
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(inputText.isEmpty ? .gray : .orange)
                }
                .disabled(inputText.isEmpty)
            }
            
            Button(action: { isVoiceMode.toggle() }) {
                Image(systemName: isVoiceMode ? "keyboard" : "mic.fill")
                    .font(.title3)
                    .foregroundColor(.orange)
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }
    
    private func sendMessage() {
        guard !inputText.isEmpty else { return }
        viewModel.sendMessage(inputText)
        inputText = ""
    }
}

struct VoiceInputButton: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var isRecording = false
    
    var body: some View {
        Button(action: toggleRecording) {
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red : Color.orange)
                    .frame(width: 60, height: 60)
                
                if isRecording {
                    Circle()
                        .stroke(Color.red.opacity(0.5), lineWidth: 4)
                        .frame(width: 70, height: 70)
                        .scaleEffect(1.2)
                        .opacity(0.5)
                        .animation(.easeInOut(duration: 1).repeatForever(), value: isRecording)
                }
                
                Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                    .font(.title2)
                    .foregroundColor(.white)
            }
        }
        .frame(maxWidth: .infinity)
    }
    
    private func toggleRecording() {
        if isRecording {
            viewModel.stopRecording()
        } else {
            viewModel.startRecording()
        }
        isRecording.toggle()
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isFromUser {
                Spacer()
            }
            
            VStack(alignment: message.isFromUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(12)
                    .background(message.isFromUser ? Color.orange : Color(.systemGray5))
                    .foregroundColor(message.isFromUser ? .white : .primary)
                    .cornerRadius(16)
                
                if let toolCall = message.toolCall {
                    ToolCallIndicator(toolCall: toolCall)
                }
            }
            
            if !message.isFromUser {
                Spacer()
            }
        }
    }
}

struct ToolCallIndicator: View {
    let toolCall: ToolCallInfo
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: toolCall.icon)
            Text(toolCall.description)
        }
        .font(.caption)
        .foregroundColor(.secondary)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

struct ConnectionIndicator: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 8, height: 8)
    }
    
    private var statusColor: Color {
        switch appState.connectionStatus {
        case .connected: return .green
        case .connecting: return .orange
        case .disconnected: return .gray
        case .error: return .red
        }
    }
}

struct InsightListenerView: View {
    var body: some View {
        NavigationView {
            Text("智语洞察")
                .navigationTitle("智语洞察")
        }
    }
}

struct ContactsView: View {
    var body: some View {
        NavigationView {
            Text("人脉管理")
                .navigationTitle("人脉")
        }
    }
}

struct ProjectsView: View {
    var body: some View {
        NavigationView {
            Text("项目管理")
                .navigationTitle("项目")
        }
    }
}

struct SettingsView: View {
    var body: some View {
        NavigationView {
            Text("设置")
                .navigationTitle("设置")
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(NetworkManager.shared)
}

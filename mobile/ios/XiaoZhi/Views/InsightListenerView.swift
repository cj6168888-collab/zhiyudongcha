import SwiftUI

struct InsightListenerFullView: View {
    @StateObject private var viewModel = InsightListenerViewModel()
    @State private var selectedType: TalkType = .meeting
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                typeSelector
                
                statusPanel
                
                transcriptView
                
                Spacer()
                
                controlPanel
            }
            .navigationTitle("智语洞察")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("会话历史") { }
                        Button("设置") { }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }
    
    private var typeSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(TalkType.allCases, id: \.self) { type in
                    Button(action: { selectedType = type }) {
                        VStack(spacing: 4) {
                            Image(systemName: type.icon)
                                .font(.title3)
                            Text(type.label)
                                .font(.caption)
                        }
                        .foregroundColor(selectedType == type ? .white : .primary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(selectedType == type ? type.color : Color(.systemGray5))
                        .cornerRadius(12)
                    }
                }
            }
            .padding()
        }
    }
    
    private var statusPanel: some View {
        HStack(spacing: 16) {
            StatusItem(
                icon: "waveform",
                label: "状态",
                value: viewModel.isListening ? "录音中" : "待机",
                color: viewModel.isListening ? .green : .gray
            )
            
            StatusItem(
                icon: "clock",
                label: "时长",
                value: viewModel.formattedDuration,
                color: .orange
            )
            
            StatusItem(
                icon: "person.2",
                label: "人物",
                value: "\(viewModel.extractedEntities.count)",
                color: .blue
            )
            
            StatusItem(
                icon: "lightbulb",
                label: "机会",
                value: "\(viewModel.opportunities.count)",
                color: .purple
            )
        }
        .padding()
        .background(Color(.systemGray6))
    }
    
    private var transcriptView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if viewModel.isListening {
                    HStack {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                        Text("正在录音...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                }
                
                if !viewModel.transcript.isEmpty {
                    Text(viewModel.transcript)
                        .font(.body)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                        .padding(.horizontal)
                }
                
                if !viewModel.interimTranscript.isEmpty {
                    Text(viewModel.interimTranscript)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .italic()
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                        .padding(.horizontal)
                }
                
                if !viewModel.extractedEntities.isEmpty {
                    extractedEntitiesSection
                }
                
                if !viewModel.opportunities.isEmpty {
                    opportunitiesSection
                }
            }
            .padding(.vertical)
        }
    }
    
    private var extractedEntitiesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("识别到的人物")
                .font(.headline)
                .padding(.horizontal)
            
            ForEach(viewModel.extractedEntities) { entity in
                HStack {
                    Image(systemName: "person.circle.fill")
                        .foregroundColor(.blue)
                    
                    VStack(alignment: .leading) {
                        Text(entity.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        if let company = entity.company {
                            Text(company)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    if !entity.isLinked {
                        Button("添加") {
                            viewModel.linkEntity(entity)
                        }
                        .font(.caption)
                        .foregroundColor(.orange)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                }
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(8)
                .padding(.horizontal)
            }
        }
    }
    
    private var opportunitiesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("发现的机会")
                .font(.headline)
                .padding(.horizontal)
            
            ForEach(viewModel.opportunities) { opp in
                HStack {
                    Image(systemName: "lightbulb.fill")
                        .foregroundColor(.yellow)
                    
                    VStack(alignment: .leading) {
                        Text(opp.description)
                            .font(.subheadline)
                        Text(opp.priority.label)
                            .font(.caption)
                            .foregroundColor(opp.priority.color)
                    }
                    
                    Spacer()
                }
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(8)
                .padding(.horizontal)
            }
        }
    }
    
    private var controlPanel: some View {
        VStack(spacing: 16) {
            if viewModel.isListening {
                volumeIndicator
            }
            
            HStack(spacing: 24) {
                Button(action: { viewModel.toggleListening(type: selectedType) }) {
                    ZStack {
                        Circle()
                            .fill(viewModel.isListening ? Color.red : Color.orange)
                            .frame(width: 70, height: 70)
                        
                        Image(systemName: viewModel.isListening ? "stop.fill" : "mic.fill")
                            .font(.title)
                            .foregroundColor(.white)
                    }
                }
                
                if !viewModel.transcript.isEmpty && !viewModel.isListening {
                    Button(action: { viewModel.analyze() }) {
                        HStack {
                            Image(systemName: "sparkles")
                            Text("分析")
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color.purple)
                        .cornerRadius(20)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }
    
    private var volumeIndicator: some View {
        HStack(spacing: 4) {
            ForEach(0..<7, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(index < viewModel.volumeLevel ? Color.green : Color.gray.opacity(0.3))
                    .frame(width: 6, height: CGFloat(8 + index * 4))
            }
        }
    }
}

struct StatusItem: View {
    let icon: String
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundColor(color)
            Text(value)
                .font(.headline)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

enum TalkType: String, CaseIterable {
    case casual = "CASUAL"
    case meeting = "MEETING"
    case negotiation = "NEGOTIATION"
    case interview = "INTERVIEW"
    case legal = "LEGAL"
    
    var label: String {
        switch self {
        case .casual: return "闲聊"
        case .meeting: return "会议"
        case .negotiation: return "谈判"
        case .interview: return "面试"
        case .legal: return "法务"
        }
    }
    
    var icon: String {
        switch self {
        case .casual: return "bubble.left.and.bubble.right"
        case .meeting: return "person.3"
        case .negotiation: return "chart.line.uptrend.xyaxis"
        case .interview: return "person.badge.clock"
        case .legal: return "building.columns"
        }
    }
    
    var color: Color {
        switch self {
        case .casual: return .gray
        case .meeting: return .blue
        case .negotiation: return .orange
        case .interview: return .purple
        case .legal: return .red
        }
    }
}

class InsightListenerViewModel: ObservableObject {
    @Published var isListening = false
    @Published var transcript = ""
    @Published var interimTranscript = ""
    @Published var duration: TimeInterval = 0
    @Published var volumeLevel = 0
    @Published var extractedEntities: [ExtractedEntity] = []
    @Published var opportunities: [Opportunity] = []
    @Published var currentSessionId: String?
    
    private let speechService = SpeechRecognitionService.shared
    private var timer: Timer?
    
    var formattedDuration: String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    func toggleListening(type: TalkType) {
        if isListening {
            stopListening()
        } else {
            startListening(type: type)
        }
    }
    
    private func startListening(type: TalkType) {
        isListening = true
        duration = 0
        transcript = ""
        interimTranscript = ""
        extractedEntities = []
        opportunities = []
        
        speechService.startRecording()
        
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.duration += 1
            self?.volumeLevel = Int.random(in: 2...7)
        }
        
        Task {
            await createSession(type: type)
        }
    }
    
    private func stopListening() {
        isListening = false
        speechService.stopRecording()
        timer?.invalidate()
        timer = nil
        volumeLevel = 0
        
        transcript = speechService.transcript
    }
    
    func analyze() {
        guard !transcript.isEmpty, let sessionId = currentSessionId else { return }
        
        Task {
            do {
                let result: AnalysisResult = try await NetworkManager.shared.request(
                    "/api/talk-sessions/\(sessionId)/analyze",
                    method: "POST",
                    body: ["text": transcript]
                )
                
                await MainActor.run {
                    self.extractedEntities = result.entities ?? []
                    self.opportunities = result.opportunities ?? []
                }
            } catch {
                print("Analysis error: \(error)")
            }
        }
    }
    
    func linkEntity(_ entity: ExtractedEntity) {
        if let index = extractedEntities.firstIndex(where: { $0.id == entity.id }) {
            extractedEntities[index].isLinked = true
        }
    }
    
    private func createSession(type: TalkType) async {
        do {
            let session: TalkSession = try await NetworkManager.shared.request(
                "/api/talk-sessions",
                method: "POST",
                body: ["type": type.rawValue, "deviceId": DeviceManager.deviceId]
            )
            await MainActor.run {
                self.currentSessionId = session.id
            }
        } catch {
            print("Create session error: \(error)")
        }
    }
}

struct ExtractedEntity: Identifiable, Decodable {
    let id: String
    let name: String
    let type: String
    var company: String?
    var title: String?
    var isLinked: Bool
    
    enum CodingKeys: String, CodingKey {
        case id, name, type, company, title
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try container.decode(String.self, forKey: .name)
        type = try container.decode(String.self, forKey: .type)
        company = try container.decodeIfPresent(String.self, forKey: .company)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        isLinked = false
    }
}

struct Opportunity: Identifiable, Decodable {
    let id: String
    let type: String
    let description: String
    let priorityRaw: String
    
    var priority: OpportunityPriority {
        OpportunityPriority(rawValue: priorityRaw) ?? .medium
    }
    
    enum CodingKeys: String, CodingKey {
        case id, type, description
        case priorityRaw = "priority"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        type = try container.decode(String.self, forKey: .type)
        description = try container.decode(String.self, forKey: .description)
        priorityRaw = try container.decodeIfPresent(String.self, forKey: .priorityRaw) ?? "MEDIUM"
    }
}

enum OpportunityPriority: String {
    case high = "HIGH"
    case medium = "MEDIUM"
    case low = "LOW"
    
    var label: String {
        switch self {
        case .high: return "高优先级"
        case .medium: return "中等优先级"
        case .low: return "低优先级"
        }
    }
    
    var color: Color {
        switch self {
        case .high: return .red
        case .medium: return .orange
        case .low: return .gray
        }
    }
}

struct AnalysisResult: Decodable {
    let talkType: String?
    let entities: [ExtractedEntity]?
    let opportunities: [Opportunity]?
    let sentiment: String?
    let keyPoints: [String]?
}

struct TalkSession: Decodable {
    let id: String
    let status: String
    let startedAt: String
}

#Preview {
    InsightListenerFullView()
}

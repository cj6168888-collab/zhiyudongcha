import SwiftUI

@main
struct XiaoZhiApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var networkManager = NetworkManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(networkManager)
                .onAppear {
                    setupApp()
                }
        }
    }
    
    private func setupApp() {
        NotificationManager.shared.requestAuthorization()
        networkManager.connect()
    }
}

class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isListening = false
    @Published var connectionStatus: ConnectionStatus = .disconnected
    
    enum ConnectionStatus {
        case connected
        case connecting
        case disconnected
        case error(String)
    }
}

struct User: Codable, Identifiable {
    let id: String
    let role: UserRole
    let deviceId: String
    
    enum UserRole: String, Codable {
        case master = "MASTER"
        case guest = "GUEST"
    }
}

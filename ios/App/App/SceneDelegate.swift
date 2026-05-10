import UIKit
import Capacitor
import AVFoundation

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        let window = UIWindow(windowScene: windowScene)
        let rootViewController = BridgeViewController()
        window.rootViewController = rootViewController
        self.window = window
        window.makeKeyAndVisible()

        configureAudioSession()
        setupVoiceEventObserver()
    }

    private func configureAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord,
                                        mode: .measurement,
                                        options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
            try audioSession.setActive(true)
        } catch {
            print("Failed to configure audio session: \(error)")
        }
    }

    private func setupVoiceEventObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleVoiceEvent(_:)),
            name: Notification.Name("voiceEvent"),
            object: nil
        )
    }

    @objc private func handleVoiceEvent(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let method = userInfo["method"] as? String,
              let data = userInfo["data"] as? [String: Any] else {
            return
        }

        // Forward to web view via Capacitor bridge
        if let bridge = (window?.rootViewController as? BridgeViewController)?.bridge {
            let jsObject = JSObject()
            for (key, value) in data {
                jsObject[key] = value
            }
            bridge.notifyListeners(method, data: jsObject)
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Resume audio engine if needed
    }

    func sceneWillResignActive(_ scene: UIScene) {
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}

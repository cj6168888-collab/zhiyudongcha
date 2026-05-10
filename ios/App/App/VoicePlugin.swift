import Foundation
import Capacitor

@objc(VoicePlugin)
public class VoicePlugin: CAPPlugin {
    
    private var isInitialized = false
    private var isListening = false
    
    @objc func initialize(_ call: CAPPluginCall) {
        isInitialized = true
        call.resolve(["success": true])
    }
    
    @objc func startListening(_ call: CAPPluginCall) {
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
            call.reject("AppDelegate not found")
            return
        }
        
        if !isInitialized {
            appDelegate.startSpeechRecognition()
        }
        
        isListening = true
        call.resolve(["success": true])
    }
    
    @objc func stopListening(_ call: CAPPluginCall) {
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
            call.reject("AppDelegate not found")
            return
        }
        
        appDelegate.stopSpeechRecognition()
        isListening = false
        call.resolve(["success": true])
    }
    
    @objc func isListening(_ call: CAPPluginCall) {
        call.resolve(["isListening": isListening])
    }
    
    @objc func hasPermission(_ call: CAPPluginCall) {
        let granted = true // iOS permissions handled at app level
        call.resolve(["hasPermission": granted])
    }
    
    @objc func requestPermission(_ call: CAPPluginCall) {
        // iOS permissions are requested at app launch
        call.resolve(["granted": true])
    }
    
    @objc func getSupportedLanguages(_ call: CAPPluginCall) {
        call.resolve([
            "languages": ["zh-CN", "zh-TW", "en-US", "en-GB", "ja-JP", "ko-KR"]
        ])
    }
    
    @objc func setLanguage(_ call: CAPPluginCall) {
        call.resolve(["success": true])
    }
    
    @objc func removeAllListeners(_ call: CAPPluginCall) {
        isListening = false
        call.resolve()
    }
}
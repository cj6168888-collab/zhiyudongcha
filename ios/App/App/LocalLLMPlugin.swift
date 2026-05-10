import Foundation
import Capacitor

@objc(LocalLLMPlugin)
public class LocalLLMPlugin: CAPPlugin {
    
    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": value
        ])
    }
}
import Foundation
import UIKit
import Security

class DeviceManager {
    static var deviceId: String {
        if let id = KeychainHelper.get(key: "device_id") {
            return id
        }
        
        let newId = UUID().uuidString
        KeychainHelper.save(key: "device_id", value: newId)
        return newId
    }
    
    static var deviceInfo: [String: String] {
        [
            "model": UIDevice.current.model,
            "name": UIDevice.current.name,
            "systemVersion": UIDevice.current.systemVersion,
            "platform": "iOS"
        ]
    }
}

class KeychainHelper {
    static func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    static func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return value
    }
    
    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

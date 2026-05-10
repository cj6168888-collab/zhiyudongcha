package com.avatar.companion

import android.content.Context
import android.content.SharedPreferences
import android.os.Build

/**
 * 配置管理类 - 支持运行时配置和构建时默认值
 */
object Config {
    private const val PREFS_NAME = "avatar_companion_prefs"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_DEVICE_NAME = "device_name"
    
    private var prefs: SharedPreferences? = null
    
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    var serverUrl: String
        get() = prefs?.getString(KEY_SERVER_URL, null) ?: DEFAULT_SERVER_URL
        set(value) = prefs?.edit()?.putString(KEY_SERVER_URL, value)?.apply() ?: Unit
    
    var deviceId: String
        get() = prefs?.getString(KEY_DEVICE_ID, null) ?: generateDeviceId()
        set(value) = prefs?.edit()?.putString(KEY_DEVICE_ID, value)?.apply() ?: Unit
    
    var deviceName: String
        get() = prefs?.getString(KEY_DEVICE_NAME, null) ?: DEFAULT_DEVICE_NAME
        set(value) = prefs?.edit()?.putString(KEY_DEVICE_NAME, value)?.apply() ?: Unit
    
    private fun generateDeviceId(): String {
        return "android-${Build.MODEL.replace(" ", "-").lowercase()}-${System.currentTimeMillis() % 10000}"
    }
    
    companion object {
        const val DEFAULT_SERVER_URL = "wss://your-server.replit.app/ws/shadow"
        const val DEFAULT_DEVICE_NAME = "小智手机"
        const val RECONNECT_INTERVAL = 5000L
        const val HEARTBEAT_INTERVAL = 30000L
    }
}

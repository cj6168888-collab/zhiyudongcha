package com.avatar.companion

import android.app.Application
import android.util.Log

/**
 * 小智伴侣应用入口
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */
class AvatarCompanionApp : Application() {
    
    companion object {
        private const val TAG = "AvatarApp"
        
        @Volatile
        private var instance: AvatarCompanionApp? = null
        
        fun getInstance(): AvatarCompanionApp {
            return instance ?: throw IllegalStateException("Application not initialized")
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        
        Config.init(this)
        
        Log.i(TAG, "小智伴侣应用已启动")
        Log.i(TAG, "设备ID: ${Config.deviceId}")
        Log.i(TAG, "服务器: ${Config.serverUrl}")
    }
}

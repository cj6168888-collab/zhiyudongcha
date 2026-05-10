package com.xiaozhi

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class XiaoZhiApplication : Application() {
    
    companion object {
        const val CHANNEL_ID_REMINDER = "xiaozhi_reminder"
        const val CHANNEL_ID_INSIGHT = "xiaozhi_insight"
        
        lateinit var instance: XiaoZhiApplication
            private set
    }
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        
        createNotificationChannels()
        NetworkManager.initialize(this)
    }
    
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val reminderChannel = NotificationChannel(
                CHANNEL_ID_REMINDER,
                "提醒通知",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "小智的提醒和通知"
            }
            
            val insightChannel = NotificationChannel(
                CHANNEL_ID_INSIGHT,
                "洞察通知",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "智语洞察分析结果"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(reminderChannel)
            notificationManager.createNotificationChannel(insightChannel)
        }
    }
}

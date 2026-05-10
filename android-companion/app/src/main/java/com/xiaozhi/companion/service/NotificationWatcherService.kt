package com.xiaozhi.companion.service

import android.annotation.SuppressLint
import android.app.Notification
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.xiaozhi.companion.WebSocketManager
import com.xiaozhi.companion.model.NotificationPayload
import com.xiaozhi.companion.model.WsMessage

class NotificationWatcherService : NotificationListenerService() {
    private val TAG = "NotificationWatcher"
    
    private var webSocketManager: WebSocketManager? = null
    
    private val watchedPackages = setOf(
        "com.tencent.mm",
        "com.tencent.mobileqq",
        "com.android.mms",
        "com.google.android.apps.messaging",
        "com.android.phone",
        "com.android.contacts"
    )
    
    private val ignoredPackages = setOf(
        "com.android.systemui",
        "com.android.launcher",
        "com.xiaozhi.companion"
    )
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "NotificationWatcherService created")
    }
    
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        
        val packageName = sbn.packageName
        
        if (packageName in ignoredPackages) return
        if (packageName !in watchedPackages && !isWeChatRelated(sbn)) return
        
        try {
            val notification = sbn.notification
            val extras = notification.extras
            
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
            val content = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            
            val timestamp = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    sbn.javaClass.getMethod("getCreationTimeMillis").invoke(sbn) as Long
                } catch (e: Exception) {
                    sbn.postTime
                }
            } else {
                sbn.postTime
            }
            
            Log.d(TAG, "Notification from $packageName: $title - $content")
            
            val payload = NotificationPayload(
                packageName = packageName,
                title = title,
                content = content,
                timestamp = timestamp
            )
            
            webSocketManager?.sendMessage(WsMessage(
                type = "NOTIFICATION",
                payload = payload
            ))
            
            if (isImportantNotification(title, content)) {
                handleImportantNotification(packageName, title, content)
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification: ${e.message}")
        }
    }
    
    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        sbn ?: return
        Log.d(TAG, "Notification removed: ${sbn.packageName}")
    }
    
    fun setWebSocketManager(ws: WebSocketManager?) {
        webSocketManager = ws
    }
    
    private fun isWeChatRelated(sbn: StatusBarNotification): Boolean {
        return sbn.packageName.contains("tencent") || 
               sbn.packageName.contains("wechat") ||
               sbn.packageName.contains("mm")
    }
    
    private fun isImportantNotification(title: String, content: String): Boolean {
        val importantKeywords = listOf(
            "律师函", "合同", "法院", "传票", "起诉", "开庭",
            "逾期", "还款", "欠款", "账单", "转账", "收款",
            "验证码", "密码", "安全", "异常", "登录"
        )
        
        val text = "$title $content"
        return importantKeywords.any { text.contains(it, ignoreCase = true) }
    }
    
    private fun handleImportantNotification(packageName: String, title: String, content: String) {
        Log.d(TAG, "Important notification detected: $title")
        
        when {
            packageName.contains("mm") -> handleWeChatNotification(title, content)
            packageName.contains("mms") || packageName.contains("messaging") -> handleSmsNotification(title, content)
            packageName.contains("phone") -> handleCallNotification(title, content)
        }
    }
    
    private fun handleWeChatNotification(title: String, content: String) {
        when {
            title.contains("微信支付") || content.contains("支付") -> {
                sendActionPayload("WECHAT_PAYMENT", mapOf("title" to title, "content" to content))
            }
            content.contains("文件") || content.contains("文档") -> {
                sendActionPayload("WECHAT_FILE", mapOf("title" to title, "content" to content))
            }
            title.contains("收款") || content.contains("收款码") -> {
                sendActionPayload("WECHAT_RECEIVE_MONEY", mapOf("title" to title, "content" to content))
            }
        }
    }
    
    private fun handleSmsNotification(title: String, content: String) {
        when {
            content.contains("验证码") -> {
                sendActionPayload("SMS_CODE", mapOf("title" to title, "content" to content))
                extractVerificationCode(content)
            }
            content.contains("银行") || content.contains("账户") -> {
                sendActionPayload("BANK_NOTIFICATION", mapOf("title" to title, "content" to content))
            }
        }
    }
    
    private fun handleCallNotification(title: String, content: String) {
        when {
            title.contains("未接") -> {
                sendActionPayload("MISSED_CALL", mapOf("title" to title, "content" to content))
            }
            content.contains("通话") -> {
                sendActionPayload("CALL_NOTIFICATION", mapOf("title" to title, "content" to content))
            }
        }
    }
    
    private fun extractVerificationCode(content: String): String? {
        val codeRegex = Regex("(\\d{4,8})")
        val match = codeRegex.find(content)
        
        if (match != null) {
            val code = match.groupValues[1]
            Log.d(TAG, "Extracted verification code: $code")
            
            sendActionPayload("VERIFICATION_CODE", mapOf("code" to code, "content" to content))
            return code
        }
        return null
    }
    
    private fun sendActionPayload(action: String, data: Map<String, String>) {
        val payload = mapOf(
            "action" to action,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        )
        
        webSocketManager?.sendMessage(WsMessage(
            type = "NOTIFICATION_ACTION",
            payload = payload
        ))
    }
    
    fun getActiveNotificationsMap(): List<Map<String, Any>> {
        val notifications = mutableListOf<Map<String, Any>>()
        
        try {
            val active = super.getActiveNotifications()
            active?.forEach { sbn ->
                try {
                    val notification = sbn.notification
                    val extras = notification.extras
                    
                    val postTime = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        try {
                            sbn.javaClass.getMethod("getCreationTimeMillis").invoke(sbn) as Long
                        } catch (e: Exception) {
                            sbn.postTime
                        }
                    } else {
                        sbn.postTime
                    }
                    
                    val item = mapOf(
                        "package" to sbn.packageName,
                        "title" to (extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""),
                        "content" to (extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""),
                        "timestamp" to postTime
                    )
                    notifications.add(item)
                } catch (e: Exception) {
                    Log.e(TAG, "Error reading notification: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting active notifications: ${e.message}")
        }
        
        return notifications
    }
    
    fun clearNotification(packageName: String?, tag: String?, id: Int) {
        try {
            if (packageName != null) {
                cancelNotification(packageName, tag, id)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing notification: ${e.message}")
        }
    }
    
    fun clearAllNotifications() {
        try {
            cancelAllNotifications()
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing all notifications: ${e.message}")
        }
    }
    
    companion object {
        var instance: NotificationWatcherService? = null
            private set
    }
    
    init {
        instance = this
    }
}

package com.avatar.companion.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

/**
 * WebSocket 后台服务 - 与服务器保持长连接
 * 
 * 功能：
 * 1. 建立和维护 WebSocket 连接
 * 2. 接收并分发操作指令
 * 3. 返回执行结果和截图
 * 4. 自动重连机制
 */
class WebSocketService : Service() {
    
    companion object {
        private const val TAG = "AvatarWS"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "avatar_companion"
    }
    
    private val serverUrl: String get() = com.avatar.companion.Config.serverUrl
    private val deviceId: String get() = com.avatar.companion.Config.deviceId
    private val deviceName: String get() = com.avatar.companion.Config.deviceName
    private val reconnectDelay: Long get() = com.avatar.companion.Config.RECONNECT_INTERVAL
    private val heartbeatInterval: Long get() = com.avatar.companion.Config.HEARTBEAT_INTERVAL
    
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var webSocket: WebSocket? = null
    private var isConnected = false
    private var reconnectJob: Job? = null
    private var heartbeatJob: Job? = null
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)  // 无限读超时
        .writeTimeout(10, TimeUnit.SECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification("正在连接..."))
        connect()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        webSocket?.close(1000, "Service destroyed")
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "小智伴侣",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "保持后台运行"
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(status: String): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("小智伴侣")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("小智伴侣")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build()
        }
    }
    
    private fun updateNotification(status: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, createNotification(status))
    }
    
    // ==================== WebSocket 连接管理 ====================
    
    private fun connect() {
        val request = Request.Builder()
            .url(serverUrl)
            .addHeader("X-Device-Id", deviceId)
            .addHeader("X-Device-Type", "ANDROID")
            .build()
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket 连接成功")
                isConnected = true
                updateNotification("已连接")
                
                // 发送注册消息
                sendRegisterMessage()
                
                // 启动心跳
                startHeartbeat()
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "收到消息: $text")
                handleMessage(text)
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket 连接失败: ${t.message}")
                isConnected = false
                updateNotification("连接失败，重连中...")
                scheduleReconnect()
            }
            
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket 已关闭: $reason")
                isConnected = false
                updateNotification("已断开")
                
                if (code != 1000) {
                    scheduleReconnect()
                }
            }
        })
    }
    
    private fun sendRegisterMessage() {
        val message = JSONObject().apply {
            put("type", "REGISTER")
            put("deviceId", deviceId)
            put("deviceType", "ANDROID")
            put("name", deviceName)
            put("capabilities", JSONObject().apply {
                put("canTap", true)
                put("canSwipe", true)
                put("canInput", true)
                put("canScreenshot", true)
                put("channels", listOf("ACCESSIBILITY", "ADB"))
            })
        }
        
        webSocket?.send(message.toString())
    }
    
    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = serviceScope.launch {
            while (isActive && isConnected) {
                delay(heartbeatInterval)
                
                val heartbeat = JSONObject().apply {
                    put("type", "HEARTBEAT")
                    put("deviceId", deviceId)
                    put("timestamp", System.currentTimeMillis())
                }
                
                webSocket?.send(heartbeat.toString())
            }
        }
    }
    
    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = serviceScope.launch {
            delay(reconnectDelay)
            connect()
        }
    }
    
    // ==================== 消息处理 ====================
    
    private fun handleMessage(text: String) {
        serviceScope.launch {
            try {
                val message = JSONObject(text)
                val type = message.optString("type")
                
                when (type) {
                    "EXECUTE" -> handleExecuteCommand(message)
                    "SCREENSHOT" -> handleScreenshotRequest(message)
                    "PING" -> handlePing(message)
                    "COLLECT_APPS" -> handleCollectApps(message)
                    else -> Log.w(TAG, "未知消息类型: $type")
                }
            } catch (e: Exception) {
                Log.e(TAG, "处理消息失败: ${e.message}")
            }
        }
    }
    
    private suspend fun handleExecuteCommand(command: JSONObject) {
        val a11yService = AvatarAccessibilityService.instance
        
        if (a11yService == null) {
            val errorResponse = JSONObject().apply {
                put("id", command.optString("id"))
                put("success", false)
                put("error", "无障碍服务未运行")
            }
            webSocket?.send(errorResponse.toString())
            return
        }
        
        // 执行前截图
        val verification = command.optJSONObject("verification")
        var screenshotBefore: String? = null
        
        if (verification?.optBoolean("screenshotBefore", false) == true) {
            screenshotBefore = captureScreenBase64()
        }
        
        val startTime = System.currentTimeMillis()
        
        // 执行指令
        val result = a11yService.executeCommand(command)
        
        // 执行后截图
        var screenshotAfter: String? = null
        if (verification?.optBoolean("screenshotAfter", false) == true) {
            delay(200)  // 等待UI更新
            screenshotAfter = captureScreenBase64()
        }
        
        // 构建响应
        result.apply {
            put("duration", System.currentTimeMillis() - startTime)
            screenshotBefore?.let { put("screenshotBefore", it) }
            screenshotAfter?.let { put("screenshotAfter", it) }
            
            // 简单的变化检测
            if (screenshotBefore != null && screenshotAfter != null) {
                put("changeDetected", screenshotBefore != screenshotAfter)
            }
        }
        
        webSocket?.send(result.toString())
    }
    
    private fun handleScreenshotRequest(message: JSONObject) {
        serviceScope.launch {
            val screenshot = captureScreenBase64()
            
            val response = JSONObject().apply {
                put("id", message.optString("id"))
                put("type", "SCREENSHOT_RESULT")
                put("image", screenshot)
                put("timestamp", System.currentTimeMillis())
            }
            
            webSocket?.send(response.toString())
        }
    }
    
    private fun handlePing(message: JSONObject) {
        val pong = JSONObject().apply {
            put("type", "PONG")
            put("id", message.optString("id"))
            put("timestamp", System.currentTimeMillis())
        }
        
        webSocket?.send(pong.toString())
    }
    
    // ==================== 免疫遥测 ====================
    
    private fun handleCollectApps(message: JSONObject) {
        serviceScope.launch {
            Log.i(TAG, "收到应用收集请求")
            
            val telemetry = ImmuneTelemetry(applicationContext)
            val apps = telemetry.collectInstalledApps()
            val systemSummary = telemetry.getSystemResourceSummary()
            
            val response = JSONObject().apply {
                put("id", message.optString("id"))
                put("type", "APPS_COLLECTED")
                put("deviceId", deviceId)
                put("apps", apps)
                put("systemSummary", systemSummary)
                put("timestamp", System.currentTimeMillis())
            }
            
            webSocket?.send(response.toString())
            Log.i(TAG, "已发送 ${apps.length()} 个应用数据")
        }
    }
    
    // ==================== 屏幕截图 ====================
    
    private suspend fun captureScreenBase64(): String? {
        // 实际实现需要 MediaProjection API
        // 这里提供框架代码，具体实现需要在 Activity 中请求权限
        
        // TODO: 实现实际的屏幕截图逻辑
        // 1. 使用 MediaProjectionManager 获取 MediaProjection
        // 2. 创建 VirtualDisplay
        // 3. 通过 ImageReader 获取图像
        // 4. 转换为 Base64
        
        return null
    }
    
    private fun bitmapToBase64(bitmap: Bitmap): String {
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 80, outputStream)
        return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
    }
}

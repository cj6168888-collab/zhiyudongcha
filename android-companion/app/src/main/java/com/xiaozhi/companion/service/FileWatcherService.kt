package com.xiaozhi.companion.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.FileObserver
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.xiaozhi.companion.MainActivity
import com.xiaozhi.companion.R
import com.xiaozhi.companion.WebSocketManager
import com.xiaozhi.companion.model.FileDetectedPayload
import com.xiaozhi.companion.model.WsMessage
import java.io.File
import java.util.Base64

class FileWatcherService : Service() {
    private val TAG = "FileWatcherService"
    private val NOTIFICATION_ID = 1001
    
    private var fileObserver: FileObserver? = null
    private var webSocketManager: WebSocketManager? = null
    
    private val watchPaths = listOf(
        "/sdcard/Tencent/MicroMsg/",
        "/sdcard/Download/",
        "/sdcard/Documents/",
        "/sdcard/tencent/MicroMsg/"
    )
    
    private val targetExtensions = listOf(
        ".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"
    )
    
    private var isWatching = false

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createNotification())
        Log.d(TAG, "FileWatcherService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startWatching()
            ACTION_STOP -> stopWatching()
        }
        return START_STICKY
    }

    private fun startWatching() {
        if (isWatching) return
        isWatching = true
        
        watchPaths.forEach { path ->
            val dir = File(path)
            if (dir.exists() && dir.isDirectory) {
                observeDirectory(dir)
                Log.d(TAG, "Watching: $path")
            }
        }
        
        updateNotification("正在监控文件: ${watchPaths.joinToString()}")
    }

    private fun observeDirectory(directory: File) {
        val observer = object : FileObserver(directory.absolutePath, 
            CREATE or MODIFY or MOVED_TO) { // FileObserver.CREATE = 8, MODIFY = 2, MOVED_TO = 128
            override fun onEvent(event: Int, path: String?) {
                if (path == null) return
                
                val file = File(directory, path)
                if (isTargetFile(file)) {
                    Log.d(TAG, "File detected: ${file.absolutePath}")
                    processFile(file)
                }
            }
        }
        
        observer.startWatching()
        fileObserver = observer
    }

    private fun isTargetFile(file: File): Boolean {
        if (!file.isFile) return false
        val ext = file.extension.lowercase()
        return targetExtensions.contains(".$ext")
    }

    private fun processFile(file: File) {
        try {
            val source = when {
                file.absolutePath.contains("MicroMsg", ignoreCase = true) -> "wechat"
                file.absolutePath.contains("Download", ignoreCase = true) -> "download"
                else -> "other"
            }
            
            val payload = FileDetectedPayload(
                filePath = file.absolutePath,
                fileName = file.name,
                fileType = file.extension,
                fileSize = file.length(),
                source = source
            )
            
            webSocketManager?.sendMessage(WsMessage(
                type = "FILE_DETECTED",
                payload = payload
            ))
            
            // Auto upload if file is small enough (< 10MB)
            if (file.length() < 10 * 1024 * 1024) {
                uploadFile(file)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing file: ${e.message}")
        }
    }

    private fun uploadFile(file: File) {
        try {
            val bytes = file.readBytes()
            val base64 = Base64.getEncoder().encodeToString(bytes)
            
            val payload = mapOf(
                "fileName" to file.name,
                "fileType" to file.extension,
                "fileSize" to file.length(),
                "base64" to base64
            )
            
            webSocketManager?.sendMessage(WsMessage(
                type = "FILE_UPLOAD",
                payload = payload
            ))
            
            Log.d(TAG, "File uploaded: ${file.name}")
        } catch (e: Exception) {
            Log.e(TAG, "Error uploading file: ${e.message}")
        }
    }

    private fun stopWatching() {
        isWatching = false
        fileObserver?.stopWatching()
        fileObserver = null
        updateNotification("文件监控已停止")
    }

    private fun createNotification(): Notification {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "文件监控服务",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "小智助手文件监控服务"
        }
        
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("小智助手")
            .setContentText("正在监控文件...")
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("小智助手")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
        
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopWatching()
        super.onDestroy()
    }

    companion object {
        const val ACTION_START = "com.xiaozhi.companion.START_WATCHING"
        const val ACTION_STOP = "com.xiaozhi.companion.STOP_WATCHING"
        const val ACTION_SET_WS = "com.xiaozhi.companion.SET_WS"
        const val EXTRA_WS = "ws_manager"
        private const val CHANNEL_ID = "file_watcher_channel"
    }
}

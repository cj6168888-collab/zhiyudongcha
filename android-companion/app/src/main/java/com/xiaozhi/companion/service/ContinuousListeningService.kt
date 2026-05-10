package com.xiaozhi.companion.service

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.xiaozhi.companion.ui.AudioVizBridge
import com.xiaozhi.companion.cache.CacheManager
import com.xiaozhi.companion.MainActivity
import com.xiaozhi.companion.R
import com.xiaozhi.companion.model.WsMessage
import java.util.concurrent.atomic.AtomicBoolean

class ContinuousListeningService : Service() {
    private val TAG = "ContinuousListening"
    private val NOTIFICATION_ID = 2001
    private val CHANNEL_ID = "continuous_listening_channel"
    
    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private val isRecordingFlag = AtomicBoolean(false)
    
    private var webSocketManager: com.xiaozhi.companion.WebSocketManager? = null
    private var voiceCallback: ((ByteArray) -> Unit)? = null
    
    private val mainHandler = Handler(Looper.getMainLooper())
    private var energyCallback: ((Float) -> Unit)? = null
    
    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private var bufferSize = 0
    
    private var vadThreshold = 0.02f
    private var silenceCount = 0
    private val maxSilenceFrames = 30
    
    companion object {
        var instance: ContinuousListeningService? = null
            private set
        
        const val ACTION_START = "com.xiaozhi.companion.START_LISTENING"
        const val ACTION_STOP = "com.xiaozhi.companion.STOP_LISTENING"
        const val ACTION_SET_WS = "com.xiaozhi.companion.SET_WS_MANAGER"
    }
    
    init {
        instance = this
    }
    
    override fun onCreate() {
        super.onCreate()
        initAudioRecord()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification("正在持续监听..."))
        Log.d(TAG, "ContinuousListeningService created")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startListening()
            ACTION_STOP -> stopListening()
            ACTION_SET_WS -> {
                // WebSocket manager would be passed via other means
            }
        }
        return START_STICKY
    }
    
    private fun initAudioRecord() {
        bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "Invalid buffer size")
            bufferSize = 4096
        }
        
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                bufferSize * 2
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "No permission to record audio")
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "持续语音监听",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "小智助手持续监听语音命令"
                setSound(null, null)
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("小智助手")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
    
    private fun updateNotification(text: String) {
        val notification = createNotification(text)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }
    
    fun setWebSocketManager(ws: com.xiaozhi.companion.WebSocketManager?) {
        webSocketManager = ws
    }
    
    fun startListening() {
        if (isRecordingFlag.getAndSet(true)) {
            Log.d(TAG, "Already recording")
            return
        }
        
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "No audio permission")
            webSocketManager?.sendMessage(WsMessage(
                type = "LISTENING_ERROR",
                payload = mapOf("error" to "No audio permission")
            ))
            return
        }
        
        try {
            audioRecord?.startRecording()
            isRecording = true
            
            Thread {
                val buffer = ByteArray(bufferSize)
                val shortBuffer = ShortArray(bufferSize / 2)
                
                while (isRecordingFlag.get()) {
                    val readResult = audioRecord?.read(shortBuffer, 0, shortBuffer.size) ?: -1
                    
                    if (readResult > 0) {
                        val energy = calculateEnergy(shortBuffer, readResult)
                        
                        mainHandler.post {
                            energyCallback?.invoke(energy)
                        }
                        // Cache latest energy value locally
                        try {
                            CacheManager.put("last_energy", energy.toString())
                        } catch (_: Throwable) {
                        }
                        // 传给可视化组件（简单波形显示）
                        val waveformCopy = shortBuffer.copyOf(readResult)
                        AudioVizBridge.postWaveform(waveformCopy)
                        
                        if (energy > vadThreshold) {
                            silenceCount = 0
                            
                            // Convert to byte array and send
                            for (i in 0 until readResult) {
                                val bytes = ByteArray(2)
                                bytes[0] = (shortBuffer[i].toInt() and 0xFF).toByte()
                                bytes[1] = (shortBuffer[i].toInt() shr 8 and 0xFF).toByte()
                                buffer[i * 2] = bytes[0]
                                buffer[i * 2 + 1] = bytes[1]
                            }
                            
                            voiceCallback?.invoke(buffer.copyOf(readResult * 2))
                            
                            // Send to server for processing
                            sendAudioToServer(buffer.copyOf(readResult * 2))
                        } else {
                            silenceCount++
                            if (silenceCount == 1) {
                                mainHandler.post {
                                    updateNotification("检测到语音...")
                                }
                            }
                        }
                        
                        if (silenceCount > maxSilenceFrames && silenceCount == maxSilenceFrames + 1) {
                            mainHandler.post {
                                updateNotification("持续监听中...")
                            }
                        }
                    }
                    
                    Thread.sleep(10)
                }
            }.start()
            
            updateNotification("正在监听语音命令")
            Log.d(TAG, "Started continuous listening")
            
            webSocketManager?.sendMessage(WsMessage(
                type = "LISTENING_STATUS",
                payload = mapOf("status" to "started")
            ))
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording: ${e.message}")
            isRecordingFlag.set(false)
        }
    }
    
    fun stopListening() {
        isRecordingFlag.set(false)
        isRecording = false
        
        try {
            audioRecord?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording: ${e.message}")
        }
        
        updateNotification("监听已停止")
        Log.d(TAG, "Stopped continuous listening")
        
        webSocketManager?.sendMessage(WsMessage(
            type = "LISTENING_STATUS",
            payload = mapOf("status" to "stopped")
        ))
    }
    
    private fun calculateEnergy(buffer: ShortArray, readSize: Int): Float {
        var sum = 0.0
        for (i in 0 until readSize) {
            sum += buffer[i].toDouble() * buffer[i].toDouble()
        }
        return (sum / readSize).toFloat().let { kotlin.math.sqrt(it) } / 32768f
    }
    
    private fun sendAudioToServer(audioData: ByteArray) {
        val base64 = android.util.Base64.encodeToString(audioData, android.util.Base64.NO_WRAP)
        
        webSocketManager?.sendMessage(WsMessage(
            type = "AUDIO_STREAM",
            payload = mapOf(
                "audio" to base64,
                "sampleRate" to sampleRate,
                "timestamp" to System.currentTimeMillis()
            )
        ))
    }
    
    fun setVoiceCallback(callback: (ByteArray) -> Unit) {
        voiceCallback = callback
    }
    
    fun setEnergyCallback(callback: (Float) -> Unit) {
        energyCallback = callback
    }
    
    fun setVadThreshold(threshold: Float) {
        vadThreshold = threshold
    }
    
    fun isListening(): Boolean = isRecordingFlag.get()
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        stopListening()
        audioRecord?.release()
        audioRecord = null
        super.onDestroy()
    }
}

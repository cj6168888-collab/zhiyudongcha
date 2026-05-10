package com.xiaozhi.network

import android.content.Context
import android.util.Base64
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object NetworkManager {
    
    private const val BASE_URL_DEBUG = "http://10.0.2.2:5000"  // Android emulator localhost
    private const val BASE_URL_PROD = "https://your-domain.replit.app"
    private const val WS_URL_DEBUG = "ws://10.0.2.2:5000/ws/mobile"
    private const val WS_URL_PROD = "wss://your-domain.replit.app/ws/mobile"
    
    private val isDebug = true  // BuildConfig.DEBUG
    
    val baseUrl: String get() = if (isDebug) BASE_URL_DEBUG else BASE_URL_PROD
    private val wsUrl: String get() = if (isDebug) WS_URL_DEBUG else WS_URL_PROD
    
    private lateinit var client: OkHttpClient
    private var webSocket: WebSocket? = null
    private lateinit var deviceId: String
    
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected
    
    private val _connectionError = MutableStateFlow<String?>(null)
    val connectionError: StateFlow<String?> = _connectionError
    
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pingJob: Job? = null
    
    var onASRResult: ((String, Boolean) -> Unit)? = null
    var onASRInterim: ((String) -> Unit)? = null
    var onAIReplyChunk: ((String, Boolean) -> Unit)? = null
    var onReminder: ((String, String) -> Unit)? = null
    var onSyncRequired: (() -> Unit)? = null
    
    fun initialize(context: Context) {
        deviceId = DeviceManager.getDeviceId(context)
        
        client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .pingInterval(30, TimeUnit.SECONDS)
            .build()
    }
    
    fun connect() {
        val url = "$wsUrl?deviceId=$deviceId&role=MASTER&platform=Android"
        val request = Request.Builder().url(url).build()
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _isConnected.value = true
                _connectionError.value = null
                startPingTimer()
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }
            
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                _isConnected.value = false
                stopPingTimer()
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _isConnected.value = false
                _connectionError.value = t.message
                stopPingTimer()
                
                scope.launch {
                    delay(5000)
                    connect()
                }
            }
        })
    }
    
    fun disconnect() {
        webSocket?.close(1000, "User disconnect")
        webSocket = null
        _isConnected.value = false
        stopPingTimer()
    }
    
    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.optString("type")
            
            when (type) {
                "pong" -> { }
                "asr_result" -> {
                    val resultText = json.optString("text")
                    val isFinal = json.optBoolean("isFinal", true)
                    onASRResult?.invoke(resultText, isFinal)
                }
                "asr_interim" -> {
                    val interimText = json.optString("text")
                    onASRInterim?.invoke(interimText)
                }
                "ai_reply_chunk" -> {
                    val chunkText = json.optString("text")
                    val isFinal = json.optBoolean("isFinal", false)
                    onAIReplyChunk?.invoke(chunkText, isFinal)
                }
                "reminder" -> {
                    val data = json.optJSONObject("data")
                    val title = data?.optString("title") ?: "提醒"
                    val body = data?.optString("body") ?: ""
                    onReminder?.invoke(title, body)
                }
                "sync_required" -> {
                    onSyncRequired?.invoke()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    fun send(message: JSONObject) {
        webSocket?.send(message.toString())
    }
    
    fun sendAudioChunk(audioData: ByteArray, sequence: Int, isFinal: Boolean) {
        val message = JSONObject().apply {
            put("type", "audio_chunk")
            put("data", Base64.encodeToString(audioData, Base64.NO_WRAP))
            put("sequence", sequence)
            put("final", isFinal)
        }
        send(message)
    }
    
    fun startASR() {
        send(JSONObject().apply {
            put("type", "asr_start")
            put("format", "pcm")
            put("sampleRate", 16000)
        })
    }
    
    fun stopASR() {
        send(JSONObject().apply { put("type", "asr_stop") })
    }
    
    private fun startPingTimer() {
        pingJob = scope.launch {
            while (isActive) {
                delay(30_000)
                send(JSONObject().apply { put("type", "ping") })
            }
        }
    }
    
    private fun stopPingTimer() {
        pingJob?.cancel()
        pingJob = null
    }
    
    suspend fun <T> request(
        endpoint: String,
        method: String = "GET",
        body: JSONObject? = null,
        parser: (String) -> T
    ): Result<T> = withContext(Dispatchers.IO) {
        try {
            val requestBuilder = Request.Builder()
                .url("$baseUrl$endpoint")
                .header("Content-Type", "application/json")
                .header("X-User-Role", "MASTER")
                .header("X-Device-Id", deviceId)
                .header("X-Platform", "Android")
                .header("X-App-Version", "1.0.0")
            
            when (method) {
                "POST" -> {
                    val requestBody = (body?.toString() ?: "{}").toRequestBody("application/json".toMediaType())
                    requestBuilder.post(requestBody)
                }
                "PUT" -> {
                    val requestBody = (body?.toString() ?: "{}").toRequestBody("application/json".toMediaType())
                    requestBuilder.put(requestBody)
                }
                "DELETE" -> requestBuilder.delete()
            }
            
            val response = client.newCall(requestBuilder.build()).execute()
            val responseBody = response.body?.string() ?: ""
            
            if (response.isSuccessful) {
                Result.success(parser(responseBody))
            } else {
                val error = try {
                    JSONObject(responseBody).optString("error", "请求失败")
                } catch (e: Exception) {
                    "请求失败: ${response.code}"
                }
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun chat(message: String, sessionId: String? = null): Result<ChatResponse> {
        val body = JSONObject().apply {
            put("message", message)
            sessionId?.let { put("sessionId", it) }
        }
        
        return request("/api/conversation/chat", "POST", body) { responseText ->
            val json = JSONObject(responseText)
            ChatResponse(
                reply = json.optString("reply"),
                sessionId = json.optString("sessionId"),
                intent = json.optString("intent"),
                confidence = json.optDouble("confidence", 0.0)
            )
        }
    }
}

data class ChatResponse(
    val reply: String,
    val sessionId: String,
    val intent: String?,
    val confidence: Double
)

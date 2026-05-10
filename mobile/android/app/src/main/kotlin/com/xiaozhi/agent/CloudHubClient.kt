package com.xiaozhi.agent

import android.content.Context
import android.os.Build
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * 云端连接客户端 - 小星手机端Agent核心组件
 *
 * 功能：
 * - 连接到小星服务器
 * - 接收服务器指令
 * - 上报设备状态和程序列表
 * - 心跳保活
 * - 自动重连
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class CloudHubClient(private val context: Context) {

    companion object {
        private const val TAG = "CloudHubClient"

        // 默认配置
        private const val DEFAULT_WS_URL = "wss://api.xiaozhi.app/ws/device"
        private const val DEFAULT_HTTP_URL = "https://api.xiaozhi.app"

        // 重连配置
        private const val INITIAL_RECONNECT_DELAY = 1000L
        private const val MAX_RECONNECT_DELAY = 30000L
        private const val HEARTBEAT_INTERVAL = 30000L

        // 超时配置
        private const val CONNECT_TIMEOUT = 30L
        private const val READ_TIMEOUT = 60L
        private const val WRITE_TIMEOUT = 60L
    }

    // 连接状态
    sealed class ConnectionState {
        data object Disconnected : ConnectionState()
        data object Connecting : ConnectionState()
        data object Connected : ConnectionState()
        data class Error(val message: String) : ConnectionState()
        data object Reconnecting : ConnectionState()
    }

    // 状态Flow
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState

    // 消息回调
    var onCommandReceived: ((String, JSONObject) -> Unit)? = null
    var onTaskReceived: ((JSONObject) -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    // 内部状态
    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var reconnectDelay = INITIAL_RECONNECT_DELAY

    // 配置
    private var serverUrl: String = DEFAULT_WS_URL
    private var httpUrl: String = DEFAULT_HTTP_URL
    private var deviceId: String = ""
    private var deviceToken: String = ""
    private var deviceName: String = Build.MODEL

    // OkHttp client
    private val client = OkHttpClient.Builder()
        .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
        .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
        .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
        .pingInterval(HEARTBEAT_INTERVAL, TimeUnit.MILLISECONDS)
        .build()

    // 待发送队列
    private val messageQueue = ArrayDeque<JSONObject>()

    /**
     * 初始化
     */
    fun initialize(
        serverUrl: String = DEFAULT_WS_URL,
        httpUrl: String = DEFAULT_HTTP_URL,
        deviceId: String,
        deviceToken: String = "",
        deviceName: String = Build.MODEL
    ) {
        this.serverUrl = serverUrl
        this.httpUrl = httpUrl
        this.deviceId = deviceId
        this.deviceToken = deviceToken
        this.deviceName = deviceName

        Log.i(TAG, "CloudHubClient initialized for device: $deviceId")
    }

    /**
     * 连接服务器
     */
    fun connect() {
        if (_connectionState.value is ConnectionState.Connected ||
            _connectionState.value is ConnectionState.Connecting) {
            Log.w(TAG, "Already connected or connecting")
            return
        }

        scope.launch {
            doConnect()
        }
    }

    /**
     * 执行连接
     */
    private suspend fun doConnect() {
        _connectionState.value = ConnectionState.Connecting
        Log.i(TAG, "Connecting to $serverUrl...")

        try {
            val request = Request.Builder()
                .url(buildWsUrl())
                .addHeader("X-Device-Id", deviceId)
                .addHeader("X-Device-Token", deviceToken)
                .addHeader("X-Device-Name", deviceName)
                .addHeader("X-Platform", "Android")
                .addHeader("X-OS-Version", Build.VERSION.RELEASE)
                .build()

            webSocket = client.newWebSocket(request, createWebSocketListener())

        } catch (e: Exception) {
            Log.e(TAG, "Connection failed", e)
            _connectionState.value = ConnectionState.Error(e.message ?: "Connection failed")
            scheduleReconnect()
        }
    }

    /**
     * 构建WebSocket URL
     */
    private fun buildWsUrl(): String {
        val urlBuilder = StringBuilder(serverUrl)
        urlBuilder.append("?deviceId=$deviceId")
        urlBuilder.append("&deviceName=${java.net.URLEncoder.encode(deviceName, "UTF-8")}")
        urlBuilder.append("&platform=Android")
        urlBuilder.append("&osVersion=${Build.VERSION.RELEASE}")
        return urlBuilder.toString()
    }

    /**
     * 创建WebSocket监听器
     */
    private fun createWebSocketListener() = object : WebSocketListener() {

        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.i(TAG, "WebSocket connected")
            _connectionState.value = ConnectionState.Connected
            reconnectDelay = INITIAL_RECONNECT_DELAY

            // 启动心跳
            startHeartbeat()

            // 发送设备信息
            sendDeviceInfo()

            // 发送队列中的消息
            flushMessageQueue()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            handleMessage(text)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            Log.w(TAG, "WebSocket closing: $code - $reason")
            webSocket.close(code, reason)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Log.i(TAG, "WebSocket closed: $code - $reason")
            _connectionState.value = ConnectionState.Disconnected
            stopHeartbeat()

            if (code != 1000) { // 非正常关闭
                scheduleReconnect()
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure", t)
            _connectionState.value = ConnectionState.Error(t.message ?: "Connection failed")
            stopHeartbeat()
            scheduleReconnect()
        }
    }

    /**
     * 处理收到的消息
     */
    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.optString("type")

            Log.d(TAG, "Received message: type=$type")

            when (type) {
                "pong" -> {
                    // 心跳响应
                }

                "command" -> {
                    // 收到指令
                    val command = json.optString("command")
                    onCommandReceived?.invoke(command, json)
                }

                "task" -> {
                    // 收到任务
                    onTaskReceived?.invoke(json)
                }

                "action:execute" -> {
                    // 执行动作
                    val action = json.optString("action")
                    val params = json.optJSONObject("parameters") ?: JSONObject()
                    onCommandReceived?.invoke(action, params)
                }

                "sync:request" -> {
                    // 服务器请求同步
                    sendDeviceInfo()
                }

                "config:update" -> {
                    // 配置更新
                    handleConfigUpdate(json)
                }

                else -> {
                    Log.w(TAG, "Unknown message type: $type")
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse message: $text", e)
        }
    }

    /**
     * 处理配置更新
     */
    private fun handleConfigUpdate(json: JSONObject) {
        val config = json.optJSONObject("config")
        if (config != null) {
            // 可以更新本地配置
            Log.i(TAG, "Received config update")
        }
    }

    /**
     * 发送消息
     */
    fun send(type: String, data: JSONObject = JSONObject()) {
        val message = JSONObject().apply {
            put("type", type)
            put("deviceId", deviceId)
            put("timestamp", System.currentTimeMillis())
            for (key in data.keys()) {
                put(key, data[key])
            }
        }

        if (_connectionState.value is ConnectionState.Connected) {
            sendMessage(message)
        } else {
            // 加入队列
            messageQueue.addLast(message)
            Log.w(TAG, "Message queued (not connected): $type")
        }
    }

    /**
     * 发送消息到服务器
     */
    private fun sendMessage(message: JSONObject): Boolean {
        return try {
            val sent = webSocket?.send(message.toString()) ?: false
            if (!sent) {
                messageQueue.addLast(message)
            }
            sent
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send message", e)
            messageQueue.addLast(message)
            false
        }
    }

    /**
     * 刷新消息队列
     */
    private fun flushMessageQueue() {
        while (messageQueue.isNotEmpty()) {
            val message = messageQueue.removeFirst()
            sendMessage(message)
        }
    }

    /**
     * 发送心跳
     */
    private fun startHeartbeat() {
        stopHeartbeat()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(HEARTBEAT_INTERVAL)
                send("ping")
            }
        }
    }

    /**
     * 停止心跳
     */
    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    /**
     * 计划重连
     */
    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(reconnectDelay)
            Log.i(TAG, "Attempting to reconnect...")
            _connectionState.value = ConnectionState.Reconnecting
            doConnect()

            // 指数退避
            reconnectDelay = minOf(reconnectDelay * 2, MAX_RECONNECT_DELAY)
        }
    }

    /**
     * 发送设备信息
     */
    fun sendDeviceInfo() {
        val info = JSONObject().apply {
            put("deviceId", deviceId)
            put("deviceName", deviceName)
            put("platform", "Android")
            put("osVersion", Build.VERSION.RELEASE)
            put("sdkVersion", Build.VERSION.SDK_INT)
            put("manufacturer", Build.MANUFACTURER)
            put("model", Build.MODEL)
            put("timestamp", System.currentTimeMillis())
        }
        send("device:info", info)
    }

    /**
     * 上报程序列表
     */
    fun reportInstalledApps(apps: List<org.json.JSONObject>) {
        val data = JSONObject().apply {
            put("deviceId", deviceId)
            put("apps", JSONArray(apps.toList()))
            put("timestamp", System.currentTimeMillis())
        }
        send("device:apps", data)
    }

    /**
     * 上报执行结果
     */
    fun reportExecutionResult(
        commandId: String,
        success: Boolean,
        result: Any? = null,
        error: String? = null
    ) {
        val data = JSONObject().apply {
            put("commandId", commandId)
            put("success", success)
            put("timestamp", System.currentTimeMillis())
            result?.let { put("result", it.toString()) }
            error?.let { put("error", it) }
        }
        send("command:result", data)
    }

    /**
     * 上报资源状态
     */
    fun reportResourceStatus(
        battery: Int? = null,
        memory: Long? = null,
        storage: Long? = null,
        networkType: String? = null
    ) {
        val data = JSONObject().apply {
            put("timestamp", System.currentTimeMillis())
            battery?.let { put("battery", it) }
            memory?.let { put("memory", it) }
            storage?.let { put("storage", it) }
            networkType?.let { put("networkType", it) }
        }
        send("device:status", data)
    }

    /**
     * 断开连接
     */
    fun disconnect() {
        reconnectJob?.cancel()
        stopHeartbeat()
        webSocket?.close(1000, "User disconnect")
        webSocket = null
        _connectionState.value = ConnectionState.Disconnected
        Log.i(TAG, "Disconnected")
    }

    /**
     * 是否已连接
     */
    fun isConnected(): Boolean = _connectionState.value is ConnectionState.Connected

    /**
     * 清理资源
     */
    fun release() {
        disconnect()
        scope.cancel()
    }
}

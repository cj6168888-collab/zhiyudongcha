package com.xiaozhi.companion

import android.util.Log
import com.google.gson.Gson
import com.xiaozhi.companion.model.*
import kotlinx.coroutines.*
import okhttp3.*
import java.util.concurrent.TimeUnit

class WebSocketManager(
    private val serverUrl: String,
    private var deviceId: String,
    private var authToken: String = "",
    private val onMessage: (String, Any) -> Unit,
    private val onStatusChange: (Boolean) -> Unit
) {
    private val TAG = "WebSocketManager"
    private val gson = Gson()
    
    private var ws: WebSocket? = null
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 10
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private var isConnected = false
    private var pendingMessages = mutableListOf<WsMessage>()

    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    fun connect() {
        val request = Request.Builder()
            .url(serverUrl)
            .build()

        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connected")
                isConnected = true
                reconnectAttempts = 0
                onStatusChange(true)
                
                // Send connect message
                sendMessage(WsMessage(
                    type = "CONNECT",
                    payload = ConnectPayload(deviceId = deviceId)
                ))
                
                // Send auth if we have token
                if (authToken.isNotEmpty()) {
                    authenticate(authToken)
                }
                
                // Send pending messages
                flushPendingMessages()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val message = gson.fromJson(text, WsMessage::class.java)
                    Log.d(TAG, "Received: ${message.type}")
                    
                    when (message.type) {
                        "AUTH_RESPONSE" -> handleAuthResponse(message.payload)
                        "ACTION" -> onMessage("ACTION", message.payload)
                        "ACTION_RESPONSE" -> onMessage("ACTION_RESPONSE", message.payload)
                        "HEARTBEAT" -> sendMessage(WsMessage(
                            type = "HEARTBEAT",
                            payload = mapOf("timestamp" to System.currentTimeMillis())
                        ))
                        "ERROR" -> Log.e(TAG, "Server error: ${message.payload}")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse message: ${e.message}")
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket error: ${t.message}")
                isConnected = false
                onStatusChange(false)
                attemptReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code - $reason")
                isConnected = false
                onStatusChange(false)
            }
        })
    }

    private fun handleAuthResponse(payload: Any) {
        try {
            val map = payload as? Map<*, *>
            if (map?.get("success") == true) {
                Log.d(TAG, "Authentication successful")
            } else {
                Log.e(TAG, "Authentication failed: $payload")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle auth: ${e.message}")
        }
    }

    fun authenticate(token: String) {
        authToken = token
        sendMessage(WsMessage(
            type = "AUTHENTICATE",
            payload = AuthPayload(authToken = token)
        ))
    }

    fun sendMessage(message: WsMessage) {
        if (!isConnected) {
            pendingMessages.add(message)
            Log.d(TAG, "Message queued: ${message.type}")
            return
        }

        val json = gson.toJson(message)
        val success = ws?.send(json) ?: false
        if (!success) {
            pendingMessages.add(message)
        }
    }

    private fun flushPendingMessages() {
        val messages = pendingMessages.toList()
        pendingMessages.clear()
        messages.forEach { sendMessage(it) }
    }

    private fun attemptReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            Log.e(TAG, "Max reconnect attempts reached")
            return
        }

        reconnectAttempts++
        val delay = (reconnectAttempts * 2000L).coerceAtMost(30000L)
        
        scope.launch {
            delay(delay)
            Log.d(TAG, "Attempting reconnect ($reconnectAttempts/$maxReconnectAttempts)")
            connect()
        }
    }

    fun disconnect() {
        isConnected = false
        ws?.close(1000, "User disconnected")
        scope.cancel()
    }

    fun isConnected(): Boolean = isConnected

    fun updateDeviceId(newDeviceId: String) {
        deviceId = newDeviceId
    }

    fun updateAuthToken(newToken: String) {
        authToken = newToken
    }
}

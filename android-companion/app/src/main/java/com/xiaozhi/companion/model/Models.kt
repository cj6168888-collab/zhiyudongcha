package com.xiaozhi.companion.model

import com.google.gson.annotations.SerializedName

data class WsMessage(
    @SerializedName("type") val type: String,
    @SerializedName("payload") val payload: Any,
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis(),
    @SerializedName("messageId") val messageId: String = "msg_${System.currentTimeMillis()}_${System.nanoTime()}"
)

data class ConnectPayload(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("platform") val platform: String = "ANDROID"
)

data class AuthPayload(
    @SerializedName("authToken") val authToken: String
)

data class FileDetectedPayload(
    @SerializedName("filePath") val filePath: String? = null,
    @SerializedName("fileName") val fileName: String? = null,
    @SerializedName("fileType") val fileType: String? = null,
    @SerializedName("fileSize") val fileSize: Long = 0,
    @SerializedName("source") val source: String = "unknown"
)

data class FileUploadPayload(
    @SerializedName("fileName") val fileName: String,
    @SerializedName("fileType") val fileType: String,
    @SerializedName("fileSize") val fileSize: Long,
    @SerializedName("base64") val base64: String
)

data class NotificationPayload(
    @SerializedName("package") val packageName: String,
    @SerializedName("title") val title: String,
    @SerializedName("content") val content: String,
    @SerializedName("timestamp") val timestamp: Long
)

data class StatusPayload(
    @SerializedName("battery") val battery: Int? = null,
    @SerializedName("running") val running: Boolean? = null,
    @SerializedName("version") val version: String? = null,
    @SerializedName("accessibility") val accessibility: Boolean? = null
)

data class CommandPayload(
    @SerializedName("command") val command: Command,
    @SerializedName("messageId") val messageId: String
)

data class Command(
    @SerializedName("type") val type: String,
    @SerializedName("params") val params: Map<String, Any>? = null
)

data class ActionPayload(
    @SerializedName("action") val action: Action,
    @SerializedName("captureResult") val captureResult: Boolean = true
)

data class Action(
    @SerializedName("type") val type: String,
    @SerializedName("target") val target: ActionTarget,
    @SerializedName("params") val params: Map<String, Any>? = null,
    @SerializedName("timeout") val timeout: Int = 10000,
    @SerializedName("retryCount") val retryCount: Int = 0
)

data class ActionTarget(
    @SerializedName("type") val type: String,
    @SerializedName("value") val value: String
)

enum class MessageType {
    CONNECT,
    AUTHENTICATE,
    FILE_DETECTED,
    FILE_UPLOAD,
    NOTIFICATION,
    SCREENSHOT,
    STATUS,
    HEARTBEAT,
    ACTION,
    ACTION_RESPONSE,
    ERROR
}

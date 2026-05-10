package com.xiaozhi.companion.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import com.xiaozhi.companion.WebSocketManager
import com.xiaozhi.companion.model.Action
import com.xiaozhi.companion.model.ActionPayload
import com.xiaozhi.companion.model.ActionTarget
import com.xiaozhi.companion.model.WsMessage
import java.io.ByteArrayOutputStream
import java.util.Base64

class XiaoZhiAccessibilityService : AccessibilityService() {
    private val TAG = "XiaoZhiAccessibility"
    private val mainHandler = Handler(Looper.getMainLooper())
    
    private var webSocketManager: WebSocketManager? = null
    private var mediaProjection: MediaProjection? = null
    private var imageReader: ImageReader? = null
    
    private var isCapturing = false
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "Accessibility service connected")
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event?.let {
            Log.d(TAG, "Event: ${it.eventType}, package: ${it.packageName}")
        }
    }
    
    override fun onInterrupt() {
        Log.d(TAG, "Service interrupted")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopScreenCapture()
    }
    
    fun setWebSocketManager(ws: WebSocketManager?) {
        webSocketManager = ws
    }
    
    fun handleAction(actionPayload: ActionPayload) {
        val action = actionPayload.action
        Log.d(TAG, "Handling action: ${action.type}")
        
        when (action.type) {
            "CLICK" -> handleClick(action.target, actionPayload.captureResult)
            "LONG_CLICK" -> handleLongClick(action.target)
            "SCROLL_FORWARD" -> handleScroll(forward = true)
            "SCROLL_BACKWARD" -> handleScroll(forward = false)
            "INPUT_TEXT" -> handleInputText(action.target, action.params)
            "SWIPE" -> handleSwipe(action.params)
            "PRESS_BACK" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "PRESS_HOME" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "PRESS_RECENTS" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "OPEN_NOTIFICATIONS" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            "TAKE_SCREENSHOT" -> takeScreenshot()
            "GET_HIERARCHY" -> getViewHierarchy()
            else -> sendActionResponse(success = false, message = "Unknown action: ${action.type}")
        }
    }
    
    private fun handleClick(target: ActionTarget, captureResult: Boolean) {
        try {
            val node = findNode(target)
            if (node != null) {
                val bounds = android.graphics.Rect()
                node.getBoundsInScreen(bounds)
                
                val clickX = bounds.centerX().toFloat()
                val clickY = bounds.centerY().toFloat()
                
                val result = performClick(clickX, clickY)
                if (captureResult) {
                    takeScreenshot()
                }
                sendActionResponse(result, if (result) "Clicked at ($clickX, $clickY)" else "Click failed")
            } else {
                sendActionResponse(false, "Node not found: ${target.value}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Click error: ${e.message}")
            sendActionResponse(false, "Error: ${e.message}")
        }
    }
    
    private fun handleLongClick(target: ActionTarget) {
        try {
            val node = findNode(target)
            if (node != null) {
                val bounds = android.graphics.Rect()
                node.getBoundsInScreen(bounds)
                
                val clickX = bounds.centerX().toFloat()
                val clickY = bounds.centerY().toFloat()
                
                val result = performLongClick(clickX, clickY)
                sendActionResponse(result, if (result) "Long clicked" else "Long click failed")
            } else {
                sendActionResponse(false, "Node not found")
            }
        } catch (e: Exception) {
            sendActionResponse(false, "Error: ${e.message}")
        }
    }
    
    private fun handleScroll(forward: Boolean) {
        val result = performScroll(forward)
        sendActionResponse(result, if (result) "Scrolled" else "Scroll failed")
    }
    
    private fun handleInputText(target: ActionTarget, params: Map<String, Any>?) {
        try {
            val node = findNode(target)
            if (node != null) {
                val text = params?.get("text")?.toString() ?: ""
                
                val arguments = android.os.Bundle()
                arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
                node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                
                sendActionResponse(true, "Text input: $text")
            } else {
                sendActionResponse(false, "Input node not found")
            }
        } catch (e: Exception) {
            sendActionResponse(false, "Error: ${e.message}")
        }
    }
    
    private fun handleSwipe(params: Map<String, Any>?) {
        try {
            val direction = params?.get("direction")?.toString() ?: "up"
            val duration = (params?.get("duration")?.toString()?.toIntOrNull() ?: 300).toLong()
            
            val wm = getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
            val metrics = android.util.DisplayMetrics()
            wm.defaultDisplay.getRealMetrics(metrics)
            
            val width = metrics.widthPixels
            val height = metrics.heightPixels
            
            val (startX, startY, endX, endY) = when (direction) {
                "up" -> listOf(width / 2, height * 3 / 4, width / 2, height / 4)
                "down" -> listOf(width / 2, height / 4, width / 2, height * 3 / 4)
                "left" -> listOf(width * 3 / 4, height / 2, width / 4, height / 2)
                "right" -> listOf(width / 4, height / 2, width * 3 / 4, height / 2)
                else -> listOf(width / 2, height * 3 / 4, width / 2, height / 4)
            }
            
            val result = performSwipe(startX.toFloat(), startY.toFloat(), endX.toFloat(), endY.toFloat(), duration)
            sendActionResponse(result, if (result) "Swiped $direction" else "Swipe failed")
        } catch (e: Exception) {
            sendActionResponse(false, "Error: ${e.message}")
        }
    }
    
    private fun findNode(target: ActionTarget): AccessibilityNodeInfo? {
        val rootNode = rootInActiveWindow ?: return null
        
        return when (target.type) {
            "TEXT" -> findNodeByText(rootNode, target.value)
            "ID" -> findNodeById(rootNode, target.value)
            "DESCRIPTION" -> findNodeByDescription(rootNode, target.value)
            "CLASS" -> findNodeByClassName(rootNode, target.value)
            else -> null
        }?.also { rootNode.recycle() }
    }
    
    private fun findNodeByText(root: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        val nodes = root.findAccessibilityNodeInfosByText(text)
        return if (nodes.isNotEmpty()) {
            nodes[0]
        } else null
    }
    
    private fun findNodeById(root: AccessibilityNodeInfo, viewId: String): AccessibilityNodeInfo? {
        val nodes = root.findAccessibilityNodeInfosByViewId(viewId)
        return if (nodes.isNotEmpty()) {
            nodes[0]
        } else null
    }
    
    private fun findNodeByDescription(root: AccessibilityNodeInfo, description: String): AccessibilityNodeInfo? {
        val nodes = root.findAccessibilityNodeInfosByText(description)
        return if (nodes.isNotEmpty()) {
            nodes[0]
        } else null
    }
    
    private fun findNodeByClassName(root: AccessibilityNodeInfo, className: String): AccessibilityNodeInfo? {
        if (root.className?.toString()?.contains(className, ignoreCase = true) == true) {
            return root
        }
        
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val result = findNodeByClassName(child, className)
            if (result != null) return result
        }
        return null
    }
    
    private fun performClick(x: Float, y: Float): Boolean {
        val gestureBuilder = GestureDescription.Builder()
        
        val path = android.graphics.Path()
        path.moveTo(x, y)
        
        val stroke = GestureDescription.StrokeDescription(path, 0L, 50L)
        gestureBuilder.addStroke(stroke)
        
        return dispatchGesture(gestureBuilder.build(), null, null)
    }
    
    private fun performLongClick(x: Float, y: Float): Boolean {
        val path = android.graphics.Path()
        path.moveTo(x, y)
        
        val stroke = GestureDescription.StrokeDescription(path, 0L, 1000L)
        val builder = GestureDescription.Builder()
        builder.addStroke(stroke)
        
        return dispatchGesture(builder.build(), null, null)
    }
    
    private fun performScroll(forward: Boolean): Boolean {
        val wm = getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        val metrics = android.util.DisplayMetrics()
        wm.defaultDisplay.getRealMetrics(metrics)
        
        val startY = if (forward) metrics.heightPixels * 3 / 4 else metrics.heightPixels / 4
        val endY = if (forward) metrics.heightPixels / 4 else metrics.heightPixels * 3 / 4
        
        val path = android.graphics.Path()
        path.moveTo(metrics.widthPixels / 2f, startY.toFloat())
        path.lineTo(metrics.widthPixels / 2f, endY.toFloat())
        
        val stroke = GestureDescription.StrokeDescription(path, 0L, 300L)
        val builder = GestureDescription.Builder()
        builder.addStroke(stroke)
        
        return dispatchGesture(builder.build(), null, null)
    }
    
    private fun performSwipe(
        startX: Float, startY: Float,
        endX: Float, endY: Float,
        duration: Long
    ): Boolean {
        val path = android.graphics.Path()
        path.moveTo(startX, startY)
        path.lineTo(endX, endY)
        
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        val builder = GestureDescription.Builder()
        builder.addStroke(stroke)
        
        return dispatchGesture(builder.build(), null, null)
    }
    
    private fun takeScreenshot() {
        if (isCapturing) return
        isCapturing = true
        
        try {
            val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val intent = projectionManager.createScreenCaptureIntent()
            
            mediaProjection = projectionManager.getMediaProjection(Activity.RESULT_OK, intent)
            
            val wm = getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
            val metrics = android.util.DisplayMetrics()
            wm.defaultDisplay.getRealMetrics(metrics)
            
            imageReader = ImageReader.newInstance(
                metrics.widthPixels,
                metrics.heightPixels,
                PixelFormat.RGBA_8888,
                2
            )
            
            val surface = imageReader?.surface
            
            mediaProjection?.let { projection ->
                projection.createVirtualDisplay(
                    "XiaoZhiCapture",
                    metrics.widthPixels,
                    metrics.heightPixels,
                    metrics.densityDpi,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    surface,
                    null,
                    null
                )
            }
            
            imageReader?.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                image?.let {
                    val buffer = it.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    
                    val bitmap = android.graphics.Bitmap.createBitmap(
                        metrics.widthPixels,
                        metrics.heightPixels,
                        Bitmap.Config.ARGB_8888
                    )
                    bitmap.copyPixelsFromBuffer(buffer)
                    
                    val outputStream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
                    val base64 = Base64.getEncoder().encodeToString(outputStream.toByteArray())
                    
                    val payload = mapOf(
                        "image" to base64,
                        "width" to metrics.widthPixels,
                        "height" to metrics.heightPixels
                    )
                    
                    webSocketManager?.sendMessage(WsMessage(
                        type = "SCREENSHOT",
                        payload = payload
                    ))
                    
                    it.close()
                    bitmap.recycle()
                }
                isCapturing = false
            }, mainHandler)
            
        } catch (e: Exception) {
            Log.e(TAG, "Screenshot error: ${e.message}")
            isCapturing = false
        }
    }
    
    private fun stopScreenCapture() {
        try {
            mediaProjection?.stop()
            imageReader?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Stop capture error: ${e.message}")
        }
    }
    
    private fun getViewHierarchy() {
        try {
            val rootNode = rootInActiveWindow ?: run {
                sendActionResponse(false, "No active window")
                return
            }
            
            val hierarchy = buildHierarchyJson(rootNode)
            rootNode.recycle()
            
            webSocketManager?.sendMessage(WsMessage(
                type = "VIEW_HIERARCHY",
                payload = mapOf("hierarchy" to hierarchy)
            ))
            
            sendActionResponse(true, "Hierarchy captured")
        } catch (e: Exception) {
            Log.e(TAG, "Hierarchy error: ${e.message}")
            sendActionResponse(false, "Error: ${e.message}")
        }
    }
    
    private fun buildHierarchyJson(node: AccessibilityNodeInfo): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        
        result["class"] = node.className?.toString()
        result["resourceId"] = node.viewIdResourceName
        result["text"] = node.text?.toString()
        result["contentDescription"] = node.contentDescription?.toString()
        result["enabled"] = node.isEnabled
        result["focused"] = node.isFocused
        result["clickable"] = node.isClickable
        result["scrollable"] = node.isScrollable
        
        val bounds = android.graphics.Rect()
        node.getBoundsInScreen(bounds)
        result["bounds"] = mapOf("left" to bounds.left, "top" to bounds.top, "right" to bounds.right, "bottom" to bounds.bottom)
        
        val children = mutableListOf<Map<String, Any?>>()
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { child ->
                children.add(buildHierarchyJson(child))
                child.recycle()
            }
        }
        if (children.isNotEmpty()) {
            result["children"] = children
        }
        
        return result
    }
    
    private fun sendActionResponse(success: Boolean, message: String) {
        val payload = mapOf(
            "success" to success,
            "message" to message,
            "timestamp" to System.currentTimeMillis()
        )
        
        webSocketManager?.sendMessage(WsMessage(
            type = "ACTION_RESPONSE",
            payload = payload
        ))
    }
    
    companion object {
        var instance: XiaoZhiAccessibilityService? = null
            private set
    }
    
    init {
        instance = this
    }
}

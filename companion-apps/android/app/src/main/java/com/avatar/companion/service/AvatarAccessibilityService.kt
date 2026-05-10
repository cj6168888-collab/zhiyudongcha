package com.avatar.companion.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.PixelFormat
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.coroutines.*
import org.json.JSONObject
import kotlin.random.Random

/**
 * 小智无障碍服务 - AccessibilityService 核心实现
 * 
 * 功能：
 * 1. 执行点击、滑动、输入等操作
 * 2. 人类行为模拟（随机偏移、自然延迟）
 * 3. 查找屏幕元素
 * 4. 与 WebSocket 服务通信
 */
class AvatarAccessibilityService : AccessibilityService() {
    
    companion object {
        private const val TAG = "AvatarA11y"
        
        @Volatile
        var instance: AvatarAccessibilityService? = null
            private set
        
        fun isRunning(): Boolean = instance != null
    }
    
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "无障碍服务已连接")
        
        // 启动 WebSocket 服务
        startService(Intent(this, WebSocketService::class.java))
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // 可以在此监听屏幕事件，用于状态感知
    }
    
    override fun onInterrupt() {
        Log.w(TAG, "无障碍服务被中断")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        instance = null
        serviceScope.cancel()
        Log.i(TAG, "无障碍服务已销毁")
    }
    
    // ==================== 动作执行 ====================
    
    /**
     * 执行点击操作
     * @param x X坐标
     * @param y Y坐标
     * @param jitterX X方向随机偏移
     * @param jitterY Y方向随机偏移
     * @param delay 点击前延迟(ms)
     */
    suspend fun performTap(
        x: Float,
        y: Float,
        jitterX: Int = 0,
        jitterY: Int = 0,
        delay: Long = 0
    ): Boolean = withContext(Dispatchers.Main) {
        if (delay > 0) {
            delay(delay)
        }
        
        val actualX = x + Random.nextInt(-jitterX, jitterX + 1)
        val actualY = y + Random.nextInt(-jitterY, jitterY + 1)
        
        Log.d(TAG, "执行点击: ($x, $y) -> ($actualX, $actualY)")
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val path = Path().apply {
                moveTo(actualX, actualY)
            }
            
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
                .build()
            
            val result = CompletableDeferred<Boolean>()
            
            dispatchGesture(gesture, object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    result.complete(true)
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    result.complete(false)
                }
            }, null)
            
            result.await()
        } else {
            // Android N 以下使用 performGlobalAction
            false
        }
    }
    
    /**
     * 执行滑动操作
     */
    suspend fun performSwipe(
        startX: Float,
        startY: Float,
        endX: Float,
        endY: Float,
        duration: Long = 300,
        jitter: Int = 0
    ): Boolean = withContext(Dispatchers.Main) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val actualStartX = startX + Random.nextInt(-jitter, jitter + 1)
            val actualStartY = startY + Random.nextInt(-jitter, jitter + 1)
            val actualEndX = endX + Random.nextInt(-jitter, jitter + 1)
            val actualEndY = endY + Random.nextInt(-jitter, jitter + 1)
            
            // 使用贝塞尔曲线模拟自然滑动
            val path = Path().apply {
                moveTo(actualStartX, actualStartY)
                
                // 添加控制点使曲线更自然
                val ctrlX = (actualStartX + actualEndX) / 2 + Random.nextInt(-20, 21)
                val ctrlY = (actualStartY + actualEndY) / 2 + Random.nextInt(-20, 21)
                quadTo(ctrlX, ctrlY, actualEndX, actualEndY)
            }
            
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, duration))
                .build()
            
            val result = CompletableDeferred<Boolean>()
            
            dispatchGesture(gesture, object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    result.complete(true)
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    result.complete(false)
                }
            }, null)
            
            result.await()
        } else {
            false
        }
    }
    
    /**
     * 执行文本输入
     */
    suspend fun performInput(
        text: String,
        typeSpeed: Int = 8,  // 字符/秒
        variance: Int = 2
    ): Boolean = withContext(Dispatchers.Main) {
        val focusedNode = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        
        if (focusedNode == null) {
            Log.w(TAG, "未找到焦点输入框")
            return@withContext false
        }
        
        try {
            // 模拟人类打字速度
            val charDelay = 1000L / typeSpeed
            
            for (char in text) {
                val actualDelay = charDelay + Random.nextLong(-variance * 50L, variance * 50L + 1)
                delay(actualDelay.coerceAtLeast(20))
                
                val arguments = Bundle().apply {
                    putCharSequence(
                        AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        focusedNode.text?.toString().orEmpty() + char
                    )
                }
                focusedNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "输入失败: ${e.message}")
            false
        } finally {
            focusedNode.recycle()
        }
    }
    
    /**
     * 执行长按操作
     */
    suspend fun performLongPress(
        x: Float,
        y: Float,
        duration: Long = 500,
        jitter: Int = 0
    ): Boolean = withContext(Dispatchers.Main) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val actualX = x + Random.nextInt(-jitter, jitter + 1)
            val actualY = y + Random.nextInt(-jitter, jitter + 1)
            
            val path = Path().apply {
                moveTo(actualX, actualY)
            }
            
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, duration))
                .build()
            
            val result = CompletableDeferred<Boolean>()
            
            dispatchGesture(gesture, object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    result.complete(true)
                }
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    result.complete(false)
                }
            }, null)
            
            result.await()
        } else {
            false
        }
    }
    
    /**
     * 执行全局操作
     */
    fun performGlobal(action: Int): Boolean {
        return performGlobalAction(action)
    }
    
    // ==================== 元素查找 ====================
    
    /**
     * 通过文本查找元素
     */
    fun findNodeByText(text: String): AccessibilityNodeInfo? {
        return rootInActiveWindow?.findAccessibilityNodeInfosByText(text)?.firstOrNull()
    }
    
    /**
     * 通过 ID 查找元素
     */
    fun findNodeById(viewId: String): AccessibilityNodeInfo? {
        return rootInActiveWindow?.findAccessibilityNodeInfosByViewId(viewId)?.firstOrNull()
    }
    
    /**
     * 获取屏幕上所有可点击元素
     */
    fun getClickableNodes(): List<AccessibilityNodeInfo> {
        val result = mutableListOf<AccessibilityNodeInfo>()
        
        fun traverse(node: AccessibilityNodeInfo?) {
            node ?: return
            
            if (node.isClickable && node.isVisibleToUser) {
                result.add(node)
            }
            
            for (i in 0 until node.childCount) {
                traverse(node.getChild(i))
            }
        }
        
        traverse(rootInActiveWindow)
        return result
    }
    
    // ==================== 指令处理 ====================
    
    /**
     * 处理来自服务器的指令
     */
    suspend fun executeCommand(command: JSONObject): JSONObject {
        val action = command.getJSONObject("action")
        val type = action.getString("type")
        val humanSim = command.optJSONObject("humanSimulation")
        
        val jitter = humanSim?.optInt("positionJitter", 0) ?: 0
        val delayBase = humanSim?.optLong("delayBase", 0) ?: 0
        val delayVariance = humanSim?.optLong("delayVariance", 0) ?: 0
        val actualDelay = delayBase + Random.nextLong(-delayVariance, delayVariance + 1)
        
        val success = when (type) {
            "TAP" -> {
                val x = action.getDouble("x").toFloat()
                val y = action.getDouble("y").toFloat()
                performTap(x, y, jitter, jitter, actualDelay.coerceAtLeast(0))
            }
            "SWIPE" -> {
                val startX = action.getDouble("startX").toFloat()
                val startY = action.getDouble("startY").toFloat()
                val endX = action.getDouble("endX").toFloat()
                val endY = action.getDouble("endY").toFloat()
                val duration = action.optLong("duration", 300)
                delay(actualDelay.coerceAtLeast(0))
                performSwipe(startX, startY, endX, endY, duration, jitter)
            }
            "INPUT" -> {
                val text = action.getString("text")
                val typeSpeed = humanSim?.optInt("typeSpeed", 8) ?: 8
                val typeVariance = humanSim?.optInt("typeVariance", 2) ?: 2
                delay(actualDelay.coerceAtLeast(0))
                performInput(text, typeSpeed, typeVariance)
            }
            "LONG_PRESS" -> {
                val x = action.getDouble("x").toFloat()
                val y = action.getDouble("y").toFloat()
                val duration = action.optLong("duration", 500)
                delay(actualDelay.coerceAtLeast(0))
                performLongPress(x, y, duration, jitter)
            }
            "BACK" -> {
                delay(actualDelay.coerceAtLeast(0))
                performGlobal(GLOBAL_ACTION_BACK)
            }
            "HOME" -> {
                delay(actualDelay.coerceAtLeast(0))
                performGlobal(GLOBAL_ACTION_HOME)
            }
            "RECENTS" -> {
                delay(actualDelay.coerceAtLeast(0))
                performGlobal(GLOBAL_ACTION_RECENTS)
            }
            else -> {
                Log.w(TAG, "未知操作类型: $type")
                false
            }
        }
        
        return JSONObject().apply {
            put("id", command.getString("id"))
            put("success", success)
            put("channel", "ACCESSIBILITY")
        }
    }
}

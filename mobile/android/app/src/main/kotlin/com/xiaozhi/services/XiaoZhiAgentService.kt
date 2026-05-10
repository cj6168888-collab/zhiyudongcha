package com.xiaozhi.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.xiaozhi.agent.XiaoZhiAgent
import com.xiaozhi.network.DeviceManager
import com.xiaozhi.ui.MainActivity
import kotlinx.coroutines.*

/**
 * 小星Agent前台服务
 *
 * 功能：
 * - 保持Agent在后台运行
 * - 维持与服务器的WebSocket连接
 * - 接收并处理服务器指令
 * - 上报设备状态和程序列表
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class XiaoZhiAgentService : Service() {

    companion object {
        private const val TAG = "XiaoZhiAgentService"

        const val CHANNEL_ID = "xiaozhi_agent_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.xiaozhi.agent.START"
        const val ACTION_STOP = "com.xiaozhi.agent.STOP"
        const val ACTION_EXECUTE = "com.xiaozhi.agent.EXECUTE"
        const val ACTION_SYNC = "com.xiaozhi.agent.SYNC"

        const val EXTRA_COMMAND = "command"
        const val EXTRA_PARAMS = "params"

        /**
         * 启动服务
         */
        fun start(context: Context) {
            val intent = Intent(context, XiaoZhiAgentService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * 停止服务
         */
        fun stop(context: Context) {
            val intent = Intent(context, XiaoZhiAgentService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }

        /**
         * 执行命令
         */
        fun executeCommand(context: Context, command: String, params: Map<String, Any> = emptyMap()) {
            val intent = Intent(context, XiaoZhiAgentService::class.java).apply {
                action = ACTION_EXECUTE
                putExtra(EXTRA_COMMAND, command)
                // params 需要通过其他方式传递
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /**
         * 请求同步
         */
        fun requestSync(context: Context) {
            val intent = Intent(context, XiaoZhiAgentService::class.java).apply {
                action = ACTION_SYNC
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    // Agent实例
    private var agent: XiaoZhiAgent? = null

    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Service created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "Service started: ${intent?.action}")

        when (intent?.action) {
            ACTION_START -> {
                startForeground(NOTIFICATION_ID, createNotification())
                initializeAgent()
            }
            ACTION_STOP -> {
                stopAgent()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_EXECUTE -> {
                val command = intent.getStringExtra(EXTRA_COMMAND)
                if (command != null) {
                    executeCommand(command)
                }
            }
            ACTION_SYNC -> {
                syncData()
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.i(TAG, "Service destroyed")
        stopAgent()
        scope.cancel()
        super.onDestroy()
    }

    /**
     * 创建通知渠道
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "小星助手",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "保持小星助手在后台运行"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * 创建通知
     */
    private fun createNotification(): Notification {
        // 点击打开主界面
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 停止按钮
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, XiaoZhiAgentService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 同步按钮
        val syncIntent = PendingIntent.getService(
            this,
            2,
            Intent(this, XiaoZhiAgentService::class.java).apply { action = ACTION_SYNC },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("小星助手运行中")
            .setContentText("点击查看控制面板")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_menu_rotate, "同步", syncIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止", stopIntent)
            .build()
    }

    /**
     * 初始化Agent
     */
    private fun initializeAgent() {
        Log.i(TAG, "Initializing XiaoZhiAgent...")

        try {
            // 获取设备ID
            val deviceId = DeviceManager.getDeviceId(this)

            // 初始化Agent
            agent = XiaoZhiAgent.getInstance(this).apply {
                initialize(
                    deviceId = deviceId,
                    deviceToken = "",
                    deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
                )
            }

            // 启动Agent
            agent?.start()

            // 上报程序列表
            scope.launch {
                delay(3000) // 等待扫描完成
                agent?.reportApps()
            }

            Log.i(TAG, "XiaoZhiAgent initialized successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize agent", e)
        }
    }

    /**
     * 停止Agent
     */
    private fun stopAgent() {
        Log.i(TAG, "Stopping XiaoZhiAgent...")
        agent?.release()
        agent = null
    }

    /**
     * 执行命令
     */
    private fun executeCommand(command: String) {
        Log.i(TAG, "Executing command: $command")
        agent?.executeCommand(command)
    }

    /**
     * 同步数据
     */
    private fun syncData() {
        Log.i(TAG, "Syncing data...")
        agent?.reportApps()
    }
}

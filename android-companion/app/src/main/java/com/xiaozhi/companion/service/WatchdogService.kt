package com.xiaozhi.companion.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Process
import android.util.Log
import androidx.core.app.NotificationCompat
import com.xiaozhi.companion.MainActivity
import com.xiaozhi.companion.R

class WatchdogService : Service() {
    private val TAG = "WatchdogService"
    private val NOTIFICATION_ID = 2003
    private val CHANNEL_ID = "watchdog_channel"

    private val CHECK_INTERVAL = 5 * 60 * 1000L // 5 minutes

    private var mainServiceRunning = false

    companion object {
        const val ACTION_START = "com.xiaozhi.companion.START_WATCHDOG"
        const val ACTION_STOP = "com.xiaozhi.companion.STOP_WATCHDOG"

        fun start(context: Context) {
            val intent = Intent(context, WatchdogService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, WatchdogService::class.java).apply {
                action = ACTION_STOP
            }
            context.stopService(intent)
        }

        fun isRunning(context: Context): Boolean {
            val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            @Suppress("DEPRECATION")
            for (service in manager.getRunningServices(Integer.MAX_VALUE)) {
                if (service.service.className == WatchdogService::class.java.name) {
                    return true
                }
            }
            return false
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Log.d(TAG, "WatchdogService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startForegroundWithNotification()
                startWatchdogLoop()
                Log.d(TAG, "Watchdog service started")
            }
            ACTION_STOP -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.d(TAG, "Watchdog service stopped")
            }
        }
        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        val notification = createNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "进程守护",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "守护小智助手主服务"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("小智助手")
            .setContentText("进程守护中")
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun startWatchdogLoop() {
        Thread {
            while (true) {
                try {
                    Thread.sleep(CHECK_INTERVAL)
                    checkMainService()
                } catch (e: InterruptedException) {
                    Log.e(TAG, "Watchdog interrupted: ${e.message}")
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Watchdog error: ${e.message}")
                }
            }
        }.start()
    }

    private fun checkMainService() {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        mainServiceRunning = false

        @Suppress("DEPRECATION")
        for (service in manager.getRunningServices(Integer.MAX_VALUE)) {
            val serviceName = service.service.className
            if (serviceName == ContinuousListeningService::class.java.name ||
                serviceName == "com.xiaozhi.companion.service.XiaoZhiAccessibilityService") {
                mainServiceRunning = true
                break
            }
        }

        if (!mainServiceRunning) {
            Log.w(TAG, "Main service not running, restarting...")
            restartMainService()
        } else {
            Log.d(TAG, "Main service is running")
        }
    }

    private fun restartMainService() {
        try {
            val intent = Intent(this, ContinuousListeningService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Log.d(TAG, "Main service restarted")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restart main service: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "WatchdogService destroyed")
    }
}

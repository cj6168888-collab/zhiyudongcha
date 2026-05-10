package com.xiaozhi.companion

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.xiaozhi.companion.model.WsMessage
import com.xiaozhi.companion.model.ActionPayload
import com.xiaozhi.companion.model.Command
import com.xiaozhi.companion.service.FileWatcherService
import com.xiaozhi.companion.ui.AudioVisualizerView
import com.xiaozhi.companion.ui.AudioVizBridge
import com.xiaozhi.companion.utils.PreferencesManager
import com.xiaozhi.companion.service.NotificationWatcherService
import com.xiaozhi.companion.service.XiaoZhiAccessibilityService
import com.xiaozhi.companion.service.KeepAliveService
import com.xiaozhi.companion.service.WatchdogService
import com.xiaozhi.companion.utils.BatteryOptimization

class MainActivity : AppCompatActivity() {
    private val TAG = "MainActivity"
    
    private lateinit var statusText: TextView
    private lateinit var connectionStatusText: TextView
    private lateinit var accessibilityStatusText: TextView
    private lateinit var notificationStatusText: TextView
    private lateinit var serverUrlInput: android.widget.EditText
    private lateinit var deviceIdInput: android.widget.EditText
    private lateinit var authTokenInput: android.widget.EditText
    private lateinit var connectButton: Button
    private lateinit var startFileWatcherButton: Button
    private lateinit var stopFileWatcherButton: Button
    private lateinit var batteryOptimizationText: TextView
    private lateinit var batteryOptimizationButton: Button
    private lateinit var manufacturerSettingsButton: Button
    private lateinit var keepaliveStatusText: TextView
    private lateinit var startKeepaliveButton: Button
    
    private var webSocketManager: WebSocketManager? = null
    
    private val requiredPermissions = arrayOf(
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.POST_NOTIFICATIONS,
        Manifest.permission.FOREGROUND_SERVICE,
        Manifest.permission.MANAGE_EXTERNAL_STORAGE
    )
    
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            Toast.makeText(this, "All permissions granted", Toast.LENGTH_SHORT).show()
            checkAccessibilityService()
        } else {
            Toast.makeText(this, "Some permissions denied", Toast.LENGTH_LONG).show()
        }
    }
    
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            checkNotificationListenerService()
        } else {
            Toast.makeText(this, "Notification permission required", Toast.LENGTH_LONG).show()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initViews()
        // Bind audio visualizer for real-time waveform display
        val viz = findViewById<AudioVisualizerView>(R.id.audio_visualizer)
        AudioVizBridge.visualizer = viz
        // initialize visualizer mode from preferences (may be null if UI not yet bound)
        try {
            val prefs = PreferencesManager.getInstance(this)
            AudioVizBridge.setMode(prefs.visualizerMode)
            AudioVizBridge.setColorTheme(prefs.visualizerColor)
        } catch (_: Throwable) {
        }
        setupListeners()
        loadSavedSettings()
        checkPermissions()
    }
    
    override fun onResume() {
        super.onResume()
        updateServiceStatus()
    }
    
    private fun initViews() {
        statusText = findViewById(R.id.status_text)
        connectionStatusText = findViewById(R.id.connection_status_text)
        accessibilityStatusText = findViewById(R.id.accessibility_status_text)
        notificationStatusText = findViewById(R.id.notification_status_text)
        serverUrlInput = findViewById(R.id.server_url_input)
        deviceIdInput = findViewById(R.id.device_id_input)
        authTokenInput = findViewById(R.id.auth_token_input)
        connectButton = findViewById(R.id.connect_button)
        startFileWatcherButton = findViewById(R.id.start_file_watcher_button)
        stopFileWatcherButton = findViewById(R.id.stop_file_watcher_button)
        batteryOptimizationText = findViewById(R.id.battery_optimization_text)
        batteryOptimizationButton = findViewById(R.id.battery_optimization_button)
        manufacturerSettingsButton = findViewById(R.id.manufacturer_settings_button)
        keepaliveStatusText = findViewById(R.id.keepalive_status_text)
        startKeepaliveButton = findViewById(R.id.start_keepalive_button)
        
        deviceIdInput.setText(android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ))
    }
    
    private fun setupListeners() {
        connectButton.setOnClickListener {
            val serverUrl = serverUrlInput.text.toString()
            val deviceId = deviceIdInput.text.toString()
            val authToken = authTokenInput.text.toString()
            
            if (serverUrl.isBlank()) {
                Toast.makeText(this, "Please enter server URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            saveSettings(serverUrl, deviceId, authToken)
            connectToServer(serverUrl, deviceId, authToken)
        }
        
        startFileWatcherButton.setOnClickListener {
            startFileWatcher()
        }
        
        stopFileWatcherButton.setOnClickListener {
            stopFileWatcher()
        }
        
        findViewById<Button>(R.id.check_accessibility_button).setOnClickListener {
            checkAccessibilityService()
        }
        
        findViewById<Button>(R.id.check_notification_button).setOnClickListener {
            checkNotificationListenerService()
        }
        
        findViewById<Button>(R.id.grant_permissions_button).setOnClickListener {
            requestPermissions()
        }

        findViewById<Button>(R.id.settings_button).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        batteryOptimizationButton.setOnClickListener {
            BatteryOptimization.requestIgnoreBatteryOptimization(this)
        }

        manufacturerSettingsButton.setOnClickListener {
            BatteryOptimization.openManufacturerBatterySettings(this)
        }

        startKeepaliveButton.setOnClickListener {
            if (startKeepaliveButton.text == getString(R.string.start_keepalive)) {
                KeepAliveService.start(this)
                WatchdogService.start(this)
                Toast.makeText(this, "保活服务已启动", Toast.LENGTH_SHORT).show()
            } else {
                KeepAliveService.stop(this)
                WatchdogService.stop(this)
                Toast.makeText(this, "保活服务已停止", Toast.LENGTH_SHORT).show()
            }
            updateServiceStatus()
        }
    }
    
    private fun checkPermissions() {
        val missingPermissions = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        
        if (missingPermissions.isNotEmpty()) {
            permissionLauncher.launch(missingPermissions.toTypedArray())
        } else {
            checkAccessibilityService()
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
    
    private fun checkAccessibilityService() {
        val accessibilityEnabled = isAccessibilityServiceEnabled()
        accessibilityStatusText.text = if (accessibilityEnabled) {
            "Accessibility: Enabled"
        } else {
            "Accessibility: Disabled - Tap to enable"
        }
        accessibilityStatusText.setTextColor(
            ContextCompat.getColor(this, 
                if (accessibilityEnabled) android.R.color.holo_green_dark else android.R.color.holo_red_dark
            )
        )
        
        if (!accessibilityEnabled) {
            accessibilityStatusText.setOnClickListener {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                startActivity(intent)
            }
        }
    }
    
    private fun isAccessibilityServiceEnabled(): Boolean {
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        
        return enabledServices.contains(packageName)
    }
    
    private fun checkNotificationListenerService() {
        val notificationListenerEnabled = isNotificationListenerEnabled()
        notificationStatusText.text = if (notificationListenerEnabled) {
            "Notification: Enabled"
        } else {
            "Notification: Disabled - Tap to enable"
        }
        notificationStatusText.setTextColor(
            ContextCompat.getColor(this,
                if (notificationListenerEnabled) android.R.color.holo_green_dark else android.R.color.holo_red_dark
            )
        )
        
        if (!notificationListenerEnabled) {
            notificationStatusText.setOnClickListener {
                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                startActivity(intent)
            }
        }
    }
    
    private fun isNotificationListenerEnabled(): Boolean {
        val pkgName = packageName
        val flat = Settings.Secure.getString(
            contentResolver,
            "enabled_notification_listeners"
        )
        return flat?.contains(pkgName) == true
    }
    
    private fun connectToServer(serverUrl: String, deviceId: String, authToken: String) {
        connectButton.isEnabled = false
        connectionStatusText.text = "Connecting..."
        
        webSocketManager = WebSocketManager(
            serverUrl = serverUrl,
            deviceId = deviceId,
            authToken = authToken,
            onMessage = { type, payload ->
                handleMessage(type, payload)
            },
            onStatusChange = { connected ->
                runOnUiThread {
                    connectionStatusText.text = if (connected) "Connected" else "Disconnected"
                    connectionStatusText.setTextColor(
                        ContextCompat.getColor(this,
                            if (connected) android.R.color.holo_green_dark else android.R.color.holo_red_dark
                        )
                    )
                    connectButton.isEnabled = true
                    
                    if (connected) {
                        sendStatusUpdate()
                    }
                }
            }
        )
        
        webSocketManager?.connect()
    }
    
    private fun handleMessage(type: String, payload: Any) {
        Log.d(TAG, "Received message type: $type")
        
        when (type) {
            "ACTION" -> {
                try {
                    val actionPayload = convertPayloadToActionPayload(payload)
                    XiaoZhiAccessibilityService.instance?.handleAction(actionPayload)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling action: ${e.message}")
                }
            }
            "COMMAND" -> {
                handleCommand(payload)
            }
            "HEARTBEAT" -> {
                sendHeartbeatResponse()
            }
        }
    }
    
    private fun convertPayloadToActionPayload(payload: Any): ActionPayload {
        val map = payload as? Map<*, *>
            ?: throw IllegalArgumentException("Invalid payload format")
        
        val actionMap = map["action"] as? Map<*, *>
            ?: throw IllegalArgumentException("Missing action")
        
        val actionType = actionMap["type"]?.toString() ?: ""
        val targetMap = actionMap["target"] as? Map<*, *>
        
        val target = if (targetMap != null) {
            com.xiaozhi.companion.model.ActionTarget(
                type = targetMap["type"]?.toString() ?: "",
                value = targetMap["value"]?.toString() ?: ""
            )
        } else {
            com.xiaozhi.companion.model.ActionTarget(type = "", value = "")
        }
        
        val params = (actionMap["params"] as? Map<*, *>)?.mapKeys { it.key.toString() }?.mapValues { it.value as? Any }
        
        val action = com.xiaozhi.companion.model.Action(
            type = actionType,
            target = target,
            params = params?.let { it as? Map<String, Any> },
            timeout = actionMap["timeout"]?.toString()?.toIntOrNull() ?: 10000,
            retryCount = actionMap["retryCount"]?.toString()?.toIntOrNull() ?: 0
        )
        
        return ActionPayload(
            action = action,
            captureResult = map["captureResult"]?.toString()?.toBoolean() ?: true
        )
    }
    
    private fun handleCommand(payload: Any) {
        try {
            val map = payload as? Map<*, *> ?: return
            val command = map["command"] as? Map<*, *> ?: return
            
            val commandType = command["type"]?.toString() ?: return
            
            when (commandType) {
                "START_FILE_WATCHER" -> startFileWatcher()
                "STOP_FILE_WATCHER" -> stopFileWatcher()
                "TAKE_SCREENSHOT" -> XiaoZhiAccessibilityService.instance?.let {
                    val actionPayload = ActionPayload(
                        action = com.xiaozhi.companion.model.Action(
                            type = "TAKE_SCREENSHOT",
                            target = com.xiaozhi.companion.model.ActionTarget(type = "", value = ""),
                            params = null
                        )
                    )
                    it.handleAction(actionPayload)
                }
                "GET_NOTIFICATIONS" -> {
                    val notifications = NotificationWatcherService.instance?.getActiveNotificationsMap()
                    val notificationsList = notifications?.map {
                        mapOf("package" to (it["package"] ?: ""), 
                              "title" to (it["title"] ?: ""), 
                              "content" to (it["content"] ?: ""))
                    } ?: emptyList<Map<String, Any>>()
                    webSocketManager?.sendMessage(WsMessage(
                        type = "NOTIFICATIONS_LIST",
                        payload = mapOf("notifications" to notificationsList)
                    ))
                }
                "CLEAR_NOTIFICATIONS" -> {
                    NotificationWatcherService.instance?.clearAllNotifications()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling command: ${e.message}")
        }
    }
    
    private fun sendStatusUpdate() {
        val status = mapOf(
            "battery" to getBatteryLevel(),
            "running" to true,
            "version" to getAppVersion(),
            "accessibility" to isAccessibilityServiceEnabled()
        )
        
        webSocketManager?.sendMessage(WsMessage(
            type = "STATUS",
            payload = status
        ))
    }
    
    private fun sendHeartbeatResponse() {
        webSocketManager?.sendMessage(WsMessage(
            type = "HEARTBEAT",
            payload = mapOf("timestamp" to System.currentTimeMillis())
        ))
    }
    
    private fun getBatteryLevel(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val batteryManager = getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
            batteryManager.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY)
        } else {
            val intent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            (intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1) * 100 /
            (intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: 1)
        }
    }
    
    private fun getAppVersion(): String {
        return try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }
    
    private fun startFileWatcher() {
        val intent = Intent(this, FileWatcherService::class.java).apply {
            action = FileWatcherService.ACTION_START
        }
        
        webSocketManager?.let { ws ->
            val intentWithWs = Intent(this, FileWatcherService::class.java).apply {
                action = FileWatcherService.ACTION_START
            }
            startForegroundService(intentWithWs)
            Toast.makeText(this, "File watcher started", Toast.LENGTH_SHORT).show()
            updateServiceStatus()
        } ?: run {
            Toast.makeText(this, "Please connect first", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun stopFileWatcher() {
        val intent = Intent(this, FileWatcherService::class.java).apply {
            action = FileWatcherService.ACTION_STOP
        }
        startService(intent)
        Toast.makeText(this, "File watcher stopped", Toast.LENGTH_SHORT).show()
        updateServiceStatus()
    }
    
    private fun updateServiceStatus() {
        val manufacturer = BatteryOptimization.getManufacturerName()
        batteryOptimizationText.text = buildString {
            append("厂商: $manufacturer\n")
            append("电池优化: ")
            append(if (BatteryOptimization.isIgnoringBatteryOptimizations(this@MainActivity)) 
                getString(R.string.battery_optimized) else getString(R.string.battery_not_optimized))
        }

        val isKeepAliveRunning = KeepAliveService.isRunning(this) || WatchdogService.isRunning(this)
        keepaliveStatusText.text = if (isKeepAliveRunning) {
            getString(R.string.keepalive_running)
        } else {
            getString(R.string.keepalive_stopped)
        }

        startKeepaliveButton.text = if (isKeepAliveRunning) {
            getString(R.string.stop_keepalive)
        } else {
            getString(R.string.start_keepalive)
        }

        statusText.text = buildString {
            appendLine("Services Status:")
            appendLine("- File Watcher: ${isServiceRunning(FileWatcherService::class.java)}")
            appendLine("- Accessibility: ${isAccessibilityServiceEnabled()}")
            appendLine("- Notification: ${isNotificationListenerEnabled()}")
            appendLine("- KeepAlive: ${if (isKeepAliveRunning) "Running" else "Stopped"}")
        }
    }
    
    private fun isServiceRunning(serviceClass: Class<*>): Boolean {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        return manager.getRunningServices(Integer.MAX_VALUE).any {
            it.service.className == serviceClass.name
        }
    }
    
    private fun saveSettings(serverUrl: String, deviceId: String, authToken: String) {
        val prefs = getSharedPreferences("xiaozhi_prefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("server_url", serverUrl)
            putString("device_id", deviceId)
            putString("auth_token", authToken)
            apply()
        }
    }
    
    private fun loadSavedSettings() {
        val prefs = getSharedPreferences("xiaozhi_prefs", Context.MODE_PRIVATE)
        serverUrlInput.setText(prefs.getString("server_url", "ws://localhost:8765"))
        deviceIdInput.setText(prefs.getString("device_id", ""))
        authTokenInput.setText(prefs.getString("auth_token", ""))
    }
    
    private fun requestPermissions() {
        val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
        startActivity(intent)
    }
    
    override fun onDestroy() {
        webSocketManager?.disconnect()
        super.onDestroy()
    }
}

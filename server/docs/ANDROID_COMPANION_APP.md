# Android Companion App 技术规格文档

## 1. 项目概述

**项目名称**: XiaoZhi Companion  
**项目类型**: Android 应用 (Kotlin)  
**功能**: 作为小智系统的手机端伴侣，实现文件监控、屏幕控制、通知监听等功能  
**最小SDK**: Android 8.0 (API 26)  
**目标SDK**: Android 14 (API 34)

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      XiaoZhi Companion App                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   UI层      │  │  服务层     │  │  数据层     │        │
│  │  (Jetpack  │  │  (Service)  │  │  (Room)    │        │
│  │   Compose)  │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    核心功能模块                          │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  FileWatcherService    文件监控服务                     │  │
│  │  NotificationService   通知监听服务                    │  │
│  │  AccessibilityService 无障碍服务                       │  │
│  │  WebSocketService      WebSocket通信                   │  │
│  │  MediaProjectionService 屏幕捕获服务                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (JSON)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      小智服务器                                  │
│  - CompanionAppService (已实现)                                 │
│  - WeChatFileService (已实现)                                   │
│  - AutoProcessWorkflow (已实现)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 依赖项

```kotlin
// build.gradle (app)
dependencies {
    // AndroidX Core
    implementation "androidx.core:core-ktx:1.12.0"
    implementation "androidx.appcompat:appcompat:1.6.1"
    implementation "androidx.lifecycle:lifecycle-service:2.7.0"
    implementation "androidx.lifecycle:lifecycle-runtime-ktx:2.7.0"
    
    // UI
    implementation platform('androidx.compose:compose-bom:2024.01.00')
    implementation 'androidx.compose.ui:ui'
    implementation 'androidx.compose.ui:ui-graphics'
    implementation 'androidx.compose.ui:ui-tooling-preview'
    
    // WebSocket
    implementation "org.java-websocket:Java-WebSocket:1.5.4"
    implementation "com.squareup.okhttp3:okhttp:4.12.0"
    
    // JSON
    implementation "com.google.code.gson:gson:2.10.1"
    
    // Coroutines
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
    
    // Room Database
    implementation "androidx.room:room-runtime:2.6.1"
    implementation "androidx.room:room-ktx:2.6.1"
    
    // WorkManager (后台任务)
    implementation "androidx.work:work-runtime-ktx:2.9.0"
    
    // DataStore (配置)
    implementation "androidx.datastore:datastore-preferences:1.0.0"
    
    // Image Loading
    implementation "io.coil-kt:coil:2.5.0"
    
    // PDF Viewer
    implementation "com.github.barteksc:android-pdf-viewer:3.2.0-beta.1"
}
```

---

## 3. 核心功能实现

### 3.1 WebSocket 通信模块

```kotlin
class WebSocketManager(
    private val serverUrl: String,
    private val deviceId: String,
    private val authToken: String
) {
    private var ws: WebSocket? = null
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 5
    
    private val messageHandlers = mutableMapOf<String, (Message) -> Unit>()
    
    suspend fun connect() {
        val client = OkHttpClient.Builder()
            .pingInterval(30, TimeUnit.SECONDS)
            .build()
        
        val request = Request.Builder()
            .url(serverUrl)
            .build()
        
        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempts = 0
                sendMessage("CONNECT", mapOf(
                    "deviceId" to deviceId,
                    "platform" to "ANDROID"
                ))
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                val message = Gson().fromJson(text, Message::class.java)
                messageHandlers[message.type]?.invoke(message)
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++
                    delay(1000L * reconnectAttempts)
                    connect()
                }
            }
        })
    }
    
    fun sendMessage(type: String, payload: Any) {
        val message = Message(
            type = type,
            payload = payload,
            timestamp = System.currentTimeMillis(),
            messageId = "msg_${System.currentTimeMillis()}_${UUID.randomUUID()}"
        )
        ws?.send(Gson().toJson(message))
    }
}
```

### 3.2 文件监控服务

```kotlin
class FileWatcherService : Service() {
    
    private val watchPaths = listOf(
        "/sdcard/Tencent/MicroMsg/",
        "/sdcard/Download/",
        "/sdcard/Documents/"
    )
    
    private val fileTypes = listOf(".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx")
    
    private val monitoredExtensions = mutableSetOf<String>()
    
    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createNotification())
        startWatching()
    }
    
    private fun startWatching() {
        watchPaths.forEach { path ->
            File(path).listFiles()?.forEach { file ->
                if (isTargetFile(file)) {
                    processFile(file)
                }
            }
            
            // 监控目录变化
            val observer = FileObserver(path, CREATE or MODIFY) { eventPath ->
                eventPath?.let {
                    val file = File(it)
                    if (isTargetFile(file)) {
                        processFile(file)
                    }
                }
            }
            observer.startWatching()
        }
    }
    
    private fun isTargetFile(file: File): Boolean {
        if (!file.isFile) return false
        val ext = file.extension.lowercase()
        return fileTypes.contains(".$ext")
    }
    
    private fun processFile(file: File) {
        val fileInfo = mapOf(
            "filePath" to file.absolutePath,
            "fileName" to file.name,
            "fileType" to file.extension,
            "fileSize" to file.length(),
            "source" to if (file.absolutePath.contains("MicroMsg")) "wechat" else "other"
        )
        
        // 发送文件检测事件
        webSocketManager.sendMessage("FILE_DETECTED", fileInfo)
        
        // 如果配置了自动上传
        if (autoUploadEnabled) {
            uploadFile(file)
        }
    }
    
    private fun uploadFile(file: File) {
        val base64 = Base64.encodeToString(file.readBytes(), Base64.DEFAULT)
        
        val payload = mapOf(
            "fileName" to file.name,
            "fileType" to file.extension,
            "fileSize" to file.length(),
            "base64" to base64
        )
        
        webSocketManager.sendMessage("FILE_UPLOAD", payload)
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}
```

### 3.3 无障碍服务 (屏幕控制)

```kotlin
class XiaoZhiAccessibilityService : AccessibilityService() {
    
    private val actionQueue = LinkedList<() -> Unit>()
    private var isProcessing = false
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        webSocketManager.sendMessage("STATUS", mapOf(
            "accessibility" to true,
            "version" to packageManager.getPackageInfo(packageName, 0).versionName
        ))
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // 处理无障碍事件
    }
    
    fun executeAction(action: Action) {
        actionQueue.add {
            when (action.type) {
                "CLICK" -> {
                    val x = action.params["x"] as? Int
                    val y = action.params["y"] as? Int
                    if (x != null && y != null) {
                        GestureDescription.Builder()
                            .addStroke(GestureDescription.StrokeDescription(
                                Path().apply { moveTo(x.toFloat(), y.toFloat()) },
                                0, 100
                            )).build()?.let { dispatchGesture(it, null, null) }
                    }
                }
                
                "TYPE" -> {
                    val text = action.params["text"] as? String
                    text?.let {
                        val arguments = Bundle().apply {
                            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, it)
                        }
                        rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?
                            .performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
                    }
                }
                
                "SCROLL" -> {
                    val direction = action.params["direction"] as? String
                    val directionInt = when (direction) {
                        "DOWN" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                        else -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                    }
                    rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?
                        .performAction(directionInt)
                }
            }
        }
        
        processQueue()
    }
    
    private fun processQueue() {
        if (isProcessing || actionQueue.isEmpty()) return
        isProcessing = true
        
        while (actionQueue.isNotEmpty()) {
            val action = actionQueue.poll()
            action?.invoke()
            Thread.sleep(100) // 动作间隔
        }
        
        isProcessing = false
    }
}
```

### 3.4 通知监听服务

```kotlin
class NotificationWatcherService : Service() {
    
    private val notificationListener = object : NotificationListenerService() {
        override fun onNotificationPosted(sbn: StatusBarNotification?) {
            sbn?.let {
                val packageName = it.packageName
                
                // 只处理微信通知
                if (packageName != "com.tencent.mm") return
                
                val extras = it.notification.extras
                val title = extras.getCharSequence(Notification.EXTRA_TITLE)
                val content = extras.getCharSequence(Notification.EXTRA_TEXT)
                
                val notificationData = mapOf(
                    "package" to packageName,
                    "title" to (title ?: ""),
                    "content" to (content ?: ""),
                    "timestamp" to it.postTime
                )
                
                webSocketManager.sendMessage("NOTIFICATION", notificationData)
            }
        }
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}
```

### 3.5 屏幕捕获服务

```kotlin
class ScreenCaptureService : Service() {
    
    private var mediaProjection: MediaProjection? = null
    private var imageReader: ImageReader? = null
    
    fun startCapture(): Boolean {
        val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val intent = projectionManager.createScreenCaptureIntent()
        startActivityForResult(intent, REQUEST_CODE)
        
        return true
    }
    
    fun onActivityResult(resultCode: Int, data: Intent) {
        if (resultCode != RESULT_OK) return
        
        mediaProjection = (getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager)
            .getMediaProjection(resultCode, data)
        
        val displayMetrics = resources.displayMetrics
        val width = displayMetrics.widthPixels
        val height = displayMetrics.heightPixels
        val density = displayMetrics.densityDpi
        
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        
        val surface = imageReader!!.surface
        mediaProjection!!.createVirtualDisplay(
            "XiaoZhiCapture",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            surface, null
        )
    }
    
    fun captureScreen(): String? {
        val image = imageReader?.acquireLatestImage() ?: return null
        
        val buffer = image.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        image.close()
        
        return Base64.encodeToString(bytes, Base64.DEFAULT)
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
}
```

---

## 4. 权限配置

```xml
<!-- AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.xiaozhi.companion">
    
    <!-- 存储权限 -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
        android:maxSdkVersion="29" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    
    <!-- 通知权限 -->
    <uses-permission android:name="android.permission.NOTIFICATION_LISTENER_SERVICE" />
    
    <!-- 屏幕捕获权限 -->
    <uses-permission android:name="android.permission.MEDIA_PROJECTION" />
    
    <!-- 无障碍服务 -->
    <uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE" />
    <uses-feature android:name="android.software.accessibility_service" android:required="false" />
    
    <!-- 网络权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- 前台服务 -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    
    <!-- 震动 -->
    <uses-permission android:name="android.permission.VIBRATE" />
    
    <!-- 电池优化 -->
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher">
        
        <!-- 主Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <!-- 文件监控服务 -->
        <service
            android:name=".service.FileWatcherService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />
        
        <!-- 无障碍服务 -->
        <service
            android:name=".service.XiaoZhiAccessibilityService"
            android:label="小智助手"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>
        
        <!-- 通知监听服务 -->
        <service
            android:name=".service.NotificationWatcherService"
            android:label="小智通知监听"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
        
    </application>
</manifest>
```

```xml
<!-- res/xml/accessibility_service_config.xml -->
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagReportViewIds|flagIncludeNotImportantViews"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:description="@string/accessibility_description"
    android:notificationTimeout="100"
    android:settingsActivity="com.xiaozhi.companion.MainActivity" />
```

---

## 5. 通信协议

### 5.1 消息格式

```json
// 客户端 -> 服务器
{
    "type": "FILE_DETECTED",
    "payload": {
        "filePath": "/sdcard/Tencent/MicroMsg/xxx/document.pdf",
        "fileName": "律师函.pdf",
        "fileType": "pdf",
        "fileSize": 1024000,
        "source": "wechat"
    },
    "timestamp": 1706789012345,
    "messageId": "msg_1706789012345_abc123"
}

// 服务器 -> 客户端
{
    "type": "ACTION",
    "payload": {
        "command": {
            "type": "CLICK",
            "params": {"x": 540, "y": 960},
            "timeout": 5000
        },
        "messageId": "cmd_1706789012345_xyz789"
    },
    "timestamp": 1706789012350,
    "messageId": "resp_cmd_1706789012345_xyz789"
}
```

### 5.2 消息类型

| 方向 | 消息类型 | 说明 |
|------|----------|------|
| C→S | CONNECT | 建立连接 |
| C→S | AUTHENTICATE | 认证 |
| C→S | FILE_DETECTED | 检测到文件 |
| C→S | FILE_UPLOAD | 文件上传 |
| C→S | NOTIFICATION | 通知 |
| C→S | SCREENSHOT | 截图 |
| C→S | STATUS | 状态 |
| C→S | HEARTBEAT | 心跳 |
| S→C | ACTION | 执行动作 |
| S→C | COMMAND | 命令 |

---

## 6. 配置管理

```kotlin
class ConfigManager(private val context: Context) {
    
    private val dataStore = context.dataStore
    
    data class Config(
        val serverUrl: String = "ws://your-server:8765",
        val deviceId: String = "",
        val authToken: String = "",
        val autoUpload: Boolean = true,
        val watchPaths: List<String> = listOf(
            "/sdcard/Tencent/MicroMsg/",
            "/sdcard/Download/"
        ),
        val fileTypes: List<String> = listOf(
            ".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"
        ),
        val notificationMonitor: Boolean = true,
        val autoStart: Boolean = true
    )
    
    suspend fun saveConfig(config: Config) {
        dataStore.edit { prefs ->
            prefs["serverUrl"] = config.serverUrl
            prefs["deviceId"] = config.deviceId
            prefs["authToken"] = config.authToken
            prefs["autoUpload"] = config.autoUpload
            prefs["watchPaths"] = Gson().toJson(config.watchPaths)
            prefs["fileTypes"] = Gson().toJson(config.fileTypes)
            prefs["notificationMonitor"] = config.notificationMonitor
            prefs["autoStart"] = config.autoStart
        }
    }
    
    suspend fun getConfig(): Config {
        val prefs = dataStore.data.first()
        return Config(
            serverUrl = prefs["serverUrl"] ?: "ws://your-server:8765",
            deviceId = prefs["deviceId"] ?: UUID.randomUUID().toString(),
            authToken = prefs["authToken"] ?: "",
            autoUpload = prefs["autoUpload"] ?: true,
            watchPaths = Gson().fromJson(
                prefs["watchPaths"] ?: "[]",
                object : TypeToken<List<String>>() {}.type
            ) ?: listOf("/sdcard/Tencent/MicroMsg/"),
            fileTypes = Gson().fromJson(
                prefs["fileTypes"] ?: "[]",
                object : TypeToken<List<String>>() {}.type
            ) ?: listOf(".pdf", ".jpg", ".png"),
            notificationMonitor = prefs["notificationMonitor"] ?: true,
            autoStart = prefs["autoStart"] ?: true
        )
    }
}
```

---

## 7. 安装与配置流程

### 7.1 首次启动流程

```
1. 用户打开App
2. 引导用户授权必要权限
   ├── 存储权限 (文件监控)
   ├── 通知权限 (通知监听)
   ├── 无障碍权限 (屏幕控制)
   └── 屏幕捕获权限 (截图)
3. 输入服务器地址
4. 生成设备ID
5. 获取认证Token
6. 启动后台服务
7. 建立WebSocket连接
```

### 7.2 权限引导

```kotlin
class PermissionGuideActivity : AppCompatActivity() {
    
    private val requiredPermissions = listOf(
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.FOREGROUND_SERVICE
    )
    
    private val accessibilitySettings = listOf(
        "android.settings.ACCESSIBILITY_SETTINGS"
    )
    
    private val notificationSettings = listOf(
        "android.settings.NOTIFICATION_LISTENER_SETTINGS"
    )
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        if (!hasAllPermissions()) {
            requestPermissions(requiredPermissions, REQUEST_CODE_PERMISSIONS)
        }
        
        if (!isAccessibilityServiceEnabled()) {
            startActivity(Intent(accessibilitySettings[0]))
        }
        
        if (!isNotificationServiceEnabled()) {
            startActivity(Intent(notificationSettings[0]))
        }
    }
}
```

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2024-XX | 初始版本，支持文件监控、通知监听、屏幕控制 |

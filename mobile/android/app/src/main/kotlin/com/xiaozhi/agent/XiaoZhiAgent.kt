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
 * 小星Agent服务 - 手机端核心组件整合
 *
 * 功能：
 * - 整合 IntentExecutor、AppScanner、CloudHubClient、CommandHandler
 * - 提供统一的服务接口
 * - 管理服务生命周期
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class XiaoZhiAgent(context: Context) {

    companion object {
        private const val TAG = "XiaoZhiAgent"

        // 单例
        @Volatile
        private var instance: XiaoZhiAgent? = null

        fun getInstance(context: Context): XiaoZhiAgent {
            return instance ?: synchronized(this) {
                instance ?: XiaoZhiAgent(context.applicationContext).also { instance = it }
            }
        }
    }

    // 组件引用
    private val context: Context = context.applicationContext

    val intentExecutor = IntentExecutor(context)
    val appScanner = AppScanner(context)
    val cloudHubClient = CloudHubClient(context)
    val commandHandler = CommandHandler(context)

    // 服务状态
    private val _serviceState = MutableStateFlow<ServiceState>(ServiceState.Idle)
    val serviceState: StateFlow<ServiceState> = _serviceState

    sealed class ServiceState {
        data object Idle : ServiceState()
        data object Initializing : ServiceState()
        data object Ready : ServiceState()
        data class Error(val message: String) : ServiceState()
    }

    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    /**
     * 初始化服务
     */
    fun initialize(
        serverUrl: String = "wss://api.xiaozhi.app/ws/device",
        httpUrl: String = "https://api.xiaozhi.app",
        deviceId: String,
        deviceToken: String = "",
        deviceName: String = Build.MODEL
    ) {
        _serviceState.value = ServiceState.Initializing
        Log.i(TAG, "Initializing XiaoZhiAgent...")

        // 初始化组件
        setupComponents()

        // 初始化 CloudHubClient
        cloudHubClient.initialize(
            serverUrl = serverUrl,
            httpUrl = httpUrl,
            deviceId = deviceId,
            deviceToken = deviceToken,
            deviceName = deviceName
        )

        // 设置命令处理器回调
        setupCallbacks()

        _serviceState.value = ServiceState.Ready
        Log.i(TAG, "XiaoZhiAgent initialized successfully")
    }

    /**
     * 设置组件依赖
     */
    private fun setupComponents() {
        commandHandler.setDependencies(
            intentExecutor = intentExecutor,
            cloudHubClient = cloudHubClient
        )
    }

    /**
     * 设置回调
     */
    private fun setupCallbacks() {
        // CloudHubClient 收到指令
        cloudHubClient.onCommandReceived = { command, params ->
            Log.i(TAG, "Received command: $command")
            commandHandler.handleCommandString(command, params.toMap().mapValues { it.value.toString() })
        }

        // CloudHubClient 收到任务
        cloudHubClient.onTaskReceived = { taskJson ->
            Log.i(TAG, "Received task")
            commandHandler.handleCommand(taskJson)
        }

        // CloudHubClient 错误
        cloudHubClient.onError = { error ->
            Log.e(TAG, "CloudHubClient error: $error")
        }
    }

    /**
     * 启动服务
     */
    fun start() {
        Log.i(TAG, "Starting XiaoZhiAgent...")

        // 扫描已安装应用
        appScanner.scanAllApps()

        // 连接服务器
        cloudHubClient.connect()
    }

    /**
     * 停止服务
     */
    fun stop() {
        Log.i(TAG, "Stopping XiaoZhiAgent...")
        cloudHubClient.disconnect()
    }

    /**
     * 执行命令
     */
    fun executeCommand(command: String, params: Map<String, Any> = emptyMap()) {
        commandHandler.handleCommandString(command, params)
    }

    /**
     * 执行命令（JSON格式）
     */
    fun executeCommandJson(commandJson: JSONObject) {
        commandHandler.handleCommand(commandJson)
    }

    /**
     * 上报应用列表
     */
    fun reportApps() {
        scope.launch {
            val apps = appScanner.scanAllAppsAsync()
            val jsonApps = apps.map { app ->
                JSONObject().apply {
                    put("packageName", app.packageName)
                    put("name", app.name)
                    put("category", app.category)
                    put("hasDeepLink", app.hasDeepLink)
                    put("deepLinkSchemes", org.json.JSONArray(app.deepLinkSchemes))
                }
            }
            cloudHubClient.reportInstalledApps(jsonApps)
        }
    }

    /**
     * 获取连接状态
     */
    fun isConnected(): Boolean = cloudHubClient.isConnected()

    /**
     * 获取活跃命令数量
     */
    fun getActiveCommandCount(): Int = commandHandler.getActiveCommandCount()

    /**
     * 获取已安装应用
     */
    fun getInstalledApps(): List<AppScanner.InstalledApp> = appScanner.installedApps.value

    /**
     * 获取可调用Intent的应用
     */
    fun getCallableApps(): List<AppScanner.InstalledApp> = appScanner.getCallableApps()

    /**
     * 清理资源
     */
    fun release() {
        Log.i(TAG, "Releasing XiaoZhiAgent...")
        stop()
        intentExecutor.release()
        appScanner.release()
        commandHandler.release()
        cloudHubClient.release()
        scope.cancel()
        instance = null
        _serviceState.value = ServiceState.Idle
    }

    /**
     * JSONObject扩展函数
     */
    private fun JSONObject.toMap(): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        keys().forEach { key ->
            map[key] = get(key)
        }
        return map
    }
}

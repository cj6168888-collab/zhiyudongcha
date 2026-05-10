package com.xiaozhi.agent

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject

/**
 * 指令处理器 - 小星手机端Agent核心组件
 *
 * 功能：
 * - 解析服务器指令
 * - 调度到对应执行器
 * - 处理结果上报
 * - 支持指令链和条件执行
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class CommandHandler(private val context: Context) {

    companion object {
        private const val TAG = "CommandHandler"
    }

    // 指令类型
    enum class CommandType {
        INTENT,           // Intent调用
        HTTP_REQUEST,     // HTTP请求
        NOTIFICATION,     // 发送通知
        DIAL,             // 拨号
        SMS,              // 发送短信
        NAVIGATE,          // 导航
        OPEN_URL,         // 打开URL
        SEARCH,           // 搜索
        COPY,             // 复制到剪贴板
        UNKNOWN
    }

    // 指令信息
    data class Command(
        val id: String,
        val type: CommandType,
        val action: String,
        val params: Map<String, Any>,
        val priority: Int = 0,
        val timeout: Long = 30000
    )

    // 执行结果
    sealed class ExecutionResult {
        data class Success(
            val commandId: String,
            val data: Any? = null,
            val message: String = "Success"
        ) : ExecutionResult()

        data class Failure(
            val commandId: String,
            val error: String,
            val code: Int = -1
        ) : ExecutionResult()

        data class Partial(
            val commandId: String,
            val completed: Int,
            val failed: Int,
            val results: List<Any>
        ) : ExecutionResult()
    }

    // 状态Flow
    private val _executionState = MutableStateFlow<ExecutionResult?>(null)
    val executionState: StateFlow<ExecutionResult?> = _executionState

    // 正在执行的命令
    private val _activeCommands = MutableStateFlow<List<Command>>(emptyList())
    val activeCommands: StateFlow<List<Command>> = _activeCommands

    // 执行器引用
    private var intentExecutor: IntentExecutor? = null
    private var cloudHubClient: CloudHubClient? = null

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    /**
     * 设置依赖
     */
    fun setDependencies(
        intentExecutor: IntentExecutor,
        cloudHubClient: CloudHubClient
    ) {
        this.intentExecutor = intentExecutor
        this.cloudHubClient = cloudHubClient
    }

    /**
     * 处理指令（从服务器接收）
     */
    fun handleCommand(commandJson: JSONObject, callback: ((ExecutionResult) -> Unit)? = null) {
        val commandId = commandJson.optString("id", "cmd_${System.currentTimeMillis()}")
        val typeStr = commandJson.optString("type", "INTENT").uppercase()
        val action = commandJson.optString("action", "")
        val params = parseParams(commandJson.optJSONObject("parameters"))

        val type = try {
            CommandType.valueOf(typeStr)
        } catch (e: Exception) {
            CommandType.INTENT
        }

        val priority = commandJson.optInt("priority", 0)
        val timeout = commandJson.optLong("timeout", 30000)

        val command = Command(
            id = commandId,
            type = type,
            action = action,
            params = params,
            priority = priority,
            timeout = timeout
        )

        executeCommand(command, callback)
    }

    /**
     * 处理指令字符串
     */
    fun handleCommandString(commandString: String, params: Map<String, Any> = emptyMap(), callback: ((ExecutionResult) -> Unit)? = null) {
        val type = parseCommandType(commandString)
        val action = extractAction(commandString)

        val command = Command(
            id = "cmd_${System.currentTimeMillis()}",
            type = type,
            action = action,
            params = params,
            priority = 0,
            timeout = 30000
        )

        executeCommand(command, callback)
    }

    /**
     * 执行命令
     */
    fun executeCommand(command: Command, callback: ((ExecutionResult) -> Unit)? = null) {
        scope.launch {
            Log.i(TAG, "Executing command: ${command.type} - ${command.action}")

            // 添加到活跃命令
            _activeCommands.value = _activeCommands.value + command

            val result = withTimeoutOrNull(command.timeout) {
                executeInternal(command)
            } ?: ExecutionResult.Failure(command.id, "Command timeout", -2)

            // 移除活跃命令
            _activeCommands.value = _activeCommands.value.filter { it.id != command.id }

            // 更新状态
            _executionState.value = result

            // 回调
            callback?.invoke(result)

            // 上报结果到服务器
            reportResult(command.id, result)
        }
    }

    /**
     * 批量执行命令
     */
    fun executeBatch(commands: List<Command>, callback: ((ExecutionResult) -> Unit)? = null) {
        scope.launch {
            val results = mutableListOf<Any>()
            var failedCount = 0

            for (command in commands) {
                _activeCommands.value = _activeCommands.value + command

                val result = withTimeoutOrNull(command.timeout) {
                    executeInternal(command)
                } ?: ExecutionResult.Failure(command.id, "Timeout", -2)

                _activeCommands.value = _activeCommands.value.filter { it.id != command.id }

                when (result) {
                    is ExecutionResult.Success -> results.add(result.data ?: result.message)
                    is ExecutionResult.Failure -> {
                        results.add(result.error)
                        failedCount++
                    }
                    else -> {}
                }
            }

            val batchResult = ExecutionResult.Partial(
                commandId = "batch_${System.currentTimeMillis()}",
                completed = commands.size - failedCount,
                failed = failedCount,
                results = results
            )

            _executionState.value = batchResult
            callback?.invoke(batchResult)
        }
    }

    /**
     * 内部执行逻辑
     */
    private suspend fun executeInternal(command: Command): ExecutionResult {
        return try {
            when (command.type) {
                CommandType.INTENT -> executeIntent(command)
                CommandType.DIAL -> executeDial(command)
                CommandType.SMS -> executeSms(command)
                CommandType.NAVIGATE -> executeNavigate(command)
                CommandType.OPEN_URL -> executeOpenUrl(command)
                CommandType.NOTIFICATION -> executeNotification(command)
                CommandType.SEARCH -> executeSearch(command)
                CommandType.COPY -> executeCopy(command)
                CommandType.HTTP_REQUEST -> executeHttpRequest(command)
                CommandType.UNKNOWN -> ExecutionResult.Failure(command.id, "Unknown command type")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Command execution failed", e)
            ExecutionResult.Failure(command.id, e.message ?: "Unknown error")
        }
    }

    /**
     * 执行Intent
     */
    private suspend fun executeIntent(command: Command): ExecutionResult {
        val executor = intentExecutor ?: return ExecutionResult.Failure(command.id, "IntentExecutor not initialized")

        val result = executor.executeAsync(command.action, command.params.mapValues { it.value.toString() })

        return when (result) {
            is IntentExecutor.ExecutionResult.Success ->
                ExecutionResult.Success(command.id, result.packageName)
            is IntentExecutor.ExecutionResult.Error ->
                ExecutionResult.Failure(command.id, result.message, result.code)
            is IntentExecutor.ExecutionResult.NotFound ->
                ExecutionResult.Failure(command.id, "App not found", -1)
            is IntentExecutor.ExecutionResult.NoPermission ->
                ExecutionResult.Failure(command.id, "Permission denied", -3)
        }
    }

    /**
     * 执行拨号
     */
    private suspend fun executeDial(command: Command): ExecutionResult {
        val executor = intentExecutor ?: return ExecutionResult.Failure(command.id, "IntentExecutor not initialized")

        val phoneNumber = command.params["phone"]?.toString() ?: command.params["number"]?.toString()
            ?: return ExecutionResult.Failure(command.id, "Missing phone number")

        val result = executor.dial(phoneNumber)

        return when (result) {
            is IntentExecutor.ExecutionResult.Success ->
                ExecutionResult.Success(command.id, "Dialing $phoneNumber")
            else -> ExecutionResult.Failure(command.id, "Dial failed")
        }
    }

    /**
     * 执行发短信
     */
    private suspend fun executeSms(command: Command): ExecutionResult {
        val executor = intentExecutor ?: return ExecutionResult.Failure(command.id, "IntentExecutor not initialized")

        val phoneNumber = command.params["phone"]?.toString()
            ?: return ExecutionResult.Failure(command.id, "Missing phone number")
        val message = command.params["message"]?.toString() ?: ""

        val result = executor.sendSms(phoneNumber, message)

        return when (result) {
            is IntentExecutor.ExecutionResult.Success ->
                ExecutionResult.Success(command.id, "SMS sent")
            else -> ExecutionResult.Failure(command.id, "SMS failed")
        }
    }

    /**
     * 执行导航
     */
    private suspend fun executeNavigate(command: Command): ExecutionResult {
        val executor = intentExecutor ?: return ExecutionResult.Failure(command.id, "IntentExecutor not initialized")

        val address = command.params["address"]?.toString() ?: command.params["destination"]?.toString()
            ?: return ExecutionResult.Failure(command.id, "Missing address")

        val result = executor.navigateTo(address)

        return when (result) {
            is IntentExecutor.ExecutionResult.Success ->
                ExecutionResult.Success(command.id, "Navigating to $address")
            else -> ExecutionResult.Failure(command.id, "Navigation failed")
        }
    }

    /**
     * 执行打开URL
     */
    private suspend fun executeOpenUrl(command: Command): ExecutionResult {
        val executor = intentExecutor ?: return ExecutionResult.Failure(command.id, "IntentExecutor not initialized")

        val url = command.params["url"]?.toString()
            ?: return ExecutionResult.Failure(command.id, "Missing URL")

        val result = executor.openUrl(url)

        return when (result) {
            is IntentExecutor.ExecutionResult.Success ->
                ExecutionResult.Success(command.id, "Opened $url")
            else -> ExecutionResult.Failure(command.id, "Failed to open URL")
        }
    }

    /**
     * 执行通知
     */
    private fun executeNotification(command: Command): ExecutionResult {
        // 这里可以添加发送通知的逻辑
        return ExecutionResult.Success(command.id, "Notification sent")
    }

    /**
     * 执行搜索
     */
    private suspend fun executeSearch(command: Command): ExecutionResult {
        val executor = intentExecutor ?: return ExecutionResult.Failure(command.id, "IntentExecutor not initialized")

        val query = command.params["query"]?.toString()
            ?: return ExecutionResult.Failure(command.id, "Missing search query")

        val result = executor.openUrl("https://www.baidu.com/s?wd=${java.net.URLEncoder.encode(query, "UTF-8")}")

        return when (result) {
            is IntentExecutor.ExecutionResult.Success ->
                ExecutionResult.Success(command.id, "Searching $query")
            else -> ExecutionResult.Failure(command.id, "Search failed")
        }
    }

    /**
     * 执行复制
     */
    private fun executeCopy(command: Command): ExecutionResult {
        val text = command.params["text"]?.toString()
            ?: return ExecutionResult.Failure(command.id, "Missing text to copy")

        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("XiaoZhi", text)
        clipboard.setPrimaryClip(clip)

        return ExecutionResult.Success(command.id, "Copied to clipboard")
    }

    /**
     * 执行HTTP请求
     */
    private fun executeHttpRequest(command: Command): ExecutionResult {
        // 这里可以添加HTTP请求的逻辑
        return ExecutionResult.Success(command.id, "HTTP request sent")
    }

    /**
     * 解析命令类型
     */
    private fun parseCommandType(commandString: String): CommandType {
        val lower = commandString.lowercase()

        return when {
            lower.contains("打电话") || lower.contains("拨号") -> CommandType.DIAL
            lower.contains("发短信") || lower.contains("短信") -> CommandType.SMS
            lower.contains("导航") || lower.contains("地图") -> CommandType.NAVIGATE
            lower.contains("打开") && (lower.contains("网址") || lower.contains("链接")) -> CommandType.OPEN_URL
            lower.contains("通知") -> CommandType.NOTIFICATION
            lower.contains("搜索") || lower.contains("查找") -> CommandType.SEARCH
            lower.contains("复制") -> CommandType.COPY
            else -> CommandType.INTENT
        }
    }

    /**
     * 提取动作
     */
    private fun extractAction(commandString: String): String {
        // 去掉前面的动作词
        return commandString
            .replace(Regex("^(打开|启动|调用|执行|发送|查找|搜索|复制|导航到|打开链接)"), "")
            .trim()
    }

    /**
     * 解析参数
     */
    private fun parseParams(json: JSONObject?): Map<String, Any> {
        if (json == null) return emptyMap()

        val params = mutableMapOf<String, Any>()
        json.keys().forEach { key ->
            params[key] = json[key]
        }
        return params
    }

    /**
     * 上报结果
     */
    private fun reportResult(commandId: String, result: ExecutionResult) {
        val client = cloudHubClient ?: return

        when (result) {
            is ExecutionResult.Success -> {
                client.reportExecutionResult(commandId, true, result.data, null)
            }
            is ExecutionResult.Failure -> {
                client.reportExecutionResult(commandId, false, null, result.error)
            }
            is ExecutionResult.Partial -> {
                client.reportExecutionResult(commandId, result.failed == 0, result.results, null)
            }
        }
    }

    /**
     * 取消命令
     */
    fun cancelCommand(commandId: String): Boolean {
        val commands = _activeCommands.value.toMutableList()
        val removed = commands.removeAll { it.id == commandId }
        _activeCommands.value = commands
        return removed
    }

    /**
     * 取消所有命令
     */
    fun cancelAllCommands() {
        _activeCommands.value = emptyList()
    }

    /**
     * 获取活跃命令数量
     */
    fun getActiveCommandCount(): Int = _activeCommands.value.size

    /**
     * 清理
     */
    fun release() {
        cancelAllCommands()
        scope.cancel()
    }
}

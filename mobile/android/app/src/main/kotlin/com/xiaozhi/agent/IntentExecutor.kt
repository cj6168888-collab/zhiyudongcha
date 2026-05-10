package com.xiaozhi.agent

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Bundle
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Intent执行器 - 小星手机端Agent核心组件
 *
 * 功能：
 * - 执行App调用Intent
 * - 处理deeplink调用
 * - 管理程序启动返回
 * - 支持隐式/显式Intent
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class IntentExecutor(private val context: Context) {

    companion object {
        private const val TAG = "IntentExecutor"
    }

    // 执行结果状态
    sealed class ExecutionResult {
        data class Success(val packageName: String, val activity: String? = null) : ExecutionResult()
        data class Error(val code: Int, val message: String) : ExecutionResult()
        data object NotFound : ExecutionResult()
        data object NoPermission : ExecutionResult()
    }

    // Intent类型
    enum class IntentType {
        EXPLICIT,     // 显式Intent - 指定包名/组件名
        IMPLICIT,     // 隐式Intent - 通过action/category匹配
        DEEPLINK,     // DeepLink - URL格式
        URI           // URI格式
    }

    // 执行结果Flow
    private val _executionResult = MutableStateFlow<ExecutionResult?>(null)
    val executionResult: StateFlow<ExecutionResult?> = _executionResult

    // 协程作用域
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // 预定义Intent Action映射
    private val commonIntentActions = mapOf(
        // 社交
        "打开微信" to IntentInfo("weixin://", IntentType.DEEPLINK, "com.tencent.mm"),
        "微信" to IntentInfo("weixin://", IntentType.DEEPLINK, "com.tencent.mm"),
        "发送微信" to IntentInfo("weixin://", IntentType.DEEPLINK, "com.tencent.mm"),
        "打开钉钉" to IntentInfo("dingtalk://", IntentType.DEEPLINK, "com.alibaba.android.rimet"),
        "钉钉" to IntentInfo("dingtalk://", IntentType.DEEPLINK, "com.alibaba.android.rimet"),
        "打开QQ" to IntentInfo("mqqapi://", IntentType.DEEPLINK, "com.tencent.mobileqq"),
        "QQ" to IntentInfo("mqqapi://", IntentType.DEEPLINK, "com.tencent.mobileqq"),
        "打开微博" to IntentInfo("sinaweibo://", IntentType.DEEPLINK, "com.sina.weibo"),
        "微博" to IntentInfo("sinaweibo://", IntentType.DEEPLINK, "com.sina.weibo"),

        // 地图导航
        "打开高德地图" to IntentInfo("amapuri://", IntentType.DEEPLINK, "com.autonavi.minimap"),
        "高德地图" to IntentInfo("amapuri://", IntentType.DEEPLINK, "com.autonavi.minimap"),
        "高德" to IntentInfo("amapuri://", IntentType.DEEPLINK, "com.autonavi.minimap"),
        "打开百度地图" to IntentInfo("baidumap://", IntentType.DEEPLINK, "com.baidu.BaiduMap"),
        "百度地图" to IntentInfo("baidumap://", IntentType.DEEPLINK, "com.baidu.BaiduMap"),
        "打开腾讯地图" to IntentInfo("qqmap://", IntentType.DEEPLINK, "com.tencent.map"),
        "腾讯地图" to IntentInfo("qqmap://", IntentType.DEEPLINK, "com.tencent.map"),

        // 支付
        "打开支付宝" to IntentInfo("alipay://", IntentType.DEEPLINK, "com.eg.android.AlipayGphone"),
        "支付宝" to IntentInfo("alipay://", IntentType.DEEPLINK, "com.eg.android.AlipayGphone"),
        "微信支付" to IntentInfo("weixin://wap/pay", IntentType.DEEPLINK, "com.tencent.mm"),

        // 电商
        "打开淘宝" to IntentInfo("taobao://", IntentType.DEEPLINK, "com.taobao.taobao4android"),
        "淘宝" to IntentInfo("taobao://", IntentType.DEEPLINK, "com.taobao.taobao4android"),
        "打开京东" to IntentInfo("openapp.jdmoble://", IntentType.DEEPLINK, "com.jingdong.app.mall"),
        "京东" to IntentInfo("openapp.jdmoble://", IntentType.DEEPLINK, "com.jingdong.app.mall"),
        "打开拼多多" to IntentInfo("pinduoduo://", IntentType.DEEPLINK, "com.xunmeng.pinduoduo"),
        "拼多多" to IntentInfo("pinduoduo://", IntentType.DEEPLINK, "com.xunmeng.pinduoduo"),

        // 音乐
        "打开网易云音乐" to IntentInfo("orpheus://", IntentType.DEEPLINK, "com.shanling.music"),
        "网易云音乐" to IntentInfo("orpheus://", IntentType.DEEPLINK, "com.shanling.music"),
        "打开QQ音乐" to IntentInfo("qqmusic://", IntentType.DEEPLINK, "com.tencent.qqmusic"),
        "QQ音乐" to IntentInfo("qqmusic://", IntentType.DEEPLINK, "com.tencent.qqmusic"),
        "打开酷狗" to IntentInfo("kugou://", IntentType.DEEPLINK, "com.kugou.android"),
        "酷狗" to IntentInfo("kugou://", IntentType.DEEPLINK, "com.kugou.android"),

        // 视频
        "打开抖音" to IntentInfo("snssdk1128://", IntentType.DEEPLINK, "com.ss.android.ugc.aweme"),
        "抖音" to IntentInfo("snssdk1128://", IntentType.DEEPLINK, "com.ss.android.ugc.aweme"),
        "打开快手" to IntentInfo("kwai://", IntentType.DEEPLINK, "com.smile.gifmaker"),
        "快手" to IntentInfo("kwai://", IntentType.DEEPLINK, "com.smile.gifmaker"),
        "打开哔哩哔哩" to IntentInfo("bilibili://", IntentType.DEEPLINK, "tv.danmaku.bili"),
        "哔哩哔哩" to IntentInfo("bilibili://", IntentType.DEEPLINK, "tv.danmaku.bili"),
        "B站" to IntentInfo("bilibili://", IntentType.DEEPLINK, "tv.danmaku.bili"),
        "打开腾讯视频" to IntentInfo("tenvideo://", IntentType.DEEPLINK, "com.tencent.qqlive"),
        "腾讯视频" to IntentInfo("tenvideo://", IntentType.DEEPLINK, "com.tencent.qqlive"),
        "打开爱奇艺" to IntentInfo("iqiyi://", IntentType.DEEPLINK, "com.qiyi.video"),
        "爱奇艺" to IntentInfo("iqiyi://", IntentType.DEEPLINK, "com.qiyi.video"),
        "打开优酷" to IntentInfo("youku://", IntentType.DEEPLINK, "com.youku.phone"),
        "优酷" to IntentInfo("youku://", IntentType.DEEPLINK, "com.youku.phone"),

        // 出行
        "打开滴滴" to IntentInfo("didiclient://", IntentType.DEEPLINK, "com.sdu.didi.psnger"),
        "滴滴" to IntentInfo("didiclient://", IntentType.DEEPLINK, "com.sdu.didi.psnger"),
        "打开携程" to IntentInfo("ctrip://", IntentType.DEEPLINK, "ctrip.android.view"),
        "携程" to IntentInfo("ctrip://", IntentType.DEEPLINK, "ctrip.android.view"),
        "打开美团" to IntentInfo("meituan://", IntentType.DEEPLINK, "com.sankuai.meituan"),
        "美团" to IntentInfo("meituan://", IntentType.DEEPLINK, "com.sankuai.meituan"),
        "打开飞猪" to IntentInfo("alipay://alipayqr/?platform=android&sessionid=*", IntentType.DEEPLINK, "com.taobao.flight"),
        "飞猪" to IntentInfo("alipay://alipayqr/?platform=android&sessionid=*", IntentType.DEEPLINK, "com.taobao.flight"),

        // 系统
        "打开设置" to IntentInfo(Intent.ACTION_SETTINGS, IntentType.IMPLICIT),
        "设置" to IntentInfo(Intent.ACTION_SETTINGS, IntentType.IMPLICIT),
        "打开相机" to IntentInfo(Intent.ACTION_CAMERA_BUTTON, IntentType.IMPLICIT),
        "相机" to IntentInfo(Intent.ACTION_CAMERA_BUTTON, IntentType.IMPLICIT),
        "打开浏览器" to IntentInfo(Intent.ACTION_VIEW, IntentType.IMPLICIT),
        "浏览器" to IntentInfo(Intent.ACTION_VIEW, IntentType.IMPLICIT),
        "打开联系人" to IntentInfo(Intent.ACTION_VIEW, IntentType.IMPLICIT, "com.android.contacts"),
        "联系人" to IntentInfo(Intent.ACTION_VIEW, IntentType.IMPLICIT, "com.android.contacts"),
        "打开日历" to IntentInfo(Intent.ACTION_VIEW, IntentType.IMPLICIT, "com.android.calendar"),
        "日历" to IntentInfo(Intent.ACTION_VIEW, IntentType.IMPLICIT, "com.android.calendar"),
        "打开计算器" to IntentInfo(Intent.ACTION_MAIN, IntentType.EXPLICIT, "com.android.calculator2"),
        "计算器" to IntentInfo(Intent.ACTION_MAIN, IntentType.EXPLICIT, "com.android.calculator2"),
        "打开文件管理" to IntentInfo(Intent.ACTION_GET_CONTENT, IntentType.IMPLICIT),
        "文件管理" to IntentInfo(Intent.ACTION_GET_CONTENT, IntentType.IMPLICIT)
    )

    data class IntentInfo(
        val uri: String,
        val type: IntentType,
        val fallbackPackage: String? = null
    )

    /**
     * 执行Intent
     */
    fun execute(
        action: String,
        params: Map<String, String> = emptyMap(),
        callback: ((ExecutionResult) -> Unit)? = null
    ) {
        scope.launch {
            val result = executeInternal(action, params)
            _executionResult.value = result
            callback?.invoke(result)
        }
    }

    /**
     * 同步执行Intent
     */
    suspend fun executeAsync(
        action: String,
        params: Map<String, String> = emptyMap()
    ): ExecutionResult = withContext(Dispatchers.Main) {
        executeInternal(action, params)
    }

    /**
     * 内部执行逻辑
     */
    private fun executeInternal(
        action: String,
        params: Map<String, String>
    ): ExecutionResult {
        Log.d(TAG, "Executing intent: $action with params: $params")

        // 1. 查找预定义Intent
        val intentInfo = findPredefinedIntent(action)

        // 2. 构建Intent
        val intent = buildIntent(intentInfo, action, params)

        // 3. 检查包是否存在
        val packageName = intentInfo?.fallbackPackage ?: extractPackageFromUri(intent.uri)
        if (packageName != null && !isPackageInstalled(packageName)) {
            Log.w(TAG, "Package not installed: $packageName")
            return ExecutionResult.NotFound
        }

        // 4. 尝试启动
        return try {
            if (intent.resolveActivity(context.packageManager) != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                Log.i(TAG, "Intent executed successfully: ${intent.toURI()}")
                ExecutionResult.Success(packageName ?: "unknown")
            } else {
                // 尝试使用包管理器直接启动
                if (packageName != null) {
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(launchIntent)
                        Log.i(TAG, "Launched via package manager: $packageName")
                        ExecutionResult.Success(packageName)
                    } else {
                        Log.w(TAG, "No activity found for: $packageName")
                        ExecutionResult.NotFound
                    }
                } else {
                    ExecutionResult.NotFound
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied", e)
            ExecutionResult.NoPermission
        } catch (e: Exception) {
            Log.e(TAG, "Intent execution failed", e)
            ExecutionResult.Error(-1, e.message ?: "Unknown error")
        }
    }

    /**
     * 查找预定义Intent
     */
    private fun findPredefinedIntent(action: String): IntentInfo? {
        // 精确匹配
        commonIntentActions[action]?.let { return it }

        // 模糊匹配
        for ((key, value) in commonIntentActions) {
            if (action.contains(key) || key.contains(action)) {
                return value
            }
        }

        return null
    }

    /**
     * 构建Intent
     */
    private fun buildIntent(
        intentInfo: IntentInfo?,
        action: String,
        params: Map<String, String>
    ): Intent {
        val intent = when (intentInfo?.type) {
            IntentType.DEEPLINK, IntentType.URI -> {
                var uri = intentInfo.uri

                // 替换参数到URI中
                for ((key, value) in params) {
                    uri = uri.replace("{$key}", value)
                    uri = "$uri&$key=$value"
                }

                Intent(Intent.ACTION_VIEW, Uri.parse(uri))
            }

            IntentType.IMPLICIT -> {
                val intent = Intent(intentInfo.uri)

                // 添加类别
                intent.addCategory(Intent.CATEGORY_DEFAULT)

                // 添加额外参数
                for ((key, value) in params) {
                    intent.putExtra(key, value)
                }

                intent
            }

            IntentType.EXPLICIT, null -> {
                if (intentInfo?.fallbackPackage != null) {
                    Intent(Intent.ACTION_MAIN).apply {
                        setPackage(intentInfo.fallbackPackage)
                    }
                } else {
                    // 尝试解析为包名
                    val packageName = extractPackageFromUri(action)
                    if (packageName != null) {
                        Intent(Intent.ACTION_MAIN).apply {
                            setPackage(packageName)
                        }
                    } else {
                        // 回退到浏览器搜索
                        Intent(Intent.ACTION_WEB_SEARCH).apply {
                            putExtra("query", action)
                        }
                    }
                }
            }
        }

        return intent
    }

    /**
     * 检查包是否安装
     */
    fun isPackageInstalled(packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    /**
     * 从URI提取包名
     */
    private fun extractPackageFromUri(uri: String): String? {
        // 从 host 提取，例如 weixin:// -> com.tencent.mm
        val hostMap = mapOf(
            "weixin" to "com.tencent.mm",
            "dingtalk" to "com.alibaba.android.rimet",
            "mqqapi" to "com.tencent.mobileqq",
            "amapuri" to "com.autonavi.minimap",
            "baidumap" to "com.baidu.BaiduMap",
            "qqmap" to "com.tencent.map",
            "alipay" to "com.eg.android.AlipayGphone",
            "taobao" to "com.taobao.taobao4android",
            "orpheus" to "com.shanling.music",
            "bilibili" to "tv.danmaku.bili",
            "snssdk1128" to "com.ss.android.ugc.aweme",
            "ctrip" to "ctrip.android.view",
            "meituan" to "com.sankuai.meituan"
        )

        try {
            val parsedUri = Uri.parse(uri)
            val host = parsedUri.host ?: return null
            return hostMap[host]
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * 获取已安装的可启动应用列表
     */
    fun getInstalledApps(): List<ResolveInfo> {
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        return context.packageManager.queryIntentActivities(mainIntent, 0)
    }

    /**
     * 搜索应用
     */
    fun searchApp(keyword: String): List<ResolveInfo> {
        return getInstalledApps().filter { resolveInfo ->
            val appName = resolveInfo.loadLabel(context.packageManager).toString()
            val packageName = resolveInfo.activityInfo.packageName
            appName.contains(keyword, ignoreCase = true) ||
            packageName.contains(keyword, ignoreCase = true)
        }
    }

    /**
     * 执行拨号
     */
    fun dial(phoneNumber: String): ExecutionResult {
        return try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            ExecutionResult.Success("android.dial")
        } catch (e: Exception) {
            ExecutionResult.Error(-1, e.message ?: "Dial failed")
        }
    }

    /**
     * 发送短信
     */
    fun sendSms(phoneNumber: String, message: String = ""): ExecutionResult {
        return try {
            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phoneNumber")).apply {
                putExtra("sms_body", message)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            ExecutionResult.Success("android.sms")
        } catch (e: Exception) {
            ExecutionResult.Error(-1, e.message ?: "Send SMS failed")
        }
    }

    /**
     * 打开网页
     */
    fun openUrl(url: String): ExecutionResult {
        return try {
            var finalUrl = url
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                finalUrl = "https://$url"
            }
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(finalUrl))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            ExecutionResult.Success("browser")
        } catch (e: Exception) {
            ExecutionResult.Error(-1, e.message ?: "Open URL failed")
        }
    }

    /**
     * 导航到地点
     */
    fun navigateTo(address: String): ExecutionResult {
        // 优先使用高德地图
        return try {
            val encodedAddress = Uri.encode(address)

            // 尝试高德地图
            val gaodeUri = "amapuri://route/plan?dlat=0&dlon=0&dname=$encodedAddress&dev=0"
            val gaodeIntent = Intent(Intent.ACTION_VIEW, Uri.parse(gaodeUri))
            gaodeIntent.setPackage("com.autonavi.minimap")

            if (gaodeIntent.resolveActivity(context.packageManager) != null) {
                gaodeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(gaodeIntent)
                ExecutionResult.Success("com.autonavi.minimap")
            } else {
                // 回退到浏览器
                val webUrl = "https://restapi.amap.com/v3/geocode/geo?address=$encodedAddress"
                openUrl(webUrl)
            }
        } catch (e: Exception) {
            ExecutionResult.Error(-1, e.message ?: "Navigate failed")
        }
    }

    /**
     * 清理
     */
    fun release() {
        scope.cancel()
    }
}

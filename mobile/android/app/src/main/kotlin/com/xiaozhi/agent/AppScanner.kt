package com.xiaozhi.agent

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.os.Build
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

/**
 * 应用扫描器 - 小星手机端Agent核心组件
 *
 * 功能：
 * - 扫描设备已安装应用
 * - 识别常用应用（微信、钉钉等）
 * - 提取应用能力信息
 * - 上报程序列表到云端
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class AppScanner(private val context: Context) {

    companion object {
        private const val TAG = "AppScanner"

        // 常用应用包名映射
        val KNOWN_APPS = mapOf(
            // 社交
            "com.tencent.mm" to AppInfo("微信", "social", "发送消息、朋友圈、支付"),
            "com.tencent.mobileqq" to AppInfo("QQ", "social", "即时通讯"),
            "com.alibaba.android.rimet" to AppInfo("钉钉", "work", "工作通讯、会议、审批"),
            "com.sina.weibo" to AppInfo("微博", "social", "社交媒体"),
            "com.twitter.android" to AppInfo("Twitter", "social", "社交媒体"),

            // 地图导航
            "com.autonavi.minimap" to AppInfo("高德地图", "tool", "导航、定位、打车"),
            "com.baidu.BaiduMap" to AppInfo("百度地图", "tool", "导航、定位"),
            "com.tencent.map" to AppInfo("腾讯地图", "tool", "导航、定位"),

            // 支付
            "com.eg.android.AlipayGphone" to AppInfo("支付宝", "tool", "支付、转账、理财"),

            // 电商
            "com.taobao.taobao4android" to AppInfo("淘宝", "shopping", "网购"),
            "com.jingdong.app.mall" to AppInfo("京东", "shopping", "网购"),
            "com.xunmeng.pinduoduo" to AppInfo("拼多多", "shopping", "网购"),
            "com.sankuai.meituan" to AppInfo("美团", "shopping", "外卖、团购"),

            // 音乐
            "com.shanling.music" to AppInfo("网易云音乐", "media", "音乐播放"),
            "com.tencent.qqmusic" to AppInfo("QQ音乐", "media", "音乐播放"),
            "com.kugou.android" to AppInfo("酷狗音乐", "media", "音乐播放"),

            // 视频
            "com.ss.android.ugc.aweme" to AppInfo("抖音", "media", "短视频"),
            "com.smile.gifmaker" to AppInfo("快手", "media", "短视频"),
            "tv.danmaku.bili" to AppInfo("哔哩哔哩", "media", "视频"),
            "com.tencent.qqlive" to AppInfo("腾讯视频", "media", "视频"),
            "com.qiyi.video" to AppInfo("爱奇艺", "media", "视频"),
            "com.youku.phone" to AppInfo("优酷", "media", "视频"),

            // 出行
            "com.sdu.didi.psnger" to AppInfo("滴滴出行", "transport", "打车"),
            "com.autonavi.map" to AppInfo("高德打车", "transport", "打车"),
            "ctrip.android.view" to AppInfo("携程旅行", "transport", "旅行、酒店"),

            // 办公
            "com.microsoft.office.word" to AppInfo("Microsoft Word", "work", "文档编辑"),
            "com.microsoft.office.excel" to AppInfo("Microsoft Excel", "work", "表格处理"),
            "com.microsoft.office.powerpoint" to AppInfo("Microsoft PowerPoint", "work", "幻灯片"),
            "com.alibaba.android.AliMail" to AppInfo("阿里邮箱", "work", "邮件"),
            "com.tencent.android.qqmail" to AppInfo("QQ邮箱", "work", "邮件"),

            // 新闻
            "com.ss.android.lark" to AppInfo("飞书", "work", "协作办公"),
            "com.tencent.wetype" to AppInfo("腾讯文档", "work", "在线文档"),

            // 工具
            "com.tencent.mm" to AppInfo("微信", "social", "消息、支付"),
            "com.UCMobile" to AppInfo("UC浏览器", "tool", "浏览器"),
            "com.UCMobile.intl" to AppInfo("UC浏览器国际版", "tool", "浏览器")
        )

        // 应用类别
        val CATEGORIES = mapOf(
            "social" to "社交",
            "work" to "办公",
            "tool" to "工具",
            "media" to "娱乐",
            "shopping" to "购物",
            "transport" to "出行",
            "other" to "其他"
        )
    }

    data class AppInfo(
        val name: String,
        val category: String,
        val description: String
    )

    // 应用列表状态
    private val _installedApps = MutableStateFlow<List<InstalledApp>>(emptyList())
    val installedApps: StateFlow<List<InstalledApp>> = _installedApps

    // 扫描状态
    private val _scanStatus = MutableStateFlow<ScanStatus>(ScanStatus.Idle)
    val scanStatus: StateFlow<ScanStatus> = _scanStatus

    sealed class ScanStatus {
        data object Idle : ScanStatus()
        data object Scanning : ScanStatus()
        data class Completed(val count: Int) : ScanStatus()
        data class Error(val message: String) : ScanStatus()
    }

    data class InstalledApp(
        val packageName: String,
        val name: String,
        val category: String,
        val description: String,
        val version: String,
        val hasDeepLink: Boolean,
        val deepLinkSchemes: List<String>,
        val isSystemApp: Boolean,
        val installedAt: Long
    )

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * 扫描所有已安装应用
     */
    fun scanAllApps() {
        scope.launch {
            _scanStatus.value = ScanStatus.Scanning
            try {
                val apps = scanAppsInternal()
                _installedApps.value = apps
                _scanStatus.value = ScanStatus.Completed(apps.size)
                Log.i(TAG, "Scanned ${apps.size} apps")
            } catch (e: Exception) {
                Log.e(TAG, "Scan failed", e)
                _scanStatus.value = ScanStatus.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * 同步扫描
     */
    suspend fun scanAllAppsAsync(): List<InstalledApp> = withContext(Dispatchers.IO) {
        scanAppsInternal()
    }

    /**
     * 内部扫描逻辑
     */
    private fun scanAppsInternal(): List<InstalledApp> {
        val pm = context.packageManager
        val apps = mutableListOf<InstalledApp>()

        // 获取所有已安装应用
        val packages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(PackageManager.GET_ACTIVITIES.toLong()))
        } else {
            @Suppress("DEPRECATION")
            pm.getInstalledPackages(PackageManager.GET_ACTIVITIES)
        }

        for (packageInfo in packages) {
            try {
                val packageName = packageInfo.packageName

                // 跳过系统更新应用
                if (isSystemUpdateApp(packageName)) continue

                // 获取应用信息
                val appName = try {
                    pm.getApplicationLabel(packageInfo.applicationInfo).toString()
                } catch (e: Exception) {
                    packageName
                }

                val version = try {
                    packageInfo.versionName ?: "unknown"
                } catch (e: Exception) {
                    "unknown"
                }

                val isSystemApp = try {
                    (packageInfo.applicationInfo?.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                } catch (e: Exception) {
                    false
                }

                // 检查是否有启动Activity
                val hasLauncher = pm.getLaunchIntentForPackage(packageName) != null
                if (!hasLauncher) continue

                // 获取Deep Link支持
                val (hasDeepLink, schemes) = analyzeDeepLinks(pm, packageName)

                // 识别应用类别和描述
                val (category, description) = KNOWN_APPS[packageName]?.let {
                    Pair(it.category, it.description)
                } ?: Pair("other", "应用程序")

                apps.add(InstalledApp(
                    packageName = packageName,
                    name = appName,
                    category = category,
                    description = description,
                    version = version,
                    hasDeepLink = hasDeepLink,
                    deepLinkSchemes = schemes,
                    isSystemApp = isSystemApp,
                    installedAt = packageInfo.firstInstallTime
                ))

            } catch (e: Exception) {
                Log.w(TAG, "Failed to scan package: ${packageInfo.packageName}", e)
            }
        }

        return apps.sortedBy { it.name }
    }

    /**
     * 分析应用的Deep Link支持
     */
    private fun analyzeDeepLinks(pm: PackageManager, packageName: String): Pair<Boolean, List<String>> {
        val schemes = mutableSetOf<String>()

        try {
            // 获取应用的所有Activity
            val activities = pm.getPackageInfo(
                packageName,
                PackageManager.GET_ACTIVITIES
            ).activities ?: return Pair(false, emptyList())

            for (activity in activities) {
                activity?.intentFilters?.forEach { filter ->
                    filter.actions?.forEach { action ->
                        if (action.names?.any { it.contains("VIEW", ignoreCase = true) } == true) {
                            filter.data?.schemes?.forEach { scheme ->
                                schemes.add(scheme)
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.d(TAG, "Failed to analyze deep links for $packageName")
        }

        return Pair(schemes.isNotEmpty(), schemes.toList())
    }

    /**
     * 检查是否是系统更新应用
     */
    private fun isSystemUpdateApp(packageName: String): Boolean {
        val systemUpdatePackages = setOf(
            "com.google.android.gms",
            "com.google.android.gsf",
            "com.android.vending",
            "com.android.providers.downloads"
        )
        return packageName in systemUpdatePackages
    }

    /**
     * 获取常用应用
     */
    fun getPopularApps(): List<InstalledApp> {
        return _installedApps.value.filter { it.packageName in KNOWN_APPS.keys }
    }

    /**
     * 按类别获取应用
     */
    fun getAppsByCategory(category: String): List<InstalledApp> {
        return _installedApps.value.filter { it.category == category }
    }

    /**
     * 搜索应用
     */
    fun searchApps(keyword: String): List<InstalledApp> {
        return _installedApps.value.filter {
            app -> app.name.contains(keyword, ignoreCase = true) ||
                   app.packageName.contains(keyword, ignoreCase = true) ||
                   app.description.contains(keyword, ignoreCase = true)
        }
    }

    /**
     * 生成上报到云端的数据
     */
    fun generateReport(): String {
        val apps = _installedApps.value
        val json = JSONObject()

        json.put("deviceId", getDeviceId())
        json.put("scanTime", System.currentTimeMillis())
        json.put("totalApps", apps.size)

        // 按类别分组
        val byCategory = JSONObject()
        for ((category, categoryName) in CATEGORIES) {
            val categoryApps = apps.filter { it.category == category }
            if (categoryApps.isNotEmpty()) {
                val categoryArray = JSONArray()
                for (app in categoryApps) {
                    val appJson = JSONObject().apply {
                        put("packageName", app.packageName)
                        put("name", app.name)
                        put("hasDeepLink", app.hasDeepLink)
                        put("deepLinkSchemes", JSONArray(app.deepLinkSchemes))
                    }
                    categoryArray.put(appJson)
                }
                byCategory.put(categoryName, categoryArray)
            }
        }
        json.put("byCategory", byCategory)

        // Deep Link支持的应用
        val deepLinkApps = JSONArray()
        for (app in apps.filter { it.hasDeepLink }) {
            deepLinkApps.put(JSONObject().apply {
                put("name", app.name)
                put("packageName", app.packageName)
                put("schemes", JSONArray(app.deepLinkSchemes))
            })
        }
        json.put("deepLinkApps", deepLinkApps)

        return json.toString(2)
    }

    /**
     * 获取设备ID
     */
    private fun getDeviceId(): String {
        return try {
            val prefs = context.getSharedPreferences("xiaozhi_prefs", Context.MODE_PRIVATE)
            prefs.getString("device_id", "unknown") ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }
    }

    /**
     * 获取可调用Intent的应用列表
     */
    fun getCallableApps(): List<InstalledApp> {
        return _installedApps.value.filter { it.hasDeepLink || it.packageName in KNOWN_APPS.keys }
    }

    /**
     * 检查应用是否已安装
     */
    fun isAppInstalled(packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    /**
     * 获取应用信息
     */
    fun getAppInfo(packageName: String): InstalledApp? {
        return _installedApps.value.find { it.packageName == packageName }
    }

    /**
     * 清理
     */
    fun release() {
        scope.cancel()
    }
}

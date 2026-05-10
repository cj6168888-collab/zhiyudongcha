package com.xiaozhi.companion.utils

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

object BatteryOptimization {
    private const val TAG = "BatteryOptimization"

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    @SuppressLint("BatteryLife")
    fun requestIgnoreBatteryOptimization(context: Context): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request battery optimization: ${e.message}")
            try {
                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                context.startActivity(intent)
                true
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to open battery settings: ${e2.message}")
                false
            }
        }
    }

    fun openBatterySettings(context: Context): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open battery settings: ${e.message}")
            false
        }
    }

    fun getManufacturer(): String = Build.MANUFACTURER.lowercase()

    fun isHuawei(): Boolean = getManufacturer().contains("huawei") || getManufacturer().contains("honor")

    fun isXiaomi(): Boolean = getManufacturer().contains("xiaomi") || getManufacturer().contains("redmi")

    fun isOPPO(): Boolean = getManufacturer().contains("oppo") || getManufacturer().contains("realme")

    fun isVivo(): Boolean = getManufacturer().contains("vivo") || getManufacturer().contains("iqoo")

    fun isSamsung(): Boolean = getManufacturer().contains("samsung")

    fun isOnePlus(): Boolean = getManufacturer().contains("oneplus")

    fun isMeizu(): Boolean = getManufacturer().contains("meizu")

    fun isASUS(): Boolean = getManufacturer().contains("asus")

    fun openManufacturerBatterySettings(context: Context): Boolean {
        val intents = getManufacturerIntents(context)
        
        for (intent in intents) {
            if (isIntentAvailable(context, intent)) {
                try {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    Log.d(TAG, "Opened manufacturer battery settings: ${intent.component}")
                    return true
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start activity: ${e.message}")
                }
            }
        }
        
        Log.w(TAG, "No manufacturer-specific settings found, opening default")
        return openBatterySettings(context)
    }

    private fun getManufacturerIntents(context: Context): List<Intent> {
        val packageName = context.packageName
        val intents = mutableListOf<Intent>()

        if (isHuawei()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.optimize.process.ProtectActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.power.ui.HwPowerManagerActivity"
                )
            })
        }

        if (isXiaomi()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.powercenter.PowerSettings"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.powercenter.PowerUsageModelActivity"
                )
            })
        }

        if (isOPPO()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.startupapp.StartupAppListActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.coloros.oppoguardelf",
                    "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity"
                )
            })
        }

        if (isVivo()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.WhtelistOfBgStartUp"
                )
            })
        }

        if (isSamsung()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.samsung.android.lool",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.samsung.android.sm",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.samsung.android.sm.battery",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"
                )
            })
        }

        if (isOnePlus()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.oneplus.security",
                    "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.oneplus.security",
                    "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"
                )
            })
        }

        if (isMeizu()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.meizu.safe",
                    "com.meizu.safe.permission.SmartBGActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.meizu.safe",
                    "com.meizu.safe.security.SHOW_APPSEC"
                )
            })
        }

        if (isASUS()) {
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.asus.mobilemanager",
                    "com.asus.mobilemanager.autostart.AutoStartActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.asus.mobilemanager",
                    "com.asus.mobilemanager.entry.FunctionActivity"
                )
            })
            intents.add(Intent().apply {
                component = ComponentName(
                    "com.asus.mobilemanager",
                    "com.asus.mobilemanager.MainActivity"
                )
            })
        }

        return intents
    }

    private fun isIntentAvailable(context: Context, intent: Intent): Boolean {
        return try {
            val resolveInfo = context.packageManager.resolveActivity(
                intent,
                PackageManager.MATCH_DEFAULT_ONLY
            )
            resolveInfo != null
        } catch (e: Exception) {
            Log.w(TAG, "Intent availability check failed: ${e.message}")
            false
        }
    }

    fun getManufacturerName(): String {
        return when {
            isHuawei() -> "华为/荣耀"
            isXiaomi() -> "小米/红米"
            isOPPO() -> "OPPO/Realme"
            isVivo() -> "Vivo/iQOO"
            isSamsung() -> "三星"
            isOnePlus() -> "一加"
            isMeizu() -> "魅族"
            isASUS() -> "华硕"
            else -> "其他"
        }
    }

    fun getOptimizationTips(): String {
        return when {
            isHuawei() -> "请在启动管理中启用小智助手的自动启动，并在电池优化中设为不优化"
            isXiaomi() -> "请在自启动管理中允许小智助手自启动，并在电量优化中设为无限制"
            isOPPO() -> "请在允许自动启动中允许小智助手，并在电池优化中关闭省电"
            isVivo() -> "请在后高耗电中允许小智助手，并在自启动中允许"
            isSamsung() -> "请在电池设置中将小智助手设为不受限制"
            isOnePlus() -> "请在自启动管理中允许小智助手，并在电池优化中关闭"
            isMeizu() -> "请在电量管理中允许小智助手后台运行"
            isASUS() -> "请在自动启动管理中允许小智助手，并在电池管理中设为无限制"
            else -> "请在系统设置中允许小智助手后台运行和自启动"
        }
    }
}

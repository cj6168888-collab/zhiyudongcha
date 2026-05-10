package com.avatar.companion.service

import android.app.ActivityManager
import android.app.usage.StorageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.storage.StorageManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 免疫系统遥测 - 收集设备应用信息
 * 
 * 功能：
 * 1. 扫描已安装应用
 * 2. 获取应用权限
 * 3. 收集资源使用情况
 * 4. 检测后台活动
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */
class ImmuneTelemetry(private val context: Context) {
    
    companion object {
        private const val TAG = "ImmuneTelemetry"
    }
    
    private val pm: PackageManager = context.packageManager
    private val am: ActivityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    
    /**
     * 收集所有已安装应用的信息
     */
    fun collectInstalledApps(): JSONArray {
        val apps = JSONArray()
        
        try {
            val packages = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS or PackageManager.GET_META_DATA)
            
            for (packageInfo in packages) {
                try {
                    val appInfo = collectAppInfo(packageInfo)
                    apps.put(appInfo)
                } catch (e: Exception) {
                    Log.w(TAG, "收集应用信息失败: ${packageInfo.packageName}", e)
                }
            }
            
            Log.i(TAG, "已收集 ${apps.length()} 个应用信息")
            
        } catch (e: Exception) {
            Log.e(TAG, "收集应用列表失败", e)
        }
        
        return apps
    }
    
    /**
     * 收集单个应用的详细信息
     */
    private fun collectAppInfo(packageInfo: PackageInfo): JSONObject {
        val appInfo = packageInfo.applicationInfo
        val packageName = packageInfo.packageName
        
        return JSONObject().apply {
            put("packageName", packageName)
            put("appName", appInfo?.let { pm.getApplicationLabel(it).toString() } ?: packageName)
            put("version", packageInfo.versionName ?: "unknown")
            put("isSystemApp", (appInfo?.flags ?: 0) and ApplicationInfo.FLAG_SYSTEM != 0)
            
            // 权限列表
            val permissions = JSONArray()
            packageInfo.requestedPermissions?.forEach { permissions.put(it) }
            put("permissionsGranted", permissions)
            
            // 资源使用估算
            put("memoryUsageMb", getAppMemoryUsage(packageName))
            put("storageUsageMb", getAppStorageUsage(packageName))
            put("batteryDrainPercent", estimateBatteryDrain(packageName))
            put("cpuUsagePercent", 0.0) // 需要 root 权限才能精确获取
            put("networkUsageMb", 0.0) // 需要 PACKAGE_USAGE_STATS 权限
            
            // 后台状态
            put("backgroundActivity", isAppRunningInBackground(packageName))
            put("autoStart", hasAutoStartPermission(packageName))
        }
    }
    
    /**
     * 获取应用内存使用
     */
    private fun getAppMemoryUsage(packageName: String): Double {
        try {
            val runningProcesses = am.runningAppProcesses ?: return 0.0
            
            for (process in runningProcesses) {
                if (process.processName == packageName) {
                    val memInfo = am.getProcessMemoryInfo(intArrayOf(process.pid))
                    if (memInfo.isNotEmpty()) {
                        return memInfo[0].totalPss / 1024.0 // 转换为 MB
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "获取内存使用失败: $packageName", e)
        }
        
        return 0.0
    }
    
    /**
     * 获取应用存储使用
     */
    private fun getAppStorageUsage(packageName: String): Double {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val storageStatsManager = context.getSystemService(Context.STORAGE_STATS_SERVICE) as StorageStatsManager
                val storageManager = context.getSystemService(Context.STORAGE_SERVICE) as StorageManager
                
                val uuid = storageManager.getUuidForPath(context.filesDir)
                val uid = pm.getApplicationInfo(packageName, 0).uid
                val storageStats = storageStatsManager.queryStatsForUid(uuid, uid)
                
                val totalBytes = storageStats.appBytes + storageStats.dataBytes + storageStats.cacheBytes
                return totalBytes / (1024.0 * 1024.0) // 转换为 MB
            }
        } catch (e: Exception) {
            // 忽略，可能是权限问题
        }
        
        // 回退方案：检查 APK 大小
        try {
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val apkFile = File(appInfo.sourceDir)
            return apkFile.length() / (1024.0 * 1024.0)
        } catch (e: Exception) {
            Log.w(TAG, "获取存储使用失败: $packageName", e)
        }
        
        return 0.0
    }
    
    /**
     * 估算电池消耗
     */
    private fun estimateBatteryDrain(packageName: String): Double {
        // 简单启发式：后台运行+网络权限=可能耗电
        try {
            val appInfo = pm.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
            var drainEstimate = 0.0
            
            // 是否在后台运行
            if (isAppRunningInBackground(packageName)) {
                drainEstimate += 2.0
            }
            
            // 检查高耗电权限
            val packageInfo = pm.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS)
            packageInfo.requestedPermissions?.forEach { permission ->
                when (permission) {
                    "android.permission.ACCESS_FINE_LOCATION",
                    "android.permission.ACCESS_BACKGROUND_LOCATION" -> drainEstimate += 3.0
                    "android.permission.WAKE_LOCK" -> drainEstimate += 1.0
                    "android.permission.RECEIVE_BOOT_COMPLETED" -> drainEstimate += 0.5
                }
            }
            
            return drainEstimate.coerceAtMost(10.0)
            
        } catch (e: Exception) {
            return 0.0
        }
    }
    
    /**
     * 检查应用是否在后台运行
     */
    private fun isAppRunningInBackground(packageName: String): Boolean {
        try {
            val runningProcesses = am.runningAppProcesses ?: return false
            
            for (process in runningProcesses) {
                if (process.processName == packageName) {
                    return process.importance > ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "检查后台状态失败: $packageName", e)
        }
        
        return false
    }
    
    /**
     * 检查是否有自启动权限
     */
    private fun hasAutoStartPermission(packageName: String): Boolean {
        try {
            val packageInfo = pm.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS)
            packageInfo.requestedPermissions?.forEach { permission ->
                if (permission == "android.permission.RECEIVE_BOOT_COMPLETED") {
                    return true
                }
            }
        } catch (e: Exception) {
            // 忽略
        }
        
        return false
    }
    
    /**
     * 获取系统资源摘要
     */
    fun getSystemResourceSummary(): JSONObject {
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val batteryLevel = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        
        return JSONObject().apply {
            put("totalMemoryMb", memInfo.totalMem / (1024 * 1024))
            put("availableMemoryMb", memInfo.availMem / (1024 * 1024))
            put("lowMemory", memInfo.lowMemory)
            put("batteryLevel", batteryLevel)
            put("timestamp", System.currentTimeMillis())
        }
    }
}

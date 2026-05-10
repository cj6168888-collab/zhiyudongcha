package com.xiaozhi.companion.utils

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.util.Log
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CrashHandler(private val context: Context) : Thread.UncaughtExceptionHandler {

    companion object {
        private const val TAG = "CrashHandler"

        @Volatile
        private var instance: CrashHandler? = null

        fun getInstance(context: Context): CrashHandler {
            return instance ?: synchronized(this) {
                instance ?: CrashHandler(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }

    private val defaultHandler: Thread.UncaughtExceptionHandler? = Thread.getDefaultUncaughtExceptionHandler()

    fun init() {
        Thread.setDefaultUncaughtExceptionHandler(this)
        Log.i(TAG, "Crash handler initialized")
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        Log.e(TAG, "Uncaught exception: ${throwable.message}", throwable)

        val crashInfo = gatherCrashInfo(thread, throwable)
        saveCrashLog(crashInfo)

        if (shouldRestartApp()) {
            restartApp()
        }

        defaultHandler?.uncaughtException(thread, throwable)
    }

    private fun gatherCrashInfo(thread: Thread, throwable: Throwable): String {
        val sw = StringWriter()
        val pw = PrintWriter(sw)

        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        
        pw.println("=== Crash Report ===")
        pw.println("Time: ${dateFormat.format(Date())}")
        pw.println("App Version: ${getAppVersion()}")
        pw.println("Android Version: ${Build.VERSION.RELEASE}")
        pw.println("Device: ${Build.MANUFACTURER} ${Build.MODEL}")
        pw.println("SDK: ${Build.VERSION.SDK_INT}")
        pw.println("Thread: ${thread.name}")
        pw.println()

        throwable.printStackTrace(pw)

        val causes = mutableListOf<Throwable>()
        var cause = throwable.cause
        while (cause != null) {
            causes.add(cause)
            cause = cause.cause
        }

        if (causes.isNotEmpty()) {
            pw.println()
            pw.println("=== Caused by ===")
            causes.forEach { c ->
                pw.println("${c.javaClass.name}: ${c.message}")
                c.printStackTrace(pw)
            }
        }

        return sw.toString()
    }

    private fun saveCrashLog(crashInfo: String) {
        try {
            val logDir = java.io.File(context.filesDir, "crash_logs")
            if (!logDir.exists()) {
                logDir.mkdirs()
            }

            val dateFormat = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault())
            val fileName = "crash_${dateFormat.format(Date())}.log"
            val crashFile = java.io.File(logDir, fileName)

            crashFile.writeText(crashInfo)
            Log.i(TAG, "Crash log saved: ${crashFile.absolutePath}")

            cleanOldCrashLogs(logDir)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save crash log: ${e.message}")
        }
    }

    private fun cleanOldCrashLogs(logDir: java.io.File) {
        val maxCrashLogs = 10
        val crashFiles = logDir.listFiles { file ->
            file.name.startsWith("crash_") && file.name.endsWith(".log")
        }?.sortedByDescending { it.lastModified() } ?: return

        if (crashFiles.size > maxCrashLogs) {
            crashFiles.drop(maxCrashLogs).forEach { file -> file.delete() }
        }
    }

    private fun shouldRestartApp(): Boolean {
        return try {
            val prefs = context.getSharedPreferences("xiaozhi_prefs", Context.MODE_PRIVATE)
            prefs.getBoolean("crash_auto_restart", true)
        } catch (e: Exception) {
            true
        }
    }

    private fun restartApp() {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            context.startActivity(intent)
            
            Log.i(TAG, "App restart initiated")
            
            Process.killProcess(Process.myPid())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restart app: ${e.message}")
        }
    }

    private fun getAppVersion(): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            "${packageInfo.versionName} (${packageInfo.versionCode})"
        } catch (e: Exception) {
            "Unknown"
        }
    }

    fun getCrashLogs(): List<java.io.File> {
        val logDir = java.io.File(context.filesDir, "crash_logs")
        return logDir.listFiles { file ->
            file.name.startsWith("crash_") && file.name.endsWith(".log")
        }?.sortedByDescending { it.lastModified() } ?: emptyList()
    }

    fun clearCrashLogs() {
        try {
            val logDir = java.io.File(context.filesDir, "crash_logs")
            logDir.listFiles()?.forEach { file -> file.delete() }
            Log.i(TAG, "Crash logs cleared")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear crash logs: ${e.message}")
        }
    }
}

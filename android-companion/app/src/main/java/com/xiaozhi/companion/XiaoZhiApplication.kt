package com.xiaozhi.companion

import android.app.Application
import com.xiaozhi.companion.utils.CrashHandler
import com.xiaozhi.companion.utils.Logger
import com.xiaozhi.companion.utils.PreferencesManager
import com.xiaozhi.companion.cache.CacheManager

class XiaoZhiApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        initLogger()
        CacheManager.init(this)
        initCrashHandler()
    }

    private fun initLogger() {
        Logger.init(this)
        
        val prefs = PreferencesManager.getInstance(this)
        Logger.setLogLevel(prefs.logLevel)
    }

    private fun initCrashHandler() {
        val crashHandler = CrashHandler.getInstance(this)
        crashHandler.init()
    }
}

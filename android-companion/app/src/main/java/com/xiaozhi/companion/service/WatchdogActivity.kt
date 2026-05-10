package com.xiaozhi.companion.service

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Process
import android.util.Log

class WatchdogActivity : Activity() {
    private val TAG = "WatchdogActivity"

    companion object {
        const val ACTION_LAUNCH = "com.xiaozhi.companion.LAUNCH_WATCHDOG"
        
        fun launch() {
            Log.d("WatchdogActivity", "Watchdog activity launched")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "WatchdogActivity onCreate")
        
        if (intent?.action == ACTION_LAUNCH) {
            Log.d(TAG, "Watchdog triggered, killing process")
            Process.killProcess(Process.myPid())
        }
        
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "WatchdogActivity destroyed")
    }
}

package com.avatar.companion.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.avatar.companion.Config
import com.avatar.companion.service.WebSocketService

/**
 * 开机自启广播接收器
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */
class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "BootReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
            Log.i(TAG, "设备启动完成，准备启动小智伴侣服务")
            
            Config.init(context)
            
            if (Config.serverUrl != Config.DEFAULT_SERVER_URL) {
                val serviceIntent = Intent(context, WebSocketService::class.java)
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                
                Log.i(TAG, "小智伴侣服务已启动")
            } else {
                Log.w(TAG, "服务器地址未配置，跳过自动启动")
            }
        }
    }
}

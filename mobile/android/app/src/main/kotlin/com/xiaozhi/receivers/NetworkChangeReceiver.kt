package com.xiaozhi.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.xiaozhi.services.XiaoZhiAgentService

/**
 * 网络变化监听器
 *
 * 功能：
 * - 监听网络连接变化
 * - 网络恢复时重新连接Agent
 *
 * @version 1.1.0
 * @date 2026-04-19
 */
class NetworkChangeReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "NetworkChangeReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Network change received: ${intent.action}")

        when (intent.action) {
            "android.net.conn.CONNECTIVITY_CHANGE" -> {
                handleConnectivityChange(context)
            }
        }
    }

    private fun handleConnectivityChange(context: Context) {
        // 网络恢复时，触发Agent重新连接
        // 这里可以使用 ConnectivityManager 来检查网络状态
        // 为了简单起见，直接请求同步
        XiaoZhiAgentService.requestSync(context)
    }
}

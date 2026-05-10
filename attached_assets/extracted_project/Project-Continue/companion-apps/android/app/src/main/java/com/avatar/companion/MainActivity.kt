package com.avatar.companion

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.avatar.companion.service.WebSocketService

/**
 * 主界面 - 状态显示和快速设置
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */
class MainActivity : AppCompatActivity() {
    
    private lateinit var tvConnectionStatus: TextView
    private lateinit var tvAccessibilityStatus: TextView
    private lateinit var tvServerUrl: TextView
    private lateinit var tvDeviceId: TextView
    private lateinit var btnConnect: Button
    private lateinit var btnSettings: Button
    private lateinit var btnAccessibility: Button
    private lateinit var btnBattery: Button
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        initViews()
        updateStatus()
    }
    
    override fun onResume() {
        super.onResume()
        updateStatus()
    }
    
    private fun initViews() {
        tvConnectionStatus = findViewById(R.id.tvConnectionStatus)
        tvAccessibilityStatus = findViewById(R.id.tvAccessibilityStatus)
        tvServerUrl = findViewById(R.id.tvServerUrl)
        tvDeviceId = findViewById(R.id.tvDeviceId)
        btnConnect = findViewById(R.id.btnConnect)
        btnSettings = findViewById(R.id.btnSettings)
        btnAccessibility = findViewById(R.id.btnAccessibility)
        btnBattery = findViewById(R.id.btnBattery)
        
        btnConnect.setOnClickListener { toggleConnection() }
        btnSettings.setOnClickListener { showSettingsDialog() }
        btnAccessibility.setOnClickListener { openAccessibilitySettings() }
        btnBattery.setOnClickListener { requestBatteryOptimizationExemption() }
    }
    
    private fun updateStatus() {
        tvServerUrl.text = "服务器: ${Config.serverUrl}"
        tvDeviceId.text = "设备ID: ${Config.deviceId}"
        
        val isAccessibilityEnabled = isAccessibilityServiceEnabled()
        tvAccessibilityStatus.text = if (isAccessibilityEnabled) "无障碍服务: 已开启" else "无障碍服务: 未开启"
        tvAccessibilityStatus.setTextColor(
            ContextCompat.getColor(this, if (isAccessibilityEnabled) android.R.color.holo_green_light else android.R.color.holo_red_light)
        )
        
        btnAccessibility.visibility = if (isAccessibilityEnabled) View.GONE else View.VISIBLE
        
        val isBatteryOptimized = !isIgnoringBatteryOptimizations()
        btnBattery.visibility = if (isBatteryOptimized) View.VISIBLE else View.GONE
    }
    
    private fun toggleConnection() {
        if (!isAccessibilityServiceEnabled()) {
            Toast.makeText(this, "请先开启无障碍服务", Toast.LENGTH_SHORT).show()
            openAccessibilitySettings()
            return
        }
        
        if (Config.serverUrl == Config.DEFAULT_SERVER_URL) {
            showSettingsDialog()
            Toast.makeText(this, "请先配置服务器地址", Toast.LENGTH_SHORT).show()
            return
        }
        
        val intent = Intent(this, WebSocketService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        
        Toast.makeText(this, "正在连接服务器...", Toast.LENGTH_SHORT).show()
        tvConnectionStatus.text = "连接状态: 连接中..."
    }
    
    private fun showSettingsDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_settings, null)
        val etServerUrl = dialogView.findViewById<EditText>(R.id.etServerUrl)
        val etDeviceName = dialogView.findViewById<EditText>(R.id.etDeviceName)
        
        etServerUrl.setText(Config.serverUrl)
        etDeviceName.setText(Config.deviceName)
        
        AlertDialog.Builder(this)
            .setTitle("连接设置")
            .setView(dialogView)
            .setPositiveButton("保存") { _, _ ->
                val newUrl = etServerUrl.text.toString().trim()
                val newName = etDeviceName.text.toString().trim()
                
                if (newUrl.isNotEmpty()) {
                    Config.serverUrl = newUrl
                }
                if (newName.isNotEmpty()) {
                    Config.deviceName = newName
                }
                
                updateStatus()
                Toast.makeText(this, "设置已保存", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("取消", null)
            .show()
    }
    
    private fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivity(intent)
        Toast.makeText(this, "请找到并开启「小智伴侣」服务", Toast.LENGTH_LONG).show()
    }
    
    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        }
    }
    
    private fun isAccessibilityServiceEnabled(): Boolean {
        val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        
        for (service in enabledServices) {
            if (service.resolveInfo.serviceInfo.packageName == packageName) {
                return true
            }
        }
        return false
    }
    
    private fun isIgnoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            return pm.isIgnoringBatteryOptimizations(packageName)
        }
        return true
    }
}

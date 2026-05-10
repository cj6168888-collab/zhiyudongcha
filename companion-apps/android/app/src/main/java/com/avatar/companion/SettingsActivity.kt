package com.avatar.companion

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * 设置页面 - 详细配置
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */
class SettingsActivity : AppCompatActivity() {
    
    private lateinit var etServerUrl: EditText
    private lateinit var etDeviceId: EditText
    private lateinit var etDeviceName: EditText
    private lateinit var btnSave: Button
    private lateinit var btnReset: Button
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "设置"
        
        initViews()
        loadSettings()
    }
    
    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
    
    private fun initViews() {
        etServerUrl = findViewById(R.id.etServerUrl)
        etDeviceId = findViewById(R.id.etDeviceId)
        etDeviceName = findViewById(R.id.etDeviceName)
        btnSave = findViewById(R.id.btnSave)
        btnReset = findViewById(R.id.btnReset)
        
        btnSave.setOnClickListener { saveSettings() }
        btnReset.setOnClickListener { resetToDefaults() }
    }
    
    private fun loadSettings() {
        etServerUrl.setText(Config.serverUrl)
        etDeviceId.setText(Config.deviceId)
        etDeviceName.setText(Config.deviceName)
    }
    
    private fun saveSettings() {
        val serverUrl = etServerUrl.text.toString().trim()
        val deviceId = etDeviceId.text.toString().trim()
        val deviceName = etDeviceName.text.toString().trim()
        
        if (serverUrl.isEmpty()) {
            Toast.makeText(this, "服务器地址不能为空", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (!serverUrl.startsWith("ws://") && !serverUrl.startsWith("wss://")) {
            Toast.makeText(this, "服务器地址必须以 ws:// 或 wss:// 开头", Toast.LENGTH_SHORT).show()
            return
        }
        
        Config.serverUrl = serverUrl
        if (deviceId.isNotEmpty()) {
            Config.deviceId = deviceId
        }
        if (deviceName.isNotEmpty()) {
            Config.deviceName = deviceName
        }
        
        Toast.makeText(this, "设置已保存", Toast.LENGTH_SHORT).show()
        finish()
    }
    
    private fun resetToDefaults() {
        etServerUrl.setText(Config.DEFAULT_SERVER_URL)
        etDeviceName.setText(Config.DEFAULT_DEVICE_NAME)
        Toast.makeText(this, "已恢复默认值，请点击保存", Toast.LENGTH_SHORT).show()
    }
}

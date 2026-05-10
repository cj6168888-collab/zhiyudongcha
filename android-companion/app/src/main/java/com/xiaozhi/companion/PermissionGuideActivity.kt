package com.xiaozhi.companion

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator
import java.util.Locale

class PermissionGuideActivity : AppCompatActivity() {
    private val TAG = "PermissionGuide"
    
    private lateinit var viewPager: ViewPager2
    private lateinit var tabIndicator: LinearLayout
    private lateinit var dots: MutableList<ImageView>
    private lateinit var skipButton: Button
    private lateinit var nextButton: Button
    
    private val totalSteps = 6
    
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        handlePermissionResult(permissions)
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_permission_guide)
        
        initViews()
        setupViewPager()
        setupButtons()
    }
    
    private fun initViews() {
        viewPager = findViewById(R.id.viewPager)
        tabIndicator = findViewById(R.id.tabIndicator)
        skipButton = findViewById(R.id.skipButton)
        nextButton = findViewById(R.id.nextButton)
        dots = mutableListOf()
        
        // Create dots
        for (i in 0 until totalSteps) {
            val dot = ImageView(this)
            dot.setImageResource(if (i == 0) R.drawable.dot_active else R.drawable.dot_inactive)
            
            val params = LinearLayout.LayoutParams(
                resources.getDimensionPixelSize(R.dimen.dot_size),
                resources.getDimensionPixelSize(R.dimen.dot_size)
            ).apply {
                marginEnd = resources.getDimensionPixelSize(R.dimen.dot_margin)
            }
            
            dot.layoutParams = params
            tabIndicator.addView(dot)
            dots.add(dot)
        }
        
        viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                updateDots(position)
                updateButtons(position)
            }
        })
    }
    
    private fun setupViewPager() {
        val adapter = PermissionGuideAdapter(this, totalSteps)
        viewPager.adapter = adapter
        viewPager.isUserInputEnabled = false
    }
    
    private fun setupButtons() {
        skipButton.setOnClickListener {
            finish()
        }
        
        nextButton.setOnClickListener {
            val currentPosition = viewPager.currentItem
            val step = currentPosition + 1
            
            when (step) {
                1 -> requestMicrophonePermission()
                2 -> requestStoragePermission()
                3 -> requestNotificationPermission()
                4 -> guideToBatteryOptimization()
                5 -> guideToAccessibility()
                6 -> guideToNotificationListener()
            }
        }
    }
    
    private fun updateDots(position: Int) {
        for (i in dots.indices) {
            dots[i].setImageResource(
                if (i == position) R.drawable.dot_active 
                else R.drawable.dot_inactive
            )
        }
    }
    
    private fun updateButtons(position: Int) {
        when (position) {
            totalSteps - 1 -> {
                nextButton.text = getString(R.string.finish)
                skipButton.visibility = View.INVISIBLE
            }
            else -> {
                nextButton.text = getString(R.string.next)
                skipButton.visibility = View.VISIBLE
            }
        }
    }
    
    private fun handlePermissionResult(permissions: Map<String, Boolean>) {
        val allGranted = permissions.all { it.value }
        
        if (allGranted) {
            // Move to next step
            val currentPosition = viewPager.currentItem
            if (currentPosition < totalSteps - 1) {
                viewPager.currentItem = currentPosition + 1
            }
        } else {
            val denied = permissions.filter { !it.value }.keys
            showPermissionDeniedDialog(denied)
        }
    }
    
    private fun requestMicrophonePermission() {
        if (hasMicrophonePermission()) {
            moveToNextStep()
            return
        }
        
        showPermissionExplanation(
            getString(R.string.microphone_permission_title),
            getString(R.string.microphone_permission_explanation),
            arrayOf(Manifest.permission.RECORD_AUDIO)
        )
    }
    
    private fun requestStoragePermission() {
        if (hasStoragePermission()) {
            moveToNextStep()
            return
        }
        
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        
        showPermissionExplanation(
            getString(R.string.storage_permission_title),
            getString(R.string.storage_permission_explanation),
            permissions
        )
    }
    
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (hasNotificationPermission()) {
                moveToNextStep()
                return
            }
            
            showPermissionExplanation(
                getString(R.string.notification_permission_title),
                getString(R.string.notification_permission_explanation),
                arrayOf(Manifest.permission.POST_NOTIFICATIONS)
            )
        } else {
            moveToNextStep()
        }
    }
    
    private fun guideToBatteryOptimization() {
        if (isIgnoringBatteryOptimizations()) {
            moveToNextStep()
            return
        }
        
        AlertDialog.Builder(this)
            .setTitle(R.string.battery_optimization_title)
            .setMessage(R.string.battery_optimization_explanation)
            .setPositiveButton(R.string.go_to_settings) { _, _ ->
                requestIgnoreBatteryOptimizations()
            }
            .setNegativeButton(R.string.skip) { _, _ ->
                moveToNextStep()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun guideToAccessibility() {
        if (isAccessibilityServiceEnabled()) {
            moveToNextStep()
            return
        }
        
        AlertDialog.Builder(this)
            .setTitle(R.string.accessibility_title)
            .setMessage(R.string.accessibility_explanation)
            .setPositiveButton(R.string.go_to_settings) { _, _ ->
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                startActivity(intent)
            }
            .setNegativeButton(R.string.skip) { _, _ ->
                moveToNextStep()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun guideToNotificationListener() {
        if (isNotificationListenerEnabled()) {
            finishGuide()
            return
        }
        
        AlertDialog.Builder(this)
            .setTitle(R.string.notification_listener_title)
            .setMessage(R.string.notification_listener_explanation)
            .setPositiveButton(R.string.go_to_settings) { _, _ ->
                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                startActivity(intent)
            }
            .setNegativeButton(R.string.skip) { _, _ ->
                finishGuide()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun showPermissionExplanation(title: String, message: String, permissions: Array<String>) {
        val hasAll = permissions.all { hasPermission(it) }
        
        if (hasAll) {
            moveToNextStep()
            return
        }
        
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(R.string.grant) { _, _ ->
                permissionLauncher.launch(permissions)
            }
            .setNegativeButton(R.string.skip) { _, _ ->
                moveToNextStep()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun showPermissionDeniedDialog(deniedPermissions: Set<String>) {
        val message = buildString {
            append(getString(R.string.permission_denied_message))
            append("\n\n需要授权的权限:\n")
            deniedPermissions.forEach { perm ->
                append("• ${getPermissionName(perm)}\n")
            }
        }
        
        AlertDialog.Builder(this)
            .setTitle(R.string.permission_required)
            .setMessage(message)
            .setPositiveButton(R.string.try_again) { _, _ ->
                permissionLauncher.launch(deniedPermissions.toTypedArray())
            }
            .setNegativeButton(R.string.skip) { _, _ ->
                moveToNextStep()
            }
            .setCancelable(false)
            .show()
    }
    
    private fun moveToNextStep() {
        val currentPosition = viewPager.currentItem
        if (currentPosition < totalSteps - 1) {
            viewPager.currentItem = currentPosition + 1
        } else {
            finishGuide()
        }
    }
    
    private fun finishGuide() {
        // Mark guide as completed
        getSharedPreferences("xiaozhi_prefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("permission_guide_completed", true)
            .apply()
        
        // Navigate to main activity
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
    
    // Permission check helpers
    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }
    
    private fun hasMicrophonePermission(): Boolean {
        return hasPermission(Manifest.permission.RECORD_AUDIO)
    }
    
    private fun hasStoragePermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasPermission(Manifest.permission.READ_MEDIA_IMAGES) && 
            hasPermission(Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }
    
    private fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasPermission(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            true
        }
    }
    
    private fun isIgnoringBatteryOptimizations(): Boolean {
        val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        return powerManager.isIgnoringBatteryOptimizations(packageName)
    }
    
    private fun requestIgnoreBatteryOptimizations() {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:$packageName")
            startActivity(intent)
        } catch (e: Exception) {
            // Fallback to general battery settings
            startActivity(Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS))
        }
    }
    
    private fun isAccessibilityServiceEnabled(): Boolean {
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(packageName)
    }
    
    private fun isNotificationListenerEnabled(): Boolean {
        val flat = Settings.Secure.getString(
            contentResolver,
            "enabled_notification_listeners"
        )
        return flat?.contains(packageName) == true
    }
    
    private fun getPermissionName(permission: String): String {
        return when (permission) {
            Manifest.permission.RECORD_AUDIO -> "麦克风"
            Manifest.permission.READ_EXTERNAL_STORAGE -> "存储"
            Manifest.permission.READ_MEDIA_IMAGES -> "照片和视频"
            Manifest.permission.READ_MEDIA_VIDEO -> "视频"
            Manifest.permission.POST_NOTIFICATIONS -> "通知"
            else -> permission
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Check permissions again when returning from settings
        checkCurrentStepPermissions()
    }
    
    private fun checkCurrentStepPermissions() {
        val currentPosition = viewPager.currentItem
        when (currentPosition) {
            0 -> if (hasMicrophonePermission()) moveToNextStep()
            1 -> if (hasStoragePermission()) moveToNextStep()
            2 -> if (hasNotificationPermission()) moveToNextStep()
            3 -> if (isIgnoringBatteryOptimizations()) moveToNextStep()
            4 -> if (isAccessibilityServiceEnabled()) moveToNextStep()
            5 -> if (isNotificationListenerEnabled()) finishGuide()
        }
    }
}

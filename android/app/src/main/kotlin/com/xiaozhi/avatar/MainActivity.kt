package com.xiaozhi.avatar

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioManager
import android.os.*
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity
import java.util.concurrent.Executors

class MainActivity : BridgeActivity(), SensorEventListener {

    companion object {
        private const val TAG = "MainActivity"
        private const val REQUEST_ALL_PERMISSIONS = 1001
        // isListening 追踪前台服务通知状态；SpeechRecognizer 由 VoicePlugin 管理
        private var isListening = false
        lateinit var instance: MainActivity; private set
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val computeExecutor = Executors.newFixedThreadPool(4)

    private var audioManager: AudioManager? = null
    private var vibrator: Vibrator? = null
    private var sensorManager: SensorManager? = null
    private var proximitySensor: Sensor? = null

    var currentSocialMode = "DAILY"
    var currentListeningMode = "daily"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION") getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        proximitySensor = sensorManager?.getDefaultSensor(Sensor.TYPE_PROXIMITY)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        registerPlugin(LocalLLMPlugin::class.java)
        registerPlugin(VoicePlugin::class.java)
        registerPlugin(TTSPlugin::class.java)
        registerPlugin(VoiceprintPlugin::class.java)
        registerPlugin(SecurityPlugin::class.java)
        registerPlugin(ActionPlugin::class.java)
        registerPlugin(DocumentPlugin::class.java)
        registerPlugin(FileProcessorPlugin::class.java)
        registerPlugin(DiagnosticsPlugin::class.java)

        checkAndRequestPermissions()
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.WRITE_CALENDAR,
            Manifest.permission.READ_CALENDAR
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val toRequest = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (toRequest.isNotEmpty()) ActivityCompat.requestPermissions(this, toRequest.toTypedArray(), REQUEST_ALL_PERMISSIONS)
    }

    fun startListening() {
        if (isListening) return
        isListening = true
        startVoiceForegroundService("listening")
    }

    fun stopListening() {
        if (!isListening) return
        isListening = false
        stopVoiceForegroundService()
    }

    private fun startVoiceForegroundService(mode: String) {
        val intent = Intent(this, VoiceForegroundService::class.java).apply {
            action = if (mode == "listening") VoiceForegroundService.ACTION_START_LISTENING else VoiceForegroundService.ACTION_START_DOWNLOAD
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopVoiceForegroundService() {
        val intent = Intent(this, VoiceForegroundService::class.java).apply {
            action = VoiceForegroundService.ACTION_STOP
        }
        startService(intent)
    }

    fun triggerFeedback(pattern: LongArray = longArrayOf(0, 50)) {
        if (isFinishing || isDestroyed) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, -1)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    override fun onSensorChanged(event: SensorEvent?) {}

    override fun onDestroy() {
        stopVoiceForegroundService()
        computeExecutor.shutdownNow()
        mainHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}

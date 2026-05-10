package com.xiaozhi.companion.utils

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "xiaozhi_settings"

        private const val KEY_VAD_THRESHOLD = "vad_threshold"
        private const val KEY_MIC_SENSITIVITY = "mic_sensitivity"
        private const val KEY_NOTIFICATION_ENABLED = "notification_enabled"
        private const val KEY_SOUND_FEEDBACK_ENABLED = "sound_feedback_enabled"
        private const val KEY_VIBRATION_ENABLED = "vibration_enabled"
        private const val KEY_DARK_MODE = "dark_mode"
        private const val KEY_AUTO_START = "auto_start"
        private const val KEY_KEEP_SCREEN_ON = "keep_screen_on"
        private const val KEY_WEB_SERVER_URL = "web_server_url"
        private const val KEY_WS_SERVER_URL = "ws_server_url"
        private const val KEY_OFFLINE_MODE = "offline_mode"
        private const val KEY_LOG_LEVEL = "log_level"
        private const val KEY_FIRST_LAUNCH = "first_launch"

        private const val DEFAULT_VAD_THRESHOLD = 0.02f
        private const val DEFAULT_MIC_SENSITIVITY = 50
        private const val DEFAULT_LOG_LEVEL = 2
        private const val KEY_VISUALIZER_MODE = "visualizer_mode"
        private const val KEY_VISUALIZER_COLOR = "visualizer_color"
        
        @Volatile
        private var instance: PreferencesManager? = null

        fun getInstance(context: Context): PreferencesManager {
            return instance ?: synchronized(this) {
                instance ?: PreferencesManager(context.applicationContext).also {
                    instance = it
                }
            }
        }
    }

    var vadThreshold: Float
        get() = prefs.getFloat(KEY_VAD_THRESHOLD, DEFAULT_VAD_THRESHOLD)
        set(value) = prefs.edit { putFloat(KEY_VAD_THRESHOLD, value) }

    var micSensitivity: Int
        get() = prefs.getInt(KEY_MIC_SENSITIVITY, DEFAULT_MIC_SENSITIVITY)
        set(value) = prefs.edit { putInt(KEY_MIC_SENSITIVITY, value) }

    var notificationEnabled: Boolean
        get() = prefs.getBoolean(KEY_NOTIFICATION_ENABLED, true)
        set(value) = prefs.edit { putBoolean(KEY_NOTIFICATION_ENABLED, value) }

    var soundFeedbackEnabled: Boolean
        get() = prefs.getBoolean(KEY_SOUND_FEEDBACK_ENABLED, true)
        set(value) = prefs.edit { putBoolean(KEY_SOUND_FEEDBACK_ENABLED, value) }

    var vibrationEnabled: Boolean
        get() = prefs.getBoolean(KEY_VIBRATION_ENABLED, true)
        set(value) = prefs.edit { putBoolean(KEY_VIBRATION_ENABLED, value) }

    var darkMode: Int
        get() = prefs.getInt(KEY_DARK_MODE, 0)
        set(value) = prefs.edit { putInt(KEY_DARK_MODE, value) }

    var autoStart: Boolean
        get() = prefs.getBoolean(KEY_AUTO_START, false)
        set(value) = prefs.edit { putBoolean(KEY_AUTO_START, value) }

    var keepScreenOn: Boolean
        get() = prefs.getBoolean(KEY_KEEP_SCREEN_ON, false)
        set(value) = prefs.edit { putBoolean(KEY_KEEP_SCREEN_ON, value) }

    var webServerUrl: String
        get() = prefs.getString(KEY_WEB_SERVER_URL, "http://localhost:3000") ?: ""
        set(value) = prefs.edit { putString(KEY_WEB_SERVER_URL, value) }

    var wsServerUrl: String
        get() = prefs.getString(KEY_WS_SERVER_URL, "ws://localhost:8765") ?: ""
        set(value) = prefs.edit { putString(KEY_WS_SERVER_URL, value) }

    var offlineMode: Boolean
        get() = prefs.getBoolean(KEY_OFFLINE_MODE, false)
        set(value) = prefs.edit { putBoolean(KEY_OFFLINE_MODE, value) }

    var logLevel: Int
        get() = prefs.getInt(KEY_LOG_LEVEL, DEFAULT_LOG_LEVEL)
        set(value) = prefs.edit { putInt(KEY_LOG_LEVEL, value) }

    var visualizerMode: Int
        get() = prefs.getInt(KEY_VISUALIZER_MODE, 0)
        set(value) = prefs.edit { putInt(KEY_VISUALIZER_MODE, value) }

    var visualizerColor: Int
        get() = prefs.getInt(KEY_VISUALIZER_COLOR, 0)
        set(value) = prefs.edit { putInt(KEY_VISUALIZER_COLOR, value) }

    var isFirstLaunch: Boolean
        get() = prefs.getBoolean(KEY_FIRST_LAUNCH, true)
        set(value) = prefs.edit { putBoolean(KEY_FIRST_LAUNCH, value) }

    fun resetToDefaults() {
        prefs.edit {
            putFloat(KEY_VAD_THRESHOLD, DEFAULT_VAD_THRESHOLD)
            putInt(KEY_MIC_SENSITIVITY, DEFAULT_MIC_SENSITIVITY)
            putBoolean(KEY_NOTIFICATION_ENABLED, true)
            putBoolean(KEY_SOUND_FEEDBACK_ENABLED, true)
            putBoolean(KEY_VIBRATION_ENABLED, true)
            putInt(KEY_DARK_MODE, 0)
            putBoolean(KEY_AUTO_START, false)
            putBoolean(KEY_KEEP_SCREEN_ON, false)
            putInt(KEY_LOG_LEVEL, DEFAULT_LOG_LEVEL)
        }
    }

    fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        prefs.registerOnSharedPreferenceChangeListener(listener)
    }

    fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        prefs.unregisterOnSharedPreferenceChangeListener(listener)
    }
}

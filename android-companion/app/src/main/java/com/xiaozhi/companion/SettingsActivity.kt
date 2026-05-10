package com.xiaozhi.companion

import android.os.Bundle
import android.view.MenuItem
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.xiaozhi.companion.utils.PreferencesManager
import com.xiaozhi.companion.ui.AudioVizBridge

class SettingsActivity : AppCompatActivity() {

    private lateinit var prefs: PreferencesManager

    private lateinit var vadSeekBar: SeekBar
    private lateinit var vadValueText: TextView
    private lateinit var sensitivitySeekBar: SeekBar
    private lateinit var sensitivityValueText: TextView

    private lateinit var notificationSwitch: Switch
    private lateinit var soundFeedbackSwitch: Switch
    private lateinit var vibrationSwitch: Switch
    private lateinit var autoStartSwitch: Switch
    private lateinit var keepScreenSwitch: Switch

    private lateinit var darkModeRadioGroup: android.widget.RadioGroup

    private lateinit var webServerInput: TextInputEditText
    private lateinit var wsServerInput: TextInputEditText
    private lateinit var logLevelSeekBar: SeekBar
    private lateinit var logLevelValueText: TextView
    private lateinit var visualizerModeGroup: android.widget.RadioGroup
    private lateinit var visualizerColorGroup: android.widget.RadioGroup

    private lateinit var saveButton: MaterialButton
    private lateinit var resetButton: MaterialButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        prefs = PreferencesManager.getInstance(this)

        setupToolbar()
        initViews()
        loadSettings()
        setupListeners()
    }

    private fun setupToolbar() {
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = getString(R.string.settings)
    }

    private fun initViews() {
        vadSeekBar = findViewById(R.id.vad_seek_bar)
        vadValueText = findViewById(R.id.vad_value_text)
        sensitivitySeekBar = findViewById(R.id.sensitivity_seek_bar)
        sensitivityValueText = findViewById(R.id.sensitivity_value_text)

        notificationSwitch = findViewById(R.id.notification_switch)
        soundFeedbackSwitch = findViewById(R.id.sound_feedback_switch)
        vibrationSwitch = findViewById(R.id.vibration_switch)
        autoStartSwitch = findViewById(R.id.auto_start_switch)
        keepScreenSwitch = findViewById(R.id.keep_screen_switch)

        darkModeRadioGroup = findViewById(R.id.dark_mode_radio_group)

        webServerInput = findViewById(R.id.web_server_input)
        wsServerInput = findViewById(R.id.ws_server_input)
        logLevelSeekBar = findViewById(R.id.log_level_seek_bar)
        logLevelValueText = findViewById(R.id.log_level_value_text)
        visualizerModeGroup = findViewById(R.id.visualizer_mode_group)
        visualizerColorGroup = findViewById(R.id.visualizer_color_group)

        saveButton = findViewById(R.id.save_button)
        resetButton = findViewById(R.id.reset_button)
    }

    private fun loadSettings() {
        vadSeekBar.progress = (prefs.vadThreshold * 1000).toInt()
        vadValueText.text = String.format("%.3f", prefs.vadThreshold)

        sensitivitySeekBar.progress = prefs.micSensitivity
        sensitivityValueText.text = prefs.micSensitivity.toString()

        notificationSwitch.isChecked = prefs.notificationEnabled
        soundFeedbackSwitch.isChecked = prefs.soundFeedbackEnabled
        vibrationSwitch.isChecked = prefs.vibrationEnabled
        autoStartSwitch.isChecked = prefs.autoStart
        keepScreenSwitch.isChecked = prefs.keepScreenOn

        when (prefs.darkMode) {
            0 -> darkModeRadioGroup.check(R.id.radio_light)
            1 -> darkModeRadioGroup.check(R.id.radio_dark)
            else -> darkModeRadioGroup.check(R.id.radio_auto)
        }

        webServerInput.setText(prefs.webServerUrl)
        wsServerInput.setText(prefs.wsServerUrl)

        logLevelSeekBar.progress = prefs.logLevel
        logLevelValueText.text = getLogLevelName(prefs.logLevel)
        // visualize mode
        when (prefs.visualizerMode) {
            0 -> visualizerModeGroup.check(R.id.radio_wave)
            1 -> visualizerModeGroup.check(R.id.radio_bars)
            else -> visualizerModeGroup.check(R.id.radio_spectrum)
        }
        // visualize color theme
        when (prefs.visualizerColor) {
            1 -> visualizerColorGroup.check(R.id.radio_color_blue)
            2 -> visualizerColorGroup.check(R.id.radio_color_purple)
            else -> visualizerColorGroup.check(R.id.radio_color_green)
        }
    }

    private fun setupListeners() {
        vadSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val value = progress / 1000f
                vadValueText.text = String.format("%.3f", value)
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        sensitivitySeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                sensitivityValueText.text = progress.toString()
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        logLevelSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                logLevelValueText.text = getLogLevelName(progress)
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        saveButton.setOnClickListener {
            saveSettings()
        }

        resetButton.setOnClickListener {
            prefs.resetToDefaults()
            loadSettings()
            Toast.makeText(this, R.string.settings_reset, Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveSettings() {
        prefs.vadThreshold = vadSeekBar.progress / 1000f
        prefs.micSensitivity = sensitivitySeekBar.progress
        prefs.notificationEnabled = notificationSwitch.isChecked
        prefs.soundFeedbackEnabled = soundFeedbackSwitch.isChecked
        prefs.vibrationEnabled = vibrationSwitch.isChecked
        prefs.autoStart = autoStartSwitch.isChecked
        prefs.keepScreenOn = keepScreenSwitch.isChecked

        prefs.darkMode = when (darkModeRadioGroup.checkedRadioButtonId) {
            R.id.radio_light -> 0
            R.id.radio_dark -> 1
            else -> 2
        }
        applyDarkMode(prefs.darkMode)

        prefs.webServerUrl = webServerInput.text.toString()
        prefs.wsServerUrl = wsServerInput.text.toString()
        prefs.logLevel = logLevelSeekBar.progress
        // save visualizer mode
        val vizMode = when (visualizerModeGroup.checkedRadioButtonId) {
            R.id.radio_wave -> 0
            R.id.radio_bars -> 1
            else -> 2
        }
        prefs.visualizerMode = vizMode
        AudioVizBridge.setMode(vizMode)
        
        // save visualizer color theme
        val vizColor = when (visualizerColorGroup.checkedRadioButtonId) {
            R.id.radio_color_blue -> 1
            R.id.radio_color_purple -> 2
            else -> 0
        }
        prefs.visualizerColor = vizColor
        AudioVizBridge.setColorTheme(vizColor)

        Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
    }

    private fun applyDarkMode(mode: Int) {
        when (mode) {
            0 -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            1 -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            else -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
        }
    }

    private fun getLogLevelName(level: Int): String {
        return when (level) {
            0 -> "DEBUG"
            1 -> "INFO"
            2 -> "WARN"
            3 -> "ERROR"
            else -> "UNKNOWN"
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                finish()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}

package com.xiaozhi.companion

import android.os.Bundle
import android.view.MenuItem
import android.widget.ArrayAdapter
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import java.io.File

class LogViewerActivity : AppCompatActivity() {

    private lateinit var toolbar: MaterialToolbar
    private lateinit var logFileSpinner: Spinner
    private lateinit var logContentText: TextView
    private lateinit var refreshButton: MaterialButton
    private lateinit var clearButton: MaterialButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_log_viewer)

        initViews()
        setupToolbar()
        loadLogFiles()
        setupListeners()
    }

    private fun initViews() {
        toolbar = findViewById(R.id.toolbar)
        logFileSpinner = findViewById(R.id.log_file_spinner)
        logContentText = findViewById(R.id.log_content_text)
        refreshButton = findViewById(R.id.refresh_button)
        clearButton = findViewById(R.id.clear_button)
    }

    private fun setupToolbar() {
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = getString(R.string.log_viewer)
    }

    private fun loadLogFiles() {
        val logFiles = com.xiaozhi.companion.utils.Logger.getLogFiles()
        val fileNames = logFiles.mapTo(mutableListOf()) { it.name }

        if (fileNames.isEmpty()) {
            fileNames.add(0, getString(R.string.no_logs))
        }

        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, fileNames)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        logFileSpinner.adapter = adapter

        if (logFiles.isNotEmpty()) {
            loadLogContent(logFiles[0])
        }
    }

    private fun loadLogContent(file: File) {
        try {
            val content = com.xiaozhi.companion.utils.Logger.getLogContent(file, 2000)
            logContentText.text = content
        } catch (e: Exception) {
            logContentText.text = "${getString(R.string.failed_to_load_log)}: ${e.message}"
        }
    }

    private fun setupListeners() {
        refreshButton.setOnClickListener {
            loadLogFiles()
            val logFiles = com.xiaozhi.companion.utils.Logger.getLogFiles()
            if (logFiles.isNotEmpty() && logFileSpinner.selectedItemPosition < logFiles.size) {
                loadLogContent(logFiles[logFileSpinner.selectedItemPosition])
            }
            Toast.makeText(this, R.string.logs_refreshed, Toast.LENGTH_SHORT).show()
        }

        clearButton.setOnClickListener {
            com.xiaozhi.companion.utils.Logger.clearLogs()
            com.xiaozhi.companion.utils.CrashHandler.getInstance(this).clearCrashLogs()
            loadLogFiles()
            logContentText.text = ""
            Toast.makeText(this, R.string.logs_cleared, Toast.LENGTH_SHORT).show()
        }

        logFileSpinner.setOnItemSelectedListener(object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val logFiles = com.xiaozhi.companion.utils.Logger.getLogFiles()
                if (logFiles.isNotEmpty() && position < logFiles.size) {
                    loadLogContent(logFiles[position])
                }
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        })
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

package com.xiaozhi.companion.utils

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors

class Logger private constructor(private val context: Context) {

    companion object {
        private const val TAG = "XiaoZhi"
        private const val MAX_LOG_SIZE = 10 * 1024 * 1024
        private const val MAX_LOG_FILES = 7
        private const val LOG_LEVEL_DEBUG = 0
        private const val LOG_LEVEL_INFO = 1
        private const val LOG_LEVEL_WARN = 2
        private const val LOG_LEVEL_ERROR = 3

        @Volatile
        private var instance: Logger? = null
        private var logLevel = LOG_LEVEL_INFO
        private var loggerContext: Context? = null

        private val logQueue = ConcurrentLinkedQueue<LogEntry>()
        private val executor = Executors.newSingleThreadExecutor()

        fun init(context: Context) {
            loggerContext = context.applicationContext
            instance = Logger(context.applicationContext)
            startLogWriter()
        }

        fun getInstance(): Logger {
            return instance ?: throw IllegalStateException("Logger not initialized. Call init() first.")
        }

        fun setLogLevel(level: Int) {
            logLevel = level
        }

        fun d(message: String, tag: String = TAG) {
            if (logLevel <= LOG_LEVEL_DEBUG) {
                Log.d(tag, message)
                addToQueue(LOG_LEVEL_DEBUG, tag, message)
            }
        }

        fun i(message: String, tag: String = TAG) {
            if (logLevel <= LOG_LEVEL_INFO) {
                Log.i(tag, message)
                addToQueue(LOG_LEVEL_INFO, tag, message)
            }
        }

        fun w(message: String, tag: String = TAG) {
            if (logLevel <= LOG_LEVEL_WARN) {
                Log.w(tag, message)
                addToQueue(LOG_LEVEL_WARN, tag, message)
            }
        }

        fun e(message: String, throwable: Throwable? = null, tag: String = TAG) {
            if (logLevel <= LOG_LEVEL_ERROR) {
                Log.e(tag, message, throwable)
                addToQueue(LOG_LEVEL_ERROR, tag, message, throwable?.stackTraceToString())
            }
        }

        private fun addToQueue(level: Int, tag: String, message: String, stackTrace: String? = null) {
            val entry = LogEntry(
                timestamp = System.currentTimeMillis(),
                level = level,
                tag = tag,
                message = message,
                stackTrace = stackTrace
            )
            logQueue.offer(entry)
        }

        private fun startLogWriter() {
            executor.execute {
                while (true) {
                    try {
                        val entry = logQueue.poll() ?: run {
                            Thread.sleep(1000)
                            return@execute
                        }
                        writeToFile(entry)
                    } catch (e: InterruptedException) {
                        break
                    } catch (e: Exception) {
                        Log.e(TAG, "Error writing log: ${e.message}")
                    }
                }
            }
        }

        private fun writeToFile(entry: LogEntry) {
            try {
                val ctx = loggerContext ?: return
                val logDir = File(ctx.filesDir, "logs")
                if (!logDir.exists()) {
                    logDir.mkdirs()
                }

                val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val fileName = "xiaozhi_${dateFormat.format(Date(entry.timestamp))}.log"
                val logFile = File(logDir, fileName)

                if (logFile.exists() && logFile.length() > MAX_LOG_SIZE) {
                    rotateLogs(logDir)
                }

                val timeFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault())
                val levelStr = when (entry.level) {
                    LOG_LEVEL_DEBUG -> "D"
                    LOG_LEVEL_INFO -> "I"
                    LOG_LEVEL_WARN -> "W"
                    LOG_LEVEL_ERROR -> "E"
                    else -> "?"
                }

                val logLine = buildString {
                    append(timeFormat.format(Date(entry.timestamp)))
                    append(" ")
                    append(levelStr)
                    append("/")
                    append(entry.tag)
                    append(": ")
                    append(entry.message)
                    if (entry.stackTrace != null) {
                        append("\n")
                        append(entry.stackTrace)
                    }
                    append("\n")
                }

                FileWriter(logFile.absolutePath, true).use { writer ->
                    writer.append(logLine)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to write log: ${e.message}")
            }
        }

        private fun rotateLogs(logDir: File) {
            val logFiles = logDir.listFiles { file ->
                file.name.startsWith("xiaozhi_") && file.name.endsWith(".log")
            }?.sortedByDescending { it.lastModified() } ?: return

            if (logFiles.size >= MAX_LOG_FILES) {
                logFiles.drop(MAX_LOG_FILES - 1).forEach { file -> file.delete() }
            }
        }

        fun getLogFiles(): List<File> {
            val ctx = loggerContext ?: return emptyList()
            val logDir = File(ctx.filesDir, "logs")
            return logDir.listFiles { file ->
                file.name.startsWith("xiaozhi_") && file.name.endsWith(".log")
            }?.sortedByDescending { it.lastModified() } ?: emptyList()
        }

        fun getLogContent(file: File, maxLines: Int = 1000): String {
            return try {
                val lines = file.readLines()
                val startIndex = if (lines.size > maxLines) lines.size - maxLines else 0
                lines.subList(startIndex, lines.size).joinToString("\n")
            } catch (e: Exception) {
                "Failed to read log: ${e.message}"
            }
        }

        fun clearLogs() {
            executor.execute {
                try {
                    val ctx = loggerContext ?: return@execute
                    val logDir = File(ctx.filesDir, "logs")
                    logDir.listFiles()?.forEach { file -> file.delete() }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to clear logs: ${e.message}")
                }
            }
        }
    }

    data class LogEntry(
        val timestamp: Long,
        val level: Int,
        val tag: String,
        val message: String,
        val stackTrace: String? = null
    )
}

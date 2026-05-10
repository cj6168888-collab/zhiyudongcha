package com.xiaozhi.companion.ui

import android.os.Handler
import android.os.Looper

object AudioVizBridge {
    var visualizer: AudioVisualizerView? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    fun postWaveform(data: ShortArray) {
        mainHandler.post {
            visualizer?.updateWaveform(data)
        }
    }

    fun setMode(mode: Int) {
        mainHandler.post {
            visualizer?.setMode(mode)
        }
    }
    
    fun setColorTheme(theme: Int) {
        mainHandler.post {
            visualizer?.setColorTheme(theme)
        }
    }
}

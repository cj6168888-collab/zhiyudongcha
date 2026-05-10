package com.xiaozhi.companion.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class AudioVisualizerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {
    
    private val paint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.FILL
    }
    
    private val strokePaint = Paint().apply {
        color = 0xFF4CAF50.toInt()
        strokeWidth = 2f
        isAntiAlias = true
        style = Paint.Style.STROKE
    }
    
    private var waveform: ShortArray = ShortArray(0)
    
    // 0 = waveform, 1 = bars, 2 = spectrum
    private var mode = 0
    
    // Color theme: 0 = green, 1 = blue, 2 = purple
    private var colorTheme = 0
    
    private val colorGreen = intArrayOf(0xFF4CAF50.toInt(), 0xFF81C784.toInt())
    private val colorBlue = intArrayOf(0xFF2196F3.toInt(), 0xFF64B5F6.toInt())
    private val colorPurple = intArrayOf(0xFF9C27B0.toInt(), 0xFFBA68C8.toInt())
    
    fun updateWaveform(data: ShortArray) {
        waveform = data
        postInvalidate()
    }
    
    fun setMode(newMode: Int) {
        mode = newMode
        postInvalidate()
    }
    
    fun setColorTheme(theme: Int) {
        colorTheme = theme
        updateGradient()
        postInvalidate()
    }
    
    private fun updateGradient() {
        val colors = when (colorTheme) {
            1 -> colorBlue
            2 -> colorPurple
            else -> colorGreen
        }
        paint.shader = LinearGradient(0f, 0f, 0f, height.toFloat(), colors, null, Shader.TileMode.CLAMP)
    }
    
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        updateGradient()
    }
    
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        
        if (waveform.isEmpty()) {
            drawIdleState(canvas, w, h)
            return
        }
        
        when (mode) {
            0 -> drawWaveform(canvas, w, h)
            1 -> drawBars(canvas, w, h)
            2 -> drawSpectrum(canvas, w, h)
        }
    }
    
    private fun drawIdleState(canvas: Canvas, w: Float, h: Float) {
        val mid = h / 2
        strokePaint.alpha = 50
        canvas.drawLine(0f, mid, w, mid, strokePaint)
        strokePaint.alpha = 255
    }
    
    private fun drawWaveform(canvas: Canvas, w: Float, h: Float) {
        val mid = h / 2f
        val step = max(1, waveform.size / w.toInt())
        
        var x = 0f
        for (i in waveform.indices step step) {
            val v = waveform[i].toFloat() / 32768f
            val y = mid - v * mid * 0.8f
            canvas.drawLine(x, mid, x, y, strokePaint)
            x += 1f
            if (x > w) break
        }
    }
    
    private fun drawBars(canvas: Canvas, w: Float, h: Float) {
        val barWidth = 6f
        val gap = 2f
        val bars = (w / (barWidth + gap)).toInt().coerceAtLeast(1)
        val step = max(1, waveform.size / bars)
        
        var x = gap
        for (i in 0 until waveform.size step step) {
            val v = abs(waveform[i].toInt()) / 32768f
            val barH = (v * h * 0.9f).coerceAtLeast(4f)
            val top = (h - barH) / 2
            
            canvas.drawRoundRect(x, top, x + barWidth, top + barH, 4f, 4f, paint)
            x += barWidth + gap
            if (x > w) break
        }
    }
    
    private fun drawSpectrum(canvas: Canvas, w: Float, h: Float) {
        val barCount = 32
        val barWidth = (w / barCount) - 2
        val step = max(1, waveform.size / barCount)
        
        var x = 1f
        for (i in 0 until waveform.size step step) {
            val v = abs(waveform[i].toInt()) / 32768f
            val barH = (v * h * 0.85f).coerceAtLeast(4f)
            val top = h - barH
            
            // Draw bar from bottom
            canvas.drawRoundRect(x, top, x + barWidth, h, 3f, 3f, paint)
            x += barWidth + 2
            if (x > w) break
        }
    }
}

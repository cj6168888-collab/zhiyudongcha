package com.xiaozhi.companion.ui;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000H\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0015\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0017\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0007\n\u0002\b\u0010\u0018\u00002\u00020\u0001B%\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\n\b\u0002\u0010\u0004\u001a\u0004\u0018\u00010\u0005\u0012\b\b\u0002\u0010\u0006\u001a\u00020\u0007\u00a2\u0006\u0002\u0010\bJ \u0010\u0014\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u0018\u001a\u00020\u00192\u0006\u0010\u001a\u001a\u00020\u0019H\u0002J \u0010\u001b\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u0018\u001a\u00020\u00192\u0006\u0010\u001a\u001a\u00020\u0019H\u0002J \u0010\u001c\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u0018\u001a\u00020\u00192\u0006\u0010\u001a\u001a\u00020\u0019H\u0002J \u0010\u001d\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u00172\u0006\u0010\u0018\u001a\u00020\u00192\u0006\u0010\u001a\u001a\u00020\u0019H\u0002J\u0010\u0010\u001e\u001a\u00020\u00152\u0006\u0010\u0016\u001a\u00020\u0017H\u0014J(\u0010\u001f\u001a\u00020\u00152\u0006\u0010\u0018\u001a\u00020\u00072\u0006\u0010\u001a\u001a\u00020\u00072\u0006\u0010 \u001a\u00020\u00072\u0006\u0010!\u001a\u00020\u0007H\u0014J\u000e\u0010\"\u001a\u00020\u00152\u0006\u0010#\u001a\u00020\u0007J\u000e\u0010$\u001a\u00020\u00152\u0006\u0010%\u001a\u00020\u0007J\b\u0010&\u001a\u00020\u0015H\u0002J\u000e\u0010\'\u001a\u00020\u00152\u0006\u0010(\u001a\u00020\u0013R\u000e\u0010\t\u001a\u00020\nX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\nX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\nX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\u0007X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\u0007X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000f\u001a\u00020\u0010X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\u0010X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\u0013X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006)"}, d2 = {"Lcom/xiaozhi/companion/ui/AudioVisualizerView;", "Landroid/view/View;", "context", "Landroid/content/Context;", "attrs", "Landroid/util/AttributeSet;", "defStyleAttr", "", "(Landroid/content/Context;Landroid/util/AttributeSet;I)V", "colorBlue", "", "colorGreen", "colorPurple", "colorTheme", "mode", "paint", "Landroid/graphics/Paint;", "strokePaint", "waveform", "", "drawBars", "", "canvas", "Landroid/graphics/Canvas;", "w", "", "h", "drawIdleState", "drawSpectrum", "drawWaveform", "onDraw", "onSizeChanged", "oldw", "oldh", "setColorTheme", "theme", "setMode", "newMode", "updateGradient", "updateWaveform", "data", "app_debug"})
public final class AudioVisualizerView extends android.view.View {
    @org.jetbrains.annotations.NotNull()
    private final android.graphics.Paint paint = null;
    @org.jetbrains.annotations.NotNull()
    private final android.graphics.Paint strokePaint = null;
    @org.jetbrains.annotations.NotNull()
    private short[] waveform;
    private int mode = 0;
    private int colorTheme = 0;
    @org.jetbrains.annotations.NotNull()
    private final int[] colorGreen = {-11751600, -8271996};
    @org.jetbrains.annotations.NotNull()
    private final int[] colorBlue = {-14575885, -10177034};
    @org.jetbrains.annotations.NotNull()
    private final int[] colorPurple = {-6543440, -4560696};
    
    @kotlin.jvm.JvmOverloads()
    public AudioVisualizerView(@org.jetbrains.annotations.NotNull()
    android.content.Context context, @org.jetbrains.annotations.Nullable()
    android.util.AttributeSet attrs, int defStyleAttr) {
        super(null);
    }
    
    public final void updateWaveform(@org.jetbrains.annotations.NotNull()
    short[] data) {
    }
    
    public final void setMode(int newMode) {
    }
    
    public final void setColorTheme(int theme) {
    }
    
    private final void updateGradient() {
    }
    
    @java.lang.Override()
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
    }
    
    @java.lang.Override()
    protected void onDraw(@org.jetbrains.annotations.NotNull()
    android.graphics.Canvas canvas) {
    }
    
    private final void drawIdleState(android.graphics.Canvas canvas, float w, float h) {
    }
    
    private final void drawWaveform(android.graphics.Canvas canvas, float w, float h) {
    }
    
    private final void drawBars(android.graphics.Canvas canvas, float w, float h) {
    }
    
    private final void drawSpectrum(android.graphics.Canvas canvas, float w, float h) {
    }
    
    @kotlin.jvm.JvmOverloads()
    public AudioVisualizerView(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        super(null);
    }
    
    @kotlin.jvm.JvmOverloads()
    public AudioVisualizerView(@org.jetbrains.annotations.NotNull()
    android.content.Context context, @org.jetbrains.annotations.Nullable()
    android.util.AttributeSet attrs) {
        super(null);
    }
}
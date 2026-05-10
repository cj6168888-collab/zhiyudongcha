package com.xiaozhi.companion.ui;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00000\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u0017\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0003\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u000e\u0010\u000b\u001a\u00020\f2\u0006\u0010\r\u001a\u00020\u000eJ\u000e\u0010\u000f\u001a\u00020\f2\u0006\u0010\u0010\u001a\u00020\u0011J\u000e\u0010\u0012\u001a\u00020\f2\u0006\u0010\u0013\u001a\u00020\u0011R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001c\u0010\u0005\u001a\u0004\u0018\u00010\u0006X\u0086\u000e\u00a2\u0006\u000e\n\u0000\u001a\u0004\b\u0007\u0010\b\"\u0004\b\t\u0010\n\u00a8\u0006\u0014"}, d2 = {"Lcom/xiaozhi/companion/ui/AudioVizBridge;", "", "()V", "mainHandler", "Landroid/os/Handler;", "visualizer", "Lcom/xiaozhi/companion/ui/AudioVisualizerView;", "getVisualizer", "()Lcom/xiaozhi/companion/ui/AudioVisualizerView;", "setVisualizer", "(Lcom/xiaozhi/companion/ui/AudioVisualizerView;)V", "postWaveform", "", "data", "", "setColorTheme", "theme", "", "setMode", "mode", "app_debug"})
public final class AudioVizBridge {
    @org.jetbrains.annotations.Nullable()
    private static com.xiaozhi.companion.ui.AudioVisualizerView visualizer;
    @org.jetbrains.annotations.NotNull()
    private static final android.os.Handler mainHandler = null;
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.ui.AudioVizBridge INSTANCE = null;
    
    private AudioVizBridge() {
        super();
    }
    
    @org.jetbrains.annotations.Nullable()
    public final com.xiaozhi.companion.ui.AudioVisualizerView getVisualizer() {
        return null;
    }
    
    public final void setVisualizer(@org.jetbrains.annotations.Nullable()
    com.xiaozhi.companion.ui.AudioVisualizerView p0) {
    }
    
    public final void postWaveform(@org.jetbrains.annotations.NotNull()
    short[] data) {
    }
    
    public final void setMode(int mode) {
    }
    
    public final void setColorTheme(int theme) {
    }
}
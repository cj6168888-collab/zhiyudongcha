package com.xiaozhi.companion.utils;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000H\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0002\b\u0005\n\u0002\u0010\b\n\u0002\b\u0017\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0007\n\u0002\b\u000e\n\u0002\u0010\u000e\n\u0002\b\t\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\u0018\u0000 F2\u00020\u0001:\u0001FB\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u000e\u0010@\u001a\u00020A2\u0006\u0010B\u001a\u00020CJ\u0006\u0010D\u001a\u00020AJ\u000e\u0010E\u001a\u00020A2\u0006\u0010B\u001a\u00020CR$\u0010\u0007\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\b\u0010\t\"\u0004\b\n\u0010\u000bR$\u0010\r\u001a\u00020\f2\u0006\u0010\u0005\u001a\u00020\f8F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\u000e\u0010\u000f\"\u0004\b\u0010\u0010\u0011R$\u0010\u0012\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\u0012\u0010\t\"\u0004\b\u0013\u0010\u000bR$\u0010\u0014\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\u0015\u0010\t\"\u0004\b\u0016\u0010\u000bR$\u0010\u0017\u001a\u00020\f2\u0006\u0010\u0005\u001a\u00020\f8F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\u0018\u0010\u000f\"\u0004\b\u0019\u0010\u0011R$\u0010\u001a\u001a\u00020\f2\u0006\u0010\u0005\u001a\u00020\f8F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\u001b\u0010\u000f\"\u0004\b\u001c\u0010\u0011R$\u0010\u001d\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b\u001e\u0010\t\"\u0004\b\u001f\u0010\u000bR$\u0010 \u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b!\u0010\t\"\u0004\b\"\u0010\u000bR\u000e\u0010#\u001a\u00020$X\u0082\u0004\u00a2\u0006\u0002\n\u0000R$\u0010%\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b&\u0010\t\"\u0004\b\'\u0010\u000bR$\u0010)\u001a\u00020(2\u0006\u0010\u0005\u001a\u00020(8F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b*\u0010+\"\u0004\b,\u0010-R$\u0010.\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b/\u0010\t\"\u0004\b0\u0010\u000bR$\u00101\u001a\u00020\f2\u0006\u0010\u0005\u001a\u00020\f8F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b2\u0010\u000f\"\u0004\b3\u0010\u0011R$\u00104\u001a\u00020\f2\u0006\u0010\u0005\u001a\u00020\f8F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b5\u0010\u000f\"\u0004\b6\u0010\u0011R$\u00108\u001a\u0002072\u0006\u0010\u0005\u001a\u0002078F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b9\u0010:\"\u0004\b;\u0010<R$\u0010=\u001a\u0002072\u0006\u0010\u0005\u001a\u0002078F@FX\u0086\u000e\u00a2\u0006\f\u001a\u0004\b>\u0010:\"\u0004\b?\u0010<\u00a8\u0006G"}, d2 = {"Lcom/xiaozhi/companion/utils/PreferencesManager;", "", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "value", "", "autoStart", "getAutoStart", "()Z", "setAutoStart", "(Z)V", "", "darkMode", "getDarkMode", "()I", "setDarkMode", "(I)V", "isFirstLaunch", "setFirstLaunch", "keepScreenOn", "getKeepScreenOn", "setKeepScreenOn", "logLevel", "getLogLevel", "setLogLevel", "micSensitivity", "getMicSensitivity", "setMicSensitivity", "notificationEnabled", "getNotificationEnabled", "setNotificationEnabled", "offlineMode", "getOfflineMode", "setOfflineMode", "prefs", "Landroid/content/SharedPreferences;", "soundFeedbackEnabled", "getSoundFeedbackEnabled", "setSoundFeedbackEnabled", "", "vadThreshold", "getVadThreshold", "()F", "setVadThreshold", "(F)V", "vibrationEnabled", "getVibrationEnabled", "setVibrationEnabled", "visualizerColor", "getVisualizerColor", "setVisualizerColor", "visualizerMode", "getVisualizerMode", "setVisualizerMode", "", "webServerUrl", "getWebServerUrl", "()Ljava/lang/String;", "setWebServerUrl", "(Ljava/lang/String;)V", "wsServerUrl", "getWsServerUrl", "setWsServerUrl", "registerOnSharedPreferenceChangeListener", "", "listener", "Landroid/content/SharedPreferences$OnSharedPreferenceChangeListener;", "resetToDefaults", "unregisterOnSharedPreferenceChangeListener", "Companion", "app_debug"})
public final class PreferencesManager {
    @org.jetbrains.annotations.NotNull()
    private final android.content.SharedPreferences prefs = null;
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String PREFS_NAME = "xiaozhi_settings";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_VAD_THRESHOLD = "vad_threshold";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_MIC_SENSITIVITY = "mic_sensitivity";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_NOTIFICATION_ENABLED = "notification_enabled";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_SOUND_FEEDBACK_ENABLED = "sound_feedback_enabled";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_VIBRATION_ENABLED = "vibration_enabled";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_DARK_MODE = "dark_mode";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_AUTO_START = "auto_start";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_KEEP_SCREEN_ON = "keep_screen_on";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_WEB_SERVER_URL = "web_server_url";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_WS_SERVER_URL = "ws_server_url";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_OFFLINE_MODE = "offline_mode";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_LOG_LEVEL = "log_level";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_FIRST_LAUNCH = "first_launch";
    private static final float DEFAULT_VAD_THRESHOLD = 0.02F;
    private static final int DEFAULT_MIC_SENSITIVITY = 50;
    private static final int DEFAULT_LOG_LEVEL = 2;
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_VISUALIZER_MODE = "visualizer_mode";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String KEY_VISUALIZER_COLOR = "visualizer_color";
    @kotlin.jvm.Volatile()
    @org.jetbrains.annotations.Nullable()
    private static volatile com.xiaozhi.companion.utils.PreferencesManager instance;
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.utils.PreferencesManager.Companion Companion = null;
    
    public PreferencesManager(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        super();
    }
    
    public final float getVadThreshold() {
        return 0.0F;
    }
    
    public final void setVadThreshold(float value) {
    }
    
    public final int getMicSensitivity() {
        return 0;
    }
    
    public final void setMicSensitivity(int value) {
    }
    
    public final boolean getNotificationEnabled() {
        return false;
    }
    
    public final void setNotificationEnabled(boolean value) {
    }
    
    public final boolean getSoundFeedbackEnabled() {
        return false;
    }
    
    public final void setSoundFeedbackEnabled(boolean value) {
    }
    
    public final boolean getVibrationEnabled() {
        return false;
    }
    
    public final void setVibrationEnabled(boolean value) {
    }
    
    public final int getDarkMode() {
        return 0;
    }
    
    public final void setDarkMode(int value) {
    }
    
    public final boolean getAutoStart() {
        return false;
    }
    
    public final void setAutoStart(boolean value) {
    }
    
    public final boolean getKeepScreenOn() {
        return false;
    }
    
    public final void setKeepScreenOn(boolean value) {
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getWebServerUrl() {
        return null;
    }
    
    public final void setWebServerUrl(@org.jetbrains.annotations.NotNull()
    java.lang.String value) {
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getWsServerUrl() {
        return null;
    }
    
    public final void setWsServerUrl(@org.jetbrains.annotations.NotNull()
    java.lang.String value) {
    }
    
    public final boolean getOfflineMode() {
        return false;
    }
    
    public final void setOfflineMode(boolean value) {
    }
    
    public final int getLogLevel() {
        return 0;
    }
    
    public final void setLogLevel(int value) {
    }
    
    public final int getVisualizerMode() {
        return 0;
    }
    
    public final void setVisualizerMode(int value) {
    }
    
    public final int getVisualizerColor() {
        return 0;
    }
    
    public final void setVisualizerColor(int value) {
    }
    
    public final boolean isFirstLaunch() {
        return false;
    }
    
    public final void setFirstLaunch(boolean value) {
    }
    
    public final void resetToDefaults() {
    }
    
    public final void registerOnSharedPreferenceChangeListener(@org.jetbrains.annotations.NotNull()
    android.content.SharedPreferences.OnSharedPreferenceChangeListener listener) {
    }
    
    public final void unregisterOnSharedPreferenceChangeListener(@org.jetbrains.annotations.NotNull()
    android.content.SharedPreferences.OnSharedPreferenceChangeListener listener) {
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00000\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0007\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0010\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u000e\u0010\u001b\u001a\u00020\u001a2\u0006\u0010\u001c\u001a\u00020\u001dR\u000e\u0010\u0003\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0007X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000f\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0010\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0013\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0014\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0015\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0016\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0017\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0018\u001a\u00020\tX\u0082T\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0019\u001a\u0004\u0018\u00010\u001aX\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u001e"}, d2 = {"Lcom/xiaozhi/companion/utils/PreferencesManager$Companion;", "", "()V", "DEFAULT_LOG_LEVEL", "", "DEFAULT_MIC_SENSITIVITY", "DEFAULT_VAD_THRESHOLD", "", "KEY_AUTO_START", "", "KEY_DARK_MODE", "KEY_FIRST_LAUNCH", "KEY_KEEP_SCREEN_ON", "KEY_LOG_LEVEL", "KEY_MIC_SENSITIVITY", "KEY_NOTIFICATION_ENABLED", "KEY_OFFLINE_MODE", "KEY_SOUND_FEEDBACK_ENABLED", "KEY_VAD_THRESHOLD", "KEY_VIBRATION_ENABLED", "KEY_VISUALIZER_COLOR", "KEY_VISUALIZER_MODE", "KEY_WEB_SERVER_URL", "KEY_WS_SERVER_URL", "PREFS_NAME", "instance", "Lcom/xiaozhi/companion/utils/PreferencesManager;", "getInstance", "context", "Landroid/content/Context;", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.xiaozhi.companion.utils.PreferencesManager getInstance(@org.jetbrains.annotations.NotNull()
        android.content.Context context) {
            return null;
        }
    }
}
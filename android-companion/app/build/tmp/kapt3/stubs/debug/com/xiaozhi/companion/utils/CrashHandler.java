package com.xiaozhi.companion.utils;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000D\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0003\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0002\b\u0003\u0018\u0000 \u001b2\u00020\u0001:\u0001\u001bB\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0010\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\tH\u0002J\u0006\u0010\n\u001a\u00020\u0007J\u0018\u0010\u000b\u001a\u00020\f2\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u0010H\u0002J\b\u0010\u0011\u001a\u00020\fH\u0002J\f\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\t0\u0013J\u0006\u0010\u0014\u001a\u00020\u0007J\b\u0010\u0015\u001a\u00020\u0007H\u0002J\u0010\u0010\u0016\u001a\u00020\u00072\u0006\u0010\u0017\u001a\u00020\fH\u0002J\b\u0010\u0018\u001a\u00020\u0019H\u0002J\u0018\u0010\u001a\u001a\u00020\u00072\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u0010H\u0016R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0005\u001a\u0004\u0018\u00010\u0001X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u001c"}, d2 = {"Lcom/xiaozhi/companion/utils/CrashHandler;", "Ljava/lang/Thread$UncaughtExceptionHandler;", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "defaultHandler", "cleanOldCrashLogs", "", "logDir", "Ljava/io/File;", "clearCrashLogs", "gatherCrashInfo", "", "thread", "Ljava/lang/Thread;", "throwable", "", "getAppVersion", "getCrashLogs", "", "init", "restartApp", "saveCrashLog", "crashInfo", "shouldRestartApp", "", "uncaughtException", "Companion", "app_debug"})
public final class CrashHandler implements java.lang.Thread.UncaughtExceptionHandler {
    @org.jetbrains.annotations.NotNull()
    private final android.content.Context context = null;
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String TAG = "CrashHandler";
    @kotlin.jvm.Volatile()
    @org.jetbrains.annotations.Nullable()
    private static volatile com.xiaozhi.companion.utils.CrashHandler instance;
    @org.jetbrains.annotations.Nullable()
    private final java.lang.Thread.UncaughtExceptionHandler defaultHandler = null;
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.utils.CrashHandler.Companion Companion = null;
    
    public CrashHandler(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        super();
    }
    
    public final void init() {
    }
    
    @java.lang.Override()
    public void uncaughtException(@org.jetbrains.annotations.NotNull()
    java.lang.Thread thread, @org.jetbrains.annotations.NotNull()
    java.lang.Throwable throwable) {
    }
    
    private final java.lang.String gatherCrashInfo(java.lang.Thread thread, java.lang.Throwable throwable) {
        return null;
    }
    
    private final void saveCrashLog(java.lang.String crashInfo) {
    }
    
    private final void cleanOldCrashLogs(java.io.File logDir) {
    }
    
    private final boolean shouldRestartApp() {
        return false;
    }
    
    private final void restartApp() {
    }
    
    private final java.lang.String getAppVersion() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<java.io.File> getCrashLogs() {
        return null;
    }
    
    public final void clearCrashLogs() {
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u000e\u0010\u0007\u001a\u00020\u00062\u0006\u0010\b\u001a\u00020\tR\u000e\u0010\u0003\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0005\u001a\u0004\u0018\u00010\u0006X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006\n"}, d2 = {"Lcom/xiaozhi/companion/utils/CrashHandler$Companion;", "", "()V", "TAG", "", "instance", "Lcom/xiaozhi/companion/utils/CrashHandler;", "getInstance", "context", "Landroid/content/Context;", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.xiaozhi.companion.utils.CrashHandler getInstance(@org.jetbrains.annotations.NotNull()
        android.content.Context context) {
            return null;
        }
    }
}
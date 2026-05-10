package com.xiaozhi.companion.utils;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0012\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\u0018\u0000 \u00052\u00020\u0001:\u0002\u0005\u0006B\u000f\b\u0002\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u0007"}, d2 = {"Lcom/xiaozhi/companion/utils/Logger;", "", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "Companion", "LogEntry", "app_debug"})
public final class Logger {
    @org.jetbrains.annotations.NotNull()
    private final android.content.Context context = null;
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String TAG = "XiaoZhi";
    private static final int MAX_LOG_SIZE = 10485760;
    private static final int MAX_LOG_FILES = 7;
    private static final int LOG_LEVEL_DEBUG = 0;
    private static final int LOG_LEVEL_INFO = 1;
    private static final int LOG_LEVEL_WARN = 2;
    private static final int LOG_LEVEL_ERROR = 3;
    @kotlin.jvm.Volatile()
    @org.jetbrains.annotations.Nullable()
    private static volatile com.xiaozhi.companion.utils.Logger instance;
    private static int logLevel = 1;
    @org.jetbrains.annotations.Nullable()
    private static android.content.Context loggerContext;
    @org.jetbrains.annotations.NotNull()
    private static final java.util.concurrent.ConcurrentLinkedQueue<com.xiaozhi.companion.utils.Logger.LogEntry> logQueue = null;
    private static final java.util.concurrent.ExecutorService executor = null;
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.utils.Logger.Companion Companion = null;
    
    private Logger(android.content.Context context) {
        super();
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000Z\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0006\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\b\n\u0002\u0010\u0003\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\b\u000b\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J,\u0010\u0017\u001a\u00020\u00182\u0006\u0010\u0019\u001a\u00020\u00042\u0006\u0010\u001a\u001a\u00020\u000b2\u0006\u0010\u001b\u001a\u00020\u000b2\n\b\u0002\u0010\u001c\u001a\u0004\u0018\u00010\u000bH\u0002J\u0006\u0010\u001d\u001a\u00020\u0018J\u0018\u0010\u001e\u001a\u00020\u00182\u0006\u0010\u001b\u001a\u00020\u000b2\b\b\u0002\u0010\u001a\u001a\u00020\u000bJ$\u0010\u001f\u001a\u00020\u00182\u0006\u0010\u001b\u001a\u00020\u000b2\n\b\u0002\u0010 \u001a\u0004\u0018\u00010!2\b\b\u0002\u0010\u001a\u001a\u00020\u000bJ\u0006\u0010\"\u001a\u00020\u0010J\u0018\u0010#\u001a\u00020\u000b2\u0006\u0010$\u001a\u00020%2\b\b\u0002\u0010&\u001a\u00020\u0004J\f\u0010\'\u001a\b\u0012\u0004\u0012\u00020%0(J\u0018\u0010)\u001a\u00020\u00182\u0006\u0010\u001b\u001a\u00020\u000b2\b\b\u0002\u0010\u001a\u001a\u00020\u000bJ\u000e\u0010*\u001a\u00020\u00182\u0006\u0010+\u001a\u00020\u0016J\u0010\u0010,\u001a\u00020\u00182\u0006\u0010-\u001a\u00020%H\u0002J\u000e\u0010.\u001a\u00020\u00182\u0006\u0010\u0019\u001a\u00020\u0004J\b\u0010/\u001a\u00020\u0018H\u0002J\u0018\u00100\u001a\u00020\u00182\u0006\u0010\u001b\u001a\u00020\u000b2\b\b\u0002\u0010\u001a\u001a\u00020\u000bJ\u0010\u00101\u001a\u00020\u00182\u0006\u00102\u001a\u00020\u0014H\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u000bX\u0082T\u00a2\u0006\u0002\n\u0000R\u0016\u0010\f\u001a\n \u000e*\u0004\u0018\u00010\r0\rX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u000f\u001a\u0004\u0018\u00010\u0010X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\u0004X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00140\u0013X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0015\u001a\u0004\u0018\u00010\u0016X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u00063"}, d2 = {"Lcom/xiaozhi/companion/utils/Logger$Companion;", "", "()V", "LOG_LEVEL_DEBUG", "", "LOG_LEVEL_ERROR", "LOG_LEVEL_INFO", "LOG_LEVEL_WARN", "MAX_LOG_FILES", "MAX_LOG_SIZE", "TAG", "", "executor", "Ljava/util/concurrent/ExecutorService;", "kotlin.jvm.PlatformType", "instance", "Lcom/xiaozhi/companion/utils/Logger;", "logLevel", "logQueue", "Ljava/util/concurrent/ConcurrentLinkedQueue;", "Lcom/xiaozhi/companion/utils/Logger$LogEntry;", "loggerContext", "Landroid/content/Context;", "addToQueue", "", "level", "tag", "message", "stackTrace", "clearLogs", "d", "e", "throwable", "", "getInstance", "getLogContent", "file", "Ljava/io/File;", "maxLines", "getLogFiles", "", "i", "init", "context", "rotateLogs", "logDir", "setLogLevel", "startLogWriter", "w", "writeToFile", "entry", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        public final void init(@org.jetbrains.annotations.NotNull()
        android.content.Context context) {
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.xiaozhi.companion.utils.Logger getInstance() {
            return null;
        }
        
        public final void setLogLevel(int level) {
        }
        
        public final void d(@org.jetbrains.annotations.NotNull()
        java.lang.String message, @org.jetbrains.annotations.NotNull()
        java.lang.String tag) {
        }
        
        public final void i(@org.jetbrains.annotations.NotNull()
        java.lang.String message, @org.jetbrains.annotations.NotNull()
        java.lang.String tag) {
        }
        
        public final void w(@org.jetbrains.annotations.NotNull()
        java.lang.String message, @org.jetbrains.annotations.NotNull()
        java.lang.String tag) {
        }
        
        public final void e(@org.jetbrains.annotations.NotNull()
        java.lang.String message, @org.jetbrains.annotations.Nullable()
        java.lang.Throwable throwable, @org.jetbrains.annotations.NotNull()
        java.lang.String tag) {
        }
        
        private final void addToQueue(int level, java.lang.String tag, java.lang.String message, java.lang.String stackTrace) {
        }
        
        private final void startLogWriter() {
        }
        
        private final void writeToFile(com.xiaozhi.companion.utils.Logger.LogEntry entry) {
        }
        
        private final void rotateLogs(java.io.File logDir) {
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.util.List<java.io.File> getLogFiles() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String getLogContent(@org.jetbrains.annotations.NotNull()
        java.io.File file, int maxLines) {
            return null;
        }
        
        public final void clearLogs() {
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\t\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0012\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0086\b\u0018\u00002\u00020\u0001B1\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\u0006\u0010\b\u001a\u00020\u0007\u0012\n\b\u0002\u0010\t\u001a\u0004\u0018\u00010\u0007\u00a2\u0006\u0002\u0010\nJ\t\u0010\u0013\u001a\u00020\u0003H\u00c6\u0003J\t\u0010\u0014\u001a\u00020\u0005H\u00c6\u0003J\t\u0010\u0015\u001a\u00020\u0007H\u00c6\u0003J\t\u0010\u0016\u001a\u00020\u0007H\u00c6\u0003J\u000b\u0010\u0017\u001a\u0004\u0018\u00010\u0007H\u00c6\u0003J=\u0010\u0018\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u00072\b\b\u0002\u0010\b\u001a\u00020\u00072\n\b\u0002\u0010\t\u001a\u0004\u0018\u00010\u0007H\u00c6\u0001J\u0013\u0010\u0019\u001a\u00020\u001a2\b\u0010\u001b\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010\u001c\u001a\u00020\u0005H\u00d6\u0001J\t\u0010\u001d\u001a\u00020\u0007H\u00d6\u0001R\u0011\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u0011\u0010\b\u001a\u00020\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000eR\u0013\u0010\t\u001a\u0004\u0018\u00010\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u000eR\u0011\u0010\u0006\u001a\u00020\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u000eR\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0012\u00a8\u0006\u001e"}, d2 = {"Lcom/xiaozhi/companion/utils/Logger$LogEntry;", "", "timestamp", "", "level", "", "tag", "", "message", "stackTrace", "(JILjava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", "getLevel", "()I", "getMessage", "()Ljava/lang/String;", "getStackTrace", "getTag", "getTimestamp", "()J", "component1", "component2", "component3", "component4", "component5", "copy", "equals", "", "other", "hashCode", "toString", "app_debug"})
    public static final class LogEntry {
        private final long timestamp = 0L;
        private final int level = 0;
        @org.jetbrains.annotations.NotNull()
        private final java.lang.String tag = null;
        @org.jetbrains.annotations.NotNull()
        private final java.lang.String message = null;
        @org.jetbrains.annotations.Nullable()
        private final java.lang.String stackTrace = null;
        
        public LogEntry(long timestamp, int level, @org.jetbrains.annotations.NotNull()
        java.lang.String tag, @org.jetbrains.annotations.NotNull()
        java.lang.String message, @org.jetbrains.annotations.Nullable()
        java.lang.String stackTrace) {
            super();
        }
        
        public final long getTimestamp() {
            return 0L;
        }
        
        public final int getLevel() {
            return 0;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String getTag() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String getMessage() {
            return null;
        }
        
        @org.jetbrains.annotations.Nullable()
        public final java.lang.String getStackTrace() {
            return null;
        }
        
        public final long component1() {
            return 0L;
        }
        
        public final int component2() {
            return 0;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String component3() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final java.lang.String component4() {
            return null;
        }
        
        @org.jetbrains.annotations.Nullable()
        public final java.lang.String component5() {
            return null;
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.xiaozhi.companion.utils.Logger.LogEntry copy(long timestamp, int level, @org.jetbrains.annotations.NotNull()
        java.lang.String tag, @org.jetbrains.annotations.NotNull()
        java.lang.String message, @org.jetbrains.annotations.Nullable()
        java.lang.String stackTrace) {
            return null;
        }
        
        @java.lang.Override()
        public boolean equals(@org.jetbrains.annotations.Nullable()
        java.lang.Object other) {
            return false;
        }
        
        @java.lang.Override()
        public int hashCode() {
            return 0;
        }
        
        @java.lang.Override()
        @org.jetbrains.annotations.NotNull()
        public java.lang.String toString() {
            return null;
        }
    }
}
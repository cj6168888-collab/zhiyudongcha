package com.xiaozhi.companion.service;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000V\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010 \n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\r\u0018\u0000 \'2\u00020\u0001:\u0001\'B\u0005\u00a2\u0006\u0002\u0010\u0002J\b\u0010\u0010\u001a\u00020\u0011H\u0002J\u0010\u0010\u0012\u001a\u00020\n2\u0006\u0010\u0013\u001a\u00020\u0014H\u0002J\u0010\u0010\u0015\u001a\u00020\u00162\u0006\u0010\u0017\u001a\u00020\u0014H\u0002J\u0014\u0010\u0018\u001a\u0004\u0018\u00010\u00192\b\u0010\u001a\u001a\u0004\u0018\u00010\u001bH\u0016J\b\u0010\u001c\u001a\u00020\u0016H\u0016J\b\u0010\u001d\u001a\u00020\u0016H\u0016J\"\u0010\u001e\u001a\u00020\u00042\b\u0010\u001a\u001a\u0004\u0018\u00010\u001b2\u0006\u0010\u001f\u001a\u00020\u00042\u0006\u0010 \u001a\u00020\u0004H\u0016J\u0010\u0010!\u001a\u00020\u00162\u0006\u0010\u0013\u001a\u00020\u0014H\u0002J\b\u0010\"\u001a\u00020\u0016H\u0002J\b\u0010#\u001a\u00020\u0016H\u0002J\u0010\u0010$\u001a\u00020\u00162\u0006\u0010%\u001a\u00020\u0006H\u0002J\u0010\u0010&\u001a\u00020\u00162\u0006\u0010\u0013\u001a\u00020\u0014H\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082D\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0007\u001a\u0004\u0018\u00010\bX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\u00060\fX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\r\u001a\b\u0012\u0004\u0012\u00020\u00060\fX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u000e\u001a\u0004\u0018\u00010\u000fX\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006("}, d2 = {"Lcom/xiaozhi/companion/service/FileWatcherService;", "Landroid/app/Service;", "()V", "NOTIFICATION_ID", "", "TAG", "", "fileObserver", "Landroid/os/FileObserver;", "isWatching", "", "targetExtensions", "", "watchPaths", "webSocketManager", "Lcom/xiaozhi/companion/WebSocketManager;", "createNotification", "Landroid/app/Notification;", "isTargetFile", "file", "Ljava/io/File;", "observeDirectory", "", "directory", "onBind", "Landroid/os/IBinder;", "intent", "Landroid/content/Intent;", "onCreate", "onDestroy", "onStartCommand", "flags", "startId", "processFile", "startWatching", "stopWatching", "updateNotification", "text", "uploadFile", "Companion", "app_debug"})
public final class FileWatcherService extends android.app.Service {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String TAG = "FileWatcherService";
    private final int NOTIFICATION_ID = 1001;
    @org.jetbrains.annotations.Nullable()
    private android.os.FileObserver fileObserver;
    @org.jetbrains.annotations.Nullable()
    private com.xiaozhi.companion.WebSocketManager webSocketManager;
    @org.jetbrains.annotations.NotNull()
    private final java.util.List<java.lang.String> watchPaths = null;
    @org.jetbrains.annotations.NotNull()
    private final java.util.List<java.lang.String> targetExtensions = null;
    private boolean isWatching = false;
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String ACTION_START = "com.xiaozhi.companion.START_WATCHING";
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String ACTION_STOP = "com.xiaozhi.companion.STOP_WATCHING";
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String ACTION_SET_WS = "com.xiaozhi.companion.SET_WS";
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String EXTRA_WS = "ws_manager";
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String CHANNEL_ID = "file_watcher_channel";
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.service.FileWatcherService.Companion Companion = null;
    
    public FileWatcherService() {
        super();
    }
    
    @java.lang.Override()
    public void onCreate() {
    }
    
    @java.lang.Override()
    public int onStartCommand(@org.jetbrains.annotations.Nullable()
    android.content.Intent intent, int flags, int startId) {
        return 0;
    }
    
    private final void startWatching() {
    }
    
    private final void observeDirectory(java.io.File directory) {
    }
    
    private final boolean isTargetFile(java.io.File file) {
        return false;
    }
    
    private final void processFile(java.io.File file) {
    }
    
    private final void uploadFile(java.io.File file) {
    }
    
    private final void stopWatching() {
    }
    
    private final android.app.Notification createNotification() {
        return null;
    }
    
    private final void updateNotification(java.lang.String text) {
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.Nullable()
    public android.os.IBinder onBind(@org.jetbrains.annotations.Nullable()
    android.content.Intent intent) {
        return null;
    }
    
    @java.lang.Override()
    public void onDestroy() {
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0014\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0005\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000\u00a8\u0006\t"}, d2 = {"Lcom/xiaozhi/companion/service/FileWatcherService$Companion;", "", "()V", "ACTION_SET_WS", "", "ACTION_START", "ACTION_STOP", "CHANNEL_ID", "EXTRA_WS", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
    }
}
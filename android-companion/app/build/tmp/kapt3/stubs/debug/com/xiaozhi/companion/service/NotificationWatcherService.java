package com.xiaozhi.companion.service;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000P\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\"\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0004\n\u0002\u0010\b\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0010$\n\u0002\u0010\u0000\n\u0002\b\u0006\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\n\u0018\u0000 )2\u00020\u0001:\u0001)B\u0005\u00a2\u0006\u0002\u0010\u0002J\u0006\u0010\n\u001a\u00020\u000bJ\"\u0010\f\u001a\u00020\u000b2\b\u0010\r\u001a\u0004\u0018\u00010\u00042\b\u0010\u000e\u001a\u0004\u0018\u00010\u00042\u0006\u0010\u000f\u001a\u00020\u0010J\u0012\u0010\u0011\u001a\u0004\u0018\u00010\u00042\u0006\u0010\u0012\u001a\u00020\u0004H\u0002J\u0018\u0010\u0013\u001a\u0014\u0012\u0010\u0012\u000e\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u00160\u00150\u0014J\u0018\u0010\u0017\u001a\u00020\u000b2\u0006\u0010\u0018\u001a\u00020\u00042\u0006\u0010\u0012\u001a\u00020\u0004H\u0002J \u0010\u0019\u001a\u00020\u000b2\u0006\u0010\r\u001a\u00020\u00042\u0006\u0010\u0018\u001a\u00020\u00042\u0006\u0010\u0012\u001a\u00020\u0004H\u0002J\u0018\u0010\u001a\u001a\u00020\u000b2\u0006\u0010\u0018\u001a\u00020\u00042\u0006\u0010\u0012\u001a\u00020\u0004H\u0002J\u0018\u0010\u001b\u001a\u00020\u000b2\u0006\u0010\u0018\u001a\u00020\u00042\u0006\u0010\u0012\u001a\u00020\u0004H\u0002J\u0018\u0010\u001c\u001a\u00020\u001d2\u0006\u0010\u0018\u001a\u00020\u00042\u0006\u0010\u0012\u001a\u00020\u0004H\u0002J\u0010\u0010\u001e\u001a\u00020\u001d2\u0006\u0010\u001f\u001a\u00020 H\u0002J\b\u0010!\u001a\u00020\u000bH\u0016J\u0012\u0010\"\u001a\u00020\u000b2\b\u0010\u001f\u001a\u0004\u0018\u00010 H\u0016J\u0012\u0010#\u001a\u00020\u000b2\b\u0010\u001f\u001a\u0004\u0018\u00010 H\u0016J$\u0010$\u001a\u00020\u000b2\u0006\u0010%\u001a\u00020\u00042\u0012\u0010&\u001a\u000e\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u00040\u0015H\u0002J\u0010\u0010\'\u001a\u00020\u000b2\b\u0010(\u001a\u0004\u0018\u00010\tR\u000e\u0010\u0003\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00040\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u0007\u001a\b\u0012\u0004\u0012\u00020\u00040\u0006X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\b\u001a\u0004\u0018\u00010\tX\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006*"}, d2 = {"Lcom/xiaozhi/companion/service/NotificationWatcherService;", "Landroid/service/notification/NotificationListenerService;", "()V", "TAG", "", "ignoredPackages", "", "watchedPackages", "webSocketManager", "Lcom/xiaozhi/companion/WebSocketManager;", "clearAllNotifications", "", "clearNotification", "packageName", "tag", "id", "", "extractVerificationCode", "content", "getActiveNotificationsMap", "", "", "", "handleCallNotification", "title", "handleImportantNotification", "handleSmsNotification", "handleWeChatNotification", "isImportantNotification", "", "isWeChatRelated", "sbn", "Landroid/service/notification/StatusBarNotification;", "onCreate", "onNotificationPosted", "onNotificationRemoved", "sendActionPayload", "action", "data", "setWebSocketManager", "ws", "Companion", "app_debug"})
public final class NotificationWatcherService extends android.service.notification.NotificationListenerService {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String TAG = "NotificationWatcher";
    @org.jetbrains.annotations.Nullable()
    private com.xiaozhi.companion.WebSocketManager webSocketManager;
    @org.jetbrains.annotations.NotNull()
    private final java.util.Set<java.lang.String> watchedPackages = null;
    @org.jetbrains.annotations.NotNull()
    private final java.util.Set<java.lang.String> ignoredPackages = null;
    @org.jetbrains.annotations.Nullable()
    private static com.xiaozhi.companion.service.NotificationWatcherService instance;
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.service.NotificationWatcherService.Companion Companion = null;
    
    public NotificationWatcherService() {
        super();
    }
    
    @java.lang.Override()
    public void onCreate() {
    }
    
    @java.lang.Override()
    public void onNotificationPosted(@org.jetbrains.annotations.Nullable()
    android.service.notification.StatusBarNotification sbn) {
    }
    
    @java.lang.Override()
    public void onNotificationRemoved(@org.jetbrains.annotations.Nullable()
    android.service.notification.StatusBarNotification sbn) {
    }
    
    public final void setWebSocketManager(@org.jetbrains.annotations.Nullable()
    com.xiaozhi.companion.WebSocketManager ws) {
    }
    
    private final boolean isWeChatRelated(android.service.notification.StatusBarNotification sbn) {
        return false;
    }
    
    private final boolean isImportantNotification(java.lang.String title, java.lang.String content) {
        return false;
    }
    
    private final void handleImportantNotification(java.lang.String packageName, java.lang.String title, java.lang.String content) {
    }
    
    private final void handleWeChatNotification(java.lang.String title, java.lang.String content) {
    }
    
    private final void handleSmsNotification(java.lang.String title, java.lang.String content) {
    }
    
    private final void handleCallNotification(java.lang.String title, java.lang.String content) {
    }
    
    private final java.lang.String extractVerificationCode(java.lang.String content) {
        return null;
    }
    
    private final void sendActionPayload(java.lang.String action, java.util.Map<java.lang.String, java.lang.String> data) {
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.util.List<java.util.Map<java.lang.String, java.lang.Object>> getActiveNotificationsMap() {
        return null;
    }
    
    public final void clearNotification(@org.jetbrains.annotations.Nullable()
    java.lang.String packageName, @org.jetbrains.annotations.Nullable()
    java.lang.String tag, int id) {
    }
    
    public final void clearAllNotifications() {
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0014\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\"\u0010\u0005\u001a\u0004\u0018\u00010\u00042\b\u0010\u0003\u001a\u0004\u0018\u00010\u0004@BX\u0086\u000e\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007\u00a8\u0006\b"}, d2 = {"Lcom/xiaozhi/companion/service/NotificationWatcherService$Companion;", "", "()V", "<set-?>", "Lcom/xiaozhi/companion/service/NotificationWatcherService;", "instance", "getInstance", "()Lcom/xiaozhi/companion/service/NotificationWatcherService;", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.Nullable()
        public final com.xiaozhi.companion.service.NotificationWatcherService getInstance() {
            return null;
        }
    }
}
package com.xiaozhi.companion.service;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000r\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010$\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\n\n\u0002\u0010\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\n\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u0007\n\u0002\b\t\n\u0002\u0010\t\n\u0002\b\t\u0018\u0000 G2\u00020\u0001:\u0001GB\u0005\u00a2\u0006\u0002\u0010\u0002J\u001e\u0010\u000f\u001a\u0010\u0012\u0004\u0012\u00020\u0004\u0012\u0006\u0012\u0004\u0018\u00010\u00110\u00102\u0006\u0010\u0012\u001a\u00020\u0013H\u0002J\u0012\u0010\u0014\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0015\u001a\u00020\u0016H\u0002J\u001a\u0010\u0017\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0018\u001a\u00020\u00132\u0006\u0010\u0019\u001a\u00020\u0004H\u0002J\u001a\u0010\u001a\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0018\u001a\u00020\u00132\u0006\u0010\u001b\u001a\u00020\u0004H\u0002J\u001a\u0010\u001c\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0018\u001a\u00020\u00132\u0006\u0010\u001d\u001a\u00020\u0004H\u0002J\u001a\u0010\u001e\u001a\u0004\u0018\u00010\u00132\u0006\u0010\u0018\u001a\u00020\u00132\u0006\u0010\u001f\u001a\u00020\u0004H\u0002J\b\u0010 \u001a\u00020!H\u0002J\u000e\u0010\"\u001a\u00020!2\u0006\u0010#\u001a\u00020$J\u0018\u0010%\u001a\u00020!2\u0006\u0010\u0015\u001a\u00020\u00162\u0006\u0010&\u001a\u00020\bH\u0002J&\u0010\'\u001a\u00020!2\u0006\u0010\u0015\u001a\u00020\u00162\u0014\u0010(\u001a\u0010\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u0011\u0018\u00010\u0010H\u0002J\u0010\u0010)\u001a\u00020!2\u0006\u0010\u0015\u001a\u00020\u0016H\u0002J\u0010\u0010*\u001a\u00020!2\u0006\u0010+\u001a\u00020\bH\u0002J\u001e\u0010,\u001a\u00020!2\u0014\u0010(\u001a\u0010\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u0011\u0018\u00010\u0010H\u0002J\u0012\u0010-\u001a\u00020!2\b\u0010.\u001a\u0004\u0018\u00010/H\u0016J\b\u00100\u001a\u00020!H\u0016J\b\u00101\u001a\u00020!H\u0016J\b\u00102\u001a\u00020!H\u0014J\u0018\u00103\u001a\u00020\b2\u0006\u00104\u001a\u0002052\u0006\u00106\u001a\u000205H\u0002J\u0018\u00107\u001a\u00020\b2\u0006\u00104\u001a\u0002052\u0006\u00106\u001a\u000205H\u0002J\u0010\u00108\u001a\u00020\b2\u0006\u0010+\u001a\u00020\bH\u0002J0\u00109\u001a\u00020\b2\u0006\u0010:\u001a\u0002052\u0006\u0010;\u001a\u0002052\u0006\u0010<\u001a\u0002052\u0006\u0010=\u001a\u0002052\u0006\u0010>\u001a\u00020?H\u0002J\u0018\u0010@\u001a\u00020!2\u0006\u0010A\u001a\u00020\b2\u0006\u0010B\u001a\u00020\u0004H\u0002J\u0010\u0010C\u001a\u00020!2\b\u0010D\u001a\u0004\u0018\u00010\u000eJ\b\u0010E\u001a\u00020!H\u0002J\b\u0010F\u001a\u00020!H\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u0005\u001a\u0004\u0018\u00010\u0006X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\bX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u000b\u001a\u0004\u0018\u00010\fX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0010\u0010\r\u001a\u0004\u0018\u00010\u000eX\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006H"}, d2 = {"Lcom/xiaozhi/companion/service/XiaoZhiAccessibilityService;", "Landroid/accessibilityservice/AccessibilityService;", "()V", "TAG", "", "imageReader", "Landroid/media/ImageReader;", "isCapturing", "", "mainHandler", "Landroid/os/Handler;", "mediaProjection", "Landroid/media/projection/MediaProjection;", "webSocketManager", "Lcom/xiaozhi/companion/WebSocketManager;", "buildHierarchyJson", "", "", "node", "Landroid/view/accessibility/AccessibilityNodeInfo;", "findNode", "target", "Lcom/xiaozhi/companion/model/ActionTarget;", "findNodeByClassName", "root", "className", "findNodeByDescription", "description", "findNodeById", "viewId", "findNodeByText", "text", "getViewHierarchy", "", "handleAction", "actionPayload", "Lcom/xiaozhi/companion/model/ActionPayload;", "handleClick", "captureResult", "handleInputText", "params", "handleLongClick", "handleScroll", "forward", "handleSwipe", "onAccessibilityEvent", "event", "Landroid/view/accessibility/AccessibilityEvent;", "onDestroy", "onInterrupt", "onServiceConnected", "performClick", "x", "", "y", "performLongClick", "performScroll", "performSwipe", "startX", "startY", "endX", "endY", "duration", "", "sendActionResponse", "success", "message", "setWebSocketManager", "ws", "stopScreenCapture", "takeScreenshot", "Companion", "app_debug"})
public final class XiaoZhiAccessibilityService extends android.accessibilityservice.AccessibilityService {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String TAG = "XiaoZhiAccessibility";
    @org.jetbrains.annotations.NotNull()
    private final android.os.Handler mainHandler = null;
    @org.jetbrains.annotations.Nullable()
    private com.xiaozhi.companion.WebSocketManager webSocketManager;
    @org.jetbrains.annotations.Nullable()
    private android.media.projection.MediaProjection mediaProjection;
    @org.jetbrains.annotations.Nullable()
    private android.media.ImageReader imageReader;
    private boolean isCapturing = false;
    @org.jetbrains.annotations.Nullable()
    private static com.xiaozhi.companion.service.XiaoZhiAccessibilityService instance;
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.service.XiaoZhiAccessibilityService.Companion Companion = null;
    
    public XiaoZhiAccessibilityService() {
        super();
    }
    
    @java.lang.Override()
    protected void onServiceConnected() {
    }
    
    @java.lang.Override()
    public void onAccessibilityEvent(@org.jetbrains.annotations.Nullable()
    android.view.accessibility.AccessibilityEvent event) {
    }
    
    @java.lang.Override()
    public void onInterrupt() {
    }
    
    @java.lang.Override()
    public void onDestroy() {
    }
    
    public final void setWebSocketManager(@org.jetbrains.annotations.Nullable()
    com.xiaozhi.companion.WebSocketManager ws) {
    }
    
    public final void handleAction(@org.jetbrains.annotations.NotNull()
    com.xiaozhi.companion.model.ActionPayload actionPayload) {
    }
    
    private final void handleClick(com.xiaozhi.companion.model.ActionTarget target, boolean captureResult) {
    }
    
    private final void handleLongClick(com.xiaozhi.companion.model.ActionTarget target) {
    }
    
    private final void handleScroll(boolean forward) {
    }
    
    private final void handleInputText(com.xiaozhi.companion.model.ActionTarget target, java.util.Map<java.lang.String, ? extends java.lang.Object> params) {
    }
    
    private final void handleSwipe(java.util.Map<java.lang.String, ? extends java.lang.Object> params) {
    }
    
    private final android.view.accessibility.AccessibilityNodeInfo findNode(com.xiaozhi.companion.model.ActionTarget target) {
        return null;
    }
    
    private final android.view.accessibility.AccessibilityNodeInfo findNodeByText(android.view.accessibility.AccessibilityNodeInfo root, java.lang.String text) {
        return null;
    }
    
    private final android.view.accessibility.AccessibilityNodeInfo findNodeById(android.view.accessibility.AccessibilityNodeInfo root, java.lang.String viewId) {
        return null;
    }
    
    private final android.view.accessibility.AccessibilityNodeInfo findNodeByDescription(android.view.accessibility.AccessibilityNodeInfo root, java.lang.String description) {
        return null;
    }
    
    private final android.view.accessibility.AccessibilityNodeInfo findNodeByClassName(android.view.accessibility.AccessibilityNodeInfo root, java.lang.String className) {
        return null;
    }
    
    private final boolean performClick(float x, float y) {
        return false;
    }
    
    private final boolean performLongClick(float x, float y) {
        return false;
    }
    
    private final boolean performScroll(boolean forward) {
        return false;
    }
    
    private final boolean performSwipe(float startX, float startY, float endX, float endY, long duration) {
        return false;
    }
    
    private final void takeScreenshot() {
    }
    
    private final void stopScreenCapture() {
    }
    
    private final void getViewHierarchy() {
    }
    
    private final java.util.Map<java.lang.String, java.lang.Object> buildHierarchyJson(android.view.accessibility.AccessibilityNodeInfo node) {
        return null;
    }
    
    private final void sendActionResponse(boolean success, java.lang.String message) {
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0014\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\"\u0010\u0005\u001a\u0004\u0018\u00010\u00042\b\u0010\u0003\u001a\u0004\u0018\u00010\u0004@BX\u0086\u000e\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007\u00a8\u0006\b"}, d2 = {"Lcom/xiaozhi/companion/service/XiaoZhiAccessibilityService$Companion;", "", "()V", "<set-?>", "Lcom/xiaozhi/companion/service/XiaoZhiAccessibilityService;", "instance", "getInstance", "()Lcom/xiaozhi/companion/service/XiaoZhiAccessibilityService;", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.Nullable()
        public final com.xiaozhi.companion.service.XiaoZhiAccessibilityService getInstance() {
            return null;
        }
    }
}
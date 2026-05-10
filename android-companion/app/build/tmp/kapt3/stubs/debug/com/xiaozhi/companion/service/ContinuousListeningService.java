package com.xiaozhi.companion.service;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000p\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\u0010\u0007\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u0012\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0017\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0013\u0018\u0000 >2\u00020\u0001:\u0001>B\u0005\u00a2\u0006\u0002\u0010\u0002J\u0018\u0010\u001f\u001a\u00020\u000f2\u0006\u0010 \u001a\u00020!2\u0006\u0010\"\u001a\u00020\u0006H\u0002J\u0010\u0010#\u001a\u00020$2\u0006\u0010%\u001a\u00020\u0004H\u0002J\b\u0010&\u001a\u00020\u0010H\u0002J\b\u0010\'\u001a\u00020\u0010H\u0002J\u0006\u0010(\u001a\u00020\u0012J\u0014\u0010)\u001a\u0004\u0018\u00010*2\b\u0010+\u001a\u0004\u0018\u00010,H\u0016J\b\u0010-\u001a\u00020\u0010H\u0016J\b\u0010.\u001a\u00020\u0010H\u0016J\"\u0010/\u001a\u00020\u00062\b\u0010+\u001a\u0004\u0018\u00010,2\u0006\u00100\u001a\u00020\u00062\u0006\u00101\u001a\u00020\u0006H\u0016J\u0010\u00102\u001a\u00020\u00102\u0006\u00103\u001a\u00020\u001cH\u0002J\u001a\u00104\u001a\u00020\u00102\u0012\u00105\u001a\u000e\u0012\u0004\u0012\u00020\u000f\u0012\u0004\u0012\u00020\u00100\u000eJ\u000e\u00106\u001a\u00020\u00102\u0006\u00107\u001a\u00020\u000fJ\u001a\u00108\u001a\u00020\u00102\u0012\u00105\u001a\u000e\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u00100\u000eJ\u0010\u00109\u001a\u00020\u00102\b\u0010:\u001a\u0004\u0018\u00010\u001eJ\u0006\u0010;\u001a\u00020\u0010J\u0006\u0010<\u001a\u00020\u0010J\u0010\u0010=\u001a\u00020\u00102\u0006\u0010%\u001a\u00020\u0004H\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\u0006X\u0082D\u00a2\u0006\u0002\n\u0000R\u0010\u0010\t\u001a\u0004\u0018\u00010\nX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\u0006X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\u0006X\u0082D\u00a2\u0006\u0002\n\u0000R\u001c\u0010\r\u001a\u0010\u0012\u0004\u0012\u00020\u000f\u0012\u0004\u0012\u00020\u0010\u0018\u00010\u000eX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\u0012X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0013\u001a\u00020\u0014X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0015\u001a\u00020\u0016X\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0017\u001a\u00020\u0006X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0018\u001a\u00020\u0006X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0019\u001a\u00020\u0006X\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u001a\u001a\u00020\u000fX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u001c\u0010\u001b\u001a\u0010\u0012\u0004\u0012\u00020\u001c\u0012\u0004\u0012\u00020\u0010\u0018\u00010\u000eX\u0082\u000e\u00a2\u0006\u0002\n\u0000R\u0010\u0010\u001d\u001a\u0004\u0018\u00010\u001eX\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006?"}, d2 = {"Lcom/xiaozhi/companion/service/ContinuousListeningService;", "Landroid/app/Service;", "()V", "CHANNEL_ID", "", "NOTIFICATION_ID", "", "TAG", "audioFormat", "audioRecord", "Landroid/media/AudioRecord;", "bufferSize", "channelConfig", "energyCallback", "Lkotlin/Function1;", "", "", "isRecording", "", "isRecordingFlag", "Ljava/util/concurrent/atomic/AtomicBoolean;", "mainHandler", "Landroid/os/Handler;", "maxSilenceFrames", "sampleRate", "silenceCount", "vadThreshold", "voiceCallback", "", "webSocketManager", "Lcom/xiaozhi/companion/WebSocketManager;", "calculateEnergy", "buffer", "", "readSize", "createNotification", "Landroid/app/Notification;", "text", "createNotificationChannel", "initAudioRecord", "isListening", "onBind", "Landroid/os/IBinder;", "intent", "Landroid/content/Intent;", "onCreate", "onDestroy", "onStartCommand", "flags", "startId", "sendAudioToServer", "audioData", "setEnergyCallback", "callback", "setVadThreshold", "threshold", "setVoiceCallback", "setWebSocketManager", "ws", "startListening", "stopListening", "updateNotification", "Companion", "app_debug"})
public final class ContinuousListeningService extends android.app.Service {
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String TAG = "ContinuousListening";
    private final int NOTIFICATION_ID = 2001;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String CHANNEL_ID = "continuous_listening_channel";
    @org.jetbrains.annotations.Nullable()
    private android.media.AudioRecord audioRecord;
    private boolean isRecording = false;
    @org.jetbrains.annotations.NotNull()
    private final java.util.concurrent.atomic.AtomicBoolean isRecordingFlag = null;
    @org.jetbrains.annotations.Nullable()
    private com.xiaozhi.companion.WebSocketManager webSocketManager;
    @org.jetbrains.annotations.Nullable()
    private kotlin.jvm.functions.Function1<? super byte[], kotlin.Unit> voiceCallback;
    @org.jetbrains.annotations.NotNull()
    private final android.os.Handler mainHandler = null;
    @org.jetbrains.annotations.Nullable()
    private kotlin.jvm.functions.Function1<? super java.lang.Float, kotlin.Unit> energyCallback;
    private final int sampleRate = 16000;
    private final int channelConfig = android.media.AudioFormat.CHANNEL_IN_MONO;
    private final int audioFormat = android.media.AudioFormat.ENCODING_PCM_16BIT;
    private int bufferSize = 0;
    private float vadThreshold = 0.02F;
    private int silenceCount = 0;
    private final int maxSilenceFrames = 30;
    @org.jetbrains.annotations.Nullable()
    private static com.xiaozhi.companion.service.ContinuousListeningService instance;
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String ACTION_START = "com.xiaozhi.companion.START_LISTENING";
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String ACTION_STOP = "com.xiaozhi.companion.STOP_LISTENING";
    @org.jetbrains.annotations.NotNull()
    public static final java.lang.String ACTION_SET_WS = "com.xiaozhi.companion.SET_WS_MANAGER";
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.service.ContinuousListeningService.Companion Companion = null;
    
    public ContinuousListeningService() {
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
    
    private final void initAudioRecord() {
    }
    
    private final void createNotificationChannel() {
    }
    
    private final android.app.Notification createNotification(java.lang.String text) {
        return null;
    }
    
    private final void updateNotification(java.lang.String text) {
    }
    
    public final void setWebSocketManager(@org.jetbrains.annotations.Nullable()
    com.xiaozhi.companion.WebSocketManager ws) {
    }
    
    public final void startListening() {
    }
    
    public final void stopListening() {
    }
    
    private final float calculateEnergy(short[] buffer, int readSize) {
        return 0.0F;
    }
    
    private final void sendAudioToServer(byte[] audioData) {
    }
    
    public final void setVoiceCallback(@org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super byte[], kotlin.Unit> callback) {
    }
    
    public final void setEnergyCallback(@org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.Float, kotlin.Unit> callback) {
    }
    
    public final void setVadThreshold(float threshold) {
    }
    
    public final boolean isListening() {
        return false;
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
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u001c\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0006\u001a\u00020\u0004X\u0086T\u00a2\u0006\u0002\n\u0000R\"\u0010\t\u001a\u0004\u0018\u00010\b2\b\u0010\u0007\u001a\u0004\u0018\u00010\b@BX\u0086\u000e\u00a2\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000b\u00a8\u0006\f"}, d2 = {"Lcom/xiaozhi/companion/service/ContinuousListeningService$Companion;", "", "()V", "ACTION_SET_WS", "", "ACTION_START", "ACTION_STOP", "<set-?>", "Lcom/xiaozhi/companion/service/ContinuousListeningService;", "instance", "getInstance", "()Lcom/xiaozhi/companion/service/ContinuousListeningService;", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
        
        @org.jetbrains.annotations.Nullable()
        public final com.xiaozhi.companion.service.ContinuousListeningService getInstance() {
            return null;
        }
    }
}
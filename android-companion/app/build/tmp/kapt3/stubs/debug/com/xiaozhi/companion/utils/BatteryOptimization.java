package com.xiaozhi.companion.utils;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000.\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u000b\n\u0002\b\u000e\b\u00c6\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u0006\u0010\u0005\u001a\u00020\u0004J\u0016\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\b0\u00072\u0006\u0010\t\u001a\u00020\nH\u0002J\u0006\u0010\u000b\u001a\u00020\u0004J\u0006\u0010\f\u001a\u00020\u0004J\u0006\u0010\r\u001a\u00020\u000eJ\u0006\u0010\u000f\u001a\u00020\u000eJ\u000e\u0010\u0010\u001a\u00020\u000e2\u0006\u0010\t\u001a\u00020\nJ\u0018\u0010\u0011\u001a\u00020\u000e2\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u0012\u001a\u00020\bH\u0002J\u0006\u0010\u0013\u001a\u00020\u000eJ\u0006\u0010\u0014\u001a\u00020\u000eJ\u0006\u0010\u0015\u001a\u00020\u000eJ\u0006\u0010\u0016\u001a\u00020\u000eJ\u0006\u0010\u0017\u001a\u00020\u000eJ\u0006\u0010\u0018\u001a\u00020\u000eJ\u000e\u0010\u0019\u001a\u00020\u000e2\u0006\u0010\t\u001a\u00020\nJ\u000e\u0010\u001a\u001a\u00020\u000e2\u0006\u0010\t\u001a\u00020\nJ\u0010\u0010\u001b\u001a\u00020\u000e2\u0006\u0010\t\u001a\u00020\nH\u0007R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082T\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u001c"}, d2 = {"Lcom/xiaozhi/companion/utils/BatteryOptimization;", "", "()V", "TAG", "", "getManufacturer", "getManufacturerIntents", "", "Landroid/content/Intent;", "context", "Landroid/content/Context;", "getManufacturerName", "getOptimizationTips", "isASUS", "", "isHuawei", "isIgnoringBatteryOptimizations", "isIntentAvailable", "intent", "isMeizu", "isOPPO", "isOnePlus", "isSamsung", "isVivo", "isXiaomi", "openBatterySettings", "openManufacturerBatterySettings", "requestIgnoreBatteryOptimization", "app_debug"})
public final class BatteryOptimization {
    @org.jetbrains.annotations.NotNull()
    private static final java.lang.String TAG = "BatteryOptimization";
    @org.jetbrains.annotations.NotNull()
    public static final com.xiaozhi.companion.utils.BatteryOptimization INSTANCE = null;
    
    private BatteryOptimization() {
        super();
    }
    
    public final boolean isIgnoringBatteryOptimizations(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return false;
    }
    
    @android.annotation.SuppressLint(value = {"BatteryLife"})
    public final boolean requestIgnoreBatteryOptimization(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return false;
    }
    
    public final boolean openBatterySettings(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return false;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getManufacturer() {
        return null;
    }
    
    public final boolean isHuawei() {
        return false;
    }
    
    public final boolean isXiaomi() {
        return false;
    }
    
    public final boolean isOPPO() {
        return false;
    }
    
    public final boolean isVivo() {
        return false;
    }
    
    public final boolean isSamsung() {
        return false;
    }
    
    public final boolean isOnePlus() {
        return false;
    }
    
    public final boolean isMeizu() {
        return false;
    }
    
    public final boolean isASUS() {
        return false;
    }
    
    public final boolean openManufacturerBatterySettings(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return false;
    }
    
    private final java.util.List<android.content.Intent> getManufacturerIntents(android.content.Context context) {
        return null;
    }
    
    private final boolean isIntentAvailable(android.content.Context context, android.content.Intent intent) {
        return false;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getManufacturerName() {
        return null;
    }
    
    @org.jetbrains.annotations.NotNull()
    public final java.lang.String getOptimizationTips() {
        return null;
    }
}
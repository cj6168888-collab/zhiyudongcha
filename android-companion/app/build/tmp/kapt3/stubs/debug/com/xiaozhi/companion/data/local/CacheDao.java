package com.xiaozhi.companion.data.local;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\bg\u0018\u00002\u00020\u0001J\b\u0010\u0002\u001a\u00020\u0003H\'J\u0010\u0010\u0004\u001a\u00020\u00032\u0006\u0010\u0005\u001a\u00020\u0006H\'J\u0012\u0010\u0007\u001a\u0004\u0018\u00010\u00062\u0006\u0010\u0005\u001a\u00020\u0006H\'J\u0010\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000bH\'\u00a8\u0006\f"}, d2 = {"Lcom/xiaozhi/companion/data/local/CacheDao;", "", "clearAll", "", "deleteValue", "key", "", "getValue", "insert", "", "entity", "Lcom/xiaozhi/companion/data/local/CacheEntity;", "app_debug"})
@androidx.room.Dao()
public abstract interface CacheDao {
    
    @androidx.room.Query(value = "SELECT value FROM cache WHERE key = :key LIMIT 1")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.String getValue(@org.jetbrains.annotations.NotNull()
    java.lang.String key);
    
    @androidx.room.Insert(onConflict = 1)
    public abstract void insert(@org.jetbrains.annotations.NotNull()
    com.xiaozhi.companion.data.local.CacheEntity entity);
    
    @androidx.room.Query(value = "DELETE FROM cache WHERE key = :key")
    public abstract int deleteValue(@org.jetbrains.annotations.NotNull()
    java.lang.String key);
    
    @androidx.room.Query(value = "DELETE FROM cache")
    public abstract int clearAll();
}
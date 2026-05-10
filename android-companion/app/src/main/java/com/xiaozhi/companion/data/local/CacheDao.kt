package com.xiaozhi.companion.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface CacheDao {
    @Query("SELECT value FROM cache WHERE key = :key LIMIT 1")
    fun getValue(key: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(entity: CacheEntity)

    @Query("DELETE FROM cache WHERE key = :key")
    fun deleteValue(key: String): Int

    @Query("DELETE FROM cache")
    fun clearAll(): Int
}

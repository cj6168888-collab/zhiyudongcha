package com.xiaozhi.companion.data.local

import android.content.Context
import androidx.room.Room

object CacheDatabaseProvider {
    @Volatile
    private var INSTANCE: CacheDatabase? = null

    fun getInstance(context: Context): CacheDatabase {
        return INSTANCE ?: synchronized(this) {
            val instance = Room.databaseBuilder(
                context.applicationContext,
                CacheDatabase::class.java,
                "xiaozhi_cache.db"
            ).build()
            INSTANCE = instance
            instance
        }
    }
}

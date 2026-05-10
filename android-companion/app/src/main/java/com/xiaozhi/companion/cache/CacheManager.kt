package com.xiaozhi.companion.cache

import android.content.Context
import com.xiaozhi.companion.data.local.CacheDatabaseProvider
import com.xiaozhi.companion.data.local.CacheRepository

object CacheManager {
    @Volatile
    private var repo: CacheRepository? = null

    fun init(context: Context) {
        val dao = CacheDatabaseProvider.getInstance(context).cacheDao()
        repo = CacheRepository(dao)
    }

    fun put(key: String, value: String) {
        repo?.put(key, value)
    }

    fun get(key: String): String? = repo?.get(key)

    fun remove(key: String) {
        repo?.delete(key)
    }

    fun clear() {
        repo?.clearAll()
    }
}

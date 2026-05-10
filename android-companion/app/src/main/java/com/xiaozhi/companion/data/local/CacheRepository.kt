package com.xiaozhi.companion.data.local

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class CacheRepository(private val dao: CacheDao) {
    fun put(key: String, value: String) {
        // Run insert on background thread to avoid DB ops on main thread
        Thread {
            dao.insert(CacheEntity(key, value))
        }.start()
    }

    fun get(key: String): String? {
        var result: String? = null
        val latch = CountDownLatch(1)
        Thread {
            result = dao.getValue(key)
            latch.countDown()
        }.start()
        try {
            latch.await(2, TimeUnit.SECONDS)
        } catch (_: InterruptedException) {
        }
        return result
    }

    fun clearAll() {
        dao.clearAll()
    }

    fun delete(key: String) {
        dao.deleteValue(key)
    }
}

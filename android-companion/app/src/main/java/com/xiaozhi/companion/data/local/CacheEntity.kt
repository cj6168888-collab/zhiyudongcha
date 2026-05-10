package com.xiaozhi.companion.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cache")
data class CacheEntity(
    @PrimaryKey val key: String,
    val value: String
)

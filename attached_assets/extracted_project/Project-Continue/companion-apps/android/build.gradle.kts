// 顶层构建文件
plugins {
    id("com.android.application") version "8.2.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.21" apply false
}

task("clean", Delete::class) {
    delete(rootProject.buildDir)
}

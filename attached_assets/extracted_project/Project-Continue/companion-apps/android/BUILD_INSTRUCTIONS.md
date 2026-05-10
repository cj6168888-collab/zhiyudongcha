# Android 伴侣应用构建说明

## 快速开始

### 1. 下载项目

将 `companion-apps/android/` 目录下载到你的电脑。

### 2. 用 Android Studio 打开

1. 打开 Android Studio
2. 选择 "Open an existing project"
3. 选择 `companion-apps/android/` 目录

### 3. 配置服务器地址

打开 `app/src/main/java/com/avatar/companion/Config.kt`，修改：

```kotlin
const val DEFAULT_SERVER_URL = "wss://你的服务器地址.replit.app/ws/shadow"
```

或者在应用内配置（推荐）。

### 4. 构建 APK

```bash
./gradlew assembleDebug
```

APK 位置：`app/build/outputs/apk/debug/app-debug.apk`

### 5. 安装到手机

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

或直接用数据线传输安装。

## 首次使用

1. 打开「小智伴侣」应用
2. 点击「配置服务器地址」输入你的服务器 WebSocket 地址
3. 点击「开启无障碍服务」并在系统设置中启用
4. 点击「关闭电池优化」确保后台运行
5. 点击「连接服务器」开始使用

## 权限说明

- **无障碍服务**: 执行自动化操作（必须）
- **悬浮窗**: 显示状态指示器（可选）
- **电池优化豁免**: 保持后台连接（强烈建议）
- **开机自启**: 自动恢复连接（可选）

## 常见问题

**Q: 连接失败？**
A: 检查服务器地址是否正确，确保使用 `wss://` 协议。

**Q: 后台断开？**
A: 确保关闭电池优化，部分手机需要额外在「后台管理」中添加白名单。

**Q: 无障碍服务被关闭？**
A: 部分手机会自动关闭无障碍服务，需要在「权限管理」中锁定应用。

## 版权

陈先生出品 · cj6168888@Gmail.com

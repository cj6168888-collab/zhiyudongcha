# 领航者 (Navigator-X) Android 伴侣应用

## 概述

此目录包含 Android 伴侣应用的完整代码模板，用于与领航者服务器建立连接并执行自动化操作。

## 核心功能

1. **AccessibilityService** - 无障碍服务，可执行点击、滑动、输入等操作
2. **WebSocket Client** - 与服务器实时通信，接收操作指令
3. **ADB Shell** - 备用执行通道（需要 root 或 ADB 授权）
4. **屏幕截图** - 支持截图上传用于视觉验证

## 项目结构

```
android/
├── app/
│   └── src/main/
│       ├── java/com/avatar/companion/
│       │   ├── AvatarCompanionApp.kt          # Application 入口
│       │   ├── service/
│       │   │   ├── AvatarAccessibilityService.kt  # 无障碍服务核心
│       │   │   └── WebSocketService.kt        # WebSocket 后台服务
│       │   ├── executor/
│       │   │   ├── ActionExecutor.kt          # 动作执行器接口
│       │   │   ├── AccessibilityExecutor.kt   # 无障碍执行器
│       │   │   └── ADBExecutor.kt             # ADB 执行器
│       │   ├── model/
│       │   │   └── ShadowCommand.kt           # 指令数据模型
│       │   └── util/
│       │       ├── ScreenCapture.kt           # 屏幕截图
│       │       └── HumanSimulation.kt         # 人类行为模拟
│       ├── res/
│       │   └── xml/
│       │       └── accessibility_service_config.xml
│       └── AndroidManifest.xml
├── build.gradle.kts
└── settings.gradle.kts
```

## 安装步骤

### 1. 导入项目
将此目录作为 Android Studio 项目导入。

### 2. 配置服务器地址
在 `app/src/main/java/com/avatar/companion/Config.kt` 中设置服务器地址：

```kotlin
object Config {
    const val SERVER_URL = "wss://your-server.replit.app/ws/shadow"
    const val DEVICE_ID = "android-phone-1"
    const val RECONNECT_INTERVAL = 5000L
}
```

### 3. 构建并安装
```bash
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 4. 启用无障碍服务
设置 → 无障碍 → 小智伴侣 → 开启

### 5. 授予权限
- 悬浮窗权限（用于显示状态指示器）
- 屏幕录制权限（用于截图验证）

## 通信协议

### WebSocket 指令格式

```json
{
  "id": "cmd-uuid-123",
  "type": "EXECUTE",
  "action": {
    "type": "TAP",
    "x": 540,
    "y": 960,
    "target": "登录按钮"
  },
  "humanSimulation": {
    "enabled": true,
    "positionJitter": 3,
    "delayBase": 150,
    "delayVariance": 100
  },
  "verification": {
    "screenshotBefore": true,
    "screenshotAfter": true
  }
}
```

### 响应格式

```json
{
  "id": "cmd-uuid-123",
  "success": true,
  "channel": "ACCESSIBILITY",
  "screenshotBefore": "base64...",
  "screenshotAfter": "base64...",
  "changeDetected": true,
  "duration": 245
}
```

## 安全说明

⚠️ **警告**: 无障碍服务拥有极高权限，请确保：
1. 仅连接到可信服务器
2. 使用 HTTPS/WSS 加密连接
3. 验证服务器证书
4. 不要在敏感应用中使用

## 版权

陈先生出品 · cj6168888@Gmail.com

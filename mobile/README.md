# 小智原生移动端应用

## 项目概述

本项目包含小智（Avatar）数字生命系统的原生移动端应用代码，支持 iOS (Swift/SwiftUI) 和 Android (Kotlin/Jetpack Compose) 双平台。

## 目录结构

```
mobile/
├── docs/
│   ├── API_SPECIFICATION.md    # API 接口规范
│   └── LOCAL_AI_INTEGRATION.md # 本地小模型集成方案
├── ios/
│   └── XiaoZhi/
│       ├── XiaoZhiApp.swift           # 应用入口
│       ├── ContentView.swift          # 主界面
│       ├── Services/
│       │   ├── NetworkManager.swift   # 网络通信（HTTP + WebSocket）
│       │   ├── SpeechRecognitionService.swift  # 语音识别
│       │   ├── DeviceManager.swift    # 设备管理
│       │   └── NotificationManager.swift       # 通知管理
│       ├── ViewModels/
│       │   └── ChatViewModel.swift    # 对话视图模型
│       └── Views/
│           └── InsightListenerView.swift  # 智语洞察视图
└── android/
    └── app/
        ├── build.gradle.kts           # Gradle 配置
        └── src/main/
            ├── AndroidManifest.xml    # 应用清单
            └── kotlin/com/xiaozhi/
                ├── XiaoZhiApplication.kt      # 应用入口
                ├── network/
                │   ├── NetworkManager.kt      # 网络通信
                │   └── DeviceManager.kt       # 设备管理
                ├── speech/
                │   └── SpeechRecognitionService.kt  # 语音识别
                └── ui/
                    ├── MainActivity.kt        # 主活动
                    ├── screens/               # 各功能页面
                    └── theme/                 # 主题配置
```

## 功能特性

### 核心功能

1. **智能对话**
   - 文本/语音双模式输入
   - Function Calling 自动执行业务操作
   - 流式回复显示

2. **智语洞察**
   - 实时语音转录（本地 + 云端双模式）
   - 谈话类型自动识别
   - 人物实体提取
   - 商机信号识别

3. **人脉管理**
   - 联系人创建与搜索
   - 关系网络可视化
   - 亲密度评分

4. **项目管理**
   - 项目进度跟踪
   - 任务分解与管理
   - 风险预警

### 技术亮点

- **三层语音识别回退**：本地 → 云端 → 手动输入
- **WebSocket 实时通信**：心跳保活、断线重连
- **本地小模型**：意图识别、唤醒词检测
- **安全存储**：Keychain (iOS) / EncryptedSharedPreferences (Android)

## 开发指南

### iOS 开发

#### 环境要求
- macOS 13.0+
- Xcode 15.0+
- iOS 16.0+ 部署目标

#### 创建项目
1. 打开 Xcode
2. 创建新项目 → iOS → App
3. 产品名称: XiaoZhi
4. Bundle ID: com.xiaozhi.avatar
5. 语言: Swift
6. 界面: SwiftUI

#### 导入代码
将 `ios/XiaoZhi/` 目录下的所有 `.swift` 文件复制到 Xcode 项目中。

#### 配置权限
在 Info.plist 中添加：
```xml
<key>NSMicrophoneUsageDescription</key>
<string>小智需要使用麦克风进行语音识别</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>小智需要使用语音识别功能</string>
```

#### 配置服务器地址
在 `NetworkManager.swift` 中修改：
```swift
#if DEBUG
self.baseURL = "http://localhost:5000"
#else
self.baseURL = "https://your-domain.replit.app"
#endif
```

### Android 开发

#### 环境要求
- Android Studio Hedgehog (2023.1.1)+
- JDK 17+
- Android SDK 34
- Kotlin 1.9+

#### 创建项目
1. 打开 Android Studio
2. 新建项目 → Empty Compose Activity
3. 包名: com.xiaozhi
4. 最低 SDK: API 26

#### 导入代码
1. 复制 `android/app/` 目录结构到项目
2. 替换 `build.gradle.kts`
3. 替换 `AndroidManifest.xml`
4. 复制所有 Kotlin 文件

#### 配置服务器地址
在 `NetworkManager.kt` 中修改：
```kotlin
private const val BASE_URL_DEBUG = "http://10.0.2.2:5000"  // 模拟器
private const val BASE_URL_PROD = "https://your-domain.replit.app"
```

## 后端服务

移动应用需要连接到小智后端服务器，主要 API 包括：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/conversation/chat` | POST | 智能对话 |
| `/api/talk-sessions` | POST | 创建洞察会话 |
| `/api/persons` | GET/POST | 人脉管理 |
| `/api/projects` | GET/POST | 项目管理 |
| `/ws/mobile` | WS | 实时通信 |

详细 API 文档见 `docs/API_SPECIFICATION.md`

## 本地 AI 集成

支持在移动端运行轻量级 AI 模型，实现：
- 唤醒词检测（"小智"、"喂小智"）
- 简单意图识别
- 离线关键词提取

详细方案见 `docs/LOCAL_AI_INTEGRATION.md`

## 测试

### iOS
```bash
# 运行单元测试
xcodebuild test -scheme XiaoZhi -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Android
```bash
# 运行单元测试
./gradlew test

# 运行 UI 测试
./gradlew connectedAndroidTest
```

## 发布

### iOS
1. 配置 Apple Developer 证书
2. Archive 构建
3. 上传到 App Store Connect

### Android
1. 生成签名密钥
2. 构建 Release APK/AAB
3. 上传到 Google Play Console

## 注意事项

1. **隐私合规**：确保语音数据的收集和处理符合隐私法规
2. **电量优化**：后台语音监听需谨慎管理，避免过度耗电
3. **网络安全**：所有通信使用 HTTPS/WSS
4. **模型更新**：本地 AI 模型支持热更新，无需应用商店审核

## 版本历史

- **1.0.0** - 初始版本
  - 智能对话功能
  - 智语洞察功能
  - 基础人脉/项目管理

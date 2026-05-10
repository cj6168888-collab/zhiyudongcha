# 小智系统功能增强升级计划

## 概述

在完成基础功能后，进行体验优化、功能增强和稳定性提升。

---

## Week 2: 体验优化

### 2.1 语音识别本地化
- **目标**: 减少延迟，降低服务器压力，支持离线基础命令
- **实现方案**: 
  - Android 端集成 `vosk` 或 `Pocketsphinx` 离线识别库
  - 本地预置唤醒词和基础指令词（如"打开""关闭""增大""减小"）
  - 复杂指令仍上传服务器处理
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/speech/LocalSpeechRecognizer.kt`
  - `android-companion/app/src/main/java/com/xiaozhi/companion/speech/OfflineCommandMatcher.kt`
- **状态**: ⏳ 待开发

### 2.2 实时语音转文字
- **目标**: 持续监听音频本地 ASR 转文字后上传
- **实现方案**:
  - 流式 ASR 处理（WebSocket 流式识别或本地模型）
  - 文字结果实时显示在 UI
  - 支持语音合成反馈
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/speech/StreamingAsr.kt`
  - `server/services/streaming-asr.ts`
- **状态**: ⏳ 待开发

### 2.3 可视化波形
- **目标**: 实时显示麦克风音频波形，增强用户体验
- **实现方案**:
  - `Visualizer` API 获取音频数据
  - Canvas 绘制波形/频谱
  - 主界面和监听界面均显示
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/ui/AudioVisualizerView.kt`
  - 布局文件更新
- **状态**: ⏳ 待开发

### 2.4 设置界面
- **目标**: 提供用户可配置的参数
- **实现方案**:
  - VAD 阈值滑块
  - 麦克风灵敏度
  - 通知偏好开关
  - 服务器地址配置
  - 主题切换（浅色/深色/自动）
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/SettingsActivity.kt`
  - `android-companion/app/src/main/res/layout/activity_settings.xml`
  - `android-companion/app/src/main/java/com/xiaozhi/companion/utils/PreferencesManager.kt`
- **状态**: ⏳ 待开发

---

## Week 3: 稳定性增强

### 3.1 崩溃恢复机制
- **目标**: 异常自动捕获和服务恢复
- **实现方案**:
  - 全局 `UncaughtExceptionHandler`
  - 服务异常退出自动重启
  - WebSocket 断线自动重连（指数退避）
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/utils/CrashHandler.kt`
  - `android-companion/app/src/main/java/com/xiaozhi/companion/service/ServiceRestartManager.kt`
  - 更新 `WebSocketManager.kt` 重连逻辑
- **状态**: ⏳ 待开发

### 3.2 日志系统
- **目标**: 本地日志记录，便于问题排查
- **实现方案**:
  - 基于 ` Timber` 或自定义日志库
  - 日志分级别（DEBUG/INFO/WARN/ERROR）
  - 日志文件滚动存储（7天）
  - Web 端日志查看器
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/utils/Logger.kt`
  - `android-companion/app/src/main/java/com/xiaozhi/companion/utils/LogViewerActivity.kt`
- **状态**: ⏳ 待开发

### 3.3 数据本地缓存
- **目标**: 离线时数据本地缓存，连接恢复后同步
- **实现方案**:
  - SQLite 本地数据库（Room）
  - 消息队列：离线时消息本地排队
  - 变更同步：文件变更、通知记录等本地缓存
- **文件**:
  - `android-companion/app/src/main/java/com/xiaozhi/companion/data/local/AppDatabase.kt`
  - `android-companion/app/src/main/java/com/xiaozhi/companion/data/local/MessageQueue.kt`
  - `android-companion/app/src/main/java/com/xiaozhi/companion/data/repository/CacheRepository.kt`
- **状态**: ⏳ 待开发

---

## Week 4: 服务器端增强

### 4.1 持续监听处理增强
- **目标**: 完善服务器端持续音频处理
- **实现方案**:
  - 语音流拼接：多个短音频片段拼接成完整语音
  - 说话人分离：多人对话场景分离不同说话人
  - 实时意图识别：流式识别 + 意图分类
- **文件**:
  - `server/services/continuous-audio.ts` 增强
  - `server/services/speech-segmentation.ts`
  - `server/services/intent-recognition.ts`
- **状态**: ⏳ 待开发

### 4.2 WebSocket 消息队列
- **目标**: 离线消息排队，连接恢复后发送
- **实现方案**:
  - 客户端：离线消息存入本地队列
  - 服务端：消息持久化（Redis/数据库）
  - 连接恢复时批量同步
- **文件**:
  - `server/services/message-queue.ts`
  - `server/middleware/sync-handler.ts`
- **状态**: ⏳ 待开发

### 4.3 多语言支持
- **目标**: 扩展语音指令识别多语言/方言
- **实现方案**:
  - 指令词多语言配置
  - TTS 多语言支持
  - 语种自动识别
- **文件**:
  - `server/config/multi-language-commands.json`
  - `server/services/multi-language-tts.ts`
- **状态**: ⏳ 待开发

---

## Week 5: 整合测试

### 5.1 端到端测试
- 全流程测试：唤醒 → 识别 → 执行 → 反馈
- 离线模式测试
- 网络切换测试（WiFi ↔ 移动数据）

### 5.2 性能测试
- 内存占用优化
- 电池消耗测试
- 响应延迟测试

### 5.3 稳定性测试
- 长时间运行测试（24小时+）
- 压力测试（高频率指令）
- 异常场景测试

---

## 文件结构总览

```
android-companion/
├── app/src/main/java/com/xiaozhi/companion/
│   ├── speech/
│   │   ├── LocalSpeechRecognizer.kt      # 本地语音识别
│   │   ├── OfflineCommandMatcher.kt      # 离线命令匹配
│   │   └── StreamingAsr.kt               # 流式ASR
│   ├── ui/
│   │   ├── AudioVisualizerView.kt        # 音频可视化
│   │   └── SettingsActivity.kt           # 设置界面
│   ├── data/
│   │   ├── local/
│   │   │   ├── AppDatabase.kt            # Room数据库
│   │   │   └── MessageQueue.kt           # 消息队列
│   │   └── repository/
│   │       └── CacheRepository.kt        # 缓存仓库
│   └── utils/
│       ├── CrashHandler.kt                # 崩溃处理
│       ├── Logger.kt                      # 日志系统
│       ├── LogViewerActivity.kt           # 日志查看
│       └── PreferencesManager.kt          # 参数管理

server/
├── services/
│   ├── streaming-asr.ts                   # 流式识别
│   ├── speech-segmentation.ts            # 语音分割
│   ├── intent-recognition.ts              # 意图识别
│   ├── message-queue.ts                   # 消息队列
│   └── multi-language-tts.ts             # 多语言TTS
├── middleware/
│   └── sync-handler.ts                    # 同步处理
└── config/
    └── multi-language-commands.json       # 多语言指令配置
```

---

## 优先级排序

| 优先级 | 功能 | 理由 |
|--------|------|------|
| P0 | 设置界面 | 用户基础配置需求 |
| P0 | 崩溃恢复 | 稳定性基础保障 |
| P0 | 日志系统 | 问题排查必备 |
| P1 | 本地缓存 | 离线可用核心 |
| P1 | 可视化波形 | 体验提升明显 |
| P1 | 持续监听增强 | 核心功能完善 |
| P2 | 本地语音识别 | 技术探索 |
| P2 | 多语言支持 | 扩展功能 |
| P3 | 消息队列 | 进阶稳定性 |

---

## 实施建议

1. **并行开发**: Week 2/3 的任务可并行推进
2. **渐进增强**: 每周发布一个可用版本
3. **回滚机制**: 每个功能独立开关，可单独禁用
4. **监控指标**: 
   - 服务启动时间 < 2s
   - 语音响应延迟 < 500ms（本地）
   - 内存占用 < 150MB
   - 电池消耗 < 5%/小时

---

*创建时间: 2026-03-01*
*版本: v1.1*

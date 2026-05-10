# Week 3 - 服务器端增强

## 完成进度

### ✅ 已完成

| 功能 | 文件 | 状态 |
|------|------|------|
| 消息队列服务 | `server/services/message-queue.ts` | ✅ |
| 消息队列 API | `server/routes/message-queue.ts` | ✅ |
| 多语言服务 | `server/services/multi-language.ts` | ✅ |
| 多语言配置 | `server/config/multi-language-commands.json` | ✅ |
| 多语言 API | `server/routes/multi-language.ts` | ✅ |
| 多语言 TTS | `server/services/multi-language-tts.ts` | ✅ |
| 多语言 TTS API | `server/routes/multi-language-tts.ts` | ✅ |

## 新增服务

### 1. 消息队列服务
- `server/services/message-queue.ts` - 离线消息缓存
- `server/routes/message-queue.ts` - REST API

### 2. 多语言服务
- `server/services/multi-language.ts` - 多语言支持
- `server/config/multi-language-commands.json` - 配置文件
- `server/routes/multi-language.ts` - REST API

### 3. 多语言 TTS
- `server/services/multi-language-tts.ts` - TTS 服务
- `server/routes/multi-language-tts.ts` - REST API

## API 端点

### 消息队列
```
POST   /api/queue/enqueue        # 添加消息
GET    /api/queue/:deviceId     # 获取消息
DELETE /api/queue/:deviceId      # 清空队列
DELETE /api/queue/:deviceId/:messageId  # 删除消息
GET    /api/queue/stats         # 获取统计
GET    /api/queue/devices       # 获取设备列表
```

### 多语言
```
GET    /api/i18n/languages           # 获取支持的语言
GET    /api/i18n/config/:language    # 获取语言配置
POST   /api/i18n/detect              # 检测语言
POST   /api/i18n/check-wakeword      # 检查唤醒词
POST   /api/i18n/match-command       # 匹配命令
PUT    /api/i18n/default             # 设置默认语言
```

### 多语言 TTS
```
GET    /api/tts/voices                    # 获取可用语音
POST   /api/tts/synthesize              # 合成语音
POST   /api/tts/detect-and-synthesize   # 自动检测语言并合成
```

## 文件结构

```
server/
├── services/
│   ├── message-queue.ts         # 消息队列
│   ├── multi-language.ts       # 多语言
│   └── multi-language-tts.ts   # 多语言TTS
├── routes/
│   ├── message-queue.ts        # 消息队列API
│   ├── multi-language.ts       # 多语言API
│   └── multi-language-tts.ts  # TTS API
└── config/
    └── multi-language-commands.json  # 多语言配置
```

## 下一步

- [ ] 集成消息队列到持续监听服务
- [ ] 完善 TTS 流式输出
- [ ] 添加更多语言支持
- [ ] 性能优化

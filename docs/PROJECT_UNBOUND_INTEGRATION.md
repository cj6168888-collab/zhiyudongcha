# Project Unbound (解缚协议) 集成指南

## 概述

Project Unbound 是小智系统的 OS 级自主操作模块，实现三大执行路径：

1. **Android 上帝模式** - AccessibilityService + ADB 双通道
2. **PC 驱动级控制** - Interception (Windows) / uinput (Linux/macOS)
3. **视觉驱动后备** - V-LLM Grounding 视觉识别

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     小智服务器 (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Shadow Operator  │  Human Simulation  │  Visual Verification │
├───────────────────┼────────────────────┼─────────────────────┤
│                 V-LLM Grounding (DashScope)                  │
├─────────────────────────────────────────────────────────────┤
│                    WebSocket 服务 (/ws/shadow)               │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
   │ Android 伴侣  │  │  PC 守护进程  │  │   Web 浏览器   │
   │ Accessibility │  │ Python RPC   │  │   WebSocket   │
   │    Service    │  │   Daemon     │  │    Client     │
   └───────────────┘  └───────────────┘  └───────────────┘
```

## 服务端模块

### 1. Shadow Operator (`server/services/shadow-operator.ts`)

设备无关的统一指令接口，负责：
- 设备会话管理
- 通道自动选择
- 命令队列调度
- 执行结果追踪

### 2. Human Simulation (`server/services/human-simulation.ts`)

人类行为模拟，规避自动化检测：
- 贝塞尔曲线鼠标轨迹
- 随机位置抖动
- 打字速度模拟
- 自然延迟

### 3. Visual Verification (`server/services/visual-verification.ts`)

视觉反馈闭环：
- 操作前后截图
- 变化检测
- 失败重试机制

### 4. V-LLM Grounding (`server/services/vllm-grounding.ts`)

视觉大模型元素定位：
- 支持 DashScope Qwen-VL-Plus (已配置)
- OpenAI GPT-4 Vision
- 本地 Ollama LLaVA
- 自然语言描述 → 屏幕坐标

## API 端点

所有端点前缀: `/api/unbound/`

| 端点 | 方法 | 描述 |
|------|------|------|
| `/shadow/sessions` | GET | 获取所有设备会话 |
| `/shadow/command` | POST | 发送执行命令 |
| `/shadow/execute` | POST | 立即执行操作 |
| `/human-sim/profile` | GET/PUT | 获取/设置模拟配置 |
| `/verification/report` | GET | 获取验证报告 |
| `/vllm/ground` | POST | 视觉元素定位 |
| `/vllm/analyze` | POST | 全屏幕分析 |
| `/vllm/status` | GET | 模型状态 |
| `/smart-action` | POST | 智能操作 (组合所有模块) |

## 伴侣应用部署

### Android 伴侣应用

位置: `companion-apps/android/`

部署步骤:
1. 用 Android Studio 打开项目
2. 修改 `Config.kt` 中的服务器地址 (`DEFAULT_SERVER_URL`)
3. 构建 APK 并安装
4. 在设置中启用无障碍服务
5. 授予悬浮窗和屏幕录制权限

技术栈:
- Kotlin + Coroutines
- AccessibilityService (手势执行)
- OkHttp WebSocket (服务器通信)
- MediaProjection (屏幕截图 - 需在 Activity 中实现)

注意: 截图功能需要在 MainActivity 中实现 MediaProjection 权限请求。当前模板提供了框架代码。

### PC 守护进程

位置: `companion-apps/pc/`

部署步骤:
1. 安装 Python 3.9+
2. `pip install -r requirements.txt`
3. 创建 `.env` 文件配置服务器地址:
   ```
   AVATAR_SERVER_URL=wss://your-server.replit.app/ws/shadow
   AVATAR_DEVICE_ID=pc-mycomputer
   AVATAR_DEVICE_NAME=小智电脑
   ```
4. `python -m avatar_daemon.main`

技术栈:
- Python 3.9+ / asyncio
- websockets (服务器通信)
- pynput (输入模拟)
- mss + Pillow (屏幕截图，可选)

平台支持:
- Windows: pynput 用户级模拟
- macOS: pynput + 辅助功能权限
- Linux: pynput + uinput 权限

注意: 截图功能依赖 mss 和 Pillow，如未安装将返回空截图并记录警告。

## 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `DASHSCOPE_API_KEY` | DashScope API 密钥 (用于 V-LLM) | 推荐 |

## 通信协议

### 设备注册

```json
{
  "type": "REGISTER",
  "deviceId": "android-phone-1",
  "deviceType": "ANDROID",
  "name": "小智手机",
  "capabilities": {
    "canTap": true,
    "canSwipe": true,
    "canInput": true,
    "canScreenshot": true,
    "channels": ["ACCESSIBILITY", "ADB"]
  }
}
```

### 执行命令

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

### 执行结果

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

## 安全注意事项

⚠️ **重要安全提醒**:

1. **仅连接可信服务器** - 使用 HTTPS/WSS 加密
2. **限制操作范围** - 在服务端设置白名单
3. **审计日志** - 所有操作都有记录
4. **敏感应用保护** - 银行/支付应用禁用自动化
5. **用户确认机制** - 高风险操作需用户确认

## 版权

陈先生出品 · cj6168888@Gmail.com

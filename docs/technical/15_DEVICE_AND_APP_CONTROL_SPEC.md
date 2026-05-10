# 设备与 App 控制规格

## 目的

生语助手的执行力来自手机、电脑、浏览器、文件系统、邮件、日历和第三方 App 的协同。但设备控制也是最高风险能力之一。

本文件把跨设备、OpenClaw、Android Agent、PC Agent 和远程控制旧文档中的有效内容收束为新技术基线。

旧参考：

- [../CROSS_DEVICE_ASSISTANT_ARCHITECTURE.md](../CROSS_DEVICE_ASSISTANT_ARCHITECTURE.md)
- [../CROSS_DEVICE_IMPLEMENTATION_PLAN.md](../CROSS_DEVICE_IMPLEMENTATION_PLAN.md)
- [../OPENCLAW_ENHANCEMENT_PLAN.md](../OPENCLAW_ENHANCEMENT_PLAN.md)
- [../SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md)

## 能力边界

设备与 App 控制包括：

- 设备注册。
- 心跳和在线状态。
- 程序/应用能力扫描。
- 屏幕截图和 OCR。
- 点击、输入、滑动、快捷键。
- 文件浏览和传输。
- Intent 和 DeepLink 调用。
- PC Agent 文件整理、文档生成、系统操作。
- WebSocket 实时控制。
- 执行结果回传。

## 核心组件

| 组件 | 职责 |
| --- | --- |
| `DeviceRegistry` | 设备、应用、能力和状态登记 |
| `CloudHub` | 设备连接、心跳、消息路由 |
| `CrossDeviceRouter` | 根据任务选择设备和执行路径 |
| `RemoteControlService` | 远程屏幕、输入、会话管理 |
| `TaskOrchestrator` | 定时、条件、长链路任务编排 |
| `UnifiedExecutor` | 抽象 PC、Android、浏览器等执行接口 |
| `ScreenAnalyzer` | OCR、UI 元素识别、状态判断 |
| `ResultNotifier` | 结果回传、失败通知、证据归档 |

## 设备状态

设备状态必须至少支持：

- `ONLINE`
- `OFFLINE`
- `BUSY`
- `IDLE`
- `DEGRADED`
- `REVOKED`

心跳记录建议包含：

- deviceId。
- ownerId。
- deviceType。
- appVersion。
- capabilities。
- battery。
- network。
- lastSeenAt。
- currentTaskId。

## 执行流程

```text
主人目标
  -> 对话理解
  -> 设备能力匹配
  -> 风险分类
  -> 权限检查
  -> 生成执行计划
  -> 必要时确认
  -> 设备执行
  -> 验证结果
  -> 回传证据
  -> 写入任务/记忆/审计
```

## 风险分级

| 动作 | 默认风险 |
| --- | --- |
| 查询设备在线状态 | L0 |
| 截图当前屏幕 | L2/S2，可能更高 |
| 打开 App | L1 |
| 输入文字但不提交 | L2 |
| 发送消息、提交表单 | L3 |
| 上传文件、共享资料 | L3/L4 |
| 删除文件 | L4 |
| 付款、修改账号、创建密钥 | L4/L5 |
| 绕过验证码或安全提示 | L5 |

## 操作原则

1. 先理解当前屏幕，再操作。
2. 低风险自动，高风险确认。
3. 不绕过验证码、密码、安全警告和平台限制。
4. 每次外部影响动作必须有证据。
5. 失败时不连续盲点，必须重新识别界面。
6. 审计不可用时停止 L3/L4。

## 远程控制指标

| 指标 | MVP 目标 |
| --- | --- |
| 截图延迟 | P95 < 1000ms |
| 控制指令回执 | P95 < 500ms |
| WebSocket 重连成功率 | >= 95% |
| 任务结果回传率 | >= 99% |
| 高风险确认覆盖率 | 100% |
| 操作证据覆盖率 | L3/L4 为 100% |

## 降级策略

| 失败 | 降级 |
| --- | --- |
| 设备离线 | 标记 BLOCKED，提醒主人 |
| 截图失败 | 停止自动点击，要求人工确认 |
| OCR 低置信 | 追问或请求主人查看 |
| App 页面变化 | 重新识别，不按旧坐标继续 |
| WebSocket 断开 | 自动重连，重连失败后暂停任务 |
| 权限不足 | 引导授权，不伪装完成 |
| 审计写入失败 | 禁止高风险动作 |

## Android 权限

Android 权限必须按需申请：

- AccessibilityService：App 操作。
- Storage Access Framework：文件访问。
- MediaStore：照片和媒体。
- Notification Listener：通知理解。
- Foreground Service：常驻任务。
- Speech / Audio APIs：语音。
- Intent / DeepLink：App 调用。

每个权限必须说明用途、数据范围、是否本地处理、关闭入口。

## PC Agent 能力

PC Agent 能力必须按工具注册：

- 文件整理。
- 文档生成。
- 系统优化。
- 编程辅助。
- 浏览器操作。
- 屏幕截图。
- 文件传输。

禁止默认开放 shell 级任意命令。需要命令执行时必须进入 L4 或 L5 判断。

## 证据要求

外部影响动作至少记录：

- 操作前目标。
- 使用设备和 App。
- 操作摘要。
- 操作后结果。
- 截图、返回值或文件 hash。
- requestId。
- auditId。


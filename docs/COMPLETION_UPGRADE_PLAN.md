# 小智系统完善升级计划

> 基于功能完成度报告生成
> 生成日期: 2026-02-28

---

## 一、问题汇总

### 已完成 (55%)
- 移动端App ✓
- 持续监听服务 ✓
- 文件/通知监控 ✓
- 唤醒词/指令系统 ✓

### 待完善 (45%)

| 优先级 | 问题 | 影响 |
|--------|------|------|
| P0 | ASR/TTS未配置 | 语音交互不可用 |
| P0 | 声纹识别基础 | 无法区分主人 |
| P0 | 屏幕监控Mock | PC控制不可用 |
| P1 | 移动端权限引导缺失 | 用户不会用 |
| P1 | 厂商白名单未适配 | 后台被杀 |
| P2 | 战报可视化 | 数据展示 |
| P2 | 预测分析 | 智能化不足 |

---

## 二、里程碑计划

### Week 1: 核心体验修复

| 日期 | 任务 | 交付物 |
|------|------|---------|
| Day 1-2 | 配置系统完善 | `config.ts` + 环境变量 |
| Day 3-4 | 声纹服务增强 | 录入UI + 验证逻辑 |
| Day 5-6 | 权限引导开发 | `PermissionGuideActivity` |
| Day 7 | 厂商白名单适配 | 各厂商跳转逻辑 |

### Week 2: 智语洞察增强

| 日期 | 任务 | 交付物 |
|------|------|---------|
| Day 8-9 | 会议纪要生成 | `insight-summary.ts` |
| Day 10-11 | 待办提取 + 实时UI | WebSocket推送 |
| Day 12-13 | 导出功能 | PDF/Markdown |
| Day 14 | 测试优化 | 完整测试 |

### Week 3: PC控制实现

| 日期 | 任务 | 交付物 |
|------|------|---------|
| Day 15-16 | PC端Python服务 | `pc-agent/main.py` |
| Day 17-18 | 服务端集成 | `PcAgentService.ts` |
| Day 19-20 | OCR/UI识别 | 坐标映射 |
| Day 21 | E2E测试 | 完整测试 |

---

## 三、具体方案

### 3.1 语音交互完善

```typescript
// 配置系统
interface APIConfig {
  dashscope: {
    apiKey: string;
    asrModel: 'paraformer-realtime-v2';
    ttsModel: 'cosyvoice-v3-flash';
  };
}
```

### 3.2 移动端权限引导

```
首次启动流程:
欢迎 → 麦克风 → 存储 → 通知 → 厂商白名单 → 无障碍 → 通知监听 → 完成
```

### 3.3 PC控制

```
架构:
服务器 → WebSocket → Python服务(PyAutoGUI) → PC操作
```

---

## 四、待开发文件

### Week 1 任务

| 文件 | 说明 |
|------|------|
| `server/services/config.ts` | 统一配置 |
| `server/services/enhanced-voiceprint.ts` | 声纹增强 |
| `android/.../PermissionGuideActivity.kt` | 权限引导 |
| `android/.../BatteryOptimization.kt` | 厂商适配 |
| `android/.../KeepAliveService.kt` | 服务保活 |

### Week 2 任务

| 文件 | 说明 |
|------|------|
| `server/services/insight-summary.ts` | 会议纪要 |
| `server/services/action-item-tracker.ts` | 待办提取 |
| `client/src/pages/insight/RealtimePanel.tsx` | 实时UI |

### Week 3 任务

| 文件 | 说明 |
|------|------|
| `pc-agent/main.py` | PC端Python服务 |
| `server/services/pc-agent/PcAgentService.ts` | 服务端集成 |
| `server/services/ocr-service.ts` | OCR服务 |

---

## 五、技术债务

### 需要清理的Mock

| 文件 | 说明 |
|------|------|
| `screen-piercer.ts` | 需实现真实现 |
| `screen-monitor.ts` | 需实现真实现 |
| `vllm-grounding.ts` | 部分Mock |

---

## 六、发布计划

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.0.0 | 已发布 | APK基础版 |
| v1.1.0 | Week1 | 权限引导 + 声纹 |
| v1.2.0 | Week2 | 智语洞察增强 |
| v1.3.0 | Week3 | PC控制 |

---

需要我开始执行 Week 1 的任务吗？

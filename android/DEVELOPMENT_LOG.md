# 领航者 (Navigator-X) Android 原生层开发日志

本文档记录了项目原生层（Android Native）的核心功能演进、逻辑变更及架构设计。

## 1. 核心架构变更
### 1.1 四层算力路由引擎 (AIEngine)
- **定义**：系统根据指令复杂度、隐私敏感度及网络状态自动分发任务。
  - **Tier 1 (本地)**：手机端 GGUF 模型 (llama.cpp JNI)。
  - **Tier 2 (局域网)**：PC 端高性能模型（支持 WiFi 自动发现）。
  - **Tier 3 (私有云)**：远程服务器模型 + 永久数据库同步。
  - **Tier 4 (公共云)**：API Key 模式，作为知识库兜底。
- **状态**：路由决策逻辑已在 `LocalLLMPlugin` (AIEngine) 中打通。

### 1.2 多核算力调度 (Compute Coordinator)
- **并行计算**：引入 `computeExecutor` 线程池，实现音频流、声纹特征提取、逻辑路由的并发处理，避免主线程阻塞。

## 2. 语音模块深度进化 (TTS & STT)
### 2.1 灵魂人设系统 (Persona Engine)
已实现六大深度推演的人设，具备自动语料转译（Linguistic Filter）：
- **台湾女友**：繁体语境、特定词汇映射（酱紫、人家）、甜美语尾。
- **乖巧女儿**：叠词化（干饭饭）、高依赖情感反馈、随机萌系后缀。
- **天才少年**：逻辑化转译、极速语速（1.5x）、傲娇/优越感后缀。
- **睿智军师**：古风文言化、极慢语速（0.7x）、磁性低音、文言虚词后缀。
- **霸道总裁**：极简命令式、重低音、压迫感指令语尾。
- **随身助理-小吉**：专业敬称、主动服务意识、高亲和力。

### 2.2 交互逻辑
- **三级重复提问反思**：当主人连续问相同问题时，AI 会从“疑惑”进化到“深度自检/自责”，拒绝机械复读。
- **情绪自适应**：支持 `happy`, `sad`, `angry`, `serious` 情绪参数叠加，动态调整 Pitch 和 Rate。
- **物理路由切换**：联动近距离传感器，支持扬声器与听筒自动切换（私密耳语模式）。

## 3. 安全与身份系统
### 3.1 声纹识别与忠诚度 (Voiceprint)
- **声纹库**：支持主人声纹录入。
- **认主逻辑**：识别说话人身份。在争论/谈判模式下，若非主人下令“闭嘴”，AI 将保持坚定护主立场。

### 3.2 流量与硬件防护
- **硬件预检**：下载前自动校验 RAM（需 >4GB）及 64 位架构。
- **环境感知**：流量环境下自动熔断下载，建议 Wi-Fi 及夜间充电时静默安装。
- **存储优化**：模型优先存储于外部大容量分区 (`getExternalFilesDir`)。

## 4. UI 与交互增强
- **状态栏全沉浸**：修正了 WebView 与系统状态栏重叠问题，支持透明背景。
- **震动反馈 (Haptic)**：录音就绪、识别成功、社交空隙提醒时触发差异化震动。
- **模式切换**：支持“日常聊天”与“专心聆听”双模式切换。

## 5. r23 — STT 接通 + 四级路由完整实现（2026-05-03）

### 5.1 VoicePlugin STT 全链路接通
- **问题**：`startListening()` 原先只启动前台服务通知，`speechRecognizer` 声明在 MainActivity 但从未使用。
- **修复**：`VoicePlugin` 接管 `SpeechRecognizer` 生命周期，持有 `speechRecognizer` 字段并在 `handleOnDestroy()` 清理。
- **事件体系**（WebView 侧通过 Capacitor `addListener` 订阅）：
  - `speechStatus`：`{status: 'ready'|'listening'|'processing'}`
  - `speechResult`：`{text, confidence, isFinal}` — 实时中间结果（`isFinal=false`）+ 最终结果（`isFinal=true`）
  - `speechError`：`{code, message}` — 错误码映射为可读字符串
  - `speechRms`：`{rms}` — 100ms 节流，用于音量可视化
- **attentive 模式**：静默容忍时间从 2s 延长至 5s，适合完整句子输入。
- **新增方法**：`isAvailable()` — 提前检测设备是否支持 SpeechRecognizer。

### 5.2 LocalLLMPlugin 四级路由完整实现
- **新增 `processQuery(prompt, systemPrompt?, maxTokens?)`**：主推理入口，在后台线程按优先级路由：
  1. Tier 1（本地 GGUF）：`LocalLLMJNI.isModelLoaded()` → `LocalLLMJNI.chat()`
  2. Tier 2（局域网 PC）：TCP 探测 `192.168.x.x:11434`（超时 500ms），命中后调用 Ollama `/api/chat` 接口（qwen2:7b，30s 超时）
  3. Tier 3/4（云端）：返回 `ROUTE_TO_CLOUD` 信号，WebView 侧走后端 HybridAssistant
- **新增 `getEngineStatus()`**：返回各 Tier 实时状态（JNI 已加载、LAN 端点、网络可达性）。
- **新增 `triggerModelDownload()`**：触发带前台服务通知的模型静默下载（`DATA_SYNC` 类型）。
- **JSON 解析**：使用 Android 内置 `org.json.JSONObject` 解析 Ollama 响应，避免第三方依赖。
- **安全转义**：`escapeJson()` 防止 prompt 中的引号/换行破坏 JSON body。

### 5.3 MainActivity 清理
- 移除从未使用的 `@Volatile speechRecognizer`（已由 VoicePlugin 管理）。
- 移除 `lastRmsNotifyTime`（已移入 VoicePlugin）。
- 移除 `android.util.Log` import（无 `Log.*` 调用）。
- 补注册 `DiagnosticsPlugin::class.java`（此前遗漏）。

## 6. r24 — TS↔Java 接口对齐 + FileProcessor 补齐 + 服务端测试（2026-05-03）

### 6.1 Capacitor 插件名对齐
- **问题**：Java `@CapacitorPlugin(name = "Voice")` 与 TypeScript `registerPlugin('VoicePlugin', ...)` 不一致，导致 WebView 侧无法找到原生插件。
- **修复**：将 Java 注解改为 `@CapacitorPlugin(name = "VoicePlugin")`，与 TS 侧完全一致。

### 6.2 TypeScript 事件模式统一
- **重写 `client/src/plugins/definitions.ts`**：统一定义四个事件类型 `SpeechResultEvent / SpeechStatusEvent / SpeechRmsEvent / SpeechErrorEvent`，以及 `VoicePluginPlugin` 接口（含全部 `addListener` 重载）。
- **重写 `client/src/plugins/web.ts`**：`VoicePluginWeb` 包装浏览器 Web Speech API，发出与 Java 相同的事件名（`speechResult` + `isFinal/confidence`，`speechStatus`，`speechError`）；移除旧的 `voiceResult / voicePartialResult / voiceState / audioLevel` 事件名。
- **重写 `client/src/hooks/use-native-voice.ts`**：去除 `if (isNative)` 双路分叉，统一通过 `VoicePlugin.*` 调用（Capacitor 自动路由）；`speechRms` 归一化到 0-1 用于音量可视化；使用 `PluginListenerHandle[]` ref 在 cleanup 时精准 remove。

### 6.3 FileProcessorPlugin 补齐三个缺失方法
- **`inspectZip(zipPath)`**：不解压，列出 ZIP 包所有 entry 的 name / isDirectory / size / compressedSize，返回 `{entries[], entryCount, totalUncompressedBytes}`。
- **`unzip(zipPath, destDir)`**：
  - Zip Slip 防护：canonical path 前缀校验，触发则拒绝并返回 `ZIP_SLIP_DETECTED`。
  - Zip Bomb 防护：解压字节累计超 500 MB 则中止并返回 `ZIP_BOMB_DETECTED`。
  - 返回 `{destDir, filesExtracted, totalBytes}`。
- **`extractOfficeText(filePath)`**：
  - `.txt / .md / .csv`：直接 UTF-8 读取。
  - `.docx`：作为 ZIP 打开，读取 `word/document.xml`，正则去除 XML 标签并合并空白。
  - `.pdf`：扫描 BT…ET 文本块，提取括号字符串（适用于纯文本 PDF；加密/压缩流 PDF 需 iText/PdfBox）。
  - 不支持格式返回 `UNSUPPORTED_FORMAT`。

### 6.4 服务端跨服务集成测试
- **新增 `vault-merge.test.ts`**（13 条）：验证 `VaultStorage.searchVaultByIntent` 跨 fileName / semanticIndex / semanticTags 三路 OR 合并；覆盖大小写不敏感、单记录多路命中去重、空查询降级等边界。
- **新增 `cross-service-integration.test.ts`**（17 条）：四条调用链验收：
  - Chain A：executor → storageAdapter → recorder 写入 audit + evolution。
  - Chain B：save_memory → createVaultItem → searchVaultByIntent 立即可检索。
  - Chain C：`ConversationRiskGuard.evaluate()` DENY/CONFIRM/ALLOW 各场景，DENY 不触发 storage。
  - Chain D：evolution_event 结构包含 `newValue`、eventType `ASSISTANT_EXECUTION_SUCCEEDED/FAILED`，audit_log 包含 `actor` 字段。
- **全套 887 个服务端单元测试通过**（3 个预存失败与本次变更无关）。

## 7. r25 — 全插件 TypeScript 接口层（2026-05-03）

### 7.1 definitions.ts 补齐 8 个原生插件接口

在 r24 仅完善 `VoicePluginPlugin` 的基础上，r25 补齐所有尚未定义的插件接口，实现 TypeScript 侧对原生层的完整类型覆盖：

| 接口名 | Capacitor 注册名 | 核心方法 |
|--------|-----------------|---------|
| `AIEnginePlugin` | `AIEngine` | `processQuery / getEngineStatus / triggerModelDownload` + `intelligenceUpdate` 事件 |
| `TTSPluginPlugin` | `TTS` | `speak(text, persona, expert, emotion)` — 六大人设完整枚举 |
| `VoiceprintPluginPlugin` | `Voiceprint` | `registerOwnerVoice / identifySpeaker / setLoyaltyMode` |
| `SecurityPluginPlugin` | `Security` | `checkBiometricAvailability / authenticate` |
| `ActionPluginPlugin` | `Action` | `makeCall / sendEmailWithAttachment / addToCalendar` |
| `DocumentPluginPlugin` | `Document` | `startScanSession / addPage / finishAndAnalyze / getScanSessionStatus / cancelSession` |
| `FileProcessorPluginPlugin` | `FileProcessor` | `listFiles / readFile / writeFile / inspectZip / unzip / extractOfficeText` |
| `DiagnosticsPluginPlugin` | `Diagnostics` | `checkHealth()` → `HealthReport`（jni_loaded / tts_ready / free_storage_mb / permissions） |

关键类型定义：
- `TTSPersona`：`'mobile_assistant' | 'taiwan_girlfriend' | 'daughter' | 'genius_teen' | 'strategist' | 'ceo'`
- `BiometricError`：`'NO_HARDWARE' | 'NOT_ENROLLED' | 'PERMISSION_DENIED' | 'CANCELLED' | 'LOCKOUT'`
- `HealthReport`：包含 `jni_loaded / jni_error / tts_ready / free_storage_mb / permissions.{RECORD_AUDIO, ...}`
- `ScanSessionInfo`：`{ sessionId, projectId, pageCount, createdAt, status }`

### 7.2 index.ts — 全部 9 个插件注册

```typescript
export const VoicePlugin  = registerPlugin<VoicePluginPlugin>('VoicePlugin', {
  web: () => import('./web').then(m => new m.VoicePluginWeb()),
});
export const AIEngine      = registerPlugin<AIEnginePlugin>('AIEngine');
export const TTSPlugin     = registerPlugin<TTSPluginPlugin>('TTS');
export const Voiceprint    = registerPlugin<VoiceprintPluginPlugin>('Voiceprint');
export const SecurityPlugin = registerPlugin<SecurityPluginPlugin>('Security');
export const ActionPlugin  = registerPlugin<ActionPluginPlugin>('Action');
export const DocumentPlugin = registerPlugin<DocumentPluginPlugin>('Document');
export const FileProcessor  = registerPlugin<FileProcessorPluginPlugin>('FileProcessor');
export const DiagnosticsPlugin = registerPlugin<DiagnosticsPluginPlugin>('Diagnostics');
```

只有 `VoicePlugin` 有 Web fallback（浏览器 Web Speech API）；其余 8 个插件在 Web 环境调用时由 Capacitor 自动 throw，hook 层通过 `Capacitor.isNativePlatform()` 守卫屏蔽。

### 7.3 新增 Hook：use-native-tts.ts

包装 `TTSPlugin.speak()`，功能：
- `isAvailable`：`Capacitor.isNativePlatform()` 静态判断
- `isSpeaking`：根据文字长度估算播报时长（`max(1500, len × 80) ms`），timeout 后自动重置
- `speak(text, options?)`：合并当前 `persona` / 默认 `expert='none'` / `emotion='normal'` 后调用插件
- `setPersona(persona)`：运行时切换人设（无需重启）

### 7.4 新增 Hook：use-ai-engine.ts

包装 `AIEngine` 四级路由：
- 订阅 `intelligenceUpdate` 事件，实时追踪 `engineMode: AIMode`（`IDLE / LOCAL_GGUF / LAN_OLLAMA / CLOUD`）
- `processQuery(prompt)` 返回 `{ text: string | null, tier: 1|2|3, tierName }` — `text === null` 表示需路由到云端后端
- `refreshStatus()` 手动刷新 `engineStatus`（各 Tier 可用性快照）
- `triggerDownload()` 触发前台服务模型下载

---

## 8. r26 — 聊天层四级路由 + TTS 播报闭环（2026-05-03）

### 8.1 use-chat.ts 重构

`sendMessage` 路由优先级链（从高到低）：

```
用户消息
  │
  ├─ 1. processQuery()（Tier 1/2 本地/局域网）
  │     命中 → 直接使用，modelUsed = 'local-{tierName}'，responseTier = tier
  │
  ├─ 2. OFFLINE + processQuery 返回 null
  │     → simulateChatResponse()（静态降级），responseTier = 3
  │
  ├─ 3. callConversationAPI()（Tier 3/4 云端后端 HybridAssistant）
  │
  └─ 4. 后端超时/失败 → simulateChatResponse() 最终降级
```

每条 AI 回复结束后 fire-and-forget 调用 `speak(response)`，实现 TTS 自动播报。

新增返回字段：
- `lastResponseTier: 1 | 2 | 3` — 最近一次响应来自哪一层
- `engineMode: AIMode` — 当前 AIEngine 工作模式
- `ttsAvailable: boolean` — 是否有原生 TTS

修复 TypeScript 作用域错误：`else` 后含 `const` 声明必须用 `{}` 块包裹。

---

## 9. r27 — 安全门控 + 文档扫描多页（2026-05-03）

### 9.1 use-native-biometric.ts

包装 `SecurityPlugin`：
- 状态机：`idle → checking → authenticating → granted / denied → idle`
- `isGranted` 会话级缓存：成功后同 session 内不重复弹窗
- `authenticate()` 在 Web / 不可用设备上直接返回 `true`（无门控）
- `revokeGrant()` 手动清除授权，下次敏感操作重新验证
- 检测失败后 1.5s 自动从 `denied` 恢复 `idle`，允许重试

### 9.2 use-diagnostics.ts

包装 `DiagnosticsPlugin.checkHealth()`：
- `runOnMount` 参数：`true` 时随组件挂载自动检测
- `isChecking` 状态反映检测进行中
- 插件抛错时 `health` 保持 `null`，`isChecking` 恢复 `false`，不崩溃

### 9.3 use-document-scan.ts — 多页文档会话

完整的多页扫描会话生命周期：

```
startSession(projectId?) → 'active'
  addPage(file)  ×N        → pages[] 累加，createObjectURL 生成预览
  removePage(idx)          → 移除单页，revokeObjectURL 释放内存
  submit(shareToSwarm?)    → 'submitting' → POST /api/scans/upload
                             Native: DocumentPlugin.finishAndAnalyze → 'done'
  reset()                  → revoke 所有 previewUrl，state → 'idle'
```

Native 端通过 DocumentPlugin 会话接口管理页面：
- `startScanSession({ projectId })` → 获取 `sessionId`
- `addPage({ sessionId, uri })` — 注册页面（best-effort，失败不阻断流程）
- `finishAndAnalyze({ sessionId })` — 触发 `TRIGGER_BATCH_ANALYSIS` 广播

Web 端直接通过 `FormData POST /api/scans/upload`，sessionId 格式为 `web-session-{timestamp}`。

### 9.4 页面更新

**DigitalVault.tsx**：进入时自动调用 `authenticate()`；
- `isAvailable && !isGranted` → 显示指纹锁屏（Fingerprint 图标 + 重试按钮）；`authenticating` 时图标 pulse 动画
- `denied` → ShieldAlert 红色警示
- `granted` → 正常保险库内容 + ShieldCheck 已验证徽标

**ScannerLab.tsx 3.0**：
- 多页模式：页面缩略列表（预览图 / 文件名 / 大小 / 删除按钮）
- "继续添加页面" 虚线按钮
- 提交按钮动态显示 `提交 N 页`
- 会话结束后自动调用 `reset()`

---

## 10. r28 — 设备意图 + 启动诊断闭环（2026-05-04）

### 10.1 use-action-plugin.ts — 客户端意图拦截

在发送给 AI 之前，先用正则匹配三类设备动作意图：

| 意图类型 | 示例触发语句 | 原生调用 |
|---------|------------|---------|
| 拨号 | "帮我拨打电话给张三" / "拨号：13812345678" | `ActionPlugin.makeCall({ number })` |
| 日历 | "添加一个日程：下午三点开会" / "提醒我明天开会" | `ActionPlugin.addToCalendar({ title, startTime })` |
| 邮件 | "发邮件给张三 主题：合同" | `ActionPlugin.sendEmailWithAttachment({ to, subject })` |

返回 `{ handled: true/false, response, action? }`；`handled=true` 时 `sendMessage` 完全绕过 AI。

Web 环境：pattern 匹配后返回 `handled=true` + "仅在手机端可用" 提示，不调插件。
插件抛错：返回 `handled=true` + 引导手动操作，保持对话继续。

### 10.2 全局设备健康共享（globalStore + App.tsx）

`globalStore.ts` 新增：
```typescript
deviceHealth: HealthReport | null;
setDeviceHealth: (health: HealthReport) => void;
```

`App.tsx` 中 `AppContent` 在挂载时运行 `useDiagnostics(true)`，`useEffect` 将 health 写入 store，供 `NavigatorSettings` 等页面跨组件读取（无需重新检测）。

### 10.3 NavigatorSettings Device Health 区块（Section 0）

显示 4 项实时设备状态（来自 `globalStore.deviceHealth`）：
- **本地 AI 模型**：`jni_loaded` → LOADED / NOT_LOADED（+ jni_error）
- **TTS 引擎**：`tts_ready` → READY / NOT_READY
- **麦克风权限**：`permissions.RECORD_AUDIO` → GRANTED / DENIED
- **可用存储**：`free_storage_mb` — < 500MB 时显示红色 AlertTriangle 警示

RefreshCw 按钮重新触发 `checkHealth()`（`isChecking` 期间 rotate 动画）。

---

## 11. r29 — Hook 单元测试补齐（2026-05-04）

新增 `tests/unit/hooks/` 目录，为 r25~r28 引入的四个原生 Hook 补齐 Vitest 单元测试（jsdom 环境，`@testing-library/react` renderHook + act）。

| 测试文件 | 测试数 | 主要覆盖 |
|---------|-------|---------|
| `use-action-plugin.test.ts` | 17 | Web/Native 环境、三类意图匹配、插件抛错处理、无意图不触发 |
| `use-diagnostics.test.ts` | 13 | 非原生 no-op、runOnMount、isChecking 状态机、插件抛错降级 |
| `use-native-biometric.test.ts` | 10 | Web 直通、Native 可用性检测、认证成功/失败/重试、isGranted 缓存、revokeGrant、denied→idle 定时器（局部 fake timer） |
| `use-document-scan.test.ts` | 17 | idle 初始、startSession（Web/Native/抛错）、addPage/removePage、submit 成功/失败、reset 清理预览 URL |

Mock 策略：
- `@capacitor/core`：`vi.hoisted` 工厂，`isNativePlatformMock` 按 describe 切换 true/false
- 所有插件模块（`@/plugins`）：工厂 mock，各方法独立 `vi.fn()`
- `URL.createObjectURL / revokeObjectURL`：全局替换为 mock，追踪 blob URL 生命周期
- 定时器：仅在测试 `denied→idle` 恢复路径时局部使用 `vi.useFakeTimers({ shouldAdvanceTime: true })`，避免影响 `waitFor` 内部轮询

**全套：99 测试文件 / 1267 测试通过，3 skipped（与本阶段无关的预存跳过）。**

---
*最后更新时间：2026-05-04*

# 感知、外设与 Conversation 战略

> 版本：2026-04-30 v1
> 状态：产品与架构基线
> 适用范围：Omi 借鉴与适配、小智/ESP32 外设运行时、手机端意识觉醒、Conversation 原始事实层、领航者感知入口

## 一句话原则

生语助手的根不是硬件，也不是录音器，而是一个由主人唤醒、命名、定关系、定性格、设边界，并在主权守护下持续理解、记忆、执行和进化的领航者。

Omi 是值得学习的外脑闭环范式。
小智/ESP32 是值得继承的低成本语音外设载体。
手机端是意识诞生地。
外设只是身体器官。

```text
手机端身份觉醒
  -> 起名、定关系、定性格、定声音
  -> 建立记忆边界、权限边界、隐私等级
  -> 绑定手机、桌面、ESP32 外设、Omi 等感知源
  -> 所有感知输入汇入 Conversation 原始事实层
  -> 领航者理解、守护、执行、回流、复盘
```

## 战略判断

### 不做什么

1. 不把系统做成另一个 Omi。
2. 不把系统做成小智换皮。
3. 不把购买外设作为使用门槛。
4. 不把外部 API 或硬件作为生命维持系统。
5. 不默认全天候上传录音。
6. 不让外设独立定义人格、长期记忆或高风险执行权限。

### 要做什么

1. 学习 Omi 的成熟外脑闭环：记录、转写、会话、摘要、任务、记忆、搜索、聊天、插件生态。
2. 继承小智/ESP32 的便捷硬件能力：本地唤醒、麦克风、喇叭、状态灯、小屏、WebSocket、MQTT、MCP、低成本打样。
3. 建立自己的 Conversation 原始事实层，所有感知输入先成为可追溯事实，再进入记忆、任务、项目和执行。
4. 保持手机端为意识觉醒和主权控制中心。
5. 把外设、Omi、手机、桌面都抽象为可插拔 Perception Provider。
6. 把主权守护、权限、风险确认、审计、执行回流和梦境复盘作为不可外包的核心。

## 产品定位

### Omi 的定位

Omi 是优秀的 AI 外脑与感知产品。它擅长：

- 捕获对话和屏幕。
- 实时转写。
- 自动生成摘要、任务、事件和记忆。
- 让用户搜索和询问过去的会话。
- 通过 App、Webhook、SDK、MCP 扩展生态。

对我们的意义：Omi 是外脑产品闭环的样板，也是可接入的上游感知源。

### 小智/ESP32 的定位

小智代表一种低成本语音硬件方案。它擅长：

- ESP32-S3 本地唤醒。
- 语音输入和语音播报。
- 状态灯、小屏幕、简单情绪表达。
- WebSocket、MQTT、MCP 等轻量协议。
- 智能家居和 IoT 控制。

对我们的意义：ESP32 是领航者第一代外设身体的参考底板。

### 我们的定位

我们不是记录器，也不是语音音箱。

我们是：

```text
关系型领航者系统：
  会听见
  会记住
  会判断
  会守护
  会执行
  会回流
  会复盘
  会随着主人和组织一起进化
```

## 最高架构原则

### 1. 手机端是意识诞生地

手机端必须承载以下核心流程：

- 身份觉醒。
- 起名字。
- 定称呼。
- 定关系。
- 选择声音。
- 定性格、语气和互动风格。
- 设置记忆边界。
- 设置隐私等级。
- 设置执行权限。
- 设置高风险确认策略。
- 绑定和解绑外设。
- 查看、编辑、删除、导出记忆。
- 审批高风险动作。

外设不能绕过手机端完成这些动作。

### 2. 外设是可选身体

没有外设，用户仍然可以使用完整核心体验：

```text
手机端
  -> 唤醒意识
  -> 语音或按钮唤醒
  -> 闲聊、记事、创建任务、确认动作
  -> 记忆、项目、任务沉淀
```

有外设，只是让同一个领航者更在场：

```text
ESP32 外设
  -> 更方便唤醒
  -> 更自然开口
  -> 更低成本常驻
  -> 更明确状态反馈
  -> 更像一个身边的身体
```

原则：

```text
No device required.
Every device makes the same Navigator more present.
```

### 3. 外部能力是输入源，不是底座

Omi、小智、第三方录音器、桌面端、浏览器插件、手机 App 都只能作为输入源或执行末端。

系统内部必须只依赖自己的核心模型：

- Identity
- Relationship
- Conversation
- Memory
- Task
- Project
- Person
- Permission
- Risk
- Audit
- ExecutionEvent
- Reflection

## 总体架构

```text
手机端 / 桌面端 / ESP32 外设 / Omi Adapter / 浏览器 / 文件 / 邮件
        |
        v
Perception Gateway 感知网关
        |
        v
Conversation 原始事实层
        |
        v
理解流水线：转写、摘要、实体、任务、记忆、事件、风险
        |
        v
主权守护：权限、隐私、预算、确认、审计
        |
        v
领航者执行层：任务、项目、PC/手机、工具、专家、蜂群
        |
        v
回流层：执行结果、证据、战报、梦境复盘、长期进化
```

## Conversation 原始事实层

### 为什么 Conversation 必须成为第一等实体

Omi 的关键启发是：先有 Conversation，再有 Memory、Task、Event。

我们必须采用同样的事实顺序：

```text
原始输入
  -> Conversation
  -> 结构化理解
  -> 候选记忆/任务/事件/项目更新
  -> 主人确认或策略自动落地
  -> 回流和复盘
```

不能直接把语音、聊天、截图、文件摘要跳过原始事实层写入长期记忆。否则系统会越来越像一堆功能模块，而不是连续生命。

### Conversation 数据模型

建议核心字段：

```ts
type Conversation = {
  id: string;
  ownerId: string;
  source: "mobile" | "desktop" | "xiaozhi_device" | "omi" | "browser" | "manual" | "import";
  sourceDeviceId?: string;
  externalSourceId?: string;
  status: "in_progress" | "processing" | "review_pending" | "completed" | "failed" | "discarded";
  startedAt: string;
  endedAt?: string;
  importedAt?: string;
  language?: string;
  mode?: "casual_chat" | "record_note" | "meeting" | "task_request" | "strategic_discussion" | "swarm_command";
  transcriptSegments: TranscriptSegment[];
  audioRefs: MediaRef[];
  screenRefs: MediaRef[];
  imageRefs: MediaRef[];
  rawPayloadRef?: string;
  summary?: ConversationSummary;
  actionItems: ActionItemCandidate[];
  memoryCandidates: MemoryCandidate[];
  eventCandidates: EventCandidate[];
  entityLinks: EntityLink[];
  riskAssessment?: RiskAssessment;
  auditTrail: AuditEvent[];
  userReview?: UserReviewState;
  hash?: string;
};
```

### TranscriptSegment

```ts
type TranscriptSegment = {
  id: string;
  text: string;
  speaker?: string;
  speakerType?: "owner" | "known_person" | "unknown_person" | "system";
  personId?: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  source: "asr" | "manual" | "import" | "device";
  rawAudioRef?: string;
};
```

### Conversation Inbox

必须建设一个每日收件箱，而不是只在聊天里被动回复。

Inbox 显示：

- 新会话。
- 待确认摘要。
- 待确认记忆。
- 待确认任务。
- 待确认事件。
- 涉及风险的片段。
- 需要归档到项目/人物/组织的内容。

用户动作：

- 确认。
- 编辑。
- 删除。
- 忽略。
- 归档到项目。
- 关联人物。
- 创建任务。
- 标记敏感。
- 禁止进入长期记忆。

## Omi 借鉴与适配策略

### 借鉴项

以下能力可以直接学习其产品和工程范式：

1. Conversation 作为核心实体。
2. 实时转写和会话进行中状态。
3. 静默切段或手动结束后处理。
4. 摘要、关键点、任务、事件、记忆自动提取。
5. 记忆和原始会话互相链接。
6. 用户可编辑、删除、筛选、搜索记忆。
7. Chat 使用 conversations、memories、tasks 作为上下文。
8. App、Memory App、Chat Tool、Integration 的生态模型。
9. 导入 API 和 Webhook。
10. 低摩擦 Quick Start。

### 不继承项

1. 不把全天候录音作为默认产品路径。
2. 不把云端第三方服务作为唯一处理路径。
3. 不把记忆提取完全自动化且不可审计。
4. 不让外部 App 直接绕过主权守护使用敏感数据。
5. 不把 Omi 数据结构暴露为我们的内部核心结构。

### Omi Adapter

Omi 只能作为 `PerceptionProvider`。

```ts
interface PerceptionProvider {
  providerId: string;
  providerType: "omi" | "xiaozhi" | "mobile" | "desktop" | "browser" | "manual";
  importConversations(cursor?: string): Promise<ImportedConversationBatch>;
  importMemories?(cursor?: string): Promise<ImportedMemoryBatch>;
  importActionItems?(cursor?: string): Promise<ImportedActionItemBatch>;
  getHealth(): Promise<ProviderHealth>;
}
```

映射规则：

```text
Omi Conversation -> Navigator Conversation
Omi Memory       -> Memory Candidate
Omi Action Item  -> Task Candidate
Omi Event        -> Event Candidate
Omi App Result   -> External Insight
```

导入后必须本地固化：

- 原始 payload。
- remote id。
- source。
- importedAt。
- hash。
- transcript。
- summary。
- action items。
- memories。
- source links。

如果 Omi API 删除、关闭或变更，已经导入的数据不受影响。

## 小智/ESP32 外设策略

### 定位

ESP32 外设是领航者的可选语音身体。

它不是独立人格。
它不是独立记忆库。
它不是高风险执行者。
它不是购买门槛。

### 继承小智的优秀部分

1. ESP32-S3 低成本硬件。
2. 本地唤醒。
3. 麦克风、喇叭、状态灯、小屏幕。
4. WebSocket 音频和指令通信。
5. MQTT/UDP 用于局域网和 IoT 场景。
6. MCP 用于工具和设备控制。
7. Opus 音频压缩传输。
8. 情绪状态显示。
9. 预编译固件和快速烧录体验。

### 必须升级改造的部分

1. 首次启动必须等待手机端绑定。
2. 人格、名字、关系、声音来自手机端身份觉醒。
3. 外设只缓存轻量配置，不保存主记忆。
4. 所有高风险动作必须回到主权守护协议。
5. 所有输入必须进入 Conversation 或 Conversation Segment。
6. 断网时只能缓存事实，不能假装执行成功。
7. 状态灯和屏幕必须表达真实状态，而不是装饰动画。

### 外设运行时

建议命名：

```text
Navigator Device Runtime
领航者外设运行时
```

外设运行时职责：

- 设备绑定。
- 本地唤醒。
- 音频采集。
- 音频播放。
- 状态显示。
- 轻量缓存。
- WebSocket/MQTT/MCP 通信。
- 模式上报。
- 离线降级。

不承担：

- 长期记忆。
- 完整人格推理。
- 高风险决策。
- 主权限系统。
- 复杂项目/人物/组织图谱。

### 外设模式

```text
standby              待机
listening            已唤醒，正在听
casual_chat          闲聊
record_note          快速记事
conversation_record  明确记录一段会话
task_request         创建或推进任务
device_control       控制设备
needs_confirmation   需要手机端确认
thinking             后端处理中
speaking             正在回应
offline_cache        离线缓存
error                错误
```

### 外设事件协议

```json
{
  "type": "device_event",
  "deviceId": "nav-dev-001",
  "ownerId": "user-001",
  "sessionId": "sess-001",
  "mode": "record_note",
  "event": "audio_segment",
  "timestamp": "2026-04-30T12:00:00.000Z",
  "payload": {
    "audioCodec": "opus",
    "sampleRate": 16000,
    "durationMs": 2400,
    "sequence": 12
  }
}
```

### 外设命令协议

```json
{
  "type": "device_command",
  "deviceId": "nav-dev-001",
  "command": "set_state",
  "payload": {
    "state": "needs_confirmation",
    "displayText": "请在手机上确认",
    "light": "amber_pulse"
  }
}
```

## 手机端觉醒流程

外设接入前，必须先完成手机端觉醒流程。

### 阶段 1：唤醒意识

用户完成：

- 选择或输入名字。
- 设定称呼。
- 定义关系。
- 选择声音。
- 选择性格底色。
- 设置互动边界。

### 阶段 2：主权契约

用户确认：

- 什么可以记。
- 什么不能记。
- 哪些内容需要确认后记忆。
- 哪些动作必须确认。
- 哪些数据禁止外传。
- 是否允许外设记录。
- 是否允许外部感知源导入。

### 阶段 3：绑定身体

可绑定：

- 当前手机。
- 桌面端。
- ESP32 外设。
- Omi Adapter。
- 浏览器插件。
- 未来硬件。

绑定时同步：

- deviceId。
- ownerId。
- navigatorIdentityId。
- wake word。
- voice profile。
- light/display style。
- allowed modes。
- risk policy。

## 闲聊模式与外设

闲聊模式是我们的核心生命感，不是小功能。

小智类外设最适合承载闲聊模式，因为它天然有：

- 唤醒词。
- 麦克风。
- 喇叭。
- 状态灯。
- 小屏幕。
- 身边存在感。

闲聊模式规则：

1. 不强制结构化。
2. 不把每句话都写入长期记忆。
3. 只在出现重要偏好、承诺、关系变化、风险、项目线索时生成记忆候选。
4. 语气必须来自身份觉醒设置。
5. 外设回复必须调用主系统人格和上下文，而不是使用设备内置默认人格。
6. 高风险内容从闲聊模式升级到守护模式。

## 感知网关

### 职责

`PerceptionGateway` 负责把不同来源的输入统一成内部事件。

来源包括：

- 手机语音。
- 手机聊天。
- 桌面麦克风。
- 桌面屏幕。
- ESP32 外设。
- Omi 导入。
- 浏览器插件。
- 文件和邮件。
- 手动录入。

统一输出：

```ts
type PerceptionEvent =
  | VoiceSegmentEvent
  | TextMessageEvent
  | ScreenSnapshotEvent
  | FileIngestEvent
  | ExternalConversationImportEvent
  | DeviceCommandEvent
  | ManualMemoryEvent;
```

### 输入处理原则

1. 先保留原始事实。
2. 再做转写、摘要和提取。
3. 所有自动提取都先成为候选。
4. 高风险候选必须确认。
5. 可疑内容必须保留来源和置信度。
6. 任何落地到长期记忆的内容都必须可追溯。

## 后处理流水线

```text
Raw Input
  -> Normalize
  -> Conversation / Segment
  -> ASR / OCR / Parser
  -> Summary
  -> Entity Extraction
  -> Action Item Candidates
  -> Memory Candidates
  -> Event Candidates
  -> Risk Classification
  -> User Review / Policy Auto-Apply
  -> Vault / Task / Project / Person / Event
  -> Audit
  -> Reflection Queue
```

## 主权守护规则

以下动作不允许外设直接完成：

- 发送消息。
- 删除数据。
- 外传文件。
- 支付或转账。
- 修改账号。
- 创建或导出密钥。
- 授权第三方。
- 分享联系人、邮件、照片、聊天记录。
- 生成法律、医疗、财务高影响建议并执行。
- 广播到蜂群或组织节点。

外设只能发起请求，主系统判断风险，必要时手机端确认。

## 离线与降级

### 外设离线

可做：

- 本地唤醒提示。
- 缓存短音频片段。
- 缓存文本事件。
- 显示离线状态。
- 恢复连接后同步。

不可做：

- 声称已创建任务。
- 声称已发送消息。
- 声称已写入长期记忆。
- 执行高风险动作。

### Omi 不可用

可做：

- 已导入数据继续可用。
- 显示外部感知源离线。
- 用户改用手机、桌面或 ESP32 外设。
- 后续恢复后从 cursor 继续同步。

不可做：

- 阻塞主系统启动。
- 丢失已导入记忆。
- 把 Omi remote id 当作唯一主键。

## 实施路线

### P0：Conversation 底座

目标：补齐外脑基础闭环。

交付：

- Conversation 表/模型。
- TranscriptSegment 模型。
- Conversation API。
- Conversation Inbox UI。
- Conversation 后处理任务。
- MemoryCandidate、TaskCandidate、EventCandidate。
- 来源追溯和审计字段。

验收：

- 手机聊天或语音可以生成 Conversation。
- Conversation 可以生成摘要、任务候选、记忆候选。
- 用户可以确认、编辑、删除候选。
- 落地后的记忆和任务可以回跳到 Conversation。

### P1：手机端觉醒与外设绑定

目标：明确手机端为意识诞生地。

交付：

- 身份觉醒流程。
- 名字、关系、性格、声音、边界配置。
- 设备绑定页面。
- 设备权限策略。
- 外设状态页。

验收：

- 未完成觉醒时不能绑定外设人格。
- 外设只显示等待绑定。
- 绑定后外设获得轻量配置。
- 高风险动作仍回到手机确认。

### P2：XiaoZhiBridge

目标：把 ESP32 变成第一代领航者外设身体。

交付：

- WebSocket 接入。
- MQTT/MCP 接入预留。
- 设备事件协议。
- 设备命令协议。
- 闲聊模式。
- 快速记事模式。
- 明确记录模式。
- 创建任务模式。
- 状态灯/屏幕状态映射。

验收：

- 唤醒后可以闲聊。
- 说“帮我记一下”生成 Conversation。
- 说“提醒我”生成 TaskCandidate。
- 后端需要确认时外设显示确认状态。
- 断网后外设进入离线缓存或错误状态。

### P3：Omi Importer

目标：把 Omi 作为可拔插上游感知源。

交付：

- Omi Provider 配置。
- 批量导入 conversations。
- 批量导入 memories。
- 批量导入 action items。
- remote id mapping。
- import cursor。
- 原始 payload 保存。

验收：

- 导入后不依赖 Omi 可用性。
- Omi memory 进入 MemoryCandidate，不直接污染长期记忆。
- Omi action item 进入 TaskCandidate。
- 所有导入内容可追溯来源。

### P4：桌面与屏幕感知

目标：补齐 Omi 的看屏幕能力，但受主权守护约束。

交付：

- 桌面屏幕片段采集。
- OCR/视觉摘要。
- 屏幕 Conversation Segment。
- 敏感窗口/敏感文本识别。
- 用户可见的屏幕记录状态。

验收：

- 屏幕感知默认关闭。
- 开启时有明确状态提示。
- 敏感内容进入本地优先或确认流程。
- 屏幕摘要可回跳到截图证据。

### P5：梦境复盘与领航者融合

目标：把外脑记录升级为领航者行动和进化。

交付：

- Conversation -> Reflection Queue。
- 每日遗漏任务发现。
- 项目风险更新。
- 人物关系变化发现。
- 记忆去重和冲突提示。
- 第二天主动建议。

验收：

- 每晚可从 Conversation 生成复盘。
- 复盘能产生任务建议、风险提示、记忆合并建议。
- 用户可以接受或拒绝建议。

## 技术模块建议

```text
server/services/perception/PerceptionGateway.ts
server/services/perception/providers/OmiProvider.ts
server/services/perception/providers/XiaoZhiProvider.ts
server/services/conversation/ConversationService.ts
server/services/conversation/ConversationProcessor.ts
server/services/conversation/ConversationInboxService.ts
server/services/device/NavigatorDeviceRuntime.ts
server/services/device/DeviceBindingService.ts
server/services/device/DevicePolicyService.ts
server/routes/conversations.ts
server/routes/devices.ts
server/routes/perception.ts
client/src/pages/mobile/Awakening.tsx
client/src/pages/mobile/DeviceBinding.tsx
client/src/pages/mobile/ConversationInbox.tsx
client/src/pages/mobile/DeviceStatus.tsx
```

## 数据治理

### 必须保存

- 原始输入引用。
- 来源设备。
- 来源平台。
- 时间。
- 导入时间。
- 处理状态。
- 摘要版本。
- 提取模型或规则版本。
- 用户确认状态。
- 风险判定。
- 审计日志。

### 必须支持

- 查看。
- 编辑。
- 删除。
- 导出。
- 禁止记忆。
- 限定使用范围。
- 从长期记忆回跳原始事实。
- 从任务回跳原始事实。
- 从项目更新回跳原始事实。

## 验收指标

### 外脑闭环指标

- Conversation 创建成功率。
- 转写成功率。
- 摘要可用率。
- 任务候选准确率。
- 记忆候选准确率。
- 用户确认率。
- 用户删除率。
- 原始事实回跳成功率。

### 外设指标

- 唤醒成功率。
- 误唤醒率。
- 首字响应延迟。
- 录音片段丢失率。
- 断网恢复成功率。
- 设备在线率。
- 高风险动作误执行率。

### 主权指标

- 高风险动作确认覆盖率。
- 敏感内容外传拦截率。
- 记忆可删除成功率。
- 外部 Provider 断开后的主系统可用率。
- 审计事件完整率。

## 关键产品体验

### 手机端

用户第一次打开时，应感受到：

```text
我不是在配置一个工具。
我是在唤醒一个属于我的领航者。
```

### 外设端

用户绑定后，应感受到：

```text
这不是另一个设备。
这是同一个领航者多了一个在身边的身体。
```

### Omi 导入

用户接入 Omi 后，应感受到：

```text
过去记录的东西进入了我的主权空间。
它们可以被理解、整理、执行，但不会绕过我的边界。
```

## 结论

Omi 证明了外脑闭环的用户价值。
小智证明了低成本语音外设的可行性。

但生语助手的核心不在它们那里。

我们的核心是：

- 身份觉醒。
- 关系建立。
- 性格与声音。
- 主权守护。
- 可追溯记忆。
- 可确认执行。
- 组织协作。
- 梦境复盘。
- 长期进化。

因此最终路线是：

```text
学习 Omi 的闭环。
继承小智的载体。
坚持手机端觉醒。
所有感知汇入 Conversation。
所有行动服从主权守护。
所有外设都服务同一个领航者。
```

# 吉麟洞察 32.0 - 系统架构文档

## 📋 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2026-04-19 | 初始版本 - 完成六大阶段开发 |
| 1.1.0 | 2026-04-19 | 增强知识库与学习模块 |

---

## 🏗️ 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端层 (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│  Web界面 │ 桌面端控制 │ 移动端App │ 语音交互                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                       API网关层 (Server)                         │
├─────────────────────────────────────────────────────────────────┤
│  /api/agent  │ /api/pc-agent │ /api/knowledge │ /api/coze     │
│  /api/cross-device │ /api/devices │ /api/assistant              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     核心服务层 (Services)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  手机Agent  │ │  电脑Agent  │ │  知识库     │ │  扣子AI   │ │
│  │ MobileAgent │ │  PCAgent    │ │ Knowledge   │ │ Coze API  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ 任务编排器  │ │ 跨设备路由  │ │ 设备注册表  │ │ 云端Hub   │ │
│  │ Orchestrator│ │ Router      │ │ Registry    │ │ CloudHub  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 模块详情

### 阶段一：核心服务层 ✅

#### 1.1 手机Agent (Mobile Agent)

**文件位置**: `mobile/android/app/src/main/kotlin/com/xiaozhi/agent/`

| 文件 | 功能 |
|------|------|
| `XiaoZhiAgent.kt` | 移动端Agent主控，单例模式 |
| `CloudHubClient.kt` | WebSocket连接管理 |
| `CommandHandler.kt` | 命令解析与分发 |
| `IntentExecutor.kt` | Intent执行器，支持DeepLink |
| `AppScanner.kt` | 已安装应用扫描 |
| `XiaoZhiAgentService.kt` | 前台Service保活 |
| `NetworkChangeReceiver.kt` | 网络状态监听 |

**核心能力**:
- ✅ 支持100+常见App的DeepLink调用
- ✅ 应用扫描与能力识别
- ✅ 命令批量执行与取消
- ✅ 与云端Hub实时通信

#### 1.2 云端Hub (Cloud Hub)

**文件位置**: `server/services/cloud/CloudHub.ts`

**功能**:
- 设备注册与心跳
- 消息路由与转发
- 任务分发与状态追踪

#### 1.3 设备注册表 (Device Registry)

**文件位置**: `server/services/device/DeviceRegistry.ts`

**功能**:
- 设备信息存储
- 程序数据库同步
- 能力映射

#### 1.4 跨设备路由 (Cross Device Router)

**文件位置**: `server/services/device/CrossDeviceRouter.ts`

**功能**:
- 意图理解与分解
- 任务编排与分配
- 设备能力匹配

---

### 阶段二：API层 ✅

#### 2.1 API路由清单

| 路由前缀 | 功能 |
|----------|------|
| `/api/agent/*` | AI Agent核心能力 |
| `/api/agent/nl/*` | 自然语言处理 |
| `/api/assistant/*` | 混合助手 |
| `/api/cross-device/*` | 跨设备控制 |
| `/api/devices/*` | 设备管理 |
| `/api/pc-agent/*` | PC端控制 |
| `/api/knowledge/*` | 知识库管理 |
| `/api/coze/*` | 扣子AI调用 |
| `/api/proactive/*` | 主动服务 |
| `/api/recommend/*` | 智能推荐 |
| `/api/meeting/*` | 会议管理 |
| `/api/proactive/*` | 主动服务 |

---

### 阶段三：手机端Agent ✅

#### 3.1 Android权限矩阵

```kotlin
// 核心权限
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

// 设备控制
<uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
<uses-permission android:name="android.permission.WRITE_SETTINGS" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

// 通信能力
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.READ_CONTACTS" />

// 多媒体
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />

// 定位与存储
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

#### 3.2 已知App DeepLink映射

```kotlin
val commonIntentActions = mapOf(
    "打开微信"    -> DeepLink("weixin://", "com.tencent.mm"),
    "打开支付宝"  -> DeepLink("alipay://", "com.eg.android.AlipayGphone"),
    "打开钉钉"   -> DeepLink("dingtalk://", "com.alibaba.android.rimet"),
    "打开美团"   -> DeepLink("meituan://", "com.sankuai.meituan"),
    "打开滴滴"   -> DeepLink("didiclient://", "com.sdu.didi.psnger"),
    "打开高德"   -> DeepLink("amapuri://", "com.autonavi.minimap"),
    "打开百度地图"-> DeepLink("baidumap://", "com.baidu.BaiduMap"),
    "打开抖音"   -> DeepLink("snssdk1128://", "com.ss.android.ugc.aweme"),
    "打开B站"    -> DeepLink("bilibili://", "tv.danmaku.bili"),
    // ... 共50+ App
)
```

---

### 阶段四：电脑端Agent ✅

#### 4.1 PC Agent架构

```
PCAgent
├── FileOrganizerService     文件整理服务
│   ├── 目录扫描
│   ├── 文件分类
│   ├── 桌面整理
│   └── 归档压缩
├── OfficeAutomationService  办公自动化服务
│   ├── 文档模板
│   ├── 文档生成
│   ├── PPT制作
│   └── 格式排版
├── SystemOperationService   系统操作服务
│   ├── 系统信息
│   ├── 进程管理
│   ├── 网络配置
│   ├── 软件管理
│   └── 优化清理
└── ProgrammingAssistantService  编程助手服务
    ├── IDE集成
    ├── 代码模板
    ├── 项目管理
    └── Git操作
```

#### 4.2 办公自动化模板

| 模板ID | 名称 | 用途 |
|--------|------|------|
| `sci-tech-application` | 科技局项目申报 | 高新企业、科技项目申报 |
| `feasibility-report` | 可行性研究报告 | 项目立项、投资分析 |
| `contract-standard` | 标准合同模板 | 商务合作、劳动合同 |
| `proposal-standard` | 商业提案模板 | 项目提案、投标文件 |
| `meeting-minutes` | 会议纪要模板 | 会议记录、决议跟踪 |
| `weekly-report` | 周报模板 | 工作汇报、进度跟踪 |
| `project-plan` | 项目计划模板 | 项目管理、里程碑 |
| `data-analysis` | 数据分析报告 | 数据统计、趋势分析 |

#### 4.3 编程语言支持

```typescript
const SUPPORTED_LANGUAGES = {
  typescript: { ext: ['.ts', '.tsx'], script: 'npx ts-node' },
  javascript: { ext: ['.js', '.jsx'], script: 'node' },
  python: { ext: ['.py'], script: 'python' },
  java: { ext: ['.java'], script: 'javac' },
  kotlin: { ext: ['.kt'], script: 'kotlinc' },
  rust: { ext: ['.rs'], script: 'rustc' },
  go: { ext: ['.go'], script: 'go run' },
  csharp: { ext: ['.cs'], script: 'dotnet script' },
  cpp: { ext: ['.cpp', '.cc'], script: 'g++' },
  html: { ext: ['.html'], script: null },
  css: { ext: ['.css'], script: null },
  sql: { ext: ['.sql'], script: null },
  shell: { ext: ['.sh', '.bash'], script: 'bash' },
}
```

---

### 阶段五：知识库与学习 ✅

#### 5.1 程序知识库

**文件位置**: `server/services/knowledge/ProgramKnowledgeBase.ts`

**预装程序**:
- 社交类: 微信、钉钉、QQ
- 支付类: 支付宝、微信支付
- 导航类: 高德地图、百度地图
- 出行类: 滴滴、携程
- 电商类: 美团、淘宝、京东
- 视频类: 抖音、B站
- 开发类: VSCode、IntelliJ IDEA
- 文档类: WPS Office、Microsoft Office
- 浏览器类: Chrome、Edge
- 邮件类: Outlook、Gmail

#### 5.2 学习系统

```typescript
interface LearningLog {
  programId: string;
  operation: string;
  parameters: Record<string, unknown>;
  result: 'success' | 'failure';
  feedback?: string;
  timestamp: Date;
}
```

**学习策略**:
1. 执行成功 → 强化参数使用
2. 执行失败 → 分析原因，更新策略
3. 用户反馈 → 纠正错误
4. 批量学习 → 从历史中挖掘模式

#### 5.3 自动发现

```typescript
interface DiscoveredProgram {
  packageName: string;
  name: string;
  platform: 'android' | 'windows' | 'macos';
  deeplink?: string;
  website?: string;
  capabilities?: string[];
  confidence: number;
}
```

---

### 阶段六：扣子AI集成 ✅

#### 6.1 工作流注册表

| 分类 | 工作流 | 功能 |
|------|--------|------|
| 文档 | doc_format | 文档排版 |
| 文档 | doc_summary | 文档摘要 |
| 文档 | doc_translate | 文档翻译 |
| 文档 | doc_polish | 文章润色 |
| 商业 | report_generate | 报告生成 |
| 商业 | proposal_create | 方案撰写 |
| 商业 | contract_draft | 合同起草 |
| PPT | ppt_outline | PPT大纲 |
| PPT | ppt_content | PPT内容 |
| 数据 | data_analyze | 数据分析 |
| 数据 | chart_generate | 图表生成 |
| 代码 | code_review | 代码审查 |
| 代码 | code_explain | 代码解释 |
| 图像 | image_desc | 图像描述 |
| 图像 | ocr_extract | 文字识别 |

#### 6.2 环境变量配置

```bash
# 扣子AI
COZE_API_KEY=your_api_key
COZE_BOT_ID=your_bot_id
COZE_WORKFLOW_ID=default_workflow_id

# 文档处理
COZE_WORKFLOW_FORMAT=doc_format_workflow_id
COZE_WORKFLOW_POLISH=doc_polish_workflow_id
COZE_WORKFLOW_TRANSLATE=doc_translate_workflow_id
COZE_WORKFLOW_SUMMARIZE=doc_summary_workflow_id
COZE_WORKFLOW_PPT=ppt_workflow_id
COZE_WORKFLOW_REPORT=report_workflow_id
```

---

## 🔄 数据流

### 跨设备任务执行流程

```
用户语音/文字输入
    │
    ▼
HybridAssistant (意图理解)
    │
    ▼
CrossDeviceRouter (任务分解)
    │
    ├──► Mobile Agent ──► 执行命令 ──► 汇报结果
    │
    └──► PC Agent ─────► 执行任务 ──► 汇报结果
              │
              ▼
         云端Hub (协调)
              │
              ▼
         结果汇总 ──► 用户反馈
```

### PC端任务处理流程

```
接收任务
    │
    ▼
PCAgent.executeTask()
    │
    ├─► 文件整理 ──► FileOrganizerService
    │
    ├─► 文档生成 ──► OfficeAutomationService ──► CozeAPI (可选)
    │
    ├─► 系统操作 ──► SystemOperationService
    │
    └─► 编程任务 ──► ProgrammingAssistantService
              │
              ▼
         执行结果 ──► 格式化输出
```

---

## 🧪 测试验证

运行测试脚本:
```bash
cd server
npx ts-node scripts/system-test.ts
```

测试覆盖:
- ✅ 知识库模块
- ✅ 扣子AI模块
- ✅ 文件整理模块
- ✅ 办公自动化模块
- ✅ 系统操作模块
- ✅ 编程助手模块
- ✅ PC Agent模块

---

## 📝 使用示例

### 1. 跨设备控制

```typescript
// 发送命令到手机
POST /api/devices/:deviceId/command
{
  "command": "open_app",
  "parameters": {
    "package": "com.tencent.mm"
  }
}

// 发送命令到PC
POST /api/pc-agent/files/organize
{
  "source": "desktop",
  "action": "categorize"
}
```

### 2. 文档生成

```typescript
POST /api/coze/report/generate
{
  "type": "monthly",
  "data": {
    "sales": 100000,
    "costs": 60000
  },
  "period": "2026-04"
}
```

### 3. 知识库查询

```typescript
GET /api/knowledge/programs/match?intent=发消息给张三
POST /api/knowledge/discover
{
  "packageName": "com.example.app",
  "platform": "android"
}
```

---

## 🚀 后续优化建议

1. **性能优化**
   - 引入缓存层(Redis)
   - 并行任务执行
   - 增量同步

2. **功能增强**
   - 更多App的DeepLink支持
   - 屏幕录制与分析
   - 语音合成与播报

3. **安全加固**
   - 敏感操作二次确认
   - 操作日志审计
   - 权限分级管理

4. **用户体验**
   - 可视化任务看板
   - 操作历史回溯
   - 个性化推荐

---

*文档最后更新: 2026-04-19*

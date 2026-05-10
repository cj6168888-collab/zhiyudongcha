# PC Agent 使用指南 v1.0

电脑端智能助手，帮助用户自动执行文件整理、文档生成、系统优化、编程辅助等任务。

---

## 功能概览

PC Agent 是一个运行在电脑端的智能助手服务，提供以下核心能力：

| 功能 | 说明 |
|------|------|
| 文件整理 | 自动扫描、分类、归档桌面/下载文件夹 |
| 文档生成 | 基于模板生成各类办公文档 |
| 系统优化 | 清理临时文件、优化系统性能 |
| 编程辅助 | 代码生成、项目分析、Git操作 |

---

## 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                        PC Agent                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ FileOrganizer│  │  OfficeAuto  │  │ SystemOpt   │       │
│  │   Service    │  │   Service   │  │   Service   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│  ┌──────┴─────────────────┴─────────────────┴──────┐       │
│  │              ProgramKnowledgeBase                  │       │
│  │                  (知识库)                          │       │
│  └──────────────────────┬───────────────────────────┘       │
│                         │                                     │
│  ┌──────────────────────┴───────────────────────────┐       │
│  │              ProgramLearner                        │       │
│  │                (学习系统)                          │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │              ProgrammingAssistantService            │      │
│  │                  (编程助手)                         │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │                   Coze API                        │      │
│  │                  (AI能力)                          │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 1. 环境要求

- Node.js >= 18
- Windows/macOS/Linux
- 建议 8GB+ 内存

### 2. 配置 Coze API（可选）

在用户设置中配置 Coze API 密钥以启用 AI 增强功能：

```json
PATCH /api/user-settings/master
{
  "cozeEnabled": "true",
  "cozeApiKey": "your-api-key"
}
```

### 3. 调用示例

```bash
# 获取能力列表
curl http://localhost:3000/api/pc-agent/capabilities

# 执行文件整理任务
curl -X POST http://localhost:3000/api/pc-agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "file_organize",
    "description": "整理桌面文件",
    "params": {}
  }'
```

---

## 服务详解

### FileOrganizerService（文件整理服务）

#### 功能

- 扫描目录并统计文件
- 按类型/日期自动分组
- 桌面文件整理
- 下载文件夹整理
- 项目文件查找
- 政府文件归档
- 重复文件清理
- 创建文件归档

#### 使用示例

```typescript
import { fileOrganizerService } from './services/pc-agent/FileOrganizerService';

// 扫描桌面
const files = await fileOrganizerService.scanDirectory('C:\\Users\\Username\\Desktop');

// 按类型分组
const grouped = fileOrganizerService.groupByType(files);

// 按日期分组
const byDate = fileOrganizerService.groupByDate(files);

// 整理桌面
const result = await fileOrganizerService.organizeDesktop({
  source: 'desktop',
  targetFolder: '桌面整理',
  groupBy: 'type'
});
```

#### 文件类型识别

| 类型 | 扩展名 |
|------|--------|
| document | .doc, .docx, .pdf, .txt, .ppt, .pptx, .xls, .xlsx |
| image | .jpg, .jpeg, .png, .gif, .bmp, .svg, .webp |
| video | .mp4, .avi, .mkv, .mov, .wmv |
| audio | .mp3, .wav, .flac, .aac, .ogg |
| code | .js, .ts, .py, .java, .cpp, .c, .h, .css, .html |
| archive | .zip, .rar, .7z, .tar, .gz |

---

### OfficeAutomationService（办公自动化服务）

#### 预设模板

| 模板ID | 名称 | 说明 |
|--------|------|------|
| sci-tech-application | 科技计划项目申报书 | 科技项目申报文档 |
| meeting-minutes | 会议纪要 | 标准会议记录模板 |
| work-plan | 工作计划 | 周/月/季度工作计划 |
| project-proposal | 项目提案 | 商业项目建议书 |
| daily-report | 工作日报 | 日常工作报告 |

#### 使用示例

```typescript
import { officeAutomationService } from './services/pc-agent/OfficeAutomationService';

// 获取模板列表
const templates = officeAutomationService.getTemplates();

// 生成文档
const result = await officeAutomationService.generateDocument({
  type: 'sci-tech-application',
  title: 'AI应用研究项目',
  variables: {
    projectName: '智能助手研究',
    companyName: 'XX科技有限公司',
    budget: 500000
  },
  format: 'docx',
  style: 'formal'
});
```

#### 输出位置

生成的文件保存在用户文档目录：

```
C:\Users\<用户名>\Documents\小星生成\
```

---

### SystemOperationService（系统操作服务）

#### 功能

- 获取系统信息（OS、CPU、内存、磁盘）
- 进程管理（列表、终止）
- 网络诊断（连通性测试、延迟检测）
- 系统优化（清理临时文件、清理浏览器缓存）
- 服务管理（Windows服务操作）

#### 使用示例

```typescript
import { systemOperationService } from './services/pc-agent/SystemOperationService';

// 获取系统信息
const sysInfo = systemOperationService.getSystemInfo();
console.log(`平台: ${sysInfo.platform}`);
console.log(`内存使用: ${sysInfo.memory.usagePercent}%`);

// 获取进程列表
const processes = await systemOperationService.getProcessList();
console.log(`运行中进程: ${processes.length}`);

// 测试网络连接
const ping = await systemOperationService.testConnection('www.google.com');
console.log(`Google可达: ${ping.reachable}`);

// 执行系统优化
const optimize = await systemOperationService.optimizeSystem();
console.log(`清理临时文件: ${optimize.tempFiles.cleaned}个`);
```

---

### ProgrammingAssistantService（编程助手服务）

#### 功能

- IDE检测（VS Code、IntelliJ、Vim等）
- 代码文件创建
- 项目结构分析
- 代码文件搜索
- 开发文档搜索
- Git操作（状态、分支管理）
- 项目创建

#### 支持的编程语言

| 语言 | 扩展名 | 框架 |
|------|--------|------|
| JavaScript | .js | Node.js, Express |
| TypeScript | .ts | NestJS, React |
| Python | .py | Django, Flask, FastAPI |
| Java | .java | Spring Boot |
| C++ | .cpp, .h | Qt, STL |
| C# | .cs | .NET, Unity |
| Go | .go | Gin, Echo |
| Rust | .rs | Actix, Tokio |
| Ruby | .rb | Rails, Sinatra |
| PHP | .php | Laravel, Symfony |

#### 使用示例

```typescript
import { programmingAssistantService } from './services/pc-agent/ProgrammingAssistantService';

// 检测IDE
const hasVSCode = await programmingAssistantService.detectIDE('vscode');

// 分析项目
const project = await programmingAssistantService.readProjectStructure('/path/to/project');
console.log(`项目: ${project.name}, 语言: ${project.language}`);

// 获取Git状态
const gitStatus = await programmingAssistantService.getGitStatus('/path/to/repo');
console.log(`分支: ${gitStatus.branch}`);
console.log(`变更: ${gitStatus.changes.length}`);

// 创建代码文件
await programmingAssistantService.createCodeFile({
  language: 'typescript',
  path: '/project/test.ts',
  template: 'interface'
});
```

---

### ProgramKnowledgeBase（程序知识库）

#### 功能

- 程序数据库管理（35+预置程序）
- 程序搜索
- 分类统计
- 意图匹配
- 操作推荐

#### 预置程序分类

| 分类 | 程序示例 |
|------|----------|
| communication | 微信、QQ、钉钉、飞书 |
| browser | Chrome、Firefox、Edge |
| development | VS Code、IntelliJ IDEA、Git |
| media | QQ音乐、网易云音乐、PotPlayer |
| office | Word、Excel、PowerPoint |
| system | 文件资源管理器、任务管理器、终端 |
| utilities | WinRAR、7-Zip、Everything |
| gaming | Steam、Epic Games |
| other | PDF阅读器、截图工具 |

#### 使用示例

```typescript
import { programKnowledgeBase } from './services/knowledge/ProgramKnowledgeBase';

// 获取所有程序
const programs = programKnowledgeBase.getAllPrograms();

// 搜索程序
const results = programKnowledgeBase.searchPrograms('微信');

// 按分类获取
const devTools = programKnowledgeBase.getProgramsByCategory('development');

// 意图匹配
const matches = programKnowledgeBase.matchIntent('帮我发消息');
console.log(`推荐: ${matches[0].programName} - ${matches[0].operation}`);
```

---

### ProgramLearner（程序学习系统）

#### 功能

- 记录操作学习数据
- 统计分析
- 建议生成
- 日志导出

#### 使用示例

```typescript
import { programLearner } from './services/knowledge/ProgramLearner';

// 记录学习
await programLearner.record({
  programId: 'wechat',
  operation: 'send_message',
  duration: 1500,
  success: true,
  context: '发送给张三'
});

// 获取统计
const stats = programLearner.getStatistics();
console.log(`学习记录: ${stats.totalLogs}`);
console.log(`成功率: ${(stats.successRate * 100).toFixed(1)}%`);

// 获取建议
console.log(stats.recommendations);
```

---

## API 参考

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/pc-agent/capabilities` | GET | 获取能力列表 |
| `/api/pc-agent/execute` | POST | 执行任务 |
| `/api/pc-agent/status` | GET | 获取状态 |
| `/api/knowledge/programs` | GET | 程序列表 |
| `/api/knowledge/search` | GET | 搜索程序 |
| `/api/knowledge/learn` | POST | 记录学习 |
| `/api/knowledge/stats` | GET | 学习统计 |

### 任务类型

| 类型 | 服务 | 说明 |
|------|------|------|
| `file_organize` | FileOrganizerService | 文件整理 |
| `document_generate` | OfficeAutomationService | 文档生成 |
| `system_optimize` | SystemOperationService | 系统优化 |
| `programming_assist` | ProgrammingAssistantService | 编程辅助 |

---

## 最佳实践

### 1. 文件整理

```typescript
// 推荐：分批处理大量文件
const batchSize = 100;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await processBatch(batch);
}

// 推荐：使用日期分组便于查找
const organized = await fileOrganizerService.organizeDesktop({
  source: 'downloads',
  groupBy: 'date'
});
```

### 2. 文档生成

```typescript
// 推荐：使用Coze API增强生成质量
const result = await officeAutomationService.generateDocument({
  type: 'sci-tech-application',
  title: '项目申报',
  variables: {
    projectName: 'AI研究',
    companyName: 'XX公司'
  }
});

// 查看生成的文件
console.log(result.filePath);
```

### 3. 系统优化

```typescript
// 推荐：定期执行优化
const optimize = await systemOperationService.optimizeSystem();
// 清理: tempFiles.cleaned, browserCache.cleaned

// 推荐：监控内存使用
const sysInfo = systemOperationService.getSystemInfo();
if (sysInfo.memory.usagePercent > 80) {
  console.warn('内存使用率高，建议优化');
}
```

---

## 故障排除

### Coze API 未配置

```
[warn] Coze API key not configured
```

**解决：** 在用户设置中配置 Coze API 密钥

### 文件访问权限不足

```
[error] Access denied: /path/to/file
```

**解决：** 确保程序有足够的文件系统权限

### 进程列表获取失败

```
[error] Failed to get process list: wmic not found
```

**解决：** Windows 11 可能需要使用 PowerShell 命令替代 WMIC

---

*文档版本: 1.0*
*最后更新: 2026-04-19*

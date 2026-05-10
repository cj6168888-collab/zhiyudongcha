# 小智 (Avatar) 一键部署指南

## 部署包内容

构建完成后的 `dist/` 目录包含：

```
dist/
├── index.cjs          # 后端服务 (3.1MB 压缩打包)
└── public/            # 前端静态资源
    ├── index.html     # 入口页面
    └── assets/        # JS/CSS/图片资源
```

**总大小**: ~9MB

## 环境变量要求

部署前确保配置以下环境变量：

### 必需
- `DATABASE_URL` - PostgreSQL 数据库连接字符串
- `SESSION_SECRET` - 会话加密密钥

### 可选 (AI服务)
- `DASHSCOPE_API_KEY` - 阿里云DashScope API密钥 (主要AI服务)
- `DEEPSEEK_API_KEY` - DeepSeek API密钥
- `DOUBAO_API_KEY` - 字节豆包API密钥

## 部署命令

### 构建
```bash
npm run build
```

### 生产环境启动
```bash
npm run start
```

服务将在端口 5000 启动。

## Replit 部署

项目已配置为 Replit Cloud Run 部署：

1. 点击 Replit 界面的 **Deploy** 按钮
2. 选择 **Production** 环境
3. 确认环境变量已配置
4. 点击 **Deploy** 完成发布

## 功能模块清单 (23+ 服务)

### 核心协议
- Z1 智能路由层
- Z3 Spirit 灵魂单例
- 六脑合一蜂群系统

### Phase 8-10 实时交互
- 实时语音对话 (WebRTC/VAD)
- 流式TTS语音合成
- 打断处理服务
- RAG知识库
- Function Calling
- MCP协议集成

### Phase 11 高级功能
- MCTS博弈推演引擎 (万次模拟)
- 技术狩猎系统 (三源监控)
- 蜂群管理协议 (分布式实体)
- 屏幕穿透服务 (UI自动化)
- 数据血缘追踪 (知识图谱)
- 战备报告生成器 (风险预警)

### 生活管理
- 守护天使健康管理
- 营养追踪
- 智能日程
- 提醒调度器
- 合同管道

### 安全防护
- 零幻觉回路
- 免疫系统
- 最后防线协议
- 秘密金库

## API 端点概览

| 模块 | 路径 | 功能 |
|------|------|------|
| MCTS | /api/mcts/* | 博弈推演 |
| Tech Hunter | /api/tech/* | 技术发现 |
| Swarm | /api/swarm/* | 蜂群管理 |
| Screen | /api/screen/* | 屏幕穿透 |
| Lineage | /api/lineage/* | 数据血缘 |
| Report | /api/report/* | 战备报告 |
| RAG | /api/rag/* | 知识检索 |
| Functions | /api/functions/* | 工具调用 |
| MCP | /api/mcp/* | 协议桥接 |
| Health | /api/health/* | 健康检查 |

## 健康检查

部署后验证服务状态：

```bash
curl https://your-domain/api/health/live
curl https://your-domain/api/health/ready
```

## 版本信息

- **系统版本**: 1.0.0
- **Phase**: 11.6 (全功能版)
- **构建日期**: 2026-01-26

# 生语助手落地运行手册

本文记录当前项目可稳定执行的本地交付路径：安装依赖、准备数据库、运行迁移、构建、启动和验证。

## 1. 环境准备

```bash
npm install --legacy-peer-deps
cp .env.example .env
```

`.env` 至少需要配置：

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sheng_yu_zhu_shou
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=false
SESSION_SECRET=replace-with-a-long-random-secret
AVATAR_MASTER_SECRET=replace-with-at-least-64-random-characters-for-avatar-auth-secret
MASTER_SECRET=replace-with-at-least-64-random-characters-for-secure-config-secret
```

如果使用本仓库的开发数据库服务：

```bash
docker compose -f docker-compose.dev.yml up -d database redis
```

完整容器化启动会先等待 PostgreSQL/Redis 健康、执行 Drizzle 迁移，然后启动应用：

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Docker Desktop 正常时，可用一条命令完成容器构建、启动、健康检查和关键 API 验收；默认验收结束后会 `docker compose down`：

```bash
npm run deploy:docker-smoke
```

需要保留容器继续手工检查时：

```bash
npm run deploy:docker-smoke -- --keep
```

当前默认应用镜像覆盖核心 Web/API 服务。服务端 BrowserAgent 已将 `playwright` 作为生产依赖加载；如需在容器内真实启动 Chromium 自动化，应使用带浏览器运行时的专用镜像，或在镜像中安装 Chromium 并设置 `CHROMIUM_EXECUTABLE_PATH`。

生产部署前复制生产模板并替换所有占位符：

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

生产环境会强制要求 `DATABASE_URL`、`SESSION_SECRET`、`AVATAR_MASTER_SECRET`、`MASTER_SECRET`，且拒绝本地默认密钥和 `replace-with...` 占位符。

## 2. 数据库迁移

项目使用 Drizzle ORM，schema 入口为 `shared/schema.ts`，迁移目录为 `migrations/`。

```bash
npm run db:generate
npm run db:migrate
```

常用命令：

```bash
npm run db:generate  # 根据 shared/schema.ts 生成迁移
npm run db:migrate   # 将 migrations/ 应用到 DATABASE_URL
npm run db:push      # 开发环境快速同步 schema，不建议直接用于生产
npm run db:studio    # 打开 Drizzle Studio
```

注意：本地 Docker/PostgreSQL 默认不启用 SSL，保持 `DATABASE_SSL=false`。云数据库需要 SSL 时设置 `DATABASE_SSL=true` 或 `PGSSLMODE=require`；如证书链由平台托管，可按供应商要求设置 `DATABASE_SSL_REJECT_UNAUTHORIZED=false`。

## 3. 构建与测试

```bash
npm run test:unit
npm run test:api
npm run build
npm run deploy:smoke
npm run deploy:docker-smoke
```

R1 发布前必须额外运行第一产品闭环门禁。该命令会构建、执行数据库迁移、启动一份本地服务、等待 `/api/health`，再运行 assistant 真实 smoke，确认聊天入口能真实写入项目、任务和记忆，确认删除、密钥外发、支付、隐私外发等高风险意图被正确拦截，并用 Playwright 打开生产 `/chat` 与 `/desktop/chat` 页面验证真实 UI 回流、风险拒绝展示、支付确认卡以及执行/取消按钮：

```bash
npm run release:r1-gate
```

本地已经完成构建和迁移、只想快速复验 assistant 闭环时：

```bash
npm run release:r1-gate -- --skip-build --skip-migrate
```

GitHub Actions 中提供了手动工作流 `R1 Release Gate`。触发前至少配置一个真实 AI Provider Secret：`DASHSCOPE_API_KEY`、`DEEPSEEK_API_KEY` 或 `DOUBAO_API_KEY`。

当前基线：

- Unit: 30 个测试文件通过，546 passed，3 skipped
- API: 31 个测试文件通过，212 passed（实测 2026-04-30）
- Build: 前端 Vite 构建和后端 esbuild 打包通过（实测 2026-04-30；Vite 大 chunk 警告仍存在）
- R1 Assistant Gate: `create_project` / `create_task` / `save_memory` 真实写入通过；删除/密钥外发拒绝，支付/隐私外发要求确认；生产 `/chat` 和 `/desktop/chat` UI 能展示执行结果、风险拦截文案、确认卡和执行/取消按钮（快速模式实测 2026-04-30）

## 4. 启动与健康检查

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

当数据库还没有就绪时，`/api/health` 会返回 degraded 状态而不是让服务启动失败，便于先验证应用进程和基础路由。当前健康路由回归也覆盖了多节点负载升为 `MEDIUM`，以及启动期 Coze 设置同步失败不阻塞健康检查。

生产模式会同时托管 `dist/public` 前端资源，并对非 API 的 GET 请求返回 `index.html`，支持 `/desktop`、`/remote-pc`、`/tasks` 等前端深链直接访问。

## 5. 已纳入回归的核心接口

```bash
curl http://localhost:3000/api/models/status
curl http://localhost:3000/api/remote/status
curl http://localhost:3000/api/remote/devices
curl http://localhost:3000/api/tasks
curl http://localhost:3000/api/tasks/executions/all?limit=5
```

这些接口已进入 `npm run test:api`：

- `/api/models/*`: 私有模型同步状态、云 provider 聚合、同步触发与启动异常映射
- `/api/remote/*`: OpenClaw 远程控制状态、设备列表、设备详情、截图、控制命令、会话脱敏与健康状态
- `/api/tasks/*`: 任务编排列表与执行历史

## 6. 浏览器烟测路径

```bash
/
/desktop
/remote-pc
/tasks
```

当前验证标准：React root 已挂载、页面有可见正文、无 4xx/5xx 请求、无 console error。

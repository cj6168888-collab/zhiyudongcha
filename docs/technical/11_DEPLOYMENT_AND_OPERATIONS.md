# 部署与运维

## 目标

部署和运维必须支撑长期运行、数据安全、密钥安全和快速回滚。

## 环境

推荐至少区分：

- development。
- staging。
- production。

## Docker

Docker 是本地和生产部署的主路径之一。

相关文件：

- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `server/Dockerfile`
- `scripts/docker-smoke.mjs`

## 环境变量

要求：

- `.env.example` 只放模板。
- `.env.production.example` 只放模板。
- 真实 `.env` 和 `.env.production` 不提交。
- 密钥泄露后必须轮换。

## 密钥管理

涉及：

- AI provider key。
- JWT secret。
- session secret。
- database password。
- Redis password。
- third-party OAuth secret。

生产环境应使用独立密钥管理方案或部署平台 secret。

## 数据备份

必须备份：

- PostgreSQL。
- 上传文件。
- 记忆原始资料索引。
- 关键配置。

涉及永久记忆的删除和迁移前必须确认备份策略。

## 日志

日志应包含：

- requestId。
- user/session。
- route。
- riskLevel。
- errorCode。
- duration。

不要在日志中输出密钥、验证码、完整敏感内容。

## 健康检查

至少检查：

- HTTP 服务。
- 数据库。
- Redis。
- AI provider 可用性。
- WebSocket。
- 关键队列/任务。

## 发布前检查

发布前至少：

```bash
npm run build
npm run test:api
npm run deploy:docker-smoke
```

根据改动范围增加 E2E、移动端或安全测试。

## 回滚

每次发布应能回答：

- 当前版本是什么。
- 数据库是否有迁移。
- 是否可回滚。
- 回滚是否影响记忆和文件。
- 是否需要停止任务执行器。

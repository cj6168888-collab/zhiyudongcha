# Pocket-Master API 文档 v1.0

---
## 概述
Pocket-Master 是基于 AI 的命理与占卜系统，提供每日运势、签到、订阅、支付、消息、祭坛进度以及多种 AI 占卜功能。所有接口遵循统一的请求/响应格式，并使用真实的大模型（OpenAI / 通义千问）进行 AI 推理。

---
## 认证与授权
- **必需请求头**
  ```
  Content-Type: application/json
  X-Device-Id: <device-id>   # 客户端唯一标识
  X-Role: MASTER | GUEST    # 权限角色
  ```
- **可选请求头**
  ```
  X-Request-Id: <uuid>       # 用于链路追踪
  Accept-Language: zh-CN|en  # 语言偏好
  ```

---
## 统一响应格式
### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-04-19T00:00:00Z",
    "requestId": "req_abcdef123456"
  }
}
```
### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "E1002",
    "message": "资源未找到",
    "details": { "resource": "person", "id": "123" }
  },
  "meta": {
    "timestamp": "2026-04-19T00:00:00Z",
    "requestId": "req_abcdef123456"
  }
}
```
---
## 错误码规范
| 范围 | 类别 | 示例 |
|------|------|------|
| E1xxx | 通用错误 | E1000-内部错误, E1001-验证失败, E1002-未找到 |
| E2xxx | AI服务错误 | E2000-服务不可用, E2001-配额超限 |
| E3xxx | 业务错误 | E3001-运势未生成, E3002-支付失败 |
| E4xxx | 认证授权 | E4001-未认证, E4002-权限不足 |
| E5xxx | 外部服务 | E5001-微信支付回调错误 |
---
## 限流
| 接口类型 | 限制 |
|----------|------|
| 普通 API | 200 次/分钟 |
| AI 对话/占卜 | 30 次/分钟 |
| 微信支付回调 | 10 次/分钟 |
---
## 核心 API 列表
### 每日运势
- **GET /api/daily-fortune**
  - 描述：获取当前设备当天的运势，若不存在则实时调用大模型生成。
  - 请求头：`X-Device-Id`
  - 响应示例：
    ```json
    {
      "success": true,
      "data": {
        "date": "2026-04-19",
        "content": "【整体】4星，事业顺利，建议多与同事沟通。..."
      }
    }
    ```
- **GET /api/daily-fortune/:date**
  - 描述：获取指定日期的运势，若缺失同上生成。
- **POST /api/daily-fortune/checkin**
  - 描述：每日签到，随机奖励并记录为运势记录。
  - 响应示例：
    ```json
    {
      "success": true,
      "data": { "date": "2026-04-19", "reward": "功德+2", "message": "签到成功！获得功德+2" }
    }
    ```

### 会员订阅
- **GET /api/fortune/subscription**
  - 返回当前会员等级、到期时间以及可用特权。
- **POST /api/fortune/subscription**
  - 请求体：`{ "tier": "premium", "expiresAt": "2027-04-19" }`
  - 用于升级/续费会员。

### 消息系统
- **GET /api/messages**
  - 获取用户私信/系统消息列表（持久化）。
- **POST /api/messages**
  - 请求体：`{ "content": "反馈内容", "type": "feedback" }`
  - 将消息写入 `messages` 表。
- **GET /api/messages/unread-count**
  - 返回未读消息数量。

### 祭坛进度
- **GET /api/altar**
  - 返回当前用户的祭坛章节、经验、等级等信息。
- **POST /api/altar/progress**
  - 请求体：`{ "sectId": "sect_01", "courseId": "course_03", "experience": 120 }`
  - 更新祭坛进度并返回最新状态。

### 支付（微信）
- **POST /api/payment/create**
  - 请求体：`{ "planId": "premium_month", "paymentMethod": "wechat" }`
  - 返回 `orderId`, `outTradeNo`, `qrCodeUrl`（二维码 URL），并在后台生成微信统一下单。
- **POST /api/payment/callback/wechat**
  - 微信支付回调（XML），系统校验签名后更新订单状态、激活会员。

### AI 视觉分析
- **POST /api/vision/analyze**
  - 请求体：`{ "imageUrl": "https://.../photo.jpg" }`
  - 调用大模型（通义千问）进行面相、舌诊等分析，返回结构化结果。

### 占卜系列（基于大模型）
| 路径 | 功能 |
|------|------|
| POST /api/divination/number-energy | 数字能量占卜 |
| POST /api/divination/caishen | 财神降临占卜 |
| POST /api/divination/zeji | 泽吉占卜 |
| POST /api/divination/luban | 鲁班造物占卜 |
| POST /api/divination/qimen | 奇门遁甲占卜 |
| POST /api/divination/compatibility | 兼容性分析 |
| POST /api/divination/followup | 后续运势追踪 |
| POST /api/fengshui/analysis | 风水布局分析 |
- 所有占卜接口接受统一请求体 `{ "question": "...", "context": { ... } }`，返回 AI 生成的文字报告以及结构化评分。

### 健康检查
- **GET /api/health/live** – 存活探针
- **GET /api/health/ready** – 就绪探针（检查 DB、Redis、AI 服务连通性）
- **GET /api/health/ai** – 返回 AI 服务状态（模型加载、配额）

---
## 构建与上线
1. **本地构建**
   ```bash
   npm install
   npm run build   # 生成 dist/ 目录
   ```
2. **Docker 镜像**
   ```dockerfile
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY . .
   RUN npm ci && npm run build
   FROM node:20-alpine
   WORKDIR /app
   COPY --from=builder /app/dist ./dist
   COPY package.json .
   RUN npm ci --production
   CMD ["node", "dist/index.cjs"]
   ```
   构建并推送：`docker build -t pocket-master:latest . && docker push your-registry/pocket-master:latest`
3. **环境变量**（必填）
   - `DATABASE_URL` – PostgreSQL 连接串
   - `REDIS_URL` – Redis 连接
   - `WECHAT_PAY_APPID`, `WECHAT_PAY_MCH_ID`, `WECHAT_PAY_API_V3_KEY` – 微信支付配置
   - `OPENAI_API_KEY` / `TONGYI_API_KEY` – 大模型密钥
4. **部署**
   - 使用 `pm2 start dist/index.cjs --name pocket-master` 或 Kubernetes Deployment。
   - 确保 `health` 探针配置在容器编排平台。
5. **监控**
   - Sentry 已集成，日志通过 `logger` 自动上报。
   - Prometheus metrics 可通过 `/metrics`（已在 `metrics.routes.ts` 中实现）收集。

---
*文档版本: 1.0*
*最后更新: 2026-04-19*

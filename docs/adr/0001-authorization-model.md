# ADR 0001：授权模型（会话主体 + 持久化 grants）

## 状态

已采纳（2026-04-19）

## 背景

- 现有会话仅有 `MASTER` / `GUEST`，无法满足 [CONSTITUTION.md](../CONSTITUTION.md) 要求的可枚举、可审计授权。
- [CAPABILITY_MATRIX.md](../CAPABILITY_MATRIX.md) 已定义 `ResourceType` / `ActionType` / `PermissionScope` 与 Navigator 枚举对齐。

## 决策

1. **主体（Principal）**  
   - 现阶段以 **`SESSION` 为主键**：`principal_id = express-session 的 session id`。  
   - 预留 **`USER`**：未来与 `users.id` 对齐，迁移时可将会话授权拷贝或合并到用户级。

2. **持久化**  
   - 表 **`authz_grants`**：一行表示一条 `(resource, action, scope)` 在某一 `(principal_kind, principal_id, workspace_id)` 下的授予。  
   - `workspace_id` 空字符串表示「个人默认空间」；组织轨后续使用非空 workspace id。

3. **生效策略（过渡期）**  
   - 若数据库中 **无任何行**：使用 **legacy_fallback**（代码内静态集合），避免在未跑迁移时全站 403。  
   - **`MASTER`**：fallback 视为「宽权限」，与当前「主人」体验一致。  
   - **`GUEST`**：fallback 为最小可读集合（含 `VAULT` + `CHAT` 等），与历史匿名/访客体验大致兼容。  
   - 一旦存在 **任意 DB 行**：以 **数据库为准**，不再叠加 fallback（便于管理员收紧）。

4. **中间件**  
   - `attachAuthzContext`：在路由前加载 `req.authz`。  
   - `requireResourceGrant(resource, action)`：对敏感路由做校验；**过渡期 `MASTER` 仍走快速放行**（代码内 TODO，待用户级模型稳定后收紧）。

5. **与 Navigator**  
   - 字符串枚举与 `server/services/navigator-core.ts` 中 `ResourceType` / `ActionType` **保持一致**；校验逻辑不依赖 Navigator 运行时。

## 后果

- 需执行迁移：`migrations/004_authz_grants.sql`。  
- 调试接口：`GET /api/authz/effective`（返回当前会话生效授权摘要，含 `sessionUserId` 若已绑定）。  
- **USER 主体合并**：若 `req.session.userId` 已设置，则同时加载 `principal_kind=USER` 且 `principal_id=userId` 的行，并与 SESSION 行 **去重合并**；两侧均无库内行时仍走 legacy_fallback。  
- **管理 API（均需 MASTER）**：  
  - `GET /api/authz/grants` — 查询参数 `principalKind`、`principalId`、`workspaceId`、`limit`  
  - `POST /api/authz/grants` — 新增一行（唯一键冲突 → 409）  
  - `DELETE /api/authz/grants/:id` — 按主键删除  
  - `POST /api/authz/session/bind-user` / `DELETE /api/authz/session/bind-user` — 绑定或解除当前会话与业务 `userId`（便于联调 USER 授权）  
- 后续迭代：登录流自动写入 `session.userId`、取消 `requireResourceGrant` 对 MASTER 的快速放行、PUT 覆盖授权。

## 相关文件

- `shared/schema.ts` — `authzGrants`  
- `server/services/authz/effective-grants.ts`  
- `server/middleware/authorization.ts`  
- `server/routes/authz.ts`

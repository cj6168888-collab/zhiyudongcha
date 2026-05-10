# ADR-0005: 双路由入口的现状与收敛策略

> 日期：2026-04-29
> 状态：已接受（过渡决策，待 P1 阶段完成后升级）
> 决策者：架构师

---

## 背景

项目存在两套路由注册逻辑，现状如下：

- `server/routes.ts`：当前活跃入口，由 `server/index.ts` 直接调用 `registerRoutes(httpServer, app)`，实际挂载所有 HTTP 路由和 WebSocket。
- `server/routes/index.ts`：包含 `registerAllRoutes`，是历史重构时建立的模块化路由聚合，但**未被** `server/index.ts` 调用，不是当前活跃路径。

这一现状导致：
1. 新开发者不知道改哪个文件。
2. 同名函数（`registerRoutes` vs `registerAllRoutes`）混淆代码搜索。
3. 部分旧文档（已归档）错误描述了 `registerAllRoutes` 为主入口。
4. 新路由模块被加入 `server/routes/index.ts` 时不会生效。

---

## 决策

**维持 `server/routes.ts` 为唯一活跃入口，`server/routes/index.ts` 的 `registerAllRoutes` 标记为废弃（Deprecated），不再新增路由到其中。**

新路由必须注册到 `server/routes.ts` 或其调用的子模块（`server/routes/` 下的具体文件）。

---

## 考虑过的方案

### 方案 A：维持现状，仅文档化（当前选择）

在 README 和本 ADR 中明确说明入口，短期内不做代码合并。

优点：
- 零风险，不破坏可运行主链。
- 可以在补测试后再做合并，降低引入回归的概率。

缺点：
- 两个文件仍然共存，继续制造混淆。
- 需要人为纪律，不是结构性保障。

### 方案 B：立即合并为 `server/routes/index.ts` 主导

将 `server/routes.ts` 的内容迁移到 `server/routes/index.ts`，由后者成为唯一入口。

优点：
- 消除混淆，模块化结构更清晰。
- 符合最初模块化架构设计意图。

缺点：
- `server/routes.ts` 包含 582 行、94 个 import，迁移风险高。
- 当前测试覆盖率仅 ~10%，迁移后回归风险无法可靠检测。

为什么未选择：当前阶段风险高于收益，待测试覆盖率达到 40% 以上再执行。

### 方案 C：废弃 `server/routes/index.ts`，只保留 `server/routes.ts`

删除 `registerAllRoutes`，统一由 `server/routes.ts` 内联注册。

优点：
- 消除混淆最彻底。

缺点：
- `server/routes.ts` 已经 582 行，继续膨胀违反单文件行数原则。
- 长期方向应该是模块化，而不是集中化。

为什么未选择：方向相反，不符合架构演进目标。

---

## 后果

**正面影响：**
- 新开发者只需看 README 中的入口说明，不会迷路。
- 不引入任何回归风险。

**负面影响 / 接受的代价：**
- 两文件共存状态持续到 P1 阶段完成。
- 依赖人为纪律（PR checklist）而非结构性保障。

**需要配套的行动：**
- README.md 已注明入口以 `server/routes.ts` 为准。
- `server/routes/index.ts` 顶部添加 Deprecated 注释（待执行）。
- 在 `server/routes.ts` 顶部添加注释说明这是活跃入口（待执行）。

---

## 触发重新决定的条件

当以下任一条件成立时，应执行方案 B（迁移到模块化入口）：

- 核心服务测试覆盖率达到 40%+。
- `server/routes.ts` 行数超过 700 行（需要强制拆分）。
- 出现因入口混淆导致的生产事故。

---

## 关联

- 影响文档：`README.md`（已注明），`docs/technical/16_API_LIVE_CONTRACT.md`
- 相关代码：`server/index.ts`、`server/routes.ts`、`server/routes/index.ts`
- 后续 ADR：待测试覆盖率达标后新增"路由模块化迁移"ADR

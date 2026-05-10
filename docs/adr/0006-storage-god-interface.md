# ADR-0006: storage.ts God Interface 的渐进式分解策略

> 日期：2026-04-29
> 状态：已接受（过渡决策）
> 决策者：架构师

---

## 背景

`server/storage.ts` 当前约 1700 行，暴露 200+ 个方法的单一 `IStorage` 接口，被全局依赖。它的问题：

1. 违反单一职责原则：持久化、业务查询、缓存逻辑混杂。
2. 所有服务直接依赖 `IStorage`，任何 schema 变更都可能波及全局。
3. 接口过大，无法做局部 mock，测试成本极高。
4. 已有 `server/storage/domains/` 领域 Storage 的初步设计，但尚未被主链使用。

---

## 决策

**不立即重写，采用"绞杀者模式"渐进分解：新代码不依赖 `IStorage`，改用 `server/storage/domains/` 下的领域 Repository；旧代码触及时逐步迁移；`storage.ts` 作为遗留层保持可运行。**

---

## 考虑过的方案

### 方案 A：渐进绞杀（当前选择）

新功能和被改动的旧代码逐步切换到领域 Repository。`storage.ts` 缩减到零依赖后删除。

优点：
- 不破坏可运行主链。
- 可与功能开发并行进行。
- 每次迁移范围可控，回归风险低。

缺点：
- 过渡期两套 API 并存，新成员需要知道规则。
- 需要持续纪律，容易被优先级压死。

### 方案 B：一次性重写

暂停功能开发，用 2-3 周完整重构 `storage.ts`。

优点：
- 一次性消除技术债务。

缺点：
- 当前测试覆盖率 ~10%，重写期间回归风险极高。
- 暂停功能开发时间窗口过长。
- 历史证明此类"一次性重写"计划经常失败。

为什么未选择：风险不可控。

### 方案 C：维持现状，仅文档化

优点：零风险。

为什么未选择：`storage.ts` 是当前测试覆盖率低的主要原因之一，不处理会持续阻碍测试质量提升。

---

## 后果

**正面影响：**
- 新代码从一开始就有领域隔离，不继续扩大 God Interface。
- 每个领域 Repository 可以独立 mock，测试成本降低。

**负面影响 / 接受的代价：**
- 过渡期 `storage.ts` 和 `domains/` 并存。
- 需要明确规则：新代码用 `domains/`，PR checklist 要检查。

**需要配套的行动：**
- `server/storage/domains/` 目录下新增领域 Repository 时，同步从 `storage.ts` 删除对应方法。
- `server/storage.ts` 顶部添加注释：遗留层，新代码使用 `server/storage/domains/`。
- 每季度评估 `storage.ts` 行数减少进度。

---

## 触发重新决定的条件

- `storage.ts` 行数降到 500 行以下：评估是否可以直接删除剩余。
- 出现因双轨并存导致的数据一致性 Bug：立即升级为 P0 强制迁移。

---

## 关联

- 影响文档：`docs/technical/02_CODE_ORGANIZATION.md`、`docs/technical/13_ENGINEERING_CONSISTENCY.md`
- 相关代码：`server/storage.ts`、`server/storage/domains/`
- 依赖 ADR：ADR-0001（授权模型）、ADR-0003（记忆数据治理）

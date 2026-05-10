# 历史文档归档说明

## 目的

本目录用于保存旧阶段报告、旧计划、旧审计和旧架构文档。归档不是删除，而是降低当前文档噪音，保留历史依据。

归档文档保留的是历史语境，内部相对链接可能因迁移而失效。若归档内容与当前权威文档冲突，以当前权威入口和 `CURRENT_STATE.md` 为准。

当前权威入口仍是：

- [../00_CANONICAL_INDEX.md](../00_CANONICAL_INDEX.md)
- [../../CURRENT_STATE.md](../../CURRENT_STATE.md)

## 建议目录

```text
docs/archive/
  audits/
  old-roadmaps/
  legacy-architecture/
  phase-reports/
  ux-history/
  deployment-history/
```

## 归档规则

可以归档：

- `PHASE*.md`
- `WEEK*.md`
- `*_REPORT.md`
- `*_PLAN.md`
- 旧 UI/UX 审计。
- 旧部署指南。
- 旧架构设计。

暂不归档：

- 当前权威文档。
- 当前运行手册。
- API 当前合约。
- ADR。
- 仍被 README 或代码引用的文档。

## 归档前检查

迁移旧文档前必须确认：

- 没有当前代码依赖其中命令。
- 没有当前 README 指向旧路径。
- 有新文档承接其中有效规则。
- Git diff 只移动文件，不改写内容。

## 历史资料使用方式

旧文档可以作为素材，但不能覆盖新权威文档。

当旧文档和新文档冲突：

1. 以 L1 权威文档为准。
2. 技术细节以当前可运行代码为准。
3. 若旧文档发现真实缺口，迁移为新文档条款或 ADR。

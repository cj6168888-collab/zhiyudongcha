# 贡献指南

## 基本原则

生语助手的开发必须服从文档基线：

- 产品和主权原则：[docs/00_CANONICAL_INDEX.md](./docs/00_CANONICAL_INDEX.md)
- 技术实现：[docs/technical/00_TECH_INDEX.md](./docs/technical/00_TECH_INDEX.md)
- 设计体验：[docs/design/00_DESIGN_INDEX.md](./docs/design/00_DESIGN_INDEX.md)
- 产品交付：[docs/product/00_PRODUCT_INDEX.md](./docs/product/00_PRODUCT_INDEX.md)

新功能必须进入主闭环：

```text
输入 -> 理解 -> 整理 -> 执行 -> 回流 -> 进化
```

如果不能说明服务哪个闭环，就先不要做成核心功能。

## 开发流程

1. 阅读相关权威文档。
2. 明确功能属于哪个产品闭环。
3. 明确读取哪些数据、需要哪些权限、风险等级是什么。
4. 先补或更新必要文档。
5. 实现代码。
6. 添加测试。
7. 运行必要验证。
8. 提交 PR。

## 新能力准入

新增能力前必须回答：

- 它帮助主人完成什么事？
- 前端入口在哪里？
- 后端服务在哪里？
- 数据模型是什么？
- 是否读取敏感数据？
- 是否影响外部世界？
- 是否需要主人确认？
- 如何审计？
- 如何失败降级？
- 如何回流到记忆、项目、任务或蜂群？

## 代码规范

- TypeScript 优先。
- API 入参用 zod 或等价 schema 校验。
- 新 API 使用统一 `ApiResponse<T>`。
- 复杂业务进 `server/services/`。
- React 页面不直接写模型调用或敏感权限判断。
- 共享类型尽量进入 `shared/`。
- 新文件使用 UTF-8。

## 测试要求

常用验证：

```bash
npm run build
npm run test
npm run test:api
npm run deploy:docker-smoke
```

涉及以下能力时必须增加对应测试：

- 权限判断。
- 风险确认。
- 敏感数据读取或外传。
- 任务状态机。
- 记忆保存、删除和召回。
- 蜂群边界。

## PR 要求

PR 至少说明：

- 做了什么。
- 为什么做。
- 影响哪些产品闭环。
- 是否涉及敏感数据。
- 是否涉及高风险动作。
- 测试结果。
- 文档是否已更新。


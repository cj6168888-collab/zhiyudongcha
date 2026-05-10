# 未提交改动审查记录

本记录用于梳理当前工作区中的未提交、已暂存和未跟踪内容，避免把用户开发要求误判为临时文件。

## 已采用到落地主线

- Web 主入口已经切换为“吉麟洞察 / Navigator-X”双端工作台，保留移动端与桌面端路由。
- 移动端业务页纳入当前产品方向：觉醒、业务中枢、专家中心、项目、联系人、保险库、命令中心、洞察室、扫描实验室、资源管理、远程 PC、任务中心、技能市场、工作流编辑器。
- 桌面端工作台纳入当前产品方向：登录、首页、聊天、终端、专家、项目、联系人、保险库、节点仪表盘、主权仪表盘、桌面任务中心。
- 后端业务能力纳入当前 API 主线：`/api/business`、`/api/remote`、`/api/tasks`、`/api/alerts`、`/api/agent`、`/api/assistant`、`/api/cross-device`、`/api/pc-agent`、`/api/knowledge`、`/api/coze`。
- 已接通遗漏的模型同步接口：`/api/models/status` 与 `/api/models/sync`。
- OpenClaw 远程控制与任务编排接口已进入 API 回归：`/api/remote/status`、`/api/remote/devices`、`/api/tasks`、`/api/tasks/executions/all`。
- `.env.example` 已从单纯监控模板升级为可启动的本地环境模板。
- `.gitignore` 已补充本地环境、SDK、Gradle 解压缓存、zip/apk 产物忽略规则。

## 有价值但需要继续验收

- `.opencode/agents/` 是一组能力角色库，可作为后续多智能体产品能力设计参考，但暂不进入应用运行主链。
- `openclaw-features/` 是远程控制、任务编排、统一执行器的独立能力包；当前主仓已有对应路由与服务，需要逐项对照后再决定是否合并剩余实现。
- `mobile/android/app/src/main/kotlin/com/xiaozhi/agent/` 是 Android 端常驻 agent 能力，属于移动端落地重点，但需要单独跑 Android 构建验证。
- `docs/*` 中多份架构、验收、产品文档是有效需求素材，后续应统一进 `docs/FOUNDATION_INDEX.md` 或运行手册，避免多版本互相冲突。
- `migrations/002_navigator_tables.sql` 与 `migrations/004_authz_grants.sql` 有业务价值，但 Drizzle journal 当前未完整覆盖所有历史手写迁移，落库前需要临时库演练。

## 不进入交付包

- `.local/`、`.config/replit/`、IDE cache、Gradle wrapper 解压目录是本地机器状态。
- `*.zip`、`*.apk`、`playwright-report/`、`test-results/` 是构建或测试产物。
- `hs_err_pid*.log`、`compile_errors.txt`、`ts_check_result.txt` 是诊断产物，可阅读但不应作为源码交付。

## 当前判断

这些改动整体不是噪音，而是一次“移动端业务工作台 + 桌面端 Navigator + OpenClaw 远程执行 + Android agent + 后端业务 API”的产品推进。当前策略是保留并接通可运行主链，暂不删除任何用户文件，对产物类文件只通过 `.gitignore` 降低干扰。

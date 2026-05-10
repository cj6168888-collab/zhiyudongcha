# Changelog

本项目从 2026-04-29 起按新的权威文档体系维护变更记录。

格式参考 Keep a Changelog，版本号按实际 release 策略更新。

## Unreleased

### Added

- Added `docs/OPENCLAW_INTEGRATION_STATUS.md` and `docs/ROUTE_LAZY_LOAD_SMOKE.md` to document active OpenClaw routes and route lazy-load runtime smoke coverage.
- 建立新的权威文档入口：[docs/00_CANONICAL_INDEX.md](./docs/00_CANONICAL_INDEX.md)。
- 建立产品、设计、技术三套基线。
- 补充产品指标体系：[docs/PRODUCT_METRICS.md](./docs/PRODUCT_METRICS.md)。
- 补充隐私与数据治理：[docs/PRIVACY_AND_DATA_GOVERNANCE.md](./docs/PRIVACY_AND_DATA_GOVERNANCE.md)。
- 补充设计 token 与组件状态：[docs/design/12_DESIGN_TOKENS_AND_COMPONENT_STATES.md](./docs/design/12_DESIGN_TOKENS_AND_COMPONENT_STATES.md)。
- 补充可观测性与事故响应：[docs/technical/12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md](./docs/technical/12_OBSERVABILITY_AND_INCIDENT_RESPONSE.md)。
- 补充贡献与安全政策。

### Changed

- Integrated OpenClaw remote control and task orchestration into the main app tree, then removed duplicate feature-drop sources and unused root-level pages.
- Converted `client/src/App.tsx` page routes to route-level `React.lazy` loading and refreshed Capacitor `www` assets.
- Stabilized release smoke scripts: production build env for `release:r1-gate`, `.env` loading for `deploy-smoke`, and focused UI smoke filtering for known realtime WebSocket noise.
- Updated current-state tracking after re-verifying core service regression coverage for vault merge, cross-service integration, and extended assistant understanding paths.
- Reworked Vitest coverage thresholds into a passing broad-suite baseline guard and documented the current all-repo coverage baseline.
- Expanded `ConversationActionExecutor` unit coverage for CRON task config, vault search, person creation, and failure branches.
- Added pending/draft lifecycle coverage for `ConversationActionExecutor`, lifting the service above 87% line coverage.
- Expanded `VectorMemoryService` coverage for reinforcement bounds, decision DNA, malformed context fallback, and stats aggregation.
- Added `PersonService` coverage for contact create/update/delete/approval side effects, including memory, audit, and broadcast behavior.
- Added `VaultService` coverage for vault CRUD broadcasts, search delegation, shred auditing, and category stats.
- Added `ProjectService` coverage for project, note, file, and template storage delegation paths.
- Added `MemoryService` coverage for shadow-memory repository delegation and stats aggregation.
- Added `HPService` coverage for HP balance, consume, restore, recharge, service consumption, and rejection paths.
- Added `AuditService` coverage for audit creation, limit reads, and canonical HP audit payloads.
- Added `EmailService` coverage for email CRUD, attachment, account listing, stats, and filtered query delegation.
- 旧阶段报告、审计报告、升级计划降级为历史资料。
- README 和 FOUNDATION_INDEX 作为兼容入口指向新权威文档。

### Fixed

- Cleaned Android and Capacitor configuration encoding damage that had obscured dependency and manifest lines.
- Removed the Vite large chunk warning for the normal production build by splitting route pages out of the initial application chunk.
- Stabilized Drizzle migration file bytes across Windows and Unix checkouts by enforcing LF endings and removing migration BOMs, allowing full release/deploy smoke runs with migrations enabled.

# 数据与记忆 Schema 方向

## 原则

数据模型必须服务长期世界模型，而不是只保存页面表单。

核心实体：

- 主人。
- 助手个体。
- 身份配置。
- 人格配置。
- 声音配置。
- 记忆。
- 资料来源。
- 人物。
- 项目。
- 任务。
- 事件。
- 证据。
- 蜂群。
- 节点。
- 契约。
- 审计。

## 记忆表建议

### `memories`

字段建议：

- `id`
- `ownerId`
- `scope`
- `type`
- `content`
- `summary`
- `confidence`
- `importance`
- `sensitivity`
- `sourceId`
- `status`
- `createdAt`
- `updatedAt`
- `lastUsedAt`
- `lastVerifiedAt`
- `expiresAt`

### `memory_sources`

记录来源：

- 文件。
- 照片。
- 邮件。
- 聊天。
- 录音。
- 日历。
- 联系人。
- 网页。
- 蜂群回报。

字段建议：

- `id`
- `ownerId`
- `sourceType`
- `uri`
- `hash`
- `metadata`
- `sensitivity`
- `createdAt`

### `memory_edges`

轻量知识图谱：

- `fromId`
- `toId`
- `edgeType`
- `confidence`
- `sourceId`
- `createdAt`

### `memory_candidates`

候选记忆：

- `id`
- `ownerId`
- `content`
- `sourceId`
- `confidence`
- `reason`
- `status`
- `reviewedAt`

## 身份与个性化

建议表：

- `identity_profiles`
- `assistant_personas`
- `voice_profiles`
- `relationship_contracts`
- `memory_consents`
- `execution_preferences`
- `protection_preferences`
- `swarm_identities`

## 蜂群治理

建议表：

- `swarms`
- `swarm_members`
- `swarm_contracts`
- `swarm_tasks`
- `swarm_reports`
- `swarm_alerts`

## 数据敏感等级

所有可长期保存的数据应有 sensitivity：

- S0 普通。
- S1 工作资料。
- S2 邮件、联系人、聊天。
- S3 合同、财务、身份、照片、私密关系。
- S4 密钥、密码、验证码、医疗、法律核心资料。

## 迁移原则

1. 数据库迁移必须可重复执行。
2. 重要表新增字段要考虑默认值。
3. 删除字段前先废弃，再迁移。
4. 涉及记忆和权限的迁移必须有备份策略。

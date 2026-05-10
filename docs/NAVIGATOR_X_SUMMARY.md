/**
 * Navigator-X System Summary
 * 
 * ## System Overview
 * 
 * Navigator-X 领航者系统是一个顶级统御级AI协同系统，包含以下核心模块：
 * 
 * ### 1. 核心服务 (server/services/)
 * 
 * | 服务 | 描述 | 状态 |
 * |------|------|------|
 * | navigator-core.ts | 领航者核心引擎 | ✅ |
 * | sovereign-terminal.ts | 主权端机制 | ✅ |
 * | expert-orchestrator.ts | 五大专家席位编排器 | ✅ |
 * | semantic-bloodline.ts | 语义血缘引擎 | ✅ |
 * | command-center.ts | 审批与分派中枢 | ✅ |
 * | anomaly-detector.ts | 异常检测引擎 | ✅ |
 * | contingency-engine.ts | Plan B 预案引擎 | ✅ |
 * | inspiration-broadcast.ts | 灵感广播服务 | ✅ |
 * | compute-allocator.ts | 算力配给服务 | ✅ |
 * 
 * ### 2. 移动端页面 (client/src/pages/mobile/)
 * 
 * | 页面 | 路由 | 描述 |
 * |------|------|------|
 * | NavigatorCommand.tsx | /navigator-command | 领航者指挥中心 |
 * | NavigatorSettings.tsx | /navigator-settings | 舰队统筹设置 |
 * | ExpertCenter.tsx | /experts | 五大专家席位 |
 * | CommandCenter.tsx | /command | 审批与分派中枢 |
 * | RedAlertPanel.tsx | /red-alerts | 红线预警面板 |
 * | InspirationBroadcast.tsx | /inspiration | 灵感广播面板 |
 * | NodeTerminal.tsx | /node-terminal | 节点端 |
 * 
 * ### 3. 桌面端页面 (client/src/pages/)
 * 
 * | 页面 | 路由 | 描述 |
 * |------|------|------|
 * | navigator-console.tsx | /navigator-console | Navigator-X 控制台 |
 * 
 * ### 4. 路由更新
 * 
 * - `/control` → `/navigator-command`
 * - `/swarm-settings` → `/navigator-settings`
 * 
 * ### 5. 数据库迁移
 * 
 * - migrations/002_navigator_tables.sql - Navigator-X 新增表结构
 * 
 * ## 四大核心效应
 * 
 * 1. **消除"沟通黑洞"：言出法随**
 *    - 语义血缘引擎自动补全老板意图
 *    - 毫秒级推送到每个节点端
 * 
 * 2. **永远的"Plan B"：自我修复**
 *    - 异常检测引擎实时监控
 *    - 自动激活预案，系统自我修复
 * 
 * 3. **精准把握异常：数字化"读心术"**
 *    - 红线预警实时通知
 *    - 数据信号分析，提前预警
 * 
 * 4. **灵感的全局传染：毫秒级同步**
 *    - 灵感自动广播至全舰队
 *    - 全公司同步进化
 * 
 * ## 技术要点
 * 
 * - **多模型路由**：Claude/DeepSeek/OpenAI 自动选择
 * - **语义血缘引擎**：NLP 补全意图
 * - **异常检测流处理**：实时监控节点数据流
 * - **自我修复机制**：自动匹配预案，触发 Plan B
 * - **灵感广播系统**：毫秒级同步到所有节点
 * 
 * ## 向后兼容
 * 
 * - swarmManager 别名指向 navigatorCore
 * - registerSwarmRoutes 别名指向 registerNavigatorRoutes
 * - transparentClone 别名指向 sovereignTerminal
 * 
 * ## 品牌升级
 * 
 * - 蜂群 → 舰队 (Fleet)
 * - 主控端 → 主权端 (Sovereign Terminal)
 * - 分身端 → 节点端 (Node Terminal)
 * - 指挥部 → 领航者指挥中心
 */

# 单元测试运行脚本

## 运行所有测试

```bash
npm run test
```

## 运行特定测试文件

### 桌面端测试
```bash
npm run test -- server/tests/unit/desktop.test.ts
```

### 化蝶计划测试
```bash
npm run test -- server/tests/unit/chrysalis.test.ts
```

### 移动端队系统测试
```bash
npm run test -- server/tests/unit/mobile-team.test.ts
```

### 集成测试
```bash
npm run test -- server/tests/integration/system-integration.test.ts
```

## 运行测试覆盖率报告

```bash
npm run test:coverage
```

## 监视模式（文件更改时自动运行）

```bash
npm run test:watch
```

## 测试文件说明

### server/tests/unit/desktop.test.ts
桌面端功能测试，包括：
- 用户角色判断
- 快捷操作导航
- 系统状态数据
- Navigator-X 数据
- 待审批汇报处理
- 警报处理
- 日期格式化
- 登录功能
- 专家咨询
- 命令终端

### server/tests/unit/chrysalis.test.ts
化蝶计划自我进化系统测试，包括：
- 进化阶段定义
- 进度计算
- 进化周期结果计算
- 夜间周期调度
- 失败收集
- 复盘引擎
- 逻辑微调
- 视觉进化
- 代码自迭代
- 晨间礼物
- 进化仪表盘

### server/tests/unit/mobile-team.test.ts
移动端队系统测试，包括：
- BusinessHub 指挥中心
- Navigator-X 队系统
- 节点管理
- 汇报审批
- 灵感广播
- 警报系统
- 舰队管理
- 移动端组件
- 路由配置
- 移动端服务

### server/tests/integration/system-integration.test.ts
系统集成测试，包括：
- API 端点集成
- 数据流集成
- 前端后端集成
- 状态管理集成
- 路由集成
- 性能集成
- 错误处理集成
- 安全集成
- 实时同步集成

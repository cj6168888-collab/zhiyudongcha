# 小智桌面精灵 (Xiaozhi Desktop Mascot)

一个可爱的AI桌面宠物应用，使用Electron + React + TypeScript构建。

## 功能特性

- 🌟 透明无边框窗口，小智漂浮在桌面上
- 🎨 可爱的CSS动画角色
- 🤖 行为引擎：走路、跳舞、打哈欠、睡觉等
- 💬 点击互动，显示可爱对话
- 🔌 连接小智后端API进行AI对话
- 📍 可拖拽到桌面任意位置

## 开发环境

### 前提条件

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
cd desktop-mascot
npm install
```

### 开发模式

```bash
npm run dev
```

这将同时启动 Vite 开发服务器和 Electron 应用。

### 构建应用

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建完成后，可执行文件将在 `release` 目录中。

## 项目结构

```
desktop-mascot/
├── electron/           # Electron主进程
│   ├── main.ts        # 主进程入口
│   └── preload.ts     # 预加载脚本
├── src/               # React渲染进程
│   ├── components/    # React组件
│   ├── hooks/         # 自定义Hooks
│   ├── services/      # API服务
│   └── styles/        # 样式文件
├── assets/            # 静态资源
└── package.json
```

## 配置

创建 `.env` 文件配置API连接：

```env
VITE_API_URL=https://your-replit-app.replit.app
VITE_MASTER_SECRET=your-secret-key
```

## 版权

陈先生出品 · cj6168888@Gmail.com

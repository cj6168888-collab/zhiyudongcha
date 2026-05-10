# 小智 PC 守护进程 (Avatar PC Daemon)

## 概述

此目录包含 PC 端守护进程的完整代码模板，用于与小智服务器建立连接并执行自动化操作。

支持平台：Windows、macOS、Linux

## 核心功能

1. **输入模拟** - 键盘/鼠标操作（驱动级和用户级）
2. **WebSocket Client** - 与服务器实时通信
3. **屏幕截图** - 支持截图上传用于视觉验证
4. **人类行为模拟** - 贝塞尔曲线移动、打字节奏模拟

## 项目结构

```
pc/
├── avatar_daemon/
│   ├── __init__.py
│   ├── main.py                # 主入口
│   ├── config.py              # 配置管理
│   ├── websocket_client.py    # WebSocket 客户端
│   ├── executor/
│   │   ├── __init__.py
│   │   ├── base.py            # 执行器基类
│   │   ├── windows.py         # Windows 执行器
│   │   ├── macos.py           # macOS 执行器
│   │   └── linux.py           # Linux 执行器
│   ├── simulation/
│   │   ├── __init__.py
│   │   ├── mouse.py           # 鼠标模拟
│   │   ├── keyboard.py        # 键盘模拟
│   │   └── human.py           # 人类行为模拟
│   └── utils/
│       ├── __init__.py
│       └── screenshot.py      # 屏幕截图
├── requirements.txt
├── setup.py
└── README.md
```

## 安装步骤

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 配置服务器地址

编辑 `avatar_daemon/config.py`:

```python
SERVER_URL = "wss://your-server.replit.app/ws/shadow"
DEVICE_ID = "pc-desktop-1"
DEVICE_NAME = "小智电脑"
```

### 3. 启动守护进程

```bash
python -m avatar_daemon.main
```

### 4. 设置开机自启（可选）

**Windows**: 添加到启动文件夹或使用任务计划程序

**macOS**: 创建 LaunchAgent plist

**Linux**: 创建 systemd service

## 通信协议

与 Android 端保持一致，参见 Android README。

## 平台特定说明

### Windows

使用 `pynput` 库进行用户级输入模拟。
如需驱动级模拟（绕过某些保护），需要安装 Interception 驱动。

```bash
# 安装 Interception (管理员权限)
# 下载: https://github.com/oblitum/Interception
```

### macOS

需要授予辅助功能权限：
设置 → 隐私与安全性 → 辅助功能 → 添加 Python/Terminal

### Linux

需要 `uinput` 权限：

```bash
sudo usermod -a -G input $USER
# 或设置 udev 规则
```

## 安全说明

⚠️ **警告**: 此程序可控制您的电脑，请确保：
1. 仅连接到可信服务器
2. 使用加密连接 (WSS)
3. 设置白名单限制可执行的操作

## 版权

陈先生出品 · cj6168888@Gmail.com

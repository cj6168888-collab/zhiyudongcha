# PC 守护进程安装说明

## 快速开始

### 1. 安装 Python

需要 Python 3.8+，从 https://python.org 下载安装。

### 2. 安装依赖

```bash
cd companion-apps/pc
pip install -r requirements.txt
```

### 3. 配置服务器

创建 `.env` 文件：

```
AVATAR_SERVER_URL=wss://你的服务器地址.replit.app/ws/shadow
AVATAR_DEVICE_NAME=我的电脑
```

或设置环境变量。

### 4. 启动守护进程

```bash
python -m avatar_daemon.main
```

## 开机自启设置

### Windows

1. 创建快捷方式指向启动脚本
2. 按 `Win+R`，输入 `shell:startup`
3. 将快捷方式放入打开的文件夹

### macOS

创建 `~/Library/LaunchAgents/com.avatar.daemon.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.avatar.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>-m</string>
        <string>avatar_daemon.main</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/companion-apps/pc</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

然后运行：
```bash
launchctl load ~/Library/LaunchAgents/com.avatar.daemon.plist
```

### Linux (systemd)

创建 `/etc/systemd/user/avatar-daemon.service`:

```ini
[Unit]
Description=Avatar PC Daemon
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m avatar_daemon.main
WorkingDirectory=/path/to/companion-apps/pc
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

启用服务：
```bash
systemctl --user enable avatar-daemon
systemctl --user start avatar-daemon
```

## 权限说明

### macOS
需要在「系统偏好设置 → 安全性与隐私 → 隐私 → 辅助功能」中添加 Python/Terminal。

### Linux
需要添加到 input 组：
```bash
sudo usermod -a -G input $USER
```

## 打包为可执行文件（可选）

```bash
pip install pyinstaller
pyinstaller --onefile --name avatar-daemon avatar_daemon/main.py
```

生成的可执行文件在 `dist/` 目录。

## 版权

陈先生出品 · cj6168888@Gmail.com

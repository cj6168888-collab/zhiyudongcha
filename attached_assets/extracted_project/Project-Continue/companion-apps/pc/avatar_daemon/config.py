"""
配置管理
"""

import os
import platform
from dotenv import load_dotenv

load_dotenv()

# 服务器配置
SERVER_URL = os.getenv("AVATAR_SERVER_URL", "wss://your-server.replit.app/ws/shadow")
DEVICE_ID = os.getenv("AVATAR_DEVICE_ID", f"pc-{platform.node()}")
DEVICE_NAME = os.getenv("AVATAR_DEVICE_NAME", f"小智电脑 ({platform.system()})")

# 连接配置
RECONNECT_DELAY = 5  # 秒
HEARTBEAT_INTERVAL = 30  # 秒
CONNECTION_TIMEOUT = 10  # 秒

# 人类模拟默认配置
DEFAULT_HUMAN_SIMULATION = {
    "enabled": True,
    "position_jitter": 3,  # 像素
    "delay_base": 150,  # 毫秒
    "delay_variance": 100,  # 毫秒
    "movement_curve": "BEZIER",  # LINEAR, BEZIER, NATURAL
    "type_speed": 8,  # 字符/秒
    "type_variance": 2,  # 速度波动
}

# 截图配置
SCREENSHOT_QUALITY = 80  # JPEG 质量
SCREENSHOT_FORMAT = "PNG"

# 日志配置
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", None)

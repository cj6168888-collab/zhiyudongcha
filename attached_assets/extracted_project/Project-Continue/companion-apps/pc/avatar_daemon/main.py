"""
小智 PC 守护进程 - 主入口

用法:
    python -m avatar_daemon.main

版权: 陈先生出品 · cj6168888@Gmail.com
"""

import asyncio
import signal
import sys
import platform
import logging
from typing import Optional

try:
    import colorlog
    handler = colorlog.StreamHandler()
    handler.setFormatter(colorlog.ColoredFormatter(
        '%(log_color)s%(asctime)s [%(levelname)s] %(message)s',
        log_colors={
            'DEBUG': 'cyan',
            'INFO': 'green',
            'WARNING': 'yellow',
            'ERROR': 'red',
            'CRITICAL': 'red,bg_white',
        }
    ))
    logger = logging.getLogger('avatar_daemon')
    logger.addHandler(handler)
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s'
    )
    logger = logging.getLogger('avatar_daemon')

from . import config
from .websocket_client import WebSocketClient
from .executor.base import get_executor


class AvatarDaemon:
    """小智 PC 守护进程"""
    
    def __init__(self):
        self.running = False
        self.ws_client: Optional[WebSocketClient] = None
        self.executor = get_executor()
        
    async def start(self):
        """启动守护进程"""
        logger.info(f"小智 PC 守护进程启动中...")
        logger.info(f"设备 ID: {config.DEVICE_ID}")
        logger.info(f"设备名称: {config.DEVICE_NAME}")
        logger.info(f"平台: {platform.system()} {platform.release()}")
        
        self.running = True
        
        # 创建 WebSocket 客户端
        self.ws_client = WebSocketClient(
            server_url=config.SERVER_URL,
            device_id=config.DEVICE_ID,
            device_name=config.DEVICE_NAME,
            executor=self.executor,
        )
        
        # 启动连接
        try:
            await self.ws_client.connect()
        except asyncio.CancelledError:
            logger.info("守护进程已取消")
        except Exception as e:
            logger.error(f"守护进程异常: {e}")
        finally:
            await self.stop()
    
    async def stop(self):
        """停止守护进程"""
        logger.info("正在停止守护进程...")
        self.running = False
        
        if self.ws_client:
            await self.ws_client.disconnect()
        
        logger.info("守护进程已停止")


def main():
    """主函数"""
    daemon = AvatarDaemon()
    
    # 设置信号处理
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    def signal_handler():
        logger.info("收到终止信号...")
        loop.create_task(daemon.stop())
    
    if sys.platform != 'win32':
        loop.add_signal_handler(signal.SIGINT, signal_handler)
        loop.add_signal_handler(signal.SIGTERM, signal_handler)
    
    try:
        loop.run_until_complete(daemon.start())
    except KeyboardInterrupt:
        logger.info("用户中断")
        loop.run_until_complete(daemon.stop())
    finally:
        loop.close()


if __name__ == "__main__":
    main()

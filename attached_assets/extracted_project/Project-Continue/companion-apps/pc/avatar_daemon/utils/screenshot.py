"""
屏幕截图工具
"""

import asyncio
import base64
import io
import logging

logger = logging.getLogger('avatar_daemon')

try:
    import mss
    from PIL import Image
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False
    logger.warning("mss 或 Pillow 未安装，截图功能将不可用")


async def capture_screen_base64(
    monitor: int = 0,
    quality: int = 80,
    format: str = "PNG",
) -> str:
    """
    截取屏幕并返回 base64 编码
    
    Args:
        monitor: 显示器索引（0 表示所有显示器，1 表示第一个显示器）
        quality: JPEG 质量（仅对 JPEG 格式有效）
        format: 图片格式（PNG 或 JPEG）
    
    Returns:
        base64 编码的图片字符串，失败时返回空字符串
    """
    if not MSS_AVAILABLE:
        logger.warning("截图依赖未安装 (mss/Pillow)，返回空截图")
        return ""
    
    def _capture():
        with mss.mss() as sct:
            # 获取显示器信息
            mon = sct.monitors[monitor]
            
            # 截图
            screenshot = sct.grab(mon)
            
            # 转换为 PIL Image
            img = Image.frombytes(
                "RGB",
                screenshot.size,
                screenshot.bgra,
                "raw",
                "BGRX",
            )
            
            # 编码为 base64
            buffer = io.BytesIO()
            
            if format.upper() == "JPEG":
                img.save(buffer, format="JPEG", quality=quality)
            else:
                img.save(buffer, format="PNG")
            
            return base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    # 在线程池中执行（避免阻塞事件循环）
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _capture)


async def get_screen_size(monitor: int = 1) -> tuple:
    """
    获取屏幕尺寸
    
    Args:
        monitor: 显示器索引
    
    Returns:
        (width, height) 元组
    """
    if not MSS_AVAILABLE:
        return (1920, 1080)  # 默认值
    
    def _get_size():
        with mss.mss() as sct:
            mon = sct.monitors[monitor]
            return (mon["width"], mon["height"])
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_size)

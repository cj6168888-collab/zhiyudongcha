"""
macOS 执行器 - 使用 pynput 进行输入模拟
"""

import asyncio
import logging
import random

logger = logging.getLogger('avatar_daemon')

try:
    from pynput.mouse import Button, Controller as MouseController
    from pynput.keyboard import Key, Controller as KeyboardController
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False
    logger.warning("pynput 未安装，输入模拟功能将不可用")

from .base import BaseExecutor


class MacOSExecutor(BaseExecutor):
    """macOS 平台执行器"""
    
    def __init__(self):
        if PYNPUT_AVAILABLE:
            self.mouse = MouseController()
            self.keyboard = KeyboardController()
        else:
            self.mouse = None
            self.keyboard = None
    
    async def tap(self, x: int, y: int, jitter: int = 0, delay: int = 0) -> bool:
        """点击操作"""
        if not PYNPUT_AVAILABLE:
            logger.error("pynput 不可用")
            return False
        
        try:
            actual_x = self.apply_jitter(x, jitter)
            actual_y = self.apply_jitter(y, jitter)
            
            await self._move_to(actual_x, actual_y, duration=0.15)
            await asyncio.sleep(random.uniform(0.01, 0.05))
            
            self.mouse.click(Button.left)
            
            logger.debug(f"点击: ({x}, {y}) -> ({actual_x}, {actual_y})")
            return True
            
        except Exception as e:
            logger.error(f"点击失败: {e}")
            return False
    
    async def swipe(
        self,
        start_x: int,
        start_y: int,
        end_x: int,
        end_y: int,
        duration: int = 300,
        jitter: int = 0,
    ) -> bool:
        """滑动操作"""
        if not PYNPUT_AVAILABLE:
            return False
        
        try:
            actual_start_x = self.apply_jitter(start_x, jitter)
            actual_start_y = self.apply_jitter(start_y, jitter)
            actual_end_x = self.apply_jitter(end_x, jitter)
            actual_end_y = self.apply_jitter(end_y, jitter)
            
            await self._move_to(actual_start_x, actual_start_y, duration=0.1)
            
            self.mouse.press(Button.left)
            await asyncio.sleep(0.02)
            
            points = self.generate_bezier_points(
                (actual_start_x, actual_start_y),
                (actual_end_x, actual_end_y),
                num_points=max(20, duration // 15),
            )
            
            delay_per_point = (duration / 1000) / len(points)
            
            for px, py in points[1:]:
                self.mouse.position = (px, py)
                await asyncio.sleep(delay_per_point)
            
            await asyncio.sleep(0.02)
            self.mouse.release(Button.left)
            
            logger.debug(f"滑动: ({start_x}, {start_y}) -> ({end_x}, {end_y})")
            return True
            
        except Exception as e:
            logger.error(f"滑动失败: {e}")
            return False
    
    async def input_text(
        self,
        text: str,
        type_speed: int = 8,
        variance: int = 2,
    ) -> bool:
        """输入文本"""
        if not PYNPUT_AVAILABLE:
            return False
        
        try:
            base_delay = 1.0 / type_speed
            
            for char in text:
                actual_delay = base_delay + random.uniform(
                    -variance * 0.05,
                    variance * 0.05,
                )
                actual_delay = max(0.02, actual_delay)
                
                if random.random() < 0.05:
                    actual_delay += random.uniform(0.1, 0.3)
                
                await asyncio.sleep(actual_delay)
                self.keyboard.type(char)
            
            logger.debug(f"输入: {text[:20]}...")
            return True
            
        except Exception as e:
            logger.error(f"输入失败: {e}")
            return False
    
    async def long_press(
        self,
        x: int,
        y: int,
        duration: int = 500,
        jitter: int = 0,
    ) -> bool:
        """长按操作"""
        if not PYNPUT_AVAILABLE:
            return False
        
        try:
            actual_x = self.apply_jitter(x, jitter)
            actual_y = self.apply_jitter(y, jitter)
            
            await self._move_to(actual_x, actual_y, duration=0.1)
            
            self.mouse.press(Button.left)
            await asyncio.sleep(duration / 1000)
            self.mouse.release(Button.left)
            
            logger.debug(f"长按: ({x}, {y}) 持续 {duration}ms")
            return True
            
        except Exception as e:
            logger.error(f"长按失败: {e}")
            return False
    
    async def scroll(
        self,
        x: int,
        y: int,
        delta: int,
        horizontal: bool = False,
    ) -> bool:
        """滚动操作"""
        if not PYNPUT_AVAILABLE:
            return False
        
        try:
            await self._move_to(x, y, duration=0.1)
            
            if horizontal:
                self.mouse.scroll(delta, 0)
            else:
                self.mouse.scroll(0, delta)
            
            logger.debug(f"滚动: ({x}, {y}) delta={delta}")
            return True
            
        except Exception as e:
            logger.error(f"滚动失败: {e}")
            return False
    
    async def _move_to(self, x: int, y: int, duration: float = 0.2):
        """平滑移动到目标位置"""
        if not self.mouse:
            return
        
        current_pos = self.mouse.position
        
        if duration <= 0.05:
            self.mouse.position = (x, y)
            return
        
        points = self.generate_bezier_points(
            current_pos,
            (x, y),
            num_points=int(duration * 60),
        )
        
        delay = duration / len(points)
        
        for px, py in points:
            self.mouse.position = (px, py)
            await asyncio.sleep(delay)

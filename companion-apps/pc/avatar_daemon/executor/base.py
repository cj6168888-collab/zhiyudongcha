"""
执行器基类
"""

import asyncio
import logging
import platform
import random
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Tuple

import numpy as np

logger = logging.getLogger('avatar_daemon')


class BaseExecutor(ABC):
    """执行器基类"""
    
    @abstractmethod
    async def tap(self, x: int, y: int, jitter: int = 0, delay: int = 0) -> bool:
        """点击操作"""
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def input_text(
        self,
        text: str,
        type_speed: int = 8,
        variance: int = 2,
    ) -> bool:
        """输入文本"""
        pass
    
    @abstractmethod
    async def long_press(
        self,
        x: int,
        y: int,
        duration: int = 500,
        jitter: int = 0,
    ) -> bool:
        """长按操作"""
        pass
    
    @abstractmethod
    async def scroll(
        self,
        x: int,
        y: int,
        delta: int,
        horizontal: bool = False,
    ) -> bool:
        """滚动操作"""
        pass
    
    async def execute(self, action: Dict[str, Any], human_sim: Dict[str, Any]) -> bool:
        """执行操作"""
        action_type = action.get("type", "").upper()
        
        enabled = human_sim.get("enabled", True)
        jitter = human_sim.get("position_jitter", human_sim.get("positionJitter", 0)) if enabled else 0
        delay_base = human_sim.get("delay_base", human_sim.get("delayBase", 0)) if enabled else 0
        delay_variance = human_sim.get("delay_variance", human_sim.get("delayVariance", 0)) if enabled else 0
        
        # 计算实际延迟
        actual_delay = delay_base + random.randint(-delay_variance, delay_variance)
        actual_delay = max(0, actual_delay)
        
        if actual_delay > 0:
            await asyncio.sleep(actual_delay / 1000)
        
        if action_type == "TAP":
            return await self.tap(
                x=int(action.get("x", 0)),
                y=int(action.get("y", 0)),
                jitter=jitter,
            )
        
        elif action_type == "SWIPE":
            return await self.swipe(
                start_x=int(action.get("startX", 0)),
                start_y=int(action.get("startY", 0)),
                end_x=int(action.get("endX", 0)),
                end_y=int(action.get("endY", 0)),
                duration=int(action.get("duration", 300)),
                jitter=jitter,
            )
        
        elif action_type == "INPUT":
            type_speed = human_sim.get("type_speed", human_sim.get("typeSpeed", 8))
            type_variance = human_sim.get("type_variance", human_sim.get("typeVariance", 2))
            return await self.input_text(
                text=action.get("text", ""),
                type_speed=type_speed,
                variance=type_variance,
            )
        
        elif action_type == "LONG_PRESS":
            return await self.long_press(
                x=int(action.get("x", 0)),
                y=int(action.get("y", 0)),
                duration=int(action.get("duration", 500)),
                jitter=jitter,
            )
        
        elif action_type == "SCROLL":
            return await self.scroll(
                x=int(action.get("x", 0)),
                y=int(action.get("y", 0)),
                delta=int(action.get("delta", 0)),
                horizontal=action.get("horizontal", False),
            )
        
        else:
            logger.warning(f"未知操作类型: {action_type}")
            return False
    
    # ==================== 人类行为模拟工具 ====================
    
    def apply_jitter(self, value: int, jitter: int) -> int:
        """应用随机偏移"""
        if jitter <= 0:
            return value
        return value + random.randint(-jitter, jitter)
    
    def generate_bezier_points(
        self,
        start: Tuple[int, int],
        end: Tuple[int, int],
        num_points: int = 50,
    ) -> List[Tuple[int, int]]:
        """生成贝塞尔曲线点"""
        # 控制点（添加随机弯曲）
        ctrl_x = (start[0] + end[0]) / 2 + random.randint(-50, 50)
        ctrl_y = (start[1] + end[1]) / 2 + random.randint(-50, 50)
        
        points = []
        for i in range(num_points + 1):
            t = i / num_points
            # 二次贝塞尔曲线
            x = (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * ctrl_x + t ** 2 * end[0]
            y = (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * ctrl_y + t ** 2 * end[1]
            points.append((int(x), int(y)))
        
        return points


def get_executor() -> BaseExecutor:
    """获取当前平台的执行器"""
    system = platform.system()
    
    if system == "Windows":
        from .windows import WindowsExecutor
        return WindowsExecutor()
    elif system == "Darwin":
        from .macos import MacOSExecutor
        return MacOSExecutor()
    else:
        from .linux import LinuxExecutor
        return LinuxExecutor()

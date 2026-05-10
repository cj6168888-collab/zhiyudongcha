"""
WebSocket 客户端 - 与服务器保持长连接
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

import websockets
from websockets.client import WebSocketClientProtocol

from . import config
from .executor.base import BaseExecutor
from .utils.screenshot import capture_screen_base64

logger = logging.getLogger('avatar_daemon')


class WebSocketClient:
    """WebSocket 客户端"""
    
    def __init__(
        self,
        server_url: str,
        device_id: str,
        device_name: str,
        executor: BaseExecutor,
    ):
        self.server_url = server_url
        self.device_id = device_id
        self.device_name = device_name
        self.executor = executor
        
        self.ws: Optional[WebSocketClientProtocol] = None
        self.connected = False
        self.should_reconnect = True
        self._heartbeat_task: Optional[asyncio.Task] = None
    
    async def connect(self):
        """建立连接（带自动重连）"""
        while self.should_reconnect:
            try:
                logger.info(f"正在连接服务器: {self.server_url}")
                
                extra_headers = {
                    "X-Device-Id": self.device_id,
                    "X-Device-Type": self._get_device_type(),
                }
                
                async with websockets.connect(
                    self.server_url,
                    extra_headers=extra_headers,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    self.ws = ws
                    self.connected = True
                    logger.info("WebSocket 连接成功")
                    
                    # 发送注册消息
                    await self._send_register()
                    
                    # 启动心跳
                    self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
                    
                    # 消息循环
                    await self._message_loop()
                    
            except websockets.exceptions.ConnectionClosed as e:
                logger.warning(f"连接已关闭: {e}")
            except Exception as e:
                logger.error(f"连接失败: {e}")
            finally:
                self.connected = False
                if self._heartbeat_task:
                    self._heartbeat_task.cancel()
                    try:
                        await self._heartbeat_task
                    except asyncio.CancelledError:
                        pass
            
            if self.should_reconnect:
                logger.info(f"{config.RECONNECT_DELAY} 秒后重连...")
                await asyncio.sleep(config.RECONNECT_DELAY)
    
    async def disconnect(self):
        """断开连接"""
        self.should_reconnect = False
        if self.ws:
            await self.ws.close()
    
    def _get_device_type(self) -> str:
        """获取设备类型"""
        import platform
        system = platform.system()
        if system == "Windows":
            return "WINDOWS"
        elif system == "Darwin":
            return "MACOS"
        else:
            return "LINUX"
    
    async def _send_register(self):
        """发送注册消息"""
        message = {
            "type": "REGISTER",
            "deviceId": self.device_id,
            "deviceType": self._get_device_type(),
            "name": self.device_name,
            "capabilities": {
                "canTap": True,
                "canSwipe": True,
                "canInput": True,
                "canScreenshot": True,
                "channels": ["RPC", "UINPUT"] if self._get_device_type() != "WINDOWS" else ["RPC", "INTERCEPTION"],
            },
        }
        
        await self.ws.send(json.dumps(message))
        logger.info("已发送注册消息")
    
    async def _heartbeat_loop(self):
        """心跳循环"""
        while self.connected:
            try:
                await asyncio.sleep(config.HEARTBEAT_INTERVAL)
                
                if self.connected and self.ws:
                    heartbeat = {
                        "type": "HEARTBEAT",
                        "deviceId": self.device_id,
                        "timestamp": int(time.time() * 1000),
                    }
                    await self.ws.send(json.dumps(heartbeat))
                    logger.debug("已发送心跳")
            except Exception as e:
                logger.warning(f"心跳发送失败: {e}")
                break
    
    async def _message_loop(self):
        """消息处理循环"""
        async for message in self.ws:
            try:
                data = json.loads(message)
                await self._handle_message(data)
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析失败: {e}")
            except Exception as e:
                logger.error(f"消息处理失败: {e}")
    
    async def _handle_message(self, message: Dict[str, Any]):
        """处理消息"""
        msg_type = message.get("type")
        
        if msg_type == "EXECUTE":
            await self._handle_execute(message)
        elif msg_type == "SCREENSHOT":
            await self._handle_screenshot(message)
        elif msg_type == "PING":
            await self._handle_ping(message)
        elif msg_type == "COLLECT_APPS":
            await self._handle_collect_apps(message)
        elif msg_type == "FILE_SCAN":
            await self._handle_file_scan(message)
        elif msg_type == "FILE_ACTIONS":
            await self._handle_file_actions(message)
        else:
            logger.warning(f"未知消息类型: {msg_type}")
    
    async def _handle_execute(self, command: Dict[str, Any]):
        """处理执行指令"""
        cmd_id = command.get("id", "unknown")
        action = command.get("action", {})
        verification = command.get("verification", {})
        human_sim = command.get("humanSimulation", config.DEFAULT_HUMAN_SIMULATION)
        
        logger.info(f"执行指令: {cmd_id} - {action.get('type')}")
        
        # 执行前截图
        screenshot_before = None
        if verification.get("screenshotBefore"):
            screenshot_before = await capture_screen_base64()
        
        start_time = time.time()
        
        # 执行操作
        try:
            success = await self.executor.execute(action, human_sim)
            error = None
        except Exception as e:
            success = False
            error = str(e)
            logger.error(f"执行失败: {e}")
        
        # 执行后截图
        screenshot_after = None
        if verification.get("screenshotAfter"):
            await asyncio.sleep(0.2)  # 等待 UI 更新
            screenshot_after = await capture_screen_base64()
        
        # 构建响应
        duration = int((time.time() - start_time) * 1000)
        
        response = {
            "id": cmd_id,
            "success": success,
            "channel": "RPC",
            "duration": duration,
        }
        
        if screenshot_before:
            response["screenshotBefore"] = screenshot_before
        if screenshot_after:
            response["screenshotAfter"] = screenshot_after
        if screenshot_before and screenshot_after:
            response["changeDetected"] = screenshot_before != screenshot_after
        if error:
            response["error"] = error
        
        await self.ws.send(json.dumps(response))
        logger.info(f"指令完成: {cmd_id} - {'成功' if success else '失败'}")
    
    async def _handle_screenshot(self, message: Dict[str, Any]):
        """处理截图请求"""
        screenshot = await capture_screen_base64()
        
        response = {
            "id": message.get("id"),
            "type": "SCREENSHOT_RESULT",
            "image": screenshot,
            "timestamp": int(time.time() * 1000),
        }
        
        await self.ws.send(json.dumps(response))
    
    async def _handle_ping(self, message: Dict[str, Any]):
        """处理 Ping"""
        pong = {
            "type": "PONG",
            "id": message.get("id"),
            "timestamp": int(time.time() * 1000),
        }
        
        await self.ws.send(json.dumps(pong))
    
    async def _handle_collect_apps(self, message: Dict[str, Any]):
        """处理应用/进程收集请求"""
        from .telemetry import immune_telemetry
        
        logger.info("收到进程收集请求")
        
        processes = await immune_telemetry.collect_processes()
        system_summary = await immune_telemetry.get_system_summary()
        
        response = {
            "id": message.get("id"),
            "type": "APPS_COLLECTED",
            "deviceId": self.device_id,
            "apps": processes,
            "systemSummary": system_summary,
            "timestamp": int(time.time() * 1000),
        }
        
        await self.ws.send(json.dumps(response))
        logger.info(f"已发送 {len(processes)} 个进程数据")
    
    async def _handle_file_scan(self, message: Dict[str, Any]):
        """处理文件扫描请求 (Project Tidying Up)"""
        from .file_ops import get_file_operator
        
        logger.info("收到文件扫描请求")
        
        scan_path = message.get("scanPath", "")
        recursive = message.get("recursive", True)
        compute_hash = message.get("computeHash", False)
        
        operator = get_file_operator(self.device_id)
        
        if scan_path.lower() == "desktop":
            files = await operator.scan_desktop(compute_hash=compute_hash)
        else:
            files = await operator.scan_directory(
                scan_path,
                recursive=recursive,
                compute_hash=compute_hash,
            )
        
        response = {
            "id": message.get("id"),
            "type": "FILE_SCAN_RESULT",
            "deviceId": self.device_id,
            "scanPath": scan_path,
            "files": [f.to_dict() for f in files],
            "totalCount": len(files),
            "timestamp": int(time.time() * 1000),
        }
        
        await self.ws.send(json.dumps(response))
        logger.info(f"已发送 {len(files)} 个文件扫描结果")
    
    async def _handle_file_actions(self, message: Dict[str, Any]):
        """处理文件操作请求 (Project Tidying Up)"""
        from .file_ops import get_file_operator, FileAction
        
        logger.info("收到文件操作请求")
        
        actions_data = message.get("actions", [])
        dry_run = message.get("dryRun", False)
        task_id = message.get("taskId")
        
        actions = [
            FileAction(
                filePath=a.get("filePath", ""),
                action=a.get("action", ""),
                newPath=a.get("newPath"),
                newName=a.get("newName"),
            )
            for a in actions_data
        ]
        
        operator = get_file_operator(self.device_id)
        results = await operator.execute_actions(actions, dry_run=dry_run)
        
        response = {
            "id": message.get("id"),
            "type": "FILE_ACTIONS_RESULT",
            "deviceId": self.device_id,
            "taskId": task_id,
            "results": [
                {
                    "filePath": r.filePath,
                    "action": r.action,
                    "newPath": r.newPath,
                    "status": r.status,
                    "error": r.error,
                }
                for r in results
            ],
            "successCount": sum(1 for r in results if r.status == "COMPLETED"),
            "failedCount": sum(1 for r in results if r.status == "FAILED"),
            "timestamp": int(time.time() * 1000),
        }
        
        await self.ws.send(json.dumps(response))
        logger.info(f"文件操作完成: {response['successCount']}成功, {response['failedCount']}失败")

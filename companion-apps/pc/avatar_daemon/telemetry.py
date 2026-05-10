"""
免疫系统遥测 - 收集PC进程和资源信息

功能：
1. 扫描运行进程
2. 获取资源使用
3. 检测可疑进程
4. 收集系统状态

版权：陈先生出品 · cj6168888@Gmail.com
"""

import asyncio
import logging
import os
import platform
import subprocess
import time
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger('avatar_daemon')


@dataclass
class ProcessInfo:
    """进程信息"""
    packageName: str  # 进程名 (与 Android 统一字段)
    appName: str      # 显示名称
    version: str
    memoryUsageMb: float
    storageUsageMb: float
    batteryDrainPercent: float
    cpuUsagePercent: float
    networkUsageMb: float
    permissionsGranted: List[str]
    isSystemApp: bool
    backgroundActivity: bool
    autoStart: bool


class ImmuneTelemetry:
    """PC端免疫遥测收集器"""
    
    def __init__(self):
        self.system = platform.system()
        self._cpu_baseline: Dict[int, float] = {}
    
    async def collect_processes(self) -> List[Dict[str, Any]]:
        """收集所有运行进程信息"""
        processes = []
        
        try:
            if self.system == "Windows":
                processes = await self._collect_windows_processes()
            elif self.system == "Darwin":
                processes = await self._collect_macos_processes()
            else:
                processes = await self._collect_linux_processes()
            
            logger.info(f"已收集 {len(processes)} 个进程信息")
            
        except Exception as e:
            logger.error(f"收集进程信息失败: {e}")
        
        return processes
    
    async def _collect_windows_processes(self) -> List[Dict[str, Any]]:
        """收集 Windows 进程"""
        processes = []
        
        try:
            cmd = [
                "powershell", "-Command",
                "Get-Process | Select-Object Name, Id, WorkingSet64, CPU, Path | "
                "ConvertTo-Json -Compress"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and result.stdout:
                import json
                data = json.loads(result.stdout)
                
                if isinstance(data, dict):
                    data = [data]
                
                for proc in data:
                    processes.append(self._create_process_info(
                        name=proc.get("Name", "unknown"),
                        pid=proc.get("Id", 0),
                        memory_bytes=proc.get("WorkingSet64", 0),
                        cpu_time=proc.get("CPU", 0),
                        path=proc.get("Path", ""),
                    ))
                    
        except Exception as e:
            logger.warning(f"Windows 进程收集失败: {e}")
        
        return processes
    
    async def _collect_macos_processes(self) -> List[Dict[str, Any]]:
        """收集 macOS 进程"""
        processes = []
        
        try:
            cmd = ["ps", "aux"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")[1:]  # 跳过标题行
                
                for line in lines:
                    parts = line.split(None, 10)
                    if len(parts) >= 11:
                        processes.append(self._create_process_info(
                            name=parts[10].split("/")[-1] if "/" in parts[10] else parts[10],
                            pid=int(parts[1]),
                            memory_percent=float(parts[3]),
                            cpu_percent=float(parts[2]),
                            path=parts[10] if "/" in parts[10] else "",
                        ))
                        
        except Exception as e:
            logger.warning(f"macOS 进程收集失败: {e}")
        
        return processes
    
    async def _collect_linux_processes(self) -> List[Dict[str, Any]]:
        """收集 Linux 进程"""
        processes = []
        
        try:
            cmd = ["ps", "aux", "--sort=-rss"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split("\n")[1:]  # 跳过标题行
                
                for line in lines[:100]:  # 限制 top 100 进程
                    parts = line.split(None, 10)
                    if len(parts) >= 11:
                        rss_kb = float(parts[5]) if parts[5].isdigit() else 0
                        
                        processes.append(self._create_process_info(
                            name=parts[10].split("/")[-1] if "/" in parts[10] else parts[10],
                            pid=int(parts[1]),
                            memory_kb=rss_kb,
                            cpu_percent=float(parts[2]) if self._is_float(parts[2]) else 0,
                            path=parts[10] if "/" in parts[10] else "",
                        ))
                        
        except Exception as e:
            logger.warning(f"Linux 进程收集失败: {e}")
        
        return processes
    
    def _create_process_info(
        self,
        name: str,
        pid: int,
        memory_bytes: int = 0,
        memory_kb: float = 0,
        memory_percent: float = 0,
        cpu_time: float = 0,
        cpu_percent: float = 0,
        path: str = "",
    ) -> Dict[str, Any]:
        """创建统一的进程信息结构"""
        
        # 计算内存 (MB)
        memory_mb = 0.0
        if memory_bytes > 0:
            memory_mb = memory_bytes / (1024 * 1024)
        elif memory_kb > 0:
            memory_mb = memory_kb / 1024
        elif memory_percent > 0:
            memory_mb = memory_percent * 10  # 估算
        
        # 判断是否系统进程
        is_system = self._is_system_process(name, path)
        
        # 检查是否开机自启
        auto_start = self._check_autostart(name, path)
        
        return {
            "packageName": name,
            "appName": name,
            "version": "1.0",
            "memoryUsageMb": round(memory_mb, 2),
            "storageUsageMb": 0.0,  # PC 端难以精确获取
            "batteryDrainPercent": cpu_percent * 0.1,  # 估算
            "cpuUsagePercent": round(cpu_percent, 2),
            "networkUsageMb": 0.0,
            "permissionsGranted": self._get_process_permissions(path),
            "isSystemApp": is_system,
            "backgroundActivity": True,
            "autoStart": auto_start,
        }
    
    def _is_system_process(self, name: str, path: str) -> bool:
        """判断是否系统进程"""
        system_patterns = [
            "System", "kernel", "init", "systemd", "launchd",
            "svchost", "csrss", "smss", "lsass", "services",
            "explorer", "WindowServer", "loginwindow",
        ]
        
        if any(p.lower() in name.lower() for p in system_patterns):
            return True
        
        if self.system == "Windows" and path:
            return "Windows" in path or "System32" in path
        elif self.system == "Darwin" and path:
            return "/System/" in path or "/usr/" in path
        elif path:
            return path.startswith("/usr/") or path.startswith("/sbin/")
        
        return False
    
    def _check_autostart(self, name: str, path: str) -> bool:
        """检查是否开机自启"""
        try:
            if self.system == "Windows":
                # 检查注册表 (简化版)
                import winreg
                locations = [
                    (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run"),
                    (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run"),
                ]
                
                for hive, key_path in locations:
                    try:
                        with winreg.OpenKey(hive, key_path) as key:
                            i = 0
                            while True:
                                try:
                                    val_name, val_data, _ = winreg.EnumValue(key, i)
                                    if name.lower() in val_data.lower():
                                        return True
                                    i += 1
                                except OSError:
                                    break
                    except Exception:
                        pass
                        
            elif self.system == "Darwin":
                # 检查 LaunchAgents
                launch_paths = [
                    os.path.expanduser("~/Library/LaunchAgents"),
                    "/Library/LaunchAgents",
                    "/Library/LaunchDaemons",
                ]
                
                for launch_path in launch_paths:
                    if os.path.exists(launch_path):
                        for plist in os.listdir(launch_path):
                            if name.lower() in plist.lower():
                                return True
                                
            else:  # Linux
                # 检查 systemd 和 autostart
                autostart_paths = [
                    os.path.expanduser("~/.config/autostart"),
                    "/etc/systemd/system",
                    "/etc/init.d",
                ]
                
                for autostart_path in autostart_paths:
                    if os.path.exists(autostart_path):
                        for item in os.listdir(autostart_path):
                            if name.lower() in item.lower():
                                return True
                                
        except Exception as e:
            logger.debug(f"检查自启失败: {e}")
        
        return False
    
    def _get_process_permissions(self, path: str) -> List[str]:
        """获取进程权限 (模拟 Android 格式)"""
        permissions = []
        
        if not path:
            return permissions
        
        # 根据路径推断权限
        if self.system == "Windows":
            if "System32" in path:
                permissions.append("SYSTEM_ACCESS")
            if "AppData" in path:
                permissions.append("USER_DATA_ACCESS")
        else:
            # Unix-like 权限检查
            if path.startswith("/usr/sbin") or path.startswith("/sbin"):
                permissions.append("ROOT_ACCESS")
            if "network" in path.lower() or "net" in path.lower():
                permissions.append("NETWORK_ACCESS")
        
        return permissions
    
    def _is_float(self, s: str) -> bool:
        """检查字符串是否为浮点数"""
        try:
            float(s)
            return True
        except ValueError:
            return False
    
    async def get_system_summary(self) -> Dict[str, Any]:
        """获取系统资源摘要"""
        summary = {
            "platform": self.system,
            "timestamp": int(time.time() * 1000),
        }
        
        try:
            if self.system == "Windows":
                # Windows 内存信息
                cmd = ["powershell", "-Command", 
                       "(Get-CimInstance Win32_OperatingSystem | "
                       "Select-Object TotalVisibleMemorySize, FreePhysicalMemory | "
                       "ConvertTo-Json -Compress)"]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    import json
                    data = json.loads(result.stdout)
                    summary["totalMemoryMb"] = data.get("TotalVisibleMemorySize", 0) / 1024
                    summary["availableMemoryMb"] = data.get("FreePhysicalMemory", 0) / 1024
            else:
                # Unix-like 内存信息
                with open("/proc/meminfo", "r") as f:
                    meminfo = {}
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            key = parts[0].strip()
                            value = int(parts[1].strip().split()[0])
                            meminfo[key] = value
                    
                    summary["totalMemoryMb"] = meminfo.get("MemTotal", 0) / 1024
                    summary["availableMemoryMb"] = meminfo.get("MemAvailable", meminfo.get("MemFree", 0)) / 1024
                    
        except Exception as e:
            logger.warning(f"获取系统摘要失败: {e}")
        
        return summary


# 单例
immune_telemetry = ImmuneTelemetry()

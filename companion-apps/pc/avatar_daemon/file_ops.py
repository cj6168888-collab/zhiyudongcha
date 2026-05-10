"""
文件操作模块 - Project Tidying Up (断舍离协议)
支持文件扫描、重命名、移动、删除、归档操作
"""

import asyncio
import hashlib
import logging
import os
import shutil
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger('avatar_daemon')


@dataclass
class FileMetadata:
    """文件元数据"""
    fileName: str
    filePath: str
    fileSize: int
    createdAt: str
    modifiedAt: str
    accessedAt: str
    fileHash: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class FileAction:
    """文件操作"""
    filePath: str
    action: str  # RENAME, MOVE, DELETE, ARCHIVE
    newPath: Optional[str] = None
    newName: Optional[str] = None
    status: str = 'PENDING'
    error: Optional[str] = None


class FileOperator:
    """文件操作执行器"""
    
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.archive_base = Path.home() / 'Archive'
        
    async def scan_directory(
        self,
        path: str,
        recursive: bool = True,
        include_hidden: bool = False,
        extensions: Optional[List[str]] = None,
        compute_hash: bool = False,
    ) -> List[FileMetadata]:
        """扫描目录获取文件元数据"""
        files: List[FileMetadata] = []
        scan_path = Path(path).expanduser()
        
        if not scan_path.exists():
            logger.error(f"Path does not exist: {path}")
            return files
        
        try:
            if recursive:
                iterator = scan_path.rglob('*')
            else:
                iterator = scan_path.glob('*')
            
            for file_path in iterator:
                if not file_path.is_file():
                    continue
                
                if not include_hidden and file_path.name.startswith('.'):
                    continue
                
                if extensions:
                    ext = file_path.suffix.lower()
                    if ext not in extensions and ext.lstrip('.') not in extensions:
                        continue
                
                try:
                    stat = file_path.stat()
                    
                    file_hash = None
                    if compute_hash:
                        file_hash = await self._compute_file_hash(file_path)
                    
                    metadata = FileMetadata(
                        fileName=file_path.name,
                        filePath=str(file_path),
                        fileSize=stat.st_size,
                        createdAt=datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        modifiedAt=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        accessedAt=datetime.fromtimestamp(stat.st_atime).isoformat(),
                        fileHash=file_hash,
                    )
                    files.append(metadata)
                    
                except (PermissionError, OSError) as e:
                    logger.warning(f"Cannot access file {file_path}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error scanning directory {path}: {e}")
        
        return files
    
    async def _compute_file_hash(self, file_path: Path, chunk_size: int = 8192) -> str:
        """计算文件MD5哈希（异步）"""
        def _hash_sync():
            md5 = hashlib.md5()
            try:
                with open(file_path, 'rb') as f:
                    while chunk := f.read(chunk_size):
                        md5.update(chunk)
                return md5.hexdigest()
            except Exception:
                return ''
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _hash_sync)
    
    async def rename_file(self, file_path: str, new_name: str) -> Tuple[bool, str]:
        """重命名文件"""
        try:
            src = Path(file_path)
            if not src.exists():
                return False, f"File not found: {file_path}"
            
            dst = src.parent / new_name
            if dst.exists():
                return False, f"Target file already exists: {dst}"
            
            shutil.move(str(src), str(dst))
            logger.info(f"Renamed: {src.name} -> {new_name}")
            return True, str(dst)
            
        except Exception as e:
            logger.error(f"Rename failed: {e}")
            return False, str(e)
    
    async def move_file(self, file_path: str, target_path: str) -> Tuple[bool, str]:
        """移动文件"""
        try:
            src = Path(file_path)
            if not src.exists():
                return False, f"File not found: {file_path}"
            
            dst = Path(target_path)
            
            # 如果目标是目录，则移动到该目录下
            if dst.is_dir():
                dst = dst / src.name
            else:
                # 确保目标目录存在
                dst.parent.mkdir(parents=True, exist_ok=True)
            
            if dst.exists():
                return False, f"Target file already exists: {dst}"
            
            shutil.move(str(src), str(dst))
            logger.info(f"Moved: {src} -> {dst}")
            return True, str(dst)
            
        except Exception as e:
            logger.error(f"Move failed: {e}")
            return False, str(e)
    
    async def delete_file(self, file_path: str, to_trash: bool = True) -> Tuple[bool, str]:
        """删除文件"""
        try:
            src = Path(file_path)
            if not src.exists():
                return False, f"File not found: {file_path}"
            
            if to_trash:
                # 移动到回收站（系统回收站或自定义）
                trash_path = Path.home() / '.Trash' / src.name
                if not trash_path.parent.exists():
                    trash_path = Path.home() / 'Trash' / src.name
                    trash_path.parent.mkdir(parents=True, exist_ok=True)
                
                # 避免名称冲突
                if trash_path.exists():
                    timestamp = int(time.time())
                    trash_path = trash_path.parent / f"{src.stem}_{timestamp}{src.suffix}"
                
                shutil.move(str(src), str(trash_path))
                logger.info(f"Moved to trash: {src} -> {trash_path}")
            else:
                os.remove(str(src))
                logger.info(f"Deleted: {src}")
            
            return True, f"Deleted: {src}"
            
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return False, str(e)
    
    async def archive_file(
        self,
        file_path: str,
        category: Optional[str] = None,
        archive_base: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """归档文件"""
        try:
            src = Path(file_path)
            if not src.exists():
                return False, f"File not found: {file_path}"
            
            base = Path(archive_base) if archive_base else self.archive_base
            year = datetime.now().strftime('%Y')
            
            if category:
                archive_dir = base / year / category
            else:
                archive_dir = base / year / 'General'
            
            archive_dir.mkdir(parents=True, exist_ok=True)
            dst = archive_dir / src.name
            
            # 避免名称冲突
            if dst.exists():
                timestamp = int(time.time())
                dst = archive_dir / f"{src.stem}_{timestamp}{src.suffix}"
            
            shutil.move(str(src), str(dst))
            logger.info(f"Archived: {src} -> {dst}")
            return True, str(dst)
            
        except Exception as e:
            logger.error(f"Archive failed: {e}")
            return False, str(e)
    
    async def execute_actions(
        self,
        actions: List[FileAction],
        dry_run: bool = False,
    ) -> List[FileAction]:
        """批量执行文件操作"""
        results: List[FileAction] = []
        
        for action in actions:
            result = FileAction(
                filePath=action.filePath,
                action=action.action,
                newPath=action.newPath,
                newName=action.newName,
            )
            
            if dry_run:
                result.status = 'SKIPPED'
                result.error = 'Dry run mode'
                results.append(result)
                continue
            
            try:
                if action.action == 'RENAME':
                    if not action.newName:
                        result.status = 'FAILED'
                        result.error = 'New name not specified'
                    else:
                        success, msg = await self.rename_file(action.filePath, action.newName)
                        result.status = 'COMPLETED' if success else 'FAILED'
                        result.error = None if success else msg
                        result.newPath = msg if success else None
                
                elif action.action == 'MOVE':
                    if not action.newPath:
                        result.status = 'FAILED'
                        result.error = 'Target path not specified'
                    else:
                        success, msg = await self.move_file(action.filePath, action.newPath)
                        result.status = 'COMPLETED' if success else 'FAILED'
                        result.error = None if success else msg
                
                elif action.action == 'DELETE':
                    success, msg = await self.delete_file(action.filePath, to_trash=True)
                    result.status = 'COMPLETED' if success else 'FAILED'
                    result.error = None if success else msg
                
                elif action.action == 'ARCHIVE':
                    success, msg = await self.archive_file(action.filePath)
                    result.status = 'COMPLETED' if success else 'FAILED'
                    result.error = None if success else msg
                    result.newPath = msg if success else None
                
                else:
                    result.status = 'FAILED'
                    result.error = f'Unknown action: {action.action}'
                    
            except Exception as e:
                result.status = 'FAILED'
                result.error = str(e)
            
            results.append(result)
        
        return results
    
    async def scan_desktop(self, compute_hash: bool = False) -> List[FileMetadata]:
        """扫描桌面"""
        import platform
        
        system = platform.system()
        
        if system == 'Windows':
            desktop = Path.home() / 'Desktop'
        elif system == 'Darwin':  # macOS
            desktop = Path.home() / 'Desktop'
        else:  # Linux
            desktop = Path.home() / 'Desktop'
            if not desktop.exists():
                desktop = Path.home() / '桌面'
        
        if not desktop.exists():
            logger.warning(f"Desktop not found: {desktop}")
            return []
        
        return await self.scan_directory(
            str(desktop),
            recursive=False,
            compute_hash=compute_hash,
        )
    
    async def find_duplicates(
        self,
        paths: List[str],
        by_hash: bool = True,
    ) -> Dict[str, List[FileMetadata]]:
        """查找重复文件"""
        all_files: List[FileMetadata] = []
        
        for path in paths:
            files = await self.scan_directory(
                path,
                recursive=True,
                compute_hash=by_hash,
            )
            all_files.extend(files)
        
        # 按哈希分组
        hash_groups: Dict[str, List[FileMetadata]] = {}
        for f in all_files:
            if not f.fileHash:
                continue
            if f.fileHash not in hash_groups:
                hash_groups[f.fileHash] = []
            hash_groups[f.fileHash].append(f)
        
        # 只返回有重复的组
        return {h: files for h, files in hash_groups.items() if len(files) > 1}
    
    async def get_cold_files(
        self,
        path: str,
        days_threshold: int = 90,
    ) -> List[FileMetadata]:
        """获取冷文件（长期未访问）"""
        files = await self.scan_directory(path, recursive=True)
        
        threshold = datetime.now().timestamp() - (days_threshold * 24 * 60 * 60)
        cold_files: List[FileMetadata] = []
        
        for f in files:
            try:
                access_time = datetime.fromisoformat(f.accessedAt).timestamp()
                if access_time < threshold:
                    cold_files.append(f)
            except (ValueError, OSError):
                continue
        
        return cold_files


# 全局文件操作实例
file_operator: Optional[FileOperator] = None


def get_file_operator(device_id: str = 'default') -> FileOperator:
    """获取文件操作实例"""
    global file_operator
    if file_operator is None:
        file_operator = FileOperator(device_id)
    return file_operator

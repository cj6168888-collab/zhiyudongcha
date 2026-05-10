/**
 * 文件服务 - FileService
 * 
 * 提供手机文件系统操作功能
 * 需要Android伴侣应用支持存储权限 (Storage Access Framework)
 */

import { createServiceLogger } from '../../lib/logger';
import deviceConnectionService from './DeviceConnectionService';
import mobileExecutorService from './MobileExecutorService';
import type {
  FileEntry,
  FileContent,
  OperationError,
} from './types';
import { createError, ERROR_CODES } from './types';

const logger = createServiceLogger('FileService');

interface ListFilesOptions {
  path: string;
  includeHidden?: boolean;
  sortBy?: 'name' | 'date' | 'size';
  sortOrder?: 'asc' | 'desc';
  fileType?: string;
}

interface ReadFileOptions {
  path: string;
  encoding: 'utf-8' | 'base64' | 'binary';
  offset?: number;
  limit?: number;
}

interface WriteFileOptions {
  path: string;
  content?: string;
  base64?: string;
  encoding: 'utf-8' | 'base64';
  createDirectories?: boolean;
}

interface SearchOptions {
  path: string;
  pattern: string;
  caseSensitive?: boolean;
  includeDirectories?: boolean;
  maxResults?: number;
}

const COMMON_MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function getMimeType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return COMMON_MIME_TYPES[ext] || 'application/octet-stream';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

class FileService {
  async listFiles(deviceId: string, options: ListFilesOptions): Promise<FileEntry[]> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const payload = {
        path: options.path,
        includeHidden: options.includeHidden ?? false,
        sortBy: options.sortBy || 'name',
        sortOrder: options.sortOrder || 'asc',
        fileType: options.fileType,
      };

      const result = await deviceConnectionService.sendRequest<{ files: FileEntry[] }>(
        deviceId,
        'FILES',
        payload,
        20000
      );

      const files = (result.files || []).map(file => ({
        ...file,
        mimeType: file.mimeType || (file.isDirectory ? 'directory' : getMimeType(file.name)),
        permissions: file.permissions || (file.isDirectory ? 'rwxr-xr-x' : 'rw-r--r--'),
      }));

      logger.info({
        deviceId,
        path: options.path,
        count: files.length,
      }, 'Files listed');

      return files;
    } catch (error) {
      logger.error({ deviceId, path: options.path, error }, 'Failed to list files');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to list files',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async readFile(deviceId: string, options: ReadFileOptions): Promise<FileContent> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!options.path) {
      throw createError(ERROR_CODES.FILE_FAILED, 'File path is required');
    }

    try {
      const payload = {
        path: options.path,
        encoding: options.encoding,
        offset: options.offset,
        limit: options.limit,
      };

      const result = await deviceConnectionService.sendRequest<{
        path: string;
        content?: string;
        base64?: string;
        encoding: string;
        size: number;
      }>(
        deviceId,
        'FILE_CONTENT',
        payload,
        60000
      );

      logger.info({
        deviceId,
        path: options.path,
        size: result.size,
      }, 'File read');

      return {
        path: result.path,
        content: result.content,
        base64: result.base64,
        encoding: result.encoding as 'utf-8' | 'base64' | 'binary',
        size: result.size,
      };
    } catch (error) {
      logger.error({ deviceId, path: options.path, error }, 'Failed to read file');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to read file',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async writeFile(deviceId: string, options: WriteFileOptions): Promise<{ success: boolean; path: string }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!options.path || (!options.content && !options.base64)) {
      throw createError(ERROR_CODES.FILE_FAILED, 'File path and content are required');
    }

    try {
      const payload = {
        path: options.path,
        content: options.content,
        base64: options.base64,
        encoding: options.encoding,
        createDirectories: options.createDirectories ?? true,
      };

      const result = await deviceConnectionService.sendRequest<{ success: boolean; path: string }>(
        deviceId,
        'FILE_WRITE',
        payload,
        60000
      );

      logger.info({
        deviceId,
        path: options.path,
        success: result.success,
      }, 'File written');

      return result;
    } catch (error) {
      logger.error({ deviceId, path: options.path, error }, 'Failed to write file');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to write file',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async deleteFile(deviceId: string, path: string, recursive: boolean = false): Promise<{ success: boolean }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!path) {
      throw createError(ERROR_CODES.FILE_FAILED, 'File path is required');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ success: boolean }>(
        deviceId,
        'FILE_DELETE',
        { path, recursive },
        30000
      );

      logger.info({ deviceId, path, success: result.success }, 'File deleted');

      return result;
    } catch (error) {
      logger.error({ deviceId, path, error }, 'Failed to delete file');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to delete file',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async createDirectory(deviceId: string, path: string): Promise<{ success: boolean }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!path) {
      throw createError(ERROR_CODES.FILE_FAILED, 'Directory path is required');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ success: boolean }>(
        deviceId,
        'FILE_MKDIR',
        { path },
        10000
      );

      logger.info({ deviceId, path, success: result.success }, 'Directory created');

      return result;
    } catch (error) {
      logger.error({ deviceId, path, error }, 'Failed to create directory');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to create directory',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async copyFile(deviceId: string, sourcePath: string, destinationPath: string): Promise<{ success: boolean }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ success: boolean }>(
        deviceId,
        'FILE_COPY',
        { sourcePath, destinationPath },
        60000
      );

      logger.info({
        deviceId,
        sourcePath,
        destinationPath,
        success: result.success,
      }, 'File copied');

      return result;
    } catch (error) {
      logger.error({ deviceId, sourcePath, destinationPath, error }, 'Failed to copy file');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to copy file',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async moveFile(deviceId: string, sourcePath: string, destinationPath: string): Promise<{ success: boolean }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{ success: boolean }>(
        deviceId,
        'FILE_MOVE',
        { sourcePath, destinationPath },
        30000
      );

      logger.info({
        deviceId,
        sourcePath,
        destinationPath,
        success: result.success,
      }, 'File moved');

      return result;
    } catch (error) {
      logger.error({ deviceId, sourcePath, destinationPath, error }, 'Failed to move file');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to move file',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async searchFiles(deviceId: string, options: SearchOptions): Promise<FileEntry[]> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const payload = {
        path: options.path,
        pattern: options.pattern,
        caseSensitive: options.caseSensitive ?? false,
        includeDirectories: options.includeDirectories ?? true,
        maxResults: options.maxResults || 100,
      };

      const result = await deviceConnectionService.sendRequest<{ files: FileEntry[] }>(
        deviceId,
        'FILE_SEARCH',
        payload,
        60000
      );

      logger.info({
        deviceId,
        path: options.path,
        pattern: options.pattern,
        count: result.files?.length || 0,
      }, 'Files searched');

      return result.files || [];
    } catch (error) {
      logger.error({ deviceId, pattern: options.pattern, error }, 'Failed to search files');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to search files',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getStorageInfo(deviceId: string): Promise<{
    totalSpace: number;
    freeSpace: number;
    usedSpace: number;
    usedPercentage: number;
  }> {
    const validationError = mobileExecutorService.validateDeviceOperation(deviceId, 'fileSystem');
    if (validationError) {
      throw validationError;
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    try {
      const result = await deviceConnectionService.sendRequest<{
        totalSpace: number;
        freeSpace: number;
      }>(
        deviceId,
        'STORAGE_INFO',
        {},
        10000
      );

      const usedSpace = result.totalSpace - result.freeSpace;
      const usedPercentage = Math.round((usedSpace / result.totalSpace) * 100);

      return {
        totalSpace: result.totalSpace,
        freeSpace: result.freeSpace,
        usedSpace,
        usedPercentage,
      };
    } catch (error) {
      logger.error({ deviceId, error }, 'Failed to get storage info');
      throw createError(
        ERROR_CODES.FILE_FAILED,
        'Failed to get storage information',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  formatFileSize(size: number): string {
    return formatFileSize(size);
  }

  getMimeType(filename: string): string {
    return getMimeType(filename);
  }
}

export const fileService = new FileService();
export default fileService;

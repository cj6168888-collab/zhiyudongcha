/**
 * API版本控制中间件 - 技术债务清理
 * 
 * 功能：
 * 1. 请求头版本协商（Accept-Version / X-API-Version）
 * 2. URL路径版本（/v1/, /v2/）
 * 3. 版本兼容性检查
 * 4. 弃用警告
 * 5. 版本统计
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('APIVersion');

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
      apiVersionInfo?: APIVersion;
    }
  }
}

export interface APIVersion {
  major: number;
  minor: number;
  patch: number;
  deprecated?: boolean;
  sunsetDate?: string;
  releaseDate: string;
}

export interface VersionConfig {
  currentVersion: string;
  supportedVersions: string[];
  deprecatedVersions: string[];
  defaultVersion: string;
  headerName: string;
}

const VERSIONS: Record<string, APIVersion> = {
  'v1': {
    major: 1,
    minor: 0,
    patch: 0,
    releaseDate: '2024-01-01',
  },
  'v2': {
    major: 2,
    minor: 0,
    patch: 0,
    releaseDate: '2025-01-01',
  },
  'v3': {
    major: 3,
    minor: 0,
    patch: 0,
    releaseDate: '2026-01-01',
  },
};

const DEFAULT_CONFIG: VersionConfig = {
  currentVersion: 'v3',
  supportedVersions: ['v1', 'v2', 'v3'],
  deprecatedVersions: ['v1'],
  defaultVersion: 'v3',
  headerName: 'X-API-Version',
};

let versionStats: Record<string, number> = {};

export function parseVersion(versionStr: string): APIVersion | null {
  const normalized = versionStr.toLowerCase().replace(/^v/, 'v');
  return VERSIONS[normalized] || null;
}

export function compareVersions(v1: string, v2: string): number {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);
  
  if (!ver1 || !ver2) return 0;
  
  if (ver1.major !== ver2.major) return ver1.major - ver2.major;
  if (ver1.minor !== ver2.minor) return ver1.minor - ver2.minor;
  return ver1.patch - ver2.patch;
}

export function createVersionMiddleware(config: Partial<VersionConfig> = {}): RequestHandler {
  const finalConfig: VersionConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    let requestedVersion: string | null = null;

    // 1. 检查URL路径版本 (/v1/, /v2/, /v3/)
    const pathMatch = req.path.match(/^\/(v\d+)\//);
    if (pathMatch) {
      requestedVersion = pathMatch[1];
    }

    // 2. 检查请求头
    if (!requestedVersion) {
      requestedVersion = (
        req.headers[finalConfig.headerName.toLowerCase()] ||
        req.headers['accept-version'] ||
        req.headers['api-version']
      ) as string | undefined || null;
    }

    // 3. 使用默认版本
    if (!requestedVersion) {
      requestedVersion = finalConfig.defaultVersion;
    }

    // 归一化版本号
    requestedVersion = requestedVersion.toLowerCase().replace(/^v/, 'v');
    if (!requestedVersion.startsWith('v')) {
      requestedVersion = 'v' + requestedVersion;
    }

    // 验证版本
    if (!finalConfig.supportedVersions.includes(requestedVersion)) {
      return res.status(400).json({
        error: 'UNSUPPORTED_API_VERSION',
        message: `不支持的API版本: ${requestedVersion}`,
        supportedVersions: finalConfig.supportedVersions,
        currentVersion: finalConfig.currentVersion,
      });
    }

    // 设置版本信息到请求对象
    req.apiVersion = requestedVersion;
    req.apiVersionInfo = VERSIONS[requestedVersion];

    // 设置响应头
    res.setHeader(finalConfig.headerName, requestedVersion);
    res.setHeader('X-API-Current-Version', finalConfig.currentVersion);

    // 检查弃用警告
    if (finalConfig.deprecatedVersions.includes(requestedVersion)) {
      const versionInfo = VERSIONS[requestedVersion];
      res.setHeader('Deprecation', 'true');
      res.setHeader('X-API-Deprecated', 'true');
      
      if (versionInfo?.sunsetDate) {
        res.setHeader('Sunset', versionInfo.sunsetDate);
      }
      
      res.setHeader(
        'X-API-Deprecation-Notice',
        `API版本 ${requestedVersion} 已弃用，请升级到 ${finalConfig.currentVersion}`
      );
    }

    // 更新统计
    versionStats[requestedVersion] = (versionStats[requestedVersion] || 0) + 1;

    next();
  };
}

// 版本路由适配器
export function versionRoute(versions: Record<string, RequestHandler>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiVersion = req.apiVersion || 'v3';
    
    // 查找匹配的版本处理器
    let handler = versions[apiVersion];
    
    // 如果没有精确匹配，尝试向下兼容
    if (!handler) {
      const sortedVersions = Object.keys(versions).sort(compareVersions).reverse();
      for (const v of sortedVersions) {
        if (compareVersions(apiVersion, v) >= 0) {
          handler = versions[v];
          break;
        }
      }
    }

    if (handler) {
      return handler(req, res, next);
    }

    // 使用最新版本
    const latestVersion = Object.keys(versions).sort(compareVersions).pop();
    if (latestVersion) {
      return versions[latestVersion](req, res, next);
    }

    next();
  };
}

// 获取版本统计
export function getVersionStats(): {
  stats: Record<string, number>;
  config: VersionConfig;
  versions: Record<string, APIVersion>;
} {
  return {
    stats: { ...versionStats },
    config: DEFAULT_CONFIG,
    versions: VERSIONS,
  };
}

// 重置统计
export function resetVersionStats(): void {
  versionStats = {};
}

// 版本信息端点
export function versionInfoHandler(req: Request, res: Response): void {
  res.json({
    current: DEFAULT_CONFIG.currentVersion,
    supported: DEFAULT_CONFIG.supportedVersions,
    deprecated: DEFAULT_CONFIG.deprecatedVersions,
    default: DEFAULT_CONFIG.defaultVersion,
    versions: VERSIONS,
    requested: req.apiVersion,
  });
}

// 版本检查辅助函数
export function isVersion(req: Request, version: string): boolean {
  return req.apiVersion === version;
}

export function isVersionAtLeast(req: Request, minVersion: string): boolean {
  return compareVersions(req.apiVersion || 'v1', minVersion) >= 0;
}

export function isVersionAtMost(req: Request, maxVersion: string): boolean {
  return compareVersions(req.apiVersion || 'v1', maxVersion) <= 0;
}

logger.info('API版本控制中间件已加载');

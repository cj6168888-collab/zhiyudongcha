import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('ApiKeyMiddleware');

/**
 * API Key 验证中间件
 * 通过请求头 `x-api-key` 与环境变量 `API_KEY` 对比。
 * 若不匹配返回 401 错误。
 */
export function createApiKeyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.API_KEY;
    if (!expectedKey) {
      logger.warn('API_KEY 未配置，跳过 API Key 验证');
      return next();
    }
    if (providedKey !== expectedKey) {
      logger.warn('无效的 API Key', { ip: req.ip, path: req.path });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: '无效的 API Key' },
      });
    }
    next();
  };
}

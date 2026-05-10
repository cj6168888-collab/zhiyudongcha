import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `路径 ${req.path} 不存在`,
    timestamp: new Date().toISOString()
  });
}

function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err: err.message, stack: err.stack, path: req.path }, 'API错误');
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
}

export function createMainRouter(): Router {
  const mainRouter = Router();
  
  logger.info('开始注册API路由');
  
  // Health check
  mainRouter.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  logger.info('API路由注册完成');
  
  mainRouter.use(notFoundHandler);
  mainRouter.use(errorHandler);
  return mainRouter;
}

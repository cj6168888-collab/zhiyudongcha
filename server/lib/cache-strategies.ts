import { Request, Response, NextFunction } from 'express'
import { responseCache } from './cache-middleware'

interface CacheOptions {
  ttl?: number;
  prefix?: string;
  condition?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  getOnly?: boolean;
}

interface RouteCacheOptions extends Partial<CacheOptions> {
  // 可以添加其他路由特定的选项
}

/**
 * API缓存中间件应用
 * 为不同类型的API端点应用合适的缓存策略
 */

// 用户信息缓存 - 5分钟
export const userInfoCache = responseCache({
  ttl: 300,
  prefix: 'user_info',
  condition: (req) => req.method === 'GET' && !req.url.includes('/profile'),
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous'
    const endpoint = req.url?.split('?')[0] || '/'
    return `user:${userId}:${endpoint}`
  }
})

// 配置信息缓存 - 30分钟
export const configCache = responseCache({
  ttl: 1800,
  prefix: 'config',
  condition: (req) => req.method === 'GET',
  keyGenerator: (req) => {
    const userId = req.user?.id || 'global'
    return `config:${userId}:${req.url}`
  }
})

// 统计数据缓存 - 1分钟（实时性要求高）
export const statsCache = responseCache({
  ttl: 60,
  prefix: 'stats',
  condition: (req) => req.method === 'GET' && req.url.includes('/stats'),
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous'
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const params = url.searchParams.toString()
    return `stats:${userId}:${req.url?.split('?')[0]}${params ? '?' + params : ''}`
  }
})

// 静态数据缓存 - 1小时
export const staticDataCache = responseCache({
  ttl: 3600,
  prefix: 'static',
  condition: (req) => {
    const staticEndpoints = ['/devices', '/voice-prints/templates', '/function-calling/schemas']
    return req.method === 'GET' && staticEndpoints.some(endpoint => req.url?.includes(endpoint))
  },
  keyGenerator: (req) => `static:${req.url}`
})

// AI对话列表缓存 - 2分钟
export const conversationListCache = responseCache({
  ttl: 120,
  prefix: 'conversation_list',
  condition: (req) => req.method === 'GET' && req.url?.includes('/conversations') && !req.url.includes('/conversations/'),
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous'
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const page = url.searchParams.get('page') || '1'
    const limit = url.searchParams.get('limit') || '10'
    return `conversations:${userId}:page:${page}:limit:${limit}`
  }
})

// 设备信息缓存 - 10分钟
export const deviceInfoCache = responseCache({
  ttl: 600,
  prefix: 'device_info',
  condition: (req) => req.method === 'GET' && req.url?.includes('/devices/') && !req.url.includes('/devices'),
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous'
    const deviceId = req.url?.split('/devices/')[1]?.split('?')[0] || 'unknown'
    return `device:${userId}:${deviceId}`
  }
})

// HP消费记录缓存 - 30秒（需要较高的实时性）
export const hpConsumptionCache = responseCache({
  ttl: 30,
  prefix: 'hp_consumption',
  condition: (req) => req.method === 'GET' && req.url?.includes('/hp-consumption'),
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous'
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const params = url.searchParams.toString()
    return `hp:${userId}:${req.url?.split('?')[0]}${params ? '?' + params : ''}`
  }
})

// 生成文件列表缓存 - 5分钟
export const generatedFilesCache = responseCache({
  ttl: 300,
  prefix: 'generated_files',
  condition: (req) => req.method === 'GET' && req.url?.includes('/generated-files') && !req.url.includes('/generated-files/'),
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous'
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const params = url.searchParams.toString()
    return `files:${userId}:${req.url?.split('?')[0]}${params ? '?' + params : ''}`
  }
})

// 中间件工厂 - 根据路由模式自动应用缓存
export function applyCacheByRoute(routePattern: string, options: RouteCacheOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.url?.match(new RegExp(routePattern))) {
      return next()
    }

    // 根据路由模式选择合适的缓存策略
    let cacheMiddleware

    if (routePattern.includes('/stats')) {
      cacheMiddleware = statsCache
    } else if (routePattern.includes('/config')) {
      cacheMiddleware = configCache
    } else if (routePattern.includes('/conversations')) {
      cacheMiddleware = conversationListCache
    } else if (routePattern.includes('/devices/')) {
      cacheMiddleware = deviceInfoCache
    } else if (routePattern.includes('/hp-consumption')) {
      cacheMiddleware = hpConsumptionCache
    } else if (routePattern.includes('/generated-files')) {
      cacheMiddleware = generatedFilesCache
    } else if (routePattern.includes('/devices') || routePattern.includes('/voice-prints')) {
      cacheMiddleware = staticDataCache
    } else {
      // 默认缓存策略
      cacheMiddleware = responseCache({
        ttl: options.ttl || 300,
        prefix: options.prefix || 'api',
        ...options
      })
    }

    return cacheMiddleware(req, res, next)
  }
}

// 智能缓存中间件 - 根据请求特征自动选择缓存策略
export function smartCache(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET') {
    return next()
  }

  const url = req.url || ''
  
  // API端点到缓存策略的映射
  const cacheStrategies = [
    { pattern: /\/stats$/, middleware: statsCache },
    { pattern: /\/config/, middleware: configCache },
    { pattern: /\/conversations(\/.*)?$/, middleware: conversationListCache },
    { pattern: /\/devices\/[^\/]+/, middleware: deviceInfoCache },
    { pattern: /\/hp-consumption/, middleware: hpConsumptionCache },
    { pattern: /\/generated-files(\/.*)?$/, middleware: generatedFilesCache },
    { pattern: /\/devices$|\/voice-prints/, middleware: staticDataCache },
  ]

  // 找到匹配的缓存策略
  const strategy = cacheStrategies.find(s => s.pattern.test(url))
  
  if (strategy) {
    return strategy.middleware(req, res, next)
  }

  // 默认不缓存
  next()
}

export {
  responseCache
}
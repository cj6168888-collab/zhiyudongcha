/**
 * Sentry 错误监控配置
 * 实时捕获前端错误和性能问题
 */

import * as Sentry from '@sentry/react';

const getClientEnv = (key: string): string => {
  const viteEnv = (import.meta as any).env?.[key];
  if (viteEnv) return viteEnv;
  return typeof process !== 'undefined' ? process.env[key] || '' : '';
};

// Sentry 配置
const initSentry = () => {
  const environment = getClientEnv('MODE') || getClientEnv('NODE_ENV') || 'development';
  const dsn = getClientEnv('VITE_SENTRY_DSN') || getClientEnv('NEXT_PUBLIC_SENTRY_DSN');
  const release = getClientEnv('VITE_APP_VERSION') || getClientEnv('NEXT_PUBLIC_APP_VERSION') || '1.0.0';

  if (typeof window !== 'undefined' && environment === 'production' && dsn && !dsn.includes('your-sentry')) {
    Sentry.init({
      dsn,
      environment,
      release,

      // 性能监控 - 使用默认的 browserProfilingIntegration
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // 错误采样率 (建议 100%)
      sampleRate: 1.0,

      // 只采集指定域名
      allowUrls: [/localhost:3000/, /yourdomain\.com/],

      // 排除浏览器扩展错误
      denyUrls: [
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
      ],

      // 错误处理和脱敏
      beforeSend(event, hint) {
        // 移除敏感信息
        if (event.request?.headers) {
          delete (event.request.headers as any).Authorization;
          delete (event.request.headers as any).Cookie;
        }

        // 过滤低价值错误
        const errorMessage = (hint?.originalException as any)?.message || event.message || '';
        if (typeof errorMessage === 'string') {
          // 过滤常见的无价值错误
          if (errorMessage.includes('Non-Error promise rejection')) {
            return null;
          }
          if (errorMessage.includes('Script error')) {
            return null;
          }
        }

        // 添加自定义上下文
        event.contexts = {
          ...event.contexts,
          app: {
            name: 'Sheng-Yu-Zhu-Shou',
            version: release,
            environment,
          },
          user: {
            id: typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || 'anonymous' : 'anonymous',
            role: typeof localStorage !== 'undefined' ? localStorage.getItem('userRole') || 'guest' : 'guest',
          },
          device: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            screenResolution: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
            language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
          },
        };

        return event;
      },

      // 错误分组
      normalizeDepth: 8,
    });

  }
};

// 手动捕获错误
export const captureError = (error: Error, context?: Record<string, unknown>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Sentry.Context);
      });
    }

    Sentry.captureException(error);
  });
};

// 捕获用户反馈
export const captureFeedback = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

// 性能监控
export const trackPerformance = (name: string, data?: Record<string, number>) => {
  const environment = getClientEnv('MODE') || getClientEnv('NODE_ENV') || 'development';
  if (environment === 'production') {
    Sentry.addBreadcrumb({
      message: `Performance: ${name}`,
      category: 'performance',
      level: 'info',
      data: data || {},
    });
  }
};

// 导出配置函数
export default initSentry;

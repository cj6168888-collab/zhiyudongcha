/**
 * 前端监控和调试集成
 * 统一管理所有监控工具
 */

import initSentry, { captureError, trackPerformance as sentryTrackPerformance } from './sentry';
import { openReplayTracker, trackErrorEvent, trackPerformanceEvent, trackVoiceEvent as openreplayTrackVoiceEvent } from './openreplay';

const getClientEnv = (key: string): string => {
  const viteEnv = (import.meta as any).env?.[key];
  if (viteEnv) return viteEnv;
  return typeof process !== 'undefined' ? process.env[key] || '' : '';
};

const sentryDsn = getClientEnv('VITE_SENTRY_DSN') || getClientEnv('NEXT_PUBLIC_SENTRY_DSN');
const openReplayProjectKey = getClientEnv('VITE_OPENREPLAY_PROJECT_KEY') || getClientEnv('NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY');
const appEnvironment = getClientEnv('MODE') || getClientEnv('NODE_ENV') || 'development';

export interface MonitoringConfig {
  sentry?: {
    dsn: string;
    environment: string;
    tracesSampleRate?: number;
  };
  openreplay?: {
    projectKey: string;
    ingestPoint?: string;
  };
  enablePerformanceMonitoring?: boolean;
  enableUserTracking?: boolean;
  enableErrorTracking?: boolean;
}

class MonitoringManager {
  private isInitialized = false;
  private config: MonitoringConfig | null = null;

  // 初始化所有监控工具
  init(config: MonitoringConfig) {
    if (this.isInitialized) {
      console.warn('[Monitoring] 已初始化，跳过重复初始化');
      return;
    }

    this.config = config;

    try {
      // 初始化 Sentry 错误监控
      if (config.enableErrorTracking !== false && config.sentry) {
        initSentry();
      }

      // 初始化 OpenReplay 会话回放
      if (config.openreplay && typeof window !== 'undefined') {
        openReplayTracker.init(config.openreplay);
      }

      // 启用性能监控
      if (config.enablePerformanceMonitoring !== false) {
        this.initPerformanceMonitoring();
      }

      // 启用用户行为追踪
      if (config.enableUserTracking !== false) {
        this.initUserTracking();
      }

      this.isInitialized = true;

    } catch (error) {
      console.error('[Monitoring] 初始化失败:', error);
    }
  }

  // 性能监控
  private initPerformanceMonitoring() {
    if (typeof window === 'undefined') return;

    // 监听页面加载性能
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;

        sentryTrackPerformance('page_load_time', { value: loadTime });
        trackPerformanceEvent('页面加载时间', loadTime);
      }, 100);
    });

    // 监听 Core Web Vitals
    this.trackCoreWebVitals();

    // 监听长任务
    this.trackLongTasks();
  }

  // 追踪 Core Web Vitals
  private trackCoreWebVitals() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    // LCP (Largest Contentful Paint)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      sentryTrackPerformance('largest_contentful_paint', { value: lastEntry.startTime });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID (First Input Delay)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.processingStart) {
          const delay = entry.processingStart - entry.startTime;
          sentryTrackPerformance('first_input_delay', { value: delay });
        }
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      sentryTrackPerformance('cumulative_layout_shift', { value: clsValue });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }

  // 追踪长任务
  private trackLongTasks() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    const longTaskObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > 50) { // 长于50ms的任务
          sentryTrackPerformance('long_task', { value: entry.duration });
        }
      });
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
  }

  // 用户行为追踪
  private initUserTracking() {
    if (typeof window === 'undefined') return;

    // 追踪页面点击
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const element = this.getElementSelector(target);
      const text = target.textContent?.slice(0, 50) || '';

      openReplayTracker.trackUserInteraction(element, 'click', { text });
    });

    // 追踪表单提交
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      const formName = form.name || form.id || 'unknown-form';

      openReplayTracker.track('form_submit', {
        formName,
        timestamp: Date.now(),
      });
    });

    // 追踪路由变化
    this.trackRouteChanges();
  }

  // 生成元素选择器
  private getElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (typeof element.className === 'string' && element.className.trim()) {
      return `.${element.className.trim().split(/\s+/).join('.')}`;
    }

    return element.tagName.toLowerCase();
  }

  // 追踪路由变化
  private trackRouteChanges() {
    if (typeof window === 'undefined') return;

    // 监听 popstate 事件
    window.addEventListener('popstate', () => {
      this.trackPageView();
    });

    // 监听 pushState 和 replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0);
    };

    // 初始页面视图
    this.trackPageView();
  }

  // 追踪页面视图
  private trackPageView() {
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;

    openReplayTracker.track('page_view', {
      path,
      search,
      hash,
      referrer: document.referrer,
      timestamp: Date.now(),
    });
  }

  // 公共方法：追踪语音事件
  trackVoiceEvent(action: 'start' | 'stop' | 'error', details?: any) {
    openreplayTrackVoiceEvent(action, details);
  }

  // 公共方法：追踪错误
  trackError(error: Error, context?: string) {
    captureError(error, { context });
    trackErrorEvent(error, context);
  }

  // 公共方法：追踪性能
  trackPerformance(metric: string, value: number) {
    trackPerformance(metric, value);
    trackPerformanceEvent(metric, value);
  }

  // 获取配置状态
  isConfigured(): boolean {
    return this.isInitialized;
  }

  // 停止所有监控
  stop() {
    openReplayTracker.stop();
  }
}

// 创建全局实例
export const monitoringManager = new MonitoringManager();

// 便捷导出
export const initMonitoring = (config: MonitoringConfig) => {
  monitoringManager.init(config);
};

export const trackVoice = (action: 'start' | 'stop' | 'error', details?: any) => {
  monitoringManager.trackVoiceEvent(action, details);
};

export const trackError = (error: Error, context?: string) => {
  monitoringManager.trackError(error, context);
};

export const trackPerformance = (metric: string, value: number) => {
  monitoringManager.trackPerformance(metric, value);
};

// 默认配置
export const defaultMonitoringConfig: MonitoringConfig = {
  enableErrorTracking: true,
  enablePerformanceMonitoring: true,
  enableUserTracking: true,
  sentry: sentryDsn && !sentryDsn.includes('your-sentry') ? {
    dsn: sentryDsn,
    environment: appEnvironment,
    tracesSampleRate: 0.1,
  } : undefined,
  openreplay: openReplayProjectKey && !openReplayProjectKey.includes('your-openreplay') ? {
    projectKey: openReplayProjectKey,
  } : undefined,
};

export default monitoringManager;

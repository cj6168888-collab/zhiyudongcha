/**
 * OpenReplay 会话回放配置
 * 记录用户交互，帮助分析用户体验问题
 */

interface OpenReplayConfig {
  projectKey: string;
  ingestPoint?: string;
  obscureTextEmails?: boolean;
  obscureTextNumbers?: boolean;
  obscureInputDates?: boolean;
  respectDoNotTrack?: boolean;
}

declare global {
  interface Window {
    openreplay?: {
      start: (config: OpenReplayConfig) => void;
      stop: () => void;
      'trk': (event: string, data?: any) => void;
      'setUserID': (userId: string) => void;
      'setUserEmail': (email: string) => void;
      'setMetadata': (key: string, value: string) => void;
    };
  }
}

class OpenReplayTracker {
  private isInitialized = false;
  private config: OpenReplayConfig | null = null;

  // 初始化 OpenReplay
  init(config: OpenReplayConfig) {
    if (typeof window === 'undefined') {
      console.warn('[OpenReplay] Window not available, skipping initialization');
      return;
    }

    if (!config.projectKey || config.projectKey.includes('your-openreplay')) {
      console.info('[OpenReplay] Project key not configured, skipping initialization');
      return;
    }

    this.config = {
      obscureTextEmails: true, // 模糊化邮箱
      obscureTextNumbers: false, // 保留数字以便调试
      obscureInputDates: false,
      respectDoNotTrack: true,
      ingestPoint: 'https://static.openreplay.com',
      ...config,
    };

    // 加载 OpenReplay 脚本
    this.loadScript()
      .then(() => {
        if (window.openreplay) {
          window.openreplay.start(this.config!);
          this.isInitialized = true;

          // 设置用户信息
          this.setUserContext();
        }
      })
      .catch((error) => {
        console.error('[OpenReplay] 加载失败:', error);
      });
  }

  // 加载 OpenReplay 脚本
  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.openreplay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.src = `${this.config?.ingestPoint || 'https://static.openreplay.com'}/openreplay.js`;

      script.onload = () => resolve();
      script.onerror = () => reject(new Error('OpenReplay script load failed'));

      document.head.appendChild(script);
    });
  }

  // 设置用户上下文
  private setUserContext() {
    if (!this.isInitialized || !window.openreplay) return;

    const userId = localStorage.getItem('userId') || 'anonymous';
    const userRole = localStorage.getItem('userRole') || 'guest';
    const userEmail = localStorage.getItem('userEmail');

    window.openreplay.setUserID(userId);

    if (userEmail) {
      window.openreplay.setUserEmail(userEmail);
    }

    window.openreplay.setMetadata('role', userRole);
    window.openreplay.setMetadata('page', window.location.pathname);
  }

  // 追踪自定义事件
  track(event: string, data?: any) {
    if (!this.isInitialized || !window.openreplay) return;

    window.openreplay.trk(event, data);
  }

  // 追踪语音交互
  trackVoiceInteraction(action: 'start' | 'stop' | 'error', details?: any) {
    this.track('voice_interaction', {
      action,
      timestamp: Date.now(),
      page: window.location.pathname,
      ...details,
    });
  }

  // 追踪错误
  trackError(error: Error, context?: string) {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      page: window.location.pathname,
    });
  }

  // 追踪性能问题
  trackPerformance(metric: string, value: number, unit = 'ms') {
    this.track('performance', {
      metric,
      value,
      unit,
      timestamp: Date.now(),
      page: window.location.pathname,
    });
  }

  // 追踪用户交互
  trackUserInteraction(element: string, action: string, details?: any) {
    this.track('user_interaction', {
      element,
      action,
      timestamp: Date.now(),
      page: window.location.pathname,
      ...details,
    });
  }

  // 停止追踪
  stop() {
    if (this.isInitialized && window.openreplay) {
      window.openreplay.stop();
      this.isInitialized = false;
    }
  }

  // 检查是否已初始化
  isActive(): boolean {
    return this.isInitialized;
  }
}

// 创建全局实例
export const openReplayTracker = new OpenReplayTracker();

// 便捷函数
export const initSessionReplay = (projectKey: string) => {
  openReplayTracker.init({ projectKey });
};

export const trackUserEvent = (event: string, data?: any) => {
  openReplayTracker.track(event, data);
};

export const trackVoiceEvent = (action: 'start' | 'stop' | 'error', details?: any) => {
  openReplayTracker.trackVoiceInteraction(action, details);
};

export const trackErrorEvent = (error: Error, context?: string) => {
  openReplayTracker.trackError(error, context);
};

export const trackPerformanceEvent = (metric: string, value: number, unit?: string) => {
  openReplayTracker.trackPerformance(metric, value, unit);
};

// 在生产环境自动初始化
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // 从环境变量获取项目密钥
  const projectKey = process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY;
  if (projectKey) {
    initSessionReplay(projectKey);
  }
}

// monitoring/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// 监控配置
const MONITORING_CONFIG = {
  endpoint: '/api/analytics/vitals',
  sampleRate: 0.1, // 10% 采样率
  enabled: process.env.NODE_ENV === 'production',
  metrics: ['CLS', 'FID', 'FCP', 'LCP', 'TTFB']
};

// 发送指标到监控服务
function sendToAnalytics(metric: any) {
  if (!MONITORING_CONFIG.enabled || Math.random() > MONITORING_CONFIG.sampleRate) {
    return;
  }

  const body = JSON.stringify({
    ...metric,
    timestamp: new Date().toISOString(),
    version: 'v2.0',
    environment: process.env.NODE_ENV || 'development'
  });

  // 使用 sendBeacon 或 fetch 发送
  if (navigator.sendBeacon) {
    navigator.sendBeacon(MONITORING_CONFIG.endpoint, body);
  } else {
    fetch(MONITORING_CONFIG.endpoint, {
      method: 'POST',
      body,
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// 注册所有 Web Vitals 指标
export function initWebVitalsMonitoring() {
  MONITORING_CONFIG.metrics.forEach(metric => {
    switch (metric) {
      case 'CLS':
        getCLS(sendToAnalytics);
        break;
      case 'FID':
        getFID(sendToAnalytics);
        break;
      case 'FCP':
        getFCP(sendToAnalytics);
        break;
      case 'LCP':
        getLCP(sendToAnalytics);
        break;
      case 'TTFB':
        getTTFB(sendToAnalytics);
        break;
      default:
        console.warn(`Unknown metric: ${metric}`);
    }
  });
}

// 性能预算检查
export function checkPerformanceBudget() {
  const budget = {
    firstContentfulPaint: 1500, // 1.5s
    largestContentfulPaint: 2500, // 2.5s
    totalBlockingTime: 200, // 200ms
    cumulativeLayoutShift: 0.1, // 0.1
    maxFirstInputDelay: 100, // 100ms
  };

  return budget;
}

// 自定义性能指标
export function trackCustomMetric(name: string, value: number) {
  if (!MONITORING_CONFIG.enabled) return;

  const metric = {
    name,
    value,
    startTime: performance.now(),
    id: `${name}_${Date.now()}`,
  };

  sendToAnalytics(metric);
}

// 页面性能分析
export function analyzePagePerformance() {
  const performanceEntries = performance.getEntries();
  const resources = performanceEntries.filter(
    (entry) => entry.entryType === 'resource'
  );

  return {
    totalResources: resources.length,
    totalSize: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
    avgResourceSize: resources.length > 0 ? resources.reduce((sum, resource) => sum + resource.transferSize, 0) / resources.length : 0,
    loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
  };
}

// 初始化监控
if (typeof window !== 'undefined') {
  initWebVitalsMonitoring();
}

export default {
  initWebVitalsMonitoring,
  checkPerformanceBudget,
  trackCustomMetric,
  analyzePagePerformance,
};
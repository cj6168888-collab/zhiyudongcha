/**
 * Performance Monitoring Hook
 *
 * Tracks Core Web Vitals and custom performance metrics
 * with reporting to Sentry and analytics.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('usePerformance');

export interface WebVitals {
  lcp: number | null;
  fcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  inp: number | null;
}

export interface PerformanceMetrics {
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
  navigation: {
    type: string;
    redirectCount: number;
    unloadDuration: number;
    appCacheDuration: number;
    domainLookupDuration: number;
    connectDuration: number;
    requestDuration: number;
    responseDuration: number;
    domInteractiveDuration: number;
    domContentLoadedDuration: number;
    loadDuration: number;
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  } | null;
  resources: {
    count: number;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
  };
}

export interface UsePerformanceReturn {
  webVitals: WebVitals;
  metrics: PerformanceMetrics;
  isLoading: boolean;
  measure: (name: string) => () => number;
  mark: (name: string) => void;
  measureEvent: (name: string, startMark?: string, endMark?: string) => number | null;
  reportToSentry: () => void;
  getScore: () => 'good' | 'needs-improvement' | 'poor';
}

const PERFORMANCE_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  ttfb: { good: 800, poor: 1800 },
  inp: { good: 200, poor: 500 },
};

export function usePerformance(): UsePerformanceReturn {
  const [webVitals, setWebVitals] = useState<WebVitals>({
    lcp: null,
    fcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    inp: null,
  });

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memory: null,
    navigation: null,
    resources: { count: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 },
  });

  const [isLoading, setIsLoading] = useState(true);
  const marksRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) {
      setIsLoading(false);
      return;
    }

    const collectWebVitals = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (navigation) {
        setMetrics((prev) => ({
          ...prev,
          navigation: {
            type: navigation.type,
            redirectCount: navigation.redirectCount,
            unloadDuration: navigation.unloadEventEnd - navigation.unloadEventStart,
            appCacheDuration: navigation.domainLookupStart - navigation.connectStart,
            domainLookupDuration: navigation.domainLookupEnd - navigation.domainLookupStart,
            connectDuration: navigation.connectEnd - navigation.connectStart,
            requestDuration: navigation.responseStart - navigation.requestStart,
            responseDuration: navigation.responseEnd - navigation.responseStart,
            domInteractiveDuration: navigation.domInteractive - (navigation as any).domLoading,
            domContentLoadedDuration: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadDuration: navigation.loadEventEnd - (navigation as any).navigationStart,
            firstPaint: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
          },
        }));

        const ttfb = navigation.responseStart - navigation.requestStart;
        setWebVitals((prev) => ({ ...prev, ttfb }));
      }

      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      const fcp = fcpEntry?.startTime || null;
      setWebVitals((prev) => ({ ...prev, fcp }));

      if ('memory' in performance) {
        const memory = performance.memory as any;
        setMetrics((prev) => ({
          ...prev,
          memory: {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          },
        }));
      }

      const resourceEntries = performance.getEntriesByType('resource') as any[];
      const totalTransferSize = resourceEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      const totalEncodedBodySize = resourceEntries.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0);
      const totalDecodedBodySize = resourceEntries.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0);

      setMetrics((prev) => ({
        ...prev,
        resources: {
          count: resourceEntries.length,
          transferSize: totalTransferSize,
          encodedBodySize: totalEncodedBodySize,
          decodedBodySize: totalDecodedBodySize,
        },
      }));

      setIsLoading(false);
    };

    const observeLCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            setWebVitals((prev) => ({ ...prev, lcp: lastEntry.startTime }));
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
          logger.warn('[usePerformance] LCP observation not supported');
        }
      }
    };

    const observeCLS = () => {
      if ('PerformanceObserver' in window) {
        try {
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries() as any) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            setWebVitals((prev) => ({ ...prev, cls: clsValue }));
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {
          logger.warn('[usePerformance] CLS observation not supported');
        }
      }
    };

    const observeFID = () => {
      if ('PerformanceObserver' in window) {
        try {
          const fidObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            if (entries.length > 0) {
              const firstInput = entries[0] as PerformanceEventTiming;
              const fid = firstInput.processingStart - firstInput.startTime;
              setWebVitals((prev) => ({ ...prev, fid }));
            }
          });
          fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (e) {
          logger.warn('[usePerformance] FID observation not supported');
        }
      }
    };

      const observeINP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const inpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries() as any[];
            if (entries.length > 0) {
              const inpEntry = entries[entries.length - 1];
              const inp = inpEntry.processingEnd - inpEntry.startTime || 0;
              setWebVitals((prev) => ({ ...prev, inp }));
            }
          });
          inpObserver.observe({ type: 'event', buffered: true });
        } catch (e) {
          logger.warn('[usePerformance] INP observation not supported');
        }
      }
    };

    if (document.readyState === 'complete') {
      collectWebVitals();
    } else {
      window.addEventListener('load', collectWebVitals);
    }

    observeLCP();
    observeCLS();
    observeFID();
    observeINP();

    return () => {
      window.removeEventListener('load', collectWebVitals);
    };
  }, []);

  const measure = useCallback((name: string) => {
    const startMark = `${name}_start`;
    performance.mark(startMark);

    return () => {
      const endMark = `${name}_end`;
      performance.mark(endMark);
      const duration = performance.measure(name, startMark, endMark).duration;
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(name);
      return duration;
    };
  }, []);

  const mark = useCallback((name: string) => {
    marksRef.current.set(name, performance.now());
    performance.mark(name);
  }, []);

  const measureEvent = useCallback(
    (name: string, startMark?: string, endMark?: string): number | null => {
      const start = startMark ? marksRef.current.get(startMark) : performance.now();
      const end = endMark ? marksRef.current.get(endMark) : performance.now();

      if (start && end) {
        const duration = end - start;
        logger.debug(`[usePerformance] ${name}: ${duration.toFixed(2)}ms`);
        return duration;
      }

      return null;
    },
    []
  );

  const reportToSentry = useCallback(() => {
    if (typeof window === 'undefined') return;

    logger.info('[usePerformance] Reporting to Sentry:', { webVitals, metrics });

    if (webVitals.lcp) {
      (window as any).Sentry?.addBreadcrumb?.({
        type: 'performance',
        data: { metric: 'LCP', value: webVitals.lcp },
      });
    }

    if (webVitals.fid) {
      (window as any).Sentry?.addBreadcrumb?.({
        type: 'performance',
        data: { metric: 'FID', value: webVitals.fid },
      });
    }

    if (webVitals.cls) {
      (window as any).Sentry?.addBreadcrumb?.({
        type: 'performance',
        data: { metric: 'CLS', value: webVitals.cls },
      });
    }
  }, [webVitals, metrics]);

  const getScore = useCallback((): 'good' | 'needs-improvement' | 'poor' => {
    const scores: number[] = [];

    if (webVitals.lcp) {
      scores.push(webVitals.lcp <= PERFORMANCE_THRESHOLDS.lcp.good ? 1 : webVitals.lcp <= PERFORMANCE_THRESHOLDS.lcp.poor ? 0.5 : 0);
    }
    if (webVitals.fid) {
      scores.push(webVitals.fid <= PERFORMANCE_THRESHOLDS.fid.good ? 1 : webVitals.fid <= PERFORMANCE_THRESHOLDS.fid.poor ? 0.5 : 0);
    }
    if (webVitals.cls) {
      scores.push(webVitals.cls <= PERFORMANCE_THRESHOLDS.cls.good ? 1 : webVitals.cls <= PERFORMANCE_THRESHOLDS.cls.poor ? 0.5 : 0);
    }

    if (scores.length === 0) return 'needs-improvement';

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (avgScore >= 0.9) return 'good';
    if (avgScore >= 0.5) return 'needs-improvement';
    return 'poor';
  }, [webVitals]);

  return {
    webVitals,
    metrics,
    isLoading,
    measure,
    mark,
    measureEvent,
    reportToSentry,
    getScore,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default usePerformance;

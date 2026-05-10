/**
 * 测试结果分析与报告生成器
 * Test Results Analysis & Report Generator
 */

import { test, expect } from '@playwright/test';

interface TestMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  totalDuration: number;
  avgDuration: number;
}

interface PerformanceMetrics {
  lcp: { avg: number; min: number; max: number };
  fcp: { avg: number; min: number; max: number };
  ttfb: { avg: number; min: number; max: number };
  pageLoad: { avg: number; min: number; max: number };
}

interface VoiceMetrics {
  connectionSuccess: number;
  asrLatency: { avg: number; min: number; max: number };
  ttsLatency: { avg: number; min: number; max: number };
  errorRate: number;
}

interface ErrorAnalysis {
  category: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  examples: string[];
}

interface UXScore {
  overall: number;
  performance: number;
  reliability: number;
  accessibility: number;
  usability: number;
}

// 测试结果收集器
class TestResultsCollector {
  private results: {
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }[] = [];

  private performanceData: {
    lcp: number[];
    fcp: number[];
    ttfb: number[];
    pageLoad: number[];
  } = {
    lcp: [],
    fcp: [],
    ttfb: [],
    pageLoad: []
  };

  private voiceData: {
    connectionSuccess: boolean;
    asrLatency: number;
    ttsLatency: number;
  }[] = [];

  addResult(name: string, success: boolean, duration: number, error?: string) {
    this.results.push({ name, success, duration, error });
  }

  addPerformanceMetric(type: 'lcp' | 'fcp' | 'ttfb' | 'pageLoad', value: number) {
    this.performanceData[type].push(value);
  }

  addVoiceMetric(connectionSuccess: boolean, asrLatency: number, ttsLatency: number) {
    this.voiceData.push({ connectionSuccess, asrLatency, ttsLatency });
  }

  getTestMetrics(): TestMetrics {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalTests: this.results.length,
      passed,
      failed,
      skipped: 0,
      passRate: this.results.length > 0 ? (passed / this.results.length) * 100 : 0,
      totalDuration,
      avgDuration: this.results.length > 0 ? totalDuration / this.results.length : 0
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const calcStats = (arr: number[]) => {
      if (arr.length === 0) return { avg: 0, min: 0, max: 0 };
      return {
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        min: Math.min(...arr),
        max: Math.max(...arr)
      };
    };

    return {
      lcp: calcStats(this.performanceData.lcp),
      fcp: calcStats(this.performanceData.fcp),
      ttfb: calcStats(this.performanceData.ttfb),
      pageLoad: calcStats(this.performanceData.pageLoad)
    };
  }

  getVoiceMetrics(): VoiceMetrics {
    const successful = this.voiceData.filter(v => v.connectionSuccess).length;
    const asrLatencies = this.voiceData.map(v => v.asrLatency).filter(v => v > 0);
    const ttsLatencies = this.voiceData.map(v => v.ttsLatency).filter(v => v > 0);
    const errors = this.results.filter(r => r.name.includes('voice') && !r.success).length;

    return {
      connectionSuccess: this.voiceData.length > 0
        ? (successful / this.voiceData.length) * 100
        : 0,
      asrLatency: {
        avg: asrLatencies.length > 0 ? asrLatencies.reduce((a, b) => a + b, 0) / asrLatencies.length : 0,
        min: Math.min(...asrLatencies),
        max: Math.max(...asrLatencies)
      },
      ttsLatency: {
        avg: ttsLatencies.length > 0 ? ttsLatencies.reduce((a, b) => a + b, 0) / ttsLatencies.length : 0,
        min: Math.min(...ttsLatencies),
        max: Math.max(...ttsLatencies)
      },
      errorRate: this.results.length > 0 ? (errors / this.results.length) * 100 : 0
    };
  }

  analyzeErrors(): ErrorAnalysis[] {
    const errors = this.results.filter(r => !r.success);
    const byCategory: Record<string, string[]> = {};

    errors.forEach(e => {
      const category = this.categorizeError(e.error || 'Unknown');
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(e.error || 'Unknown');
    });

    return Object.entries(byCategory).map(([category, examples]) => ({
      category,
      count: examples.length,
      severity: this.calculateSeverity(category),
      examples: examples.slice(0, 5)
    }));
  }

  private categorizeError(error: string): string {
    if (error.includes('timeout') || error.includes('Timed out')) return 'Timeout';
    if (error.includes('network') || error.includes('Network')) return 'Network';
    if (error.includes('permission') || error.includes('Permission')) return 'Permission';
    if (error.includes('websocket') || error.includes('WebSocket')) return 'WebSocket';
    if (error.includes('audio') || error.includes('Audio')) return 'Audio';
    if (error.includes('voice') || error.includes('Voice')) return 'Voice';
    return 'Other';
  }

  private calculateSeverity(category: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (category) {
      case 'Permission':
      case 'Network':
        return 'critical';
      case 'WebSocket':
      case 'Voice':
        return 'high';
      case 'Audio':
      case 'Timeout':
        return 'medium';
      default:
        return 'low';
    }
  }

  calculateUXScore(): UXScore {
    const testMetrics = this.getTestMetrics();
    const perfMetrics = this.getPerformanceMetrics();
    const voiceMetrics = this.getVoiceMetrics();
    const errors = this.analyzeErrors();

    // 性能评分 (基于LCP和页面加载)
    const perfScore = Math.min(100,
      (perfMetrics.lcp.avg < 2500 ? 40 : 0) +
      (perfMetrics.lcp.avg < 1800 ? 20 : 0) +
      (perfMetrics.pageLoad.avg < 3000 ? 20 : 0) +
      (perfMetrics.pageLoad.avg < 1500 ? 20 : 0)
    );

    // 可靠性评分 (基于错误率)
    const errorRate = errors.reduce((sum, e) => sum + e.count, 0) / Math.max(1, testMetrics.totalTests);
    const reliabilityScore = Math.min(100, (1 - errorRate) * 100);

    // 可用性评分 (基于通过率)
    const usabilityScore = testMetrics.passRate;

    // 综合评分
    const overall = Math.round(
      (perfScore * 0.3) +
      (reliabilityScore * 0.3) +
      (usabilityScore * 0.4)
    );

    return {
      overall,
      performance: Math.round(perfScore),
      reliability: Math.round(reliabilityScore),
      accessibility: Math.round(usabilityScore * 0.8), // 假设基础可访问性
      usability: Math.round(usabilityScore)
    };
  }
}

// 生成报告
export function generateReport(
  collector: TestResultsCollector,
  appName: string = '小星数字生命系统',
  version: string = '1.0.0'
): string {
  const testMetrics = collector.getTestMetrics();
  const perfMetrics = collector.getPerformanceMetrics();
  const voiceMetrics = collector.getVoiceMetrics();
  const errors = collector.analyzeErrors();
  const uxScore = collector.calculateUXScore();
  const timestamp = new Date().toISOString();

  return `
# ${appName} 前端体验测试报告

## 📊 测试概览

| 指标 | 数值 |
|------|------|
| 测试时间 | ${timestamp} |
| 版本 | ${version} |
| 总测试数 | ${testMetrics.totalTests} |
| 通过 | ${testMetrics.passed} |
| 失败 | ${testMetrics.failed} |
| 通过率 | ${testMetrics.passRate.toFixed(2)}% |
| 总耗时 | ${(testMetrics.totalDuration / 1000).toFixed(2)}s |
| 平均耗时 | ${testMetrics.avgDuration.toFixed(2)}ms |

## 🎯 用户体验评分

| 维度 | 评分 | 等级 |
|------|------|------|
| 综合评分 | ${uxScore.overall}/100 | ${getGrade(uxScore.overall)} |
| 性能 | ${uxScore.performance}/100 | ${getGrade(uxScore.performance)} |
| 可靠性 | ${uxScore.reliability}/100 | ${getGrade(uxScore.reliability)} |
| 可访问性 | ${uxScore.accessibility}/100 | ${getGrade(uxScore.accessibility)} |
| 可用性 | ${uxScore.usability}/100 | ${getGrade(uxScore.usability)} |

## ⚡ 性能指标

### Core Web Vitals

| 指标 | 平均值 | 最小值 | 最大值 | 状态 |
|------|--------|--------|--------|------|
| LCP (最大内容绘制) | ${perfMetrics.lcp.avg.toFixed(2)}ms | ${perfMetrics.lcp.min.toFixed(2)}ms | ${perfMetrics.lcp.max.toFixed(2)}ms | ${getPerformanceStatus('lcp', perfMetrics.lcp.avg)} |
| FCP (首次内容绘制) | ${perfMetrics.fcp.avg.toFixed(2)}ms | ${perfMetrics.fcp.min.toFixed(2)}ms | ${perfMetrics.fcp.max.toFixed(2)}ms | ${getPerformanceStatus('fcp', perfMetrics.fcp.avg)} |
| TTFB (首字节时间) | ${perfMetrics.ttfb.avg.toFixed(2)}ms | ${perfMetrics.ttfb.min.toFixed(2)}ms | ${perfMetrics.ttfb.max.toFixed(2)}ms | ${getPerformanceStatus('ttfb', perfMetrics.ttfb.avg)} |
| 页面加载 | ${perfMetrics.pageLoad.avg.toFixed(2)}ms | ${perfMetrics.pageLoad.min.toFixed(2)}ms | ${perfMetrics.pageLoad.max.toFixed(2)}ms | ${getPerformanceStatus('load', perfMetrics.pageLoad.avg)} |

### 语音交互性能

| 指标 | 数值 | 状态 |
|------|------|------|
| 连接成功率 | ${voiceMetrics.connectionSuccess.toFixed(2)}% | ${voiceMetrics.connectionSuccess >= 95 ? '✅ 优秀' : voiceMetrics.connectionSuccess >= 80 ? '⚠️ 一般' : '❌ 需改进'} |
| ASR延迟 | 平均 ${voiceMetrics.asrLatency.avg.toFixed(0)}ms | ${voiceMetrics.asrLatency.avg < 500 ? '✅ 优秀' : voiceMetrics.asrLatency.avg < 1000 ? '⚠️ 一般' : '❌ 需改进'} |
| TTS延迟 | 平均 ${voiceMetrics.ttsLatency.avg.toFixed(0)}ms | ${voiceMetrics.ttsLatency.avg < 500 ? '✅ 优秀' : voiceMetrics.ttsLatency.avg < 1000 ? '⚠️ 一般' : '❌ 需改进'} |
| 错误率 | ${voiceMetrics.errorRate.toFixed(2)}% | ${voiceMetrics.errorRate < 5 ? '✅ 优秀' : voiceMetrics.errorRate < 10 ? '⚠️ 一般' : '❌ 需改进'} |

## 🔍 错误分析

| 类别 | 数量 | 严重程度 | 示例 |
|------|------|----------|------|
${errors.map(e => `| ${e.category} | ${e.count} | ${getSeverityBadge(e.severity)} | ${e.examples[0] || '-'} |`).join('\n')}

## 📝 测试详情

### 测试用例结果

| 用例名称 | 状态 | 耗时 |
|----------|------|------|
${collector['results'].map(r => `| ${r.name} | ${r.success ? '✅ 通过' : '❌ 失败'} | ${r.duration}ms |`).join('\n')}

## 💡 改进建议

${generateRecommendations(testMetrics, perfMetrics, voiceMetrics, errors)}

---

*报告生成时间: ${timestamp}*
*测试框架: Playwright*
*监控工具: Sentry + OpenReplay*
`;
}

function getGrade(score: number): string {
  if (score >= 90) return '优秀 (A)';
  if (score >= 80) return '良好 (B)';
  if (score >= 70) return '一般 (C)';
  if (score >= 60) return '及格 (D)';
  return '不及格 (F)';
}

function getPerformanceStatus(type: string, value: number): string {
  const thresholds: Record<string, { good: number; needsImprovement: number }> = {
    lcp: { good: 1800, needsImprovement: 2500 },
    fcp: { good: 1000, needsImprovement: 1800 },
    ttfb: { good: 800, needsImprovement: 1800 },
    load: { good: 2000, needsImprovement: 3000 }
  };

  const threshold = thresholds[type] || { good: 1000, needsImprovement: 2000 };

  if (value <= threshold.good) return '✅ 优秀';
  if (value <= threshold.needsImprovement) return '⚠️ 需改进';
  return '❌ 较差';
}

function getSeverityBadge(severity: 'critical' | 'high' | 'medium' | 'low'): string {
  const badges: Record<string, string> = {
    critical: '🔴 严重',
    high: '🟠 高',
    medium: '🟡 中',
    low: '🟢 低'
  };
  return badges[severity] || '⚪ 未知';
}

function generateRecommendations(
  testMetrics: TestMetrics,
  perfMetrics: PerformanceMetrics,
  voiceMetrics: VoiceMetrics,
  errors: ErrorAnalysis[]
): string {
  const recommendations: string[] = [];

  if (perfMetrics.lcp.avg > 2500) {
    recommendations.push('1. **优化LCP**: 考虑使用SSR/SSG，懒加载非关键资源，优化首屏CSS');
  }

  if (perfMetrics.pageLoad.avg > 3000) {
    recommendations.push('2. **优化页面加载**: 启用资源压缩，移除未使用的代码，使用CDN');
  }

  if (voiceMetrics.connectionSuccess < 95) {
    recommendations.push('3. **提升语音连接**: 检查WebSocket服务稳定性，优化重连机制');
  }

  if (voiceMetrics.asrLatency.avg > 500) {
    recommendations.push('4. **降低ASR延迟**: 考虑使用本地ASR模型，优化网络请求');
  }

  if (voiceMetrics.ttsLatency.avg > 500) {
    recommendations.push('5. **降低TTS延迟**: 预加载TTS资源，使用流式传输');
  }

  errors.forEach(e => {
    if (e.severity === 'critical' || e.severity === 'high') {
      recommendations.push(`6. **修复${e.category}错误**: 需要优先处理，当前有${e.count}个相关错误`);
    }
  });

  if (recommendations.length === 0) {
    return '当前系统表现优秀，建议继续保持性能监控和优化。';
  }

  return recommendations.join('\n\n');
}

export { TestResultsCollector };
export default generateReport;

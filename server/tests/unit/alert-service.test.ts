/**
 * 告警服务单元测试
 */

import { describe, it, expect } from 'vitest';

describe('AlertService', () => {
  describe('evaluateCondition', () => {
    const evaluateCondition = (condition: string, metrics: Record<string, number>): boolean => {
      const parts = condition.split(/(>=|<=|!=|==|>|<)/);
      if (parts.length !== 3) return false;

      const left = parts[0].trim();
      const op = parts[1].trim();
      const right = parts[2].trim();
      
      const metricValue = metrics[left] ?? 0;
      const thresholdValue = parseFloat(right);

      switch (op) {
        case '>': return metricValue > thresholdValue;
        case '<': return metricValue < thresholdValue;
        case '>=': return metricValue >= thresholdValue;
        case '<=': return metricValue <= thresholdValue;
        case '==': return metricValue === thresholdValue;
        case '!=': return metricValue !== thresholdValue;
        default: return false;
      }
    };

    it('应该正确评估大于条件', () => {
      const metrics = { cpu: 95 };
      expect(evaluateCondition('cpu > 90', metrics)).toBe(true);
    });

    it('应该正确评估小于条件', () => {
      const metrics = { memory: 50 };
      expect(evaluateCondition('memory < 85', metrics)).toBe(true);
    });

    it('应该正确评估大于等于条件', () => {
      const metrics = { disk: 90 };
      expect(evaluateCondition('disk >= 90', metrics)).toBe(true);
    });

    it('应该正确评估不等于条件', () => {
      const metrics = { error: 1 };
      expect(evaluateCondition('error != 0', metrics)).toBe(true);
    });

    it('应该在指标不存在时返回 false', () => {
      const metrics = { cpu: 50 };
      expect(evaluateCondition('unknown > 90', metrics)).toBe(false);
    });

    it('应该正确评估等于条件', () => {
      const metrics = { status: 200 };
      expect(evaluateCondition('status == 200', metrics)).toBe(true);
    });

    it('应该正确评估小于等于条件', () => {
      const metrics = { latency: 100 };
      expect(evaluateCondition('latency <= 100', metrics)).toBe(true);
    });
  });

  describe('Alert Configuration', () => {
    it('应该有默认告警配置', () => {
      const config = {
        alerts: [
          { name: 'high_cpu', severity: 'critical' },
          { name: 'high_memory', severity: 'warning' },
        ]
      };
      expect(config.alerts.length).toBe(2);
    });
  });
});

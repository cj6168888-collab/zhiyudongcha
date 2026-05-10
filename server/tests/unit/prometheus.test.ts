/**
 * Prometheus 指标端点单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import prometheusRouter from '../../routes/prometheus';

describe('Prometheus Metrics Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use('/api/metrics', prometheusRouter);
  });

  it('应该返回 Prometheus 格式的指标', async () => {
    const response = await request(app).get('/api/metrics/prometheus');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# HELP');
    expect(response.text).toContain('# TYPE');
    expect(response.text).toContain('nodejs_memory_usage_bytes');
  });

  it('应该包含内存指标', async () => {
    const response = await request(app).get('/api/metrics/prometheus');

    expect(response.text).toContain('nodejs_memory_usage_bytes');
    expect(response.text).toContain('nodejs_memory_total_bytes');
  });

  it('应该包含 CPU 指标', async () => {
    const response = await request(app).get('/api/metrics/prometheus');

    expect(response.text).toContain('nodejs_cpu_usage_percent');
  });

  it('应该包含进程运行时间', async () => {
    const response = await request(app).get('/api/metrics/prometheus');

    expect(response.text).toContain('process_uptime_seconds');
  });
});

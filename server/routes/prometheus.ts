/**
 * Prometheus 指标导出端点
 * Phase 4 - 可观测性
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/prometheus', async (_req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    let output = '';

    output += `# HELP nodejs_eventloop_lag_ms Event loop lag in milliseconds\n`;
    output += `# TYPE nodejs_eventloop_lag_ms gauge\n`;
    output += `nodejs_eventloop_lag_ms 0\n`;

    output += `# HELP nodejs_memory_usage_bytes Memory usage in bytes\n`;
    output += `# TYPE nodejs_memory_usage_bytes gauge\n`;
    output += `nodejs_memory_usage_bytes ${mem.heapUsed}\n`;

    output += `# HELP nodejs_memory_total_bytes Total memory in bytes\n`;
    output += `# TYPE nodejs_memory_total_bytes gauge\n`;
    output += `nodejs_memory_total_bytes ${mem.heapTotal}\n`;

    output += `# HELP nodejs_cpu_usage_percent CPU usage percentage\n`;
    output += `# TYPE nodejs_cpu_usage_percent gauge\n`;
    output += `nodejs_cpu_usage_percent ${(cpu.user + cpu.system) / 1000000}\n`;

    output += `# HELP http_requests_total Total HTTP requests\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total ${(globalThis as Record<string, unknown>).requestCount || 0}\n`;

    output += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE process_uptime_seconds gauge\n`;
    output += `process_uptime_seconds ${process.uptime()}\n`;

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(output);
  } catch (error) {
    res.status(500).send(`# Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

export default router;

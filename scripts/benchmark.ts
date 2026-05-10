import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

interface BenchmarkResult {
  endpoint: string;
  method: string;
  samples: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  successRate: number;
  timestamp: string;
}

interface BenchmarkConfig {
  baseUrl: string;
  warmupRequests: number;
  measureRequests: number;
  concurrency: number;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  warmupRequests: 5,
  measureRequests: 50,
  concurrency: 1,
};

const ENDPOINTS_TO_BENCHMARK = [
  { method: 'GET', path: '/api/v1/health/live' },
  { method: 'GET', path: '/api/v1/health/ready' },
  { method: 'GET', path: '/api/v1/health/ai' },
  { method: 'GET', path: '/api/persons' },
  { method: 'GET', path: '/api/projects' },
  { method: 'GET', path: '/api/calendar/events' },
  { method: 'GET', path: '/api/reminders' },
];

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function makeRequest(url: string, method: string): Promise<{ latency: number; success: boolean }> {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'MASTER',
      },
    });
    const latency = performance.now() - start;
    return { latency, success: response.ok };
  } catch {
    const latency = performance.now() - start;
    return { latency, success: false };
  }
}

async function benchmarkEndpoint(
  endpoint: { method: string; path: string },
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const url = `${config.baseUrl}${endpoint.path}`;
  
  console.log(`\n  Benchmarking ${endpoint.method} ${endpoint.path}...`);
  
  for (let i = 0; i < config.warmupRequests; i++) {
    await makeRequest(url, endpoint.method);
  }
  
  const latencies: number[] = [];
  let successCount = 0;
  
  for (let i = 0; i < config.measureRequests; i++) {
    const result = await makeRequest(url, endpoint.method);
    latencies.push(result.latency);
    if (result.success) successCount++;
  }
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  
  return {
    endpoint: endpoint.path,
    method: endpoint.method,
    samples: config.measureRequests,
    avgLatencyMs: Math.round(avgLatency * 100) / 100,
    p50LatencyMs: Math.round(percentile(latencies, 50) * 100) / 100,
    p95LatencyMs: Math.round(percentile(latencies, 95) * 100) / 100,
    p99LatencyMs: Math.round(percentile(latencies, 99) * 100) / 100,
    minLatencyMs: Math.round(Math.min(...latencies) * 100) / 100,
    maxLatencyMs: Math.round(Math.max(...latencies) * 100) / 100,
    successRate: (successCount / config.measureRequests) * 100,
    timestamp: new Date().toISOString(),
  };
}

async function runBenchmark() {
  console.log('='.repeat(60));
  console.log('  小智系统 API 性能基准测试');
  console.log('='.repeat(60));
  console.log(`\n  配置:`);
  console.log(`  - 基础URL: ${DEFAULT_CONFIG.baseUrl}`);
  console.log(`  - 预热请求: ${DEFAULT_CONFIG.warmupRequests}`);
  console.log(`  - 测量请求: ${DEFAULT_CONFIG.measureRequests}`);
  console.log(`  - 并发数: ${DEFAULT_CONFIG.concurrency}`);
  
  const results: BenchmarkResult[] = [];
  
  for (const endpoint of ENDPOINTS_TO_BENCHMARK) {
    try {
      const result = await benchmarkEndpoint(endpoint, DEFAULT_CONFIG);
      results.push(result);
      
      const p95Status = result.p95LatencyMs <= 500 ? '✅' : '❌';
      console.log(`    Avg: ${result.avgLatencyMs}ms | P95: ${result.p95LatencyMs}ms ${p95Status} | Success: ${result.successRate}%`);
    } catch (error) {
      console.log(`    ❌ Failed: ${error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('  基准测试报告');
  console.log('='.repeat(60));
  
  console.log('\n  端点性能汇总:');
  console.log('  ' + '-'.repeat(80));
  console.log('  | 端点                              | Avg(ms) | P95(ms) | 状态 |');
  console.log('  ' + '-'.repeat(80));
  
  let allPassed = true;
  for (const result of results) {
    const status = result.p95LatencyMs <= 500 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') allPassed = false;
    
    const endpoint = `${result.method} ${result.endpoint}`.padEnd(35);
    const avg = result.avgLatencyMs.toFixed(1).padStart(7);
    const p95 = result.p95LatencyMs.toFixed(1).padStart(7);
    
    console.log(`  | ${endpoint} | ${avg} | ${p95} | ${status} |`);
  }
  console.log('  ' + '-'.repeat(80));
  
  const reportDir = path.join(process.cwd(), 'reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  
  const reportFile = path.join(reportDir, `benchmark-${new Date().toISOString().split('T')[0]}.json`);
  writeFileSync(reportFile, JSON.stringify({
    config: DEFAULT_CONFIG,
    results,
    summary: {
      totalEndpoints: results.length,
      passingEndpoints: results.filter(r => r.p95LatencyMs <= 500).length,
      avgP95: results.reduce((a, b) => a + b.p95LatencyMs, 0) / results.length,
      allPassed,
    },
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.log(`\n  报告已保存至: ${reportFile}`);
  
  if (!allPassed) {
    console.log('\n  ⚠️  部分端点P95延迟超过500ms阈值');
    process.exit(1);
  } else {
    console.log('\n  ✅ 所有端点P95延迟均在500ms阈值内');
  }
}

runBenchmark().catch(console.error);

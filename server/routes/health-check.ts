/**
 * 综合系统健康检查端点
 * Phase 5.2 - 部署就绪验证
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('HealthCheck');

import { getErrorMessage } from '../lib/errors';
import { Router, Request, Response } from 'express';
import { getDatabase } from '../db';
import { sql } from 'drizzle-orm';
import { telemetryService } from '../services/telemetry-service';
import { aiProvider } from '../lib/ai-provider';

const router = Router();

interface HealthCheck {
  service: string;
  status: 'ok' | 'degraded' | 'error';
  message?: string;
  latencyMs?: number;
}

interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  environment: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await getDatabase().execute(sql`SELECT 1`);
    return {
      service: 'database',
      status: 'ok',
      message: 'PostgreSQL connected',
      latencyMs: Date.now() - start,
    };
  } catch (error: unknown) {
    return {
      service: 'database',
      status: 'error',
      message: getErrorMessage(error),
      latencyMs: Date.now() - start,
    };
  }
}

function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const percent = Math.round((heapUsedMB / heapTotalMB) * 100);

  if (percent > 90) {
    return {
      service: 'memory',
      status: 'error',
      message: `Heap usage critical: ${heapUsedMB}/${heapTotalMB}MB (${percent}%)`,
    };
  } else if (percent > 75) {
    return {
      service: 'memory',
      status: 'degraded',
      message: `Heap usage high: ${heapUsedMB}/${heapTotalMB}MB (${percent}%)`,
    };
  }

  return {
    service: 'memory',
    status: 'ok',
    message: `Heap: ${heapUsedMB}/${heapTotalMB}MB (${percent}%)`,
  };
}

function checkHP(): HealthCheck {
  const metrics = telemetryService.getHPMetrics();
  
  if (metrics.currentBalance <= 0) {
    return {
      service: 'hp_economy',
      status: 'error',
      message: 'HP exhausted - system in reduced mode',
    };
  } else if (metrics.currentBalance < 1000) {
    return {
      service: 'hp_economy',
      status: 'degraded',
      message: `HP low: ${metrics.currentBalance}`,
    };
  }

  return {
    service: 'hp_economy',
    status: 'ok',
    message: `HP balance: ${metrics.currentBalance}`,
  };
}

function checkEnvironmentVars(): HealthCheck {
  const required = ['DATABASE_URL'];
  const recommended = ['DASHSCOPE_API_KEY', 'SESSION_SECRET'];
  
  const missingRequired = required.filter(key => !process.env[key]);
  const missingRecommended = recommended.filter(key => !process.env[key]);

  if (missingRequired.length > 0) {
    return {
      service: 'environment',
      status: 'error',
      message: `Missing required: ${missingRequired.join(', ')}`,
    };
  } else if (missingRecommended.length > 0) {
    return {
      service: 'environment',
      status: 'degraded',
      message: `Missing recommended: ${missingRecommended.join(', ')}`,
    };
  }

  return {
    service: 'environment',
    status: 'ok',
    message: 'All environment variables configured',
  };
}

function checkAIProviders(): HealthCheck {
  const providerStatus = aiProvider.getProviderStatus();
  const availableProviders = aiProvider.getAvailableProviders();
  
  const healthyCount = Object.values(providerStatus).filter(p => p.healthy).length;
  const configuredCount = Object.values(providerStatus).filter(p => p.available).length;
  
  if (healthyCount === 0 && configuredCount === 0) {
    return {
      service: 'ai_providers',
      status: 'error',
      message: 'No AI providers configured',
    };
  } else if (healthyCount === 0) {
    return {
      service: 'ai_providers',
      status: 'error',
      message: `All ${configuredCount} configured providers are unhealthy`,
    };
  } else if (healthyCount < configuredCount) {
    return {
      service: 'ai_providers',
      status: 'degraded',
      message: `${healthyCount}/${configuredCount} providers healthy`,
    };
  }

  return {
    service: 'ai_providers',
    status: 'ok',
    message: `${healthyCount} providers healthy: ${availableProviders.join(', ')}`,
  };
}

const startTime = Date.now();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const checks = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkMemory()),
      Promise.resolve(checkHP()),
      Promise.resolve(checkEnvironmentVars()),
      Promise.resolve(checkAIProviders()),
    ]);

    const hasError = checks.some(c => c.status === 'error');
    const hasDegraded = checks.some(c => c.status === 'degraded');

    const report: SystemHealthReport = {
      status: hasError ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      checks,
      environment: process.env.NODE_ENV || 'development',
    };

    const statusCode = hasError ? 503 : 200;
    res.status(statusCode).json(report);
  } catch (error: unknown) {
    res.status(503).json({
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      checks: [{
        service: 'system',
        status: 'error',
        message: getErrorMessage(error),
      }],
      environment: process.env.NODE_ENV || 'development',
    });
  }
});

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await checkDatabase();
    const envCheck = checkEnvironmentVars();

    const isReady = dbCheck.status === 'ok' && envCheck.status !== 'error';

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      checks: [dbCheck, envCheck],
    });
  } catch (error: unknown) {
    res.status(503).json({
      ready: false,
      error: getErrorMessage(error),
    });
  }
});

router.get('/startup', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await checkDatabase();
    
    res.status(dbCheck.status === 'ok' ? 200 : 503).json({
      started: dbCheck.status === 'ok',
      database: dbCheck,
    });
  } catch (error: unknown) {
    res.status(503).json({
      started: false,
      error: getErrorMessage(error),
    });
  }
});

router.get('/ai', (_req: Request, res: Response) => {
  const providerStatus = aiProvider.getProviderStatus();
  const availableProviders = aiProvider.getAvailableProviders();
  const aiCheck = checkAIProviders();
  
  res.json({
    status: aiCheck.status,
    message: aiCheck.message,
    providers: providerStatus,
    activeProviders: availableProviders,
    fallbackChain: ['dashscope', 'deepseek', 'doubao'],
  });
});

export default router;

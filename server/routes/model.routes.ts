/**
 * Model Routes - 吉麟私有云模型同步接口
 */
import { Router } from 'express';
import { aiProvider } from '../lib/ai-provider';
import { createServiceLogger } from '../lib/logger';
import { modelSyncService } from '../services/system/ModelSyncService';
import { requireMaster } from '../middleware/auth';

const router = Router();
const logger = createServiceLogger('ModelRoutes');

router.use(requireMaster);

// 获取当前服务器模型同步状态
router.get('/status', (req, res) => {
  const status = modelSyncService.getStatus();
  const cloudProviders = aiProvider.getProviderStatus();
  const availableCloudProviders = aiProvider.getAvailableProviders();

  res.json({
    success: true,
    ...status,
    cloud: {
      ready: availableCloudProviders.length > 0,
      availableProviders: availableCloudProviders,
      providers: cloudProviders,
    },
  });
});

router.get('/cloud-status', (req, res) => {
  const providers = aiProvider.getProviderStatus();
  const availableProviders = aiProvider.getAvailableProviders();

  res.json({
    success: true,
    ready: availableProviders.length > 0,
    availableProviders,
    providers,
  });
});

// 远程触发服务器开始同步模型
router.post('/sync', async (req, res) => {
  try {
    void modelSyncService.startSync().catch((error) => {
      logger.error({ error }, 'Model sync failed after route response');
    });
    res.json({ success: true, message: '服务器已启动同步任务' });
  } catch (error) {
    logger.error({ error }, 'Failed to start model sync');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start model sync',
    });
  }
});

export default router;

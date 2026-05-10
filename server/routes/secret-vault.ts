/**
 * Z1 协议 - SecretVault API 路由
 * 密钥管理接口，支持加密存储和安全轮换
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SecretVault');

import { Router, Request, Response } from 'express';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
import { secretVault, getDashScopeApiKey, getDeepSeekApiKey, getDoubaoApiKey, type SecretKeyType } from '../services/secret-vault';

const router = Router();

router.post('/store', async (req: Request, res: Response) => {
  try {
    const { keyType, value } = req.body;
    
    if (!keyType || !value) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必需参数: keyType 和 value' 
      });
    }

    const validKeyTypes: SecretKeyType[] = ['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'DOUBAO_API_KEY', 'CUSTOM'];
    if (!validKeyTypes.includes(keyType)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的 keyType，支持: ${validKeyTypes.join(', ')}` 
      });
    }

    const result = await secretVault.storeSecret(keyType, value);
    
    res.json({ 
      success: result, 
      message: result ? '密钥已安全存储' : '存储失败' 
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '存储失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/verify/:keyType', async (req: Request, res: Response) => {
  try {
    const keyType = req.params.keyType as SecretKeyType;
    const exists = await secretVault.verifySecret(keyType);
    
    res.json({ 
      keyType, 
      exists, 
      message: exists ? '密钥已配置' : '密钥未配置' 
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '验证失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/list', async (_req: Request, res: Response) => {
  try {
    const secrets = await secretVault.listSecrets();
    
    res.json({ 
      success: true, 
      secrets: secrets.map(s => ({
        keyType: s.keyType,
        fingerprint: s.fingerprint,
        lastRotated: s.lastRotated,
      }))
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '列表失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/rotate', async (req: Request, res: Response) => {
  try {
    const { keyType, newValue } = req.body;
    
    if (!keyType || !newValue) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必需参数: keyType 和 newValue' 
      });
    }

    const result = await secretVault.rotateSecret(keyType, newValue);
    
    res.json({ 
      success: result, 
      message: result ? '密钥已轮换' : '轮换失败' 
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '轮换失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/:keyType', async (req: Request, res: Response) => {
  try {
    const keyType = req.params.keyType as SecretKeyType;
    const result = await secretVault.deleteSecret(keyType);
    
    res.json({ 
      success: result, 
      message: result ? '密钥已删除' : '删除失败' 
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '删除失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = secretVault.getStatus();
    
    const providerStatus = {
      dashscope: await secretVault.verifySecret('DASHSCOPE_API_KEY'),
      deepseek: await secretVault.verifySecret('DEEPSEEK_API_KEY'),
      doubao: await secretVault.verifySecret('DOUBAO_API_KEY'),
    };

    res.json({ 
      success: true,
      ...status,
      providers: providerStatus,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, '状态查询失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/clear-cache', async (_req: Request, res: Response) => {
  try {
    secretVault.clearCache();
    res.json({ success: true, message: '缓存已清除' });
  } catch (error: unknown) {
    logger.error({ err: error }, '清除缓存失败');
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;

/**
 * 离线同步 API 路由
 * Phase 4.4 - 移动端离线加固
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('OfflineSync');

import { Router, Request, Response } from 'express';
import { offlineSyncService } from '../services/offline-sync';

const router = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供设备ID (deviceId)' 
      });
    }
    
    const state = offlineSyncService.registerDevice(deviceId);
    
    res.json({
      success: true,
      data: state,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.put('/network/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { networkType } = req.body;
    
    offlineSyncService.updateNetworkStatus(deviceId, networkType);
    
    res.json({
      success: true,
      message: `网络状态已更新: ${networkType}`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/queue', async (req: Request, res: Response) => {
  try {
    const { deviceId, entityType, entityId, operation, data, priority } = req.body;
    
    if (!deviceId || !entityType || !entityId || !operation) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: deviceId, entityType, entityId, operation' 
      });
    }
    
    const opId = offlineSyncService.queueOperation(deviceId, {
      entityType,
      entityId,
      operation,
      data,
      priority: priority || 'NORMAL',
      deviceId,
    });
    
    res.json({
      success: true,
      data: { operationId: opId },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/trigger/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const result = await offlineSyncService.triggerSync(deviceId);
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/state/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const state = offlineSyncService.getDeviceState(deviceId);
    
    if (!state) {
      return res.status(404).json({ 
        success: false, 
        error: '设备未注册' 
      });
    }
    
    res.json({
      success: true,
      data: state,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/devices', async (_req: Request, res: Response) => {
  try {
    const states = offlineSyncService.getAllDeviceStates();
    
    res.json({
      success: true,
      data: states,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/pending/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const operations = offlineSyncService.getPendingOperations(deviceId);
    
    res.json({
      success: true,
      data: operations,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/conflicts', async (_req: Request, res: Response) => {
  try {
    const conflicts = offlineSyncService.getConflicts();
    
    res.json({
      success: true,
      data: conflicts,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/conflicts/:conflictId/resolve', async (req: Request, res: Response) => {
  try {
    const { conflictId } = req.params;
    const { resolution, resolvedData } = req.body;
    
    if (!resolution) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供解决方案 (resolution)' 
      });
    }
    
    const success = offlineSyncService.resolveConflict(conflictId, resolution, resolvedData);
    
    res.json({
      success,
      message: success ? '冲突已解决' : '冲突不存在',
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/manifest', async (_req: Request, res: Response) => {
  try {
    const manifest = offlineSyncService.generateSyncManifest();
    
    res.json({
      success: true,
      data: manifest,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/changes/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const sinceVersion = parseInt(req.query.sinceVersion as string) || 0;
    
    const result = offlineSyncService.getIncrementalChanges(deviceId, sinceVersion);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供任务名称 (name) 和类型 (type)' 
      });
    }
    
    const taskId = offlineSyncService.scheduleBackgroundTask({ name, type });
    
    res.json({
      success: true,
      data: { taskId },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/tasks', async (_req: Request, res: Response) => {
  try {
    const tasks = offlineSyncService.getBackgroundTasks();
    
    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = offlineSyncService.getSyncStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.delete('/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const state = offlineSyncService.getDeviceState(deviceId);
    
    if (!state) {
      return res.status(404).json({ 
        success: false, 
        error: '设备未注册' 
      });
    }
    
    res.json({
      success: true,
      message: `设备 ${deviceId} 已移除`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

router.post('/reset/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    offlineSyncService.registerDevice(deviceId);
    
    res.json({
      success: true,
      message: `设备 ${deviceId} 同步状态已重置`,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;

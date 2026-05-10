/**
 * Immune System API Routes - 免疫系统接口
 * Project Immune System (免疫系统协议)
 * 
 * 功能:
 * - 设备体检扫描
 * - 健康报告获取
 * - 威胁列表查询
 * - 净化行动执行
 * - 伴侣应用数据上报
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { Router, Request, Response } from 'express';
import { immuneOrchestrator, ScanType, AppInfo, RemediationRequest } from '../services/immune-orchestrator';
import { z } from 'zod';

const router = Router();

const scanRequestSchema = z.object({
  deviceId: z.string().min(1),
  scanType: z.enum(['FULL', 'QUICK', 'PERMISSION', 'MEMORY', 'MALWARE']).optional().default('FULL'),
});

const appInfoSchema = z.object({
  packageName: z.string(),
  appName: z.string(),
  version: z.string().optional(),
  memoryUsageMb: z.number(),
  storageUsageMb: z.number(),
  batteryDrainPercent: z.number(),
  cpuUsagePercent: z.number(),
  networkUsageMb: z.number(),
  permissionsGranted: z.array(z.string()),
  isSystemApp: z.boolean(),
  backgroundActivity: z.boolean(),
  autoStart: z.boolean(),
});

const reportAppsSchema = z.object({
  deviceId: z.string().min(1),
  apps: z.array(appInfoSchema),
});

const remediationSchema = z.object({
  actionType: z.enum(['UNINSTALL', 'FORCE_STOP', 'CLEAR_CACHE', 'REVOKE_PERMISSION', 'DISABLE_AUTOSTART', 'QUARANTINE']),
  targetApp: z.string(),
  targetPackage: z.string(),
  reason: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  autoApprove: z.boolean().optional(),
});

const approveSchema = z.object({
  actionId: z.string().min(1),
});

router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { deviceId, scanType } = scanRequestSchema.parse(req.body);
    console.log(`[Immune API] 开始体检: deviceId=${deviceId}, type=${scanType}`);
    
    const result = await immuneOrchestrator.performScan(deviceId, scanType as ScanType);
    
    res.json({
      success: true,
      data: result,
      message: result.status === 'COMPLETED' 
        ? `体检完成！健康评分: ${result.overallHealthScore}分`
        : '体检进行中...',
    });
  } catch (error) {
    console.error('[Immune API] 体检失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '体检失败' });
    }
  }
});

router.get('/health/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const report = immuneOrchestrator.getHealthReport(deviceId);
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[Immune API] 获取健康报告失败:', error);
    res.status(500).json({ success: false, error: '获取健康报告失败' });
  }
});

router.get('/threats/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const threats = immuneOrchestrator.getTopProblematicApps(deviceId);
    
    res.json({
      success: true,
      data: {
        deviceId,
        threats,
        totalThreats: threats.length,
        criticalCount: threats.filter(t => t.threatLevel === 'CRITICAL').length,
        highCount: threats.filter(t => t.threatLevel === 'HIGH').length,
      },
      message: threats.length > 0 
        ? `主人，发现 ${threats.length} 个可疑应用需要处理`
        : '环境很干净，没有发现威胁应用~',
    });
  } catch (error) {
    console.error('[Immune API] 获取威胁列表失败:', error);
    res.status(500).json({ success: false, error: '获取威胁列表失败' });
  }
});

router.post('/remediate', async (req: Request, res: Response) => {
  try {
    const request = remediationSchema.parse(req.body) as RemediationRequest;
    console.log(`[Immune API] 执行净化: ${request.actionType} -> ${request.targetApp}`);
    
    const result = await immuneOrchestrator.executeRemediation(request);
    
    res.json({
      success: result.status !== 'FAILED',
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error('[Immune API] 净化执行失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '净化执行失败' });
    }
  }
});

router.post('/remediate/approve', async (req: Request, res: Response) => {
  try {
    const { actionId } = approveSchema.parse(req.body);
    console.log(`[Immune API] 批准净化行动: ${actionId}`);
    
    const result = await immuneOrchestrator.approveRemediation(actionId);
    
    res.json({
      success: result.status === 'SUCCESS',
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error('[Immune API] 批准净化失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '批准净化失败' });
    }
  }
});

router.post('/report-apps', async (req: Request, res: Response) => {
  try {
    const { deviceId, apps } = reportAppsSchema.parse(req.body);
    console.log(`[Immune API] 收到设备应用上报: deviceId=${deviceId}, apps=${apps.length}`);
    
    immuneOrchestrator.reportDeviceApps(deviceId, apps as AppInfo[]);
    
    res.json({
      success: true,
      data: {
        deviceId,
        appsReceived: apps.length,
        timestamp: new Date().toISOString(),
      },
      message: `已接收 ${apps.length} 个应用数据，主人的设备信息已更新`,
    });
  } catch (error) {
    console.error('[Immune API] 应用上报失败:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: '参数格式错误', details: error.errors });
    } else {
      res.status(500).json({ success: false, error: '应用上报失败' });
    }
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        service: 'ImmuneSystem',
        status: 'ONLINE',
        version: '1.0.0',
        capabilities: [
          'FULL_SCAN',
          'QUICK_SCAN', 
          'PERMISSION_SCAN',
          'MEMORY_SCAN',
          'MALWARE_SCAN',
          'APP_REMEDIATION',
          'DEVICE_MONITORING',
        ],
      },
      message: '免疫系统在线，随时准备保护主人的设备~',
    });
  } catch (error) {
    console.error('[Immune API] 获取状态失败:', error);
    res.status(500).json({ success: false, error: '获取状态失败' });
  }
});

export default router;

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('CommandCenter');

import { Router, Request, Response, type Express } from 'express';
import { requireMaster, auditAction } from '../middleware/auth';

import { tieredAccessService } from '../services/tiered-access';
import { killSwitchService } from '../services/kill-switch';
import { cascadeDataService } from '../services/cascade-data';
import { capabilityIndexer } from '../services/capability-indexer';
import { battleReportService } from '../services/battle-report';
import { wisdomDistributionService } from '../services/wisdom-distribution';
import { commandCenterService } from '../services/CommandCenterService';
import privacyGradingRoutes from './privacy-grading';
import crisisInterventionRoutes from './crisis-intervention';
import riskPredictionRoutes from './risk-prediction';
import type { AccessTier } from '@shared/schema';

const router = Router();

router.post('/team-members', requireMaster, async (req: Request, res: Response) => {
  try {
     const member = await commandCenterService.createTeamMember(req.body);
    await auditAction('CREATE_TEAM_MEMBER', 'MASTER', 'team_member', member.id, { name: member.name }, 'SUCCESS', req);
    return res.json(member);
  } catch (error) {
    return res.status(500).json({ error: '创建团队成员失败' });
  }
});

router.get('/team-members', requireMaster, async (req: Request, res: Response) => {
  try {
    const isActive = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
     const members = await commandCenterService.getAllTeamMembers(isActive);
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ error: '获取团队成员失败' });
  }
});

router.get('/team-members/:id', requireMaster, async (req: Request, res: Response) => {
  try {
     const member = await commandCenterService.getTeamMember(req.params.id);
    if (!member) return res.status(404).json({ error: '成员不存在' });
    return res.json(member);
  } catch (error) {
    return res.status(500).json({ error: '获取成员详情失败' });
  }
});

router.patch('/team-members/:id', requireMaster, async (req: Request, res: Response) => {
  try {
     const member = await commandCenterService.updateTeamMember(req.params.id, req.body);
    if (!member) return res.status(404).json({ error: '成员不存在' });
    await auditAction('UPDATE_TEAM_MEMBER', 'MASTER', 'team_member', member.id, req.body, 'SUCCESS', req);
    return res.json(member);
  } catch (error) {
    return res.status(500).json({ error: '更新成员失败' });
  }
});

router.patch('/team-members/:id/tier', requireMaster, async (req: Request, res: Response) => {
  try {
    const { tier } = req.body;
    const success = await tieredAccessService.updateMemberTier(req.params.id, tier as AccessTier);
    if (!success) return res.status(404).json({ error: '成员不存在' });
    await auditAction('UPDATE_MEMBER_TIER', 'MASTER', 'team_member', req.params.id, { tier }, 'SUCCESS', req);
    return res.json({ success: true, tier });
  } catch (error) {
    return res.status(500).json({ error: '更新权限等级失败' });
  }
});

router.post('/satellite-devices', requireMaster, async (req: Request, res: Response) => {
  try {
     const device = await commandCenterService.createSatelliteDevice(req.body);
    await auditAction('CREATE_SATELLITE_DEVICE', 'MASTER', 'satellite_device', device.id, { name: device.deviceName }, 'SUCCESS', req);
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: '创建分台设备失败' });
  }
});

router.get('/satellite-devices', requireMaster, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
     const devices = await commandCenterService.getAllSatelliteDevices(status);
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: '获取分台设备失败' });
  }
});

router.get('/satellite-devices/:deviceId', requireMaster, async (req: Request, res: Response) => {
  try {
     const device = await commandCenterService.getSatelliteDeviceByDeviceId(req.params.deviceId);
    if (!device) return res.status(404).json({ error: '设备不存在' });
    return res.json(device);
  } catch (error) {
    return res.status(500).json({ error: '获取设备详情失败' });
  }
});

router.patch('/satellite-devices/:id', requireMaster, async (req: Request, res: Response) => {
  try {
     const device = await commandCenterService.updateSatelliteDevice(req.params.id, req.body);
    if (!device) return res.status(404).json({ error: '设备不存在' });
    return res.json(device);
  } catch (error) {
    return res.status(500).json({ error: '更新设备失败' });
  }
});

router.post('/kill-switch/revoke-device', requireMaster, async (req: Request, res: Response) => {
  try {
    const { deviceId, reason } = req.body;
    const result = await killSwitchService.revokeDeviceAccess(deviceId, reason, 'MASTER');
    await auditAction('KILL_SWITCH_REVOKE', 'MASTER', 'satellite_device', deviceId, { reason }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '熔断操作失败' });
  }
});

router.post('/kill-switch/destroy-local', requireMaster, async (req: Request, res: Response) => {
  try {
    const { deviceId, reason } = req.body;
    const result = await killSwitchService.destroyLocalData(deviceId, reason, 'MASTER');
    await auditAction('KILL_SWITCH_DESTROY', 'MASTER', 'satellite_device', deviceId, { reason }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '销毁操作失败' });
  }
});

router.post('/kill-switch/lock-device', requireMaster, async (req: Request, res: Response) => {
  try {
    const { deviceId, reason } = req.body;
    const result = await killSwitchService.lockDevice(deviceId, reason, 'MASTER');
    await auditAction('KILL_SWITCH_LOCK', 'MASTER', 'satellite_device', deviceId, { reason }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '锁定操作失败' });
  }
});

router.post('/kill-switch/full-wipe', requireMaster, async (req: Request, res: Response) => {
  try {
    const { deviceId, reason, authorizedBy } = req.body;
    const result = await killSwitchService.fullWipe(deviceId, reason, 'MASTER', authorizedBy);
    await auditAction('KILL_SWITCH_WIPE', 'MASTER', 'satellite_device', deviceId, { reason }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '完全清除操作失败' });
  }
});

router.post('/kill-switch/revoke-member', requireMaster, async (req: Request, res: Response) => {
  try {
    const { memberId, reason } = req.body;
    const result = await killSwitchService.revokeMemberAccess(memberId, reason, 'MASTER');
    await auditAction('KILL_SWITCH_MEMBER', 'MASTER', 'team_member', memberId, { reason }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '成员权限回收失败' });
  }
});

router.post('/kill-switch/restore', requireMaster, async (req: Request, res: Response) => {
  try {
    const { logId } = req.body;
    const result = await killSwitchService.restoreAccess(logId, 'MASTER');
    await auditAction('KILL_SWITCH_RESTORE', 'MASTER', 'kill_switch_log', logId, {}, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '恢复权限失败' });
  }
});

router.get('/kill-switch/logs', requireMaster, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await killSwitchService.getLogs(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: '获取熔断日志失败' });
  }
});

router.get('/cascade/sync-status', requireMaster, async (req: Request, res: Response) => {
  try {
    const status = await cascadeDataService.getDeviceSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: '获取同步状态失败' });
  }
});

router.post('/cascade/broadcast', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await cascadeDataService.broadcastStrategy(req.body);
    await auditAction('CASCADE_BROADCAST', 'MASTER', 'cascade', 'all', { type: req.body.type }, 'SUCCESS', req);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '广播策略失败' });
  }
});

router.get('/cascade/aggregate', requireMaster, async (req: Request, res: Response) => {
  try {
    const deviceIds = req.query.deviceIds ? (req.query.deviceIds as string).split(',') : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const aggregate = await cascadeDataService.aggregateReports(deviceIds, startDate, endDate);
    res.json(aggregate);
  } catch (error) {
    res.status(500).json({ error: '聚合战报失败' });
  }
});

router.post('/cascade/submit-report', async (req: Request, res: Response) => {
  try {
    const { deviceId, ...reportData } = req.body;
    const report = await cascadeDataService.submitReport(deviceId, reportData);
    if (!report) return res.status(403).json({ error: '设备无权限或不存在' });
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: '提交战报失败' });
  }
});

router.get('/battle-reports', requireMaster, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
     const reports = await commandCenterService.getAllBattleReports(limit);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: '获取战报失败' });
  }
});

router.get('/loyalty-events', requireMaster, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
     const events = await commandCenterService.getAllLoyaltyEvents(status);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: '获取忠诚度事件失败' });
  }
});

router.post('/loyalty-events', requireMaster, async (req: Request, res: Response) => {
  try {
     const event = await commandCenterService.createLoyaltyEvent(req.body);
    await auditAction('CREATE_LOYALTY_EVENT', 'MASTER', 'loyalty_event', event.id, { type: event.eventType }, 'SUCCESS', req);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: '创建忠诚度事件失败' });
  }
});

router.patch('/loyalty-events/:id', requireMaster, async (req: Request, res: Response) => {
  try {
     const event = await commandCenterService.updateLoyaltyEvent(req.params.id, req.body);
    if (!event) return res.status(404).json({ error: '事件不存在' });
    return res.json(event);
  } catch (error) {
    return res.status(500).json({ error: '更新忠诚度事件失败' });
  }
});

router.get('/combat-power/distribution', requireMaster, async (req: Request, res: Response) => {
  try {
    const distribution = await capabilityIndexer.getTeamCombatPowerDistribution();
    res.json(distribution);
  } catch (error) {
    logger.error({ err: error }, 'CombatPower distribution error');
    res.status(500).json({ error: '获取战斗力分布失败' });
  }
});

router.get('/combat-power/member/:personId', requireMaster, async (req: Request, res: Response) => {
  try {
    const radar = await capabilityIndexer.getMemberCapabilityRadar(req.params.personId);
    if (!radar) return res.status(404).json({ error: '成员不存在' });
    return res.json(radar);
  } catch (error) {
    logger.error({ err: error }, 'CombatPower member radar error');
    return res.status(500).json({ error: '获取成员能力雷达失败' });
  }
});

router.get('/combat-power/overview', requireMaster, async (req: Request, res: Response) => {
  try {
    const overview = await capabilityIndexer.getTeamCapabilityOverview();
    res.json(overview);
  } catch (error) {
    logger.error({ err: error }, 'CombatPower overview error');
    res.status(500).json({ error: '获取能力概览失败' });
  }
});

router.post('/combat-power/index/:personId', requireMaster, async (req: Request, res: Response) => {
  try {
    await capabilityIndexer.indexPerson(req.params.personId);
    res.json({ success: true, message: '能力索引已更新' });
  } catch (error) {
    logger.error({ err: error }, 'CombatPower index error');
    res.status(500).json({ error: '索引能力失败' });
  }
});

router.post('/combat-power/index-all', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await capabilityIndexer.indexAllPersons();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, 'CombatPower index all error');
    res.status(500).json({ error: '批量索引失败' });
  }
});

router.get('/combat-power/search', requireMaster, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string || '';
    const results = await capabilityIndexer.searchByCapability(query);
    res.json(results);
  } catch (error) {
    logger.error({ err: error }, 'CombatPower search error');
    res.status(500).json({ error: '搜索能力失败' });
  }
});

router.post('/combat-power/find-match', requireMaster, async (req: Request, res: Response) => {
  try {
    const { capabilities } = req.body;
    if (!Array.isArray(capabilities)) {
      return res.status(400).json({ error: '需要提供capabilities数组' });
    }
    const matches = await capabilityIndexer.findPersonsWithCapabilities(capabilities);
    return res.json(matches);
  } catch (error) {
    logger.error({ err: error }, 'CombatPower find match error');
    return res.status(500).json({ error: '匹配人才失败' });
  }
});

router.get('/battle-report/daily-summary', requireMaster, async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const summary = await battleReportService.generateDailySummary(date);
    res.json(summary);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport daily summary error');
    res.status(500).json({ error: '获取日报汇总失败' });
  }
});

router.get('/battle-report/weekly-trend', requireMaster, async (req: Request, res: Response) => {
  try {
    const trend = await battleReportService.getWeeklyTrend();
    res.json(trend);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport weekly trend error');
    res.status(500).json({ error: '获取周趋势失败' });
  }
});

router.get('/battle-report/device-activity', requireMaster, async (req: Request, res: Response) => {
  try {
    const activities = await battleReportService.getDeviceActivitySummary();
    res.json(activities);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport device activity error');
    res.status(500).json({ error: '获取设备活动失败' });
  }
});

router.get('/battle-report/security-status', requireMaster, async (req: Request, res: Response) => {
  try {
    const status = await battleReportService.assessSecurityStatus();
    res.json(status);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport security status error');
    res.status(500).json({ error: '获取安全状态失败' });
  }
});

router.get('/battle-report/opportunity-pipeline', requireMaster, async (req: Request, res: Response) => {
  try {
    const pipeline = await battleReportService.getOpportunityPipeline();
    res.json(pipeline);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport pipeline error');
    res.status(500).json({ error: '获取商机管道失败' });
  }
});

router.get('/battle-report/auto-summary', requireMaster, async (req: Request, res: Response) => {
  try {
    const summary = await battleReportService.generateAutoSummary();
    res.json(summary);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport auto summary error');
    res.status(500).json({ error: '生成自动汇总失败' });
  }
});

router.post('/battle-report/submit', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await battleReportService.submitBattleReport(req.body);
    await auditAction('SUBMIT_BATTLE_REPORT', 'MASTER', 'battle_report', result.id, { title: req.body.title }, 'SUCCESS', req);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'BattleReport submit error');
    res.status(500).json({ error: '提交战报失败' });
  }
});

router.get('/wisdom/stats', requireMaster, async (req: Request, res: Response) => {
  try {
    const stats = wisdomDistributionService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom stats error');
    res.status(500).json({ error: '获取同步统计失败' });
  }
});

router.get('/wisdom/devices', requireMaster, async (req: Request, res: Response) => {
  try {
    const devices = await wisdomDistributionService.getConnectedDeviceStatus();
    res.json(devices);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom devices error');
    res.status(500).json({ error: '获取设备状态失败' });
  }
});

router.post('/wisdom/push-strategy', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.pushStrategy(req.body.strategy, req.body.targetDevices);
    await auditAction('PUSH_STRATEGY', 'MASTER', 'wisdom', 'strategy', { name: req.body.strategy?.name }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom push strategy error');
    res.status(500).json({ error: '推送策略失败' });
  }
});

router.post('/wisdom/push-legal-rule', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.pushLegalRule(req.body.rule, req.body.targetTiers);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom push legal rule error');
    res.status(500).json({ error: '推送法规失败' });
  }
});

router.post('/wisdom/push-weights', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.pushWeightUpdate(req.body);
    await auditAction('PUSH_WEIGHTS', 'MASTER', 'wisdom', 'weights', { module: req.body.module }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom push weights error');
    res.status(500).json({ error: '推送权重失败' });
  }
});

router.post('/wisdom/push-vocab', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.pushVocabSync(req.body);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom push vocab error');
    res.status(500).json({ error: '推送词库失败' });
  }
});

router.post('/wisdom/push-config', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.pushConfigUpdate(req.body.config, req.body.targetDevices);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom push config error');
    res.status(500).json({ error: '推送配置失败' });
  }
});

router.post('/wisdom/push-emergency', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.pushEmergency(req.body.emergency, req.body.targetDevices);
    await auditAction('PUSH_EMERGENCY', 'MASTER', 'wisdom', 'emergency', { type: req.body.emergency?.type }, result.success ? 'SUCCESS' : 'FAILED', req);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom push emergency error');
    res.status(500).json({ error: '推送紧急指令失败' });
  }
});

router.post('/wisdom/sync-all', requireMaster, async (req: Request, res: Response) => {
  try {
    const result = await wisdomDistributionService.syncAllDevices();
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Wisdom sync all error');
    res.status(500).json({ error: '全线同步失败' });
  }
});

export function registerCommandCenterRoutes(app: Express) {
  app.use('/api/command-center', router);
  app.use('/api/command-center/privacy', privacyGradingRoutes);
  app.use('/api/command-center/crisis', crisisInterventionRoutes);
  app.use('/api/command-center/risk', riskPredictionRoutes);
}
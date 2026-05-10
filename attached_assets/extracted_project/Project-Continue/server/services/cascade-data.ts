import { storage } from '../storage';
import { tieredAccessService } from './tiered-access';
import type { AccessTier, BattleReport, SatelliteDevice } from '@shared/schema';

export interface DataSyncPayload {
  type: 'STRATEGY' | 'INTELLIGENCE' | 'CAPABILITY' | 'POLICY';
  data: Record<string, unknown>;
  priority: number;
  targetDevices?: string[];
  targetTiers?: AccessTier[];
}

export interface SanitizedReport {
  reportType: string;
  summary: string;
  opportunitiesFound: number;
  trapsDetected: number;
  riskLevel: string;
  timestamp: Date;
}

export interface CascadeSyncResult {
  success: boolean;
  targetDevices: number;
  syncedDevices: number;
  failedDevices: string[];
  payload: DataSyncPayload;
}

class CascadeDataService {
  sanitizeReport(report: BattleReport, targetTier: AccessTier): SanitizedReport {
    const base: SanitizedReport = {
      reportType: report.reportType,
      summary: report.summary || '',
      opportunitiesFound: report.opportunitiesFound || 0,
      trapsDetected: report.trapsDetected || 0,
      riskLevel: report.riskLevel || 'LOW',
      timestamp: report.createdAt || new Date(),
    };

    if (targetTier === 'BASIC') {
      return {
        ...base,
        summary: this.redactSensitiveInfo(base.summary),
      };
    }

    if (targetTier === 'RESTRICTED') {
      return {
        ...base,
        summary: '[数据受限]',
        opportunitiesFound: 0,
        trapsDetected: 0,
      };
    }

    return base;
  }

  private redactSensitiveInfo(text: string): string {
    return text
      .replace(/\d{11}/g, '***')
      .replace(/\d{4}-\d{4}-\d{4}-\d{4}/g, '****-****-****-****')
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '***@***.***')
      .replace(/￥[\d,]+/g, '￥***')
      .replace(/\$[\d,]+/g, '$***');
  }

  async aggregateReports(
    deviceIds?: string[],
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalOpportunities: number;
    totalTraps: number;
    totalContracts: number;
    totalDecisions: number;
    riskDistribution: Record<string, number>;
    deviceStats: Record<string, number>;
  }> {
    const reports = await storage.getAllBattleReports(100);
    
    let filtered = reports;
    if (deviceIds && deviceIds.length > 0) {
      filtered = reports.filter(r => r.sourceDeviceId && deviceIds.includes(r.sourceDeviceId));
    }
    if (startDate) {
      filtered = filtered.filter(r => r.createdAt && r.createdAt >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.createdAt && r.createdAt <= endDate);
    }

    const result = {
      totalOpportunities: 0,
      totalTraps: 0,
      totalContracts: 0,
      totalDecisions: 0,
      riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      deviceStats: {} as Record<string, number>,
    };

    for (const report of filtered) {
      result.totalOpportunities += report.opportunitiesFound || 0;
      result.totalTraps += report.trapsDetected || 0;
      result.totalContracts += report.contractsAnalyzed || 0;
      result.totalDecisions += report.decisionsAssisted || 0;
      
      const risk = report.riskLevel || 'LOW';
      result.riskDistribution[risk] = (result.riskDistribution[risk] || 0) + 1;
      
      if (report.sourceDeviceId) {
        result.deviceStats[report.sourceDeviceId] = (result.deviceStats[report.sourceDeviceId] || 0) + 1;
      }
    }

    return result;
  }

  async broadcastStrategy(payload: DataSyncPayload): Promise<CascadeSyncResult> {
    const devices = await storage.getAllSatelliteDevices('ONLINE');
    
    let targetDevices = devices;
    
    if (payload.targetDevices && payload.targetDevices.length > 0) {
      targetDevices = devices.filter(d => payload.targetDevices!.includes(d.deviceId));
    }
    
    if (payload.targetTiers && payload.targetTiers.length > 0) {
      targetDevices = targetDevices.filter(d => 
        payload.targetTiers!.includes((d.accessTier as AccessTier) || 'BASIC')
      );
    }

    targetDevices = targetDevices.filter(d => !d.killSwitchActive && d.syncEnabled);

    const syncedDevices: string[] = [];
    const failedDevices: string[] = [];

    for (const device of targetDevices) {
      try {
        await storage.updateSatelliteDevice(device.id, {
          pendingUpdates: (device.pendingUpdates || 0) + 1,
          lastSyncAt: new Date(),
        });
        syncedDevices.push(device.deviceId);
      } catch (error) {
        failedDevices.push(device.deviceId);
      }
    }

    return {
      success: failedDevices.length === 0,
      targetDevices: targetDevices.length,
      syncedDevices: syncedDevices.length,
      failedDevices,
      payload,
    };
  }

  async syncCapabilityWeights(
    weights: Record<string, number>,
    targetTiers: AccessTier[] = ['PROFESSIONAL', 'BASIC', 'CUSTOM']
  ): Promise<CascadeSyncResult> {
    return this.broadcastStrategy({
      type: 'CAPABILITY',
      data: { weights },
      priority: 5,
      targetTiers,
    });
  }

  async pushPolicyUpdate(
    policyType: string,
    policyData: Record<string, unknown>,
    priority: number = 10
  ): Promise<CascadeSyncResult> {
    return this.broadcastStrategy({
      type: 'POLICY',
      data: { policyType, ...policyData },
      priority,
      targetTiers: ['PROFESSIONAL', 'BASIC', 'CUSTOM'],
    });
  }

  async pushIntelligenceUpdate(
    intelType: string,
    intelData: Record<string, unknown>,
    targetTiers: AccessTier[] = ['PROFESSIONAL']
  ): Promise<CascadeSyncResult> {
    return this.broadcastStrategy({
      type: 'INTELLIGENCE',
      data: { intelType, ...intelData },
      priority: 8,
      targetTiers,
    });
  }

  async getDeviceSyncStatus(): Promise<{
    totalDevices: number;
    onlineDevices: number;
    syncEnabledDevices: number;
    pendingUpdates: number;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const devices = await storage.getAllSatelliteDevices();
    
    const result = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'ONLINE').length,
      syncEnabledDevices: devices.filter(d => d.syncEnabled).length,
      pendingUpdates: devices.reduce((sum, d) => sum + (d.pendingUpdates || 0), 0),
      byTier: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    for (const device of devices) {
      const tier = device.accessTier || 'BASIC';
      const status = device.status || 'OFFLINE';
      result.byTier[tier] = (result.byTier[tier] || 0) + 1;
      result.byStatus[status] = (result.byStatus[status] || 0) + 1;
    }

    return result;
  }

  async markSyncComplete(deviceId: string): Promise<boolean> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device) return false;

    await storage.updateSatelliteDevice(device.id, {
      pendingUpdates: 0,
      lastSyncAt: new Date(),
    });

    return true;
  }

  async submitReport(
    deviceId: string,
    reportData: {
      reportType: string;
      title: string;
      summary?: string;
      opportunitiesFound?: number;
      trapsDetected?: number;
      contractsAnalyzed?: number;
      decisionsAssisted?: number;
      riskLevel?: string;
      details?: Record<string, unknown>;
    }
  ): Promise<BattleReport | null> {
    const device = await storage.getSatelliteDeviceByDeviceId(deviceId);
    if (!device || device.killSwitchActive) {
      return null;
    }

    const report = await storage.createBattleReport({
      reportType: reportData.reportType,
      sourceDeviceId: device.id,
      sourceMemberId: device.ownerId,
      title: reportData.title,
      summary: reportData.summary,
      opportunitiesFound: reportData.opportunitiesFound,
      trapsDetected: reportData.trapsDetected,
      contractsAnalyzed: reportData.contractsAnalyzed,
      decisionsAssisted: reportData.decisionsAssisted,
      riskLevel: reportData.riskLevel || 'LOW',
      details: reportData.details,
    });

    return report;
  }
}

export const cascadeDataService = new CascadeDataService();

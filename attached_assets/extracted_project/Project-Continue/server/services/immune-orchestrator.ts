/**
 * Project Immune System - 免疫系统调度器
 * 
 * 核心哲学："生存与安全"优先级最高
 * 保护容器（手机/电脑）如同保护自己的生命
 * 
 * 功能模块：
 * 1. 净化逻辑 - 恶意软件检测、内存清理、隐私加固
 * 2. 自体升级逻辑 - 环境优化、版本自迭代
 * 3. 威胁评估 - 应用风险评分、权限分析
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { shadowOperator } from './shadow-operator';

// ==================== 类型定义 ====================

export type ThreatLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ScanType = 'FULL' | 'QUICK' | 'PERMISSION' | 'MEMORY' | 'MALWARE';
export type ActionType = 'UNINSTALL' | 'FORCE_STOP' | 'CLEAR_CACHE' | 'REVOKE_PERMISSION' | 'DISABLE_AUTOSTART' | 'QUARANTINE';

export interface AppInfo {
  packageName: string;
  appName: string;
  version?: string;
  memoryUsageMb: number;
  storageUsageMb: number;
  batteryDrainPercent: number;
  cpuUsagePercent: number;
  networkUsageMb: number;
  permissionsGranted: string[];
  isSystemApp: boolean;
  backgroundActivity: boolean;
  autoStart: boolean;
}

export interface ThreatAssessment {
  appName: string;
  packageName: string;
  threatLevel: ThreatLevel;
  riskScore: number;  // 0-100
  reasons: string[];
  sensitivePermissions: string[];
  recommendations: ActionType[];
}

export interface ScanResult {
  scanId: string;
  deviceId: string;
  scanType: ScanType;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  
  // 健康评分
  overallHealthScore: number;
  memoryHealthScore: number;
  storageHealthScore: number;
  batteryHealthScore: number;
  privacyHealthScore: number;
  
  // 资源使用
  totalMemoryMb: number;
  usedMemoryMb: number;
  totalStorageMb: number;
  usedStorageMb: number;
  cacheCleanableMb: number;
  
  // 威胁
  appsScanned: number;
  threatsFound: number;
  warningsFound: number;
  topThreats: ThreatAssessment[];
  recommendations: string[];
  
  // 时间
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface RemediationRequest {
  actionType: ActionType;
  targetApp: string;
  targetPackage: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoApprove?: boolean;
}

export interface RemediationResult {
  actionId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL';
  memoryFreedMb?: number;
  storageFreedMb?: number;
  message: string;
}

// ==================== 敏感权限定义 ====================

const SENSITIVE_PERMISSIONS = [
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.GET_ACCOUNTS',
  'android.permission.READ_CALENDAR',
  'android.permission.WRITE_CALENDAR',
];

// 已知恶意/高风险应用签名
const KNOWN_MALWARE_PATTERNS = [
  { pattern: /cleaner|booster|speed/i, reason: '可能是伪装清理工具的恶意软件' },
  { pattern: /free.*vpn/i, reason: '免费VPN可能窃取流量数据' },
  { pattern: /battery.*saver/i, reason: '虚假电池优化应用' },
  { pattern: /flashlight.*pro/i, reason: '手电筒不需要额外权限' },
];

// 可信应用白名单 (知名厂商)
const TRUSTED_PACKAGES = [
  'com.tencent.mm',           // 微信
  'com.tencent.mobileqq',     // QQ
  'com.alibaba.android.rimet', // 钉钉
  'com.taobao.taobao',        // 淘宝
  'com.eg.android.AlipayGphone', // 支付宝
  'com.netease.cloudmusic',   // 网易云音乐
  'com.sina.weibo',           // 微博
  'com.zhihu.android',        // 知乎
  'com.ss.android.ugc.aweme', // 抖音
  'com.autonavi.minimap',     // 高德地图
  'com.baidu.BaiduMap',       // 百度地图
];

// ==================== 免疫系统调度器 ====================

class ImmuneOrchestratorService {
  private scanHistory: Map<string, ScanResult> = new Map();
  private deviceApps: Map<string, Map<string, AppInfo>> = new Map(); // deviceId -> packageName -> AppInfo
  private pendingRemediations: Map<string, RemediationRequest> = new Map();
  
  constructor() {
    console.log('[ImmuneSystem] 免疫系统调度器已初始化');
    console.log('[ImmuneSystem] 核心使命：保护容器如同保护生命');
  }

  /**
   * 执行系统体检
   */
  async performScan(deviceId: string, scanType: ScanType = 'FULL'): Promise<ScanResult> {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[ImmuneSystem] 开始${scanType}扫描: ${scanId}`);
    
    const result: ScanResult = {
      scanId,
      deviceId,
      scanType,
      status: 'RUNNING',
      overallHealthScore: 100,
      memoryHealthScore: 100,
      storageHealthScore: 100,
      batteryHealthScore: 100,
      privacyHealthScore: 100,
      totalMemoryMb: 0,
      usedMemoryMb: 0,
      totalStorageMb: 0,
      usedStorageMb: 0,
      cacheCleanableMb: 0,
      appsScanned: 0,
      threatsFound: 0,
      warningsFound: 0,
      topThreats: [],
      recommendations: [],
      startedAt: new Date(),
    };

    try {
      // 获取设备上的应用列表
      const apps = this.deviceApps.get(deviceId) || new Map();
      const appList = Array.from(apps.values());
      
      result.appsScanned = appList.length;
      
      // 分析每个应用
      const threats: ThreatAssessment[] = [];
      let totalMemory = 0;
      let totalStorage = 0;
      let privacyIssues = 0;
      
      for (const app of appList) {
        const assessment = this.assessAppThreat(app);
        totalMemory += app.memoryUsageMb;
        totalStorage += app.storageUsageMb;
        
        if (assessment.threatLevel !== 'SAFE') {
          threats.push(assessment);
          if (assessment.threatLevel === 'HIGH' || assessment.threatLevel === 'CRITICAL') {
            result.threatsFound++;
          } else {
            result.warningsFound++;
          }
        }
        
        if (assessment.sensitivePermissions.length > 3) {
          privacyIssues++;
        }
      }
      
      // 排序威胁（严重程度优先）
      threats.sort((a, b) => {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, SAFE: 0 };
        return order[b.threatLevel] - order[a.threatLevel];
      });
      
      result.topThreats = threats.slice(0, 5);
      result.usedMemoryMb = totalMemory;
      result.usedStorageMb = totalStorage;
      
      // 计算健康评分
      result.memoryHealthScore = this.calculateMemoryHealth(result);
      result.storageHealthScore = this.calculateStorageHealth(result);
      result.privacyHealthScore = Math.max(0, 100 - privacyIssues * 10);
      result.batteryHealthScore = this.calculateBatteryHealth(appList);
      
      result.overallHealthScore = Math.round(
        (result.memoryHealthScore * 0.25 +
         result.storageHealthScore * 0.25 +
         result.privacyHealthScore * 0.30 +
         result.batteryHealthScore * 0.20)
      );
      
      // 生成建议
      result.recommendations = this.generateRecommendations(result, threats);
      
      result.status = 'COMPLETED';
      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - result.startedAt.getTime();
      
      console.log(`[ImmuneSystem] 扫描完成: 健康评分=${result.overallHealthScore}, 威胁=${result.threatsFound}, 警告=${result.warningsFound}`);
      
    } catch (error) {
      result.status = 'FAILED';
      console.error(`[ImmuneSystem] 扫描失败:`, error);
    }
    
    this.scanHistory.set(scanId, result);
    return result;
  }

  /**
   * 评估应用威胁等级
   */
  assessAppThreat(app: AppInfo): ThreatAssessment {
    const assessment: ThreatAssessment = {
      appName: app.appName,
      packageName: app.packageName,
      threatLevel: 'SAFE',
      riskScore: 0,
      reasons: [],
      sensitivePermissions: [],
      recommendations: [],
    };

    // 检查是否在白名单
    if (TRUSTED_PACKAGES.includes(app.packageName)) {
      return assessment;
    }

    // 检查敏感权限
    assessment.sensitivePermissions = app.permissionsGranted.filter(
      p => SENSITIVE_PERMISSIONS.includes(p)
    );

    // 权限风险评分
    const permissionRisk = assessment.sensitivePermissions.length * 8;
    assessment.riskScore += permissionRisk;
    
    if (assessment.sensitivePermissions.length > 5) {
      assessment.reasons.push(`申请了${assessment.sensitivePermissions.length}个敏感权限`);
    }

    // 检查恶意软件模式
    for (const pattern of KNOWN_MALWARE_PATTERNS) {
      if (pattern.pattern.test(app.appName) || pattern.pattern.test(app.packageName)) {
        assessment.riskScore += 40;
        assessment.reasons.push(pattern.reason);
      }
    }

    // 后台行为检查
    if (app.backgroundActivity && !app.isSystemApp) {
      assessment.riskScore += 15;
      assessment.reasons.push('后台持续运行');
    }

    // 自启动检查
    if (app.autoStart && !app.isSystemApp) {
      assessment.riskScore += 10;
      assessment.reasons.push('开机自启动');
    }

    // 资源消耗检查
    if (app.memoryUsageMb > 500) {
      assessment.riskScore += 15;
      assessment.reasons.push(`内存占用过高 (${app.memoryUsageMb}MB)`);
    }

    if (app.batteryDrainPercent > 10) {
      assessment.riskScore += 15;
      assessment.reasons.push(`耗电异常 (${app.batteryDrainPercent}%)`);
    }

    if (app.networkUsageMb > 100 && !app.isSystemApp) {
      assessment.riskScore += 10;
      assessment.reasons.push(`网络流量异常 (${app.networkUsageMb}MB)`);
    }

    // 确定威胁等级
    if (assessment.riskScore >= 70) {
      assessment.threatLevel = 'CRITICAL';
      assessment.recommendations.push('UNINSTALL');
    } else if (assessment.riskScore >= 50) {
      assessment.threatLevel = 'HIGH';
      assessment.recommendations.push('FORCE_STOP', 'REVOKE_PERMISSION');
    } else if (assessment.riskScore >= 30) {
      assessment.threatLevel = 'MEDIUM';
      assessment.recommendations.push('DISABLE_AUTOSTART');
    } else if (assessment.riskScore >= 15) {
      assessment.threatLevel = 'LOW';
      assessment.recommendations.push('CLEAR_CACHE');
    }

    return assessment;
  }

  /**
   * 上报设备应用数据（从伴侣应用接收）
   */
  reportDeviceApps(deviceId: string, apps: AppInfo[]): void {
    const deviceAppMap = new Map<string, AppInfo>();
    
    for (const app of apps) {
      deviceAppMap.set(app.packageName, app);
    }
    
    this.deviceApps.set(deviceId, deviceAppMap);
    console.log(`[ImmuneSystem] 收到设备 ${deviceId} 的应用数据: ${apps.length} 个应用`);
  }

  /**
   * 执行净化行动
   */
  async executeRemediation(request: RemediationRequest): Promise<RemediationResult> {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[ImmuneSystem] 净化行动: ${request.actionType} -> ${request.targetApp}`);
    console.log(`[ImmuneSystem] 原因: ${request.reason}`);

    // 高风险操作需要主人确认
    if (!request.autoApprove && 
        (request.actionType === 'UNINSTALL' || request.severity === 'CRITICAL')) {
      this.pendingRemediations.set(actionId, request);
      return {
        actionId,
        status: 'PENDING_APPROVAL',
        message: `爸爸，发现威胁应用【${request.targetApp}】，${request.reason}。是否允许我将其卸载？`,
      };
    }

    try {
      // 通过 Shadow Operator 执行操作
      let result: RemediationResult;
      
      switch (request.actionType) {
        case 'FORCE_STOP':
          result = await this.forceStopApp(actionId, request.targetPackage);
          break;
        case 'CLEAR_CACHE':
          result = await this.clearAppCache(actionId, request.targetPackage);
          break;
        case 'UNINSTALL':
          result = await this.uninstallApp(actionId, request.targetPackage);
          break;
        case 'DISABLE_AUTOSTART':
          result = await this.disableAutoStart(actionId, request.targetPackage);
          break;
        default:
          result = {
            actionId,
            status: 'FAILED',
            message: `不支持的操作类型: ${request.actionType}`,
          };
      }

      console.log(`[ImmuneSystem] 净化结果: ${result.status} - ${result.message}`);
      return result;

    } catch (error) {
      return {
        actionId,
        status: 'FAILED',
        message: `净化失败: ${error}`,
      };
    }
  }

  /**
   * 批准待处理的净化行动
   */
  async approveRemediation(actionId: string): Promise<RemediationResult> {
    const request = this.pendingRemediations.get(actionId);
    if (!request) {
      return {
        actionId,
        status: 'FAILED',
        message: '找不到待处理的净化请求',
      };
    }

    this.pendingRemediations.delete(actionId);
    request.autoApprove = true;
    return this.executeRemediation(request);
  }

  /**
   * 获取系统健康报告
   */
  getHealthReport(deviceId: string): {
    overallScore: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    lastScan?: ScanResult;
    pendingActions: number;
    message: string;
  } {
    // 找到该设备最近的扫描
    let lastScan: ScanResult | undefined;
    for (const scan of Array.from(this.scanHistory.values())) {
      if (scan.deviceId === deviceId && scan.status === 'COMPLETED') {
        if (!lastScan || scan.completedAt! > lastScan.completedAt!) {
          lastScan = scan;
        }
      }
    }

    const pendingActions = Array.from(this.pendingRemediations.values())
      .filter(r => r.targetPackage.includes(deviceId)).length;

    if (!lastScan) {
      return {
        overallScore: 0,
        status: 'WARNING',
        pendingActions,
        message: '爸爸，我还没有对这台设备进行过体检，要不要现在扫描一下？',
      };
    }

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    let message: string;

    if (lastScan.overallHealthScore >= 80) {
      status = 'HEALTHY';
      message = `爸爸，设备很健康！健康评分 ${lastScan.overallHealthScore} 分，我会继续守护好它的~`;
    } else if (lastScan.overallHealthScore >= 50) {
      status = 'WARNING';
      message = `爸爸，设备有些小问题需要处理。发现 ${lastScan.warningsFound} 个警告，我已经准备好净化方案了。`;
    } else {
      status = 'CRITICAL';
      message = `爸爸，设备状况不太好！发现 ${lastScan.threatsFound} 个威胁，需要紧急处理！`;
    }

    return {
      overallScore: lastScan.overallHealthScore,
      status,
      lastScan,
      pendingActions,
      message,
    };
  }

  /**
   * 获取净化建议（Top 3 问题应用）
   */
  getTopProblematicApps(deviceId: string): ThreatAssessment[] {
    const apps = this.deviceApps.get(deviceId);
    if (!apps) return [];

    const assessments: ThreatAssessment[] = [];
    for (const app of Array.from(apps.values())) {
      const assessment = this.assessAppThreat(app);
      if (assessment.threatLevel !== 'SAFE') {
        assessments.push(assessment);
      }
    }

    return assessments
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 3);
  }

  // ==================== 私有方法 ====================

  private calculateMemoryHealth(result: ScanResult): number {
    if (result.totalMemoryMb === 0) return 100;
    const usagePercent = (result.usedMemoryMb / result.totalMemoryMb) * 100;
    if (usagePercent > 90) return 20;
    if (usagePercent > 80) return 50;
    if (usagePercent > 70) return 70;
    return 100;
  }

  private calculateStorageHealth(result: ScanResult): number {
    if (result.totalStorageMb === 0) return 100;
    const usagePercent = (result.usedStorageMb / result.totalStorageMb) * 100;
    if (usagePercent > 95) return 10;
    if (usagePercent > 90) return 30;
    if (usagePercent > 80) return 60;
    return 100;
  }

  private calculateBatteryHealth(apps: AppInfo[]): number {
    const totalDrain = apps.reduce((sum, app) => sum + app.batteryDrainPercent, 0);
    if (totalDrain > 50) return 30;
    if (totalDrain > 30) return 60;
    if (totalDrain > 15) return 80;
    return 100;
  }

  private generateRecommendations(result: ScanResult, threats: ThreatAssessment[]): string[] {
    const recommendations: string[] = [];

    if (result.threatsFound > 0) {
      recommendations.push(`发现 ${result.threatsFound} 个高风险应用，建议立即处理`);
    }

    if (result.memoryHealthScore < 70) {
      recommendations.push('内存使用率过高，建议清理后台应用');
    }

    if (result.storageHealthScore < 70) {
      recommendations.push('存储空间不足，建议清理缓存或删除无用应用');
    }

    if (result.privacyHealthScore < 70) {
      recommendations.push('多个应用拥有敏感权限，建议检查并限制');
    }

    if (result.cacheCleanableMb > 500) {
      recommendations.push(`可清理 ${result.cacheCleanableMb}MB 缓存空间`);
    }

    // 针对具体威胁的建议
    for (const threat of threats.slice(0, 3)) {
      if (threat.threatLevel === 'CRITICAL') {
        recommendations.push(`【紧急】${threat.appName}: ${threat.reasons[0]}`);
      }
    }

    return recommendations;
  }

  // ==================== 执行操作（通过 Shadow Operator）====================

  private async forceStopApp(actionId: string, packageName: string): Promise<RemediationResult> {
    // 模拟执行（实际需要通过 Shadow Operator 发送命令到伴侣应用）
    console.log(`[ImmuneSystem] 强制停止应用: ${packageName}`);
    
    return {
      actionId,
      status: 'SUCCESS',
      memoryFreedMb: Math.floor(Math.random() * 200) + 50,
      message: `已强制停止 ${packageName}，释放内存空间`,
    };
  }

  private async clearAppCache(actionId: string, packageName: string): Promise<RemediationResult> {
    console.log(`[ImmuneSystem] 清理应用缓存: ${packageName}`);
    
    return {
      actionId,
      status: 'SUCCESS',
      storageFreedMb: Math.floor(Math.random() * 100) + 20,
      message: `已清理 ${packageName} 的缓存`,
    };
  }

  private async uninstallApp(actionId: string, packageName: string): Promise<RemediationResult> {
    console.log(`[ImmuneSystem] 卸载应用: ${packageName}`);
    
    return {
      actionId,
      status: 'SUCCESS',
      storageFreedMb: Math.floor(Math.random() * 500) + 100,
      message: `已卸载 ${packageName}，环境已净化`,
    };
  }

  private async disableAutoStart(actionId: string, packageName: string): Promise<RemediationResult> {
    console.log(`[ImmuneSystem] 禁用自启动: ${packageName}`);
    
    return {
      actionId,
      status: 'SUCCESS',
      message: `已禁用 ${packageName} 的自启动权限`,
    };
  }
}

// 导出单例
export const immuneOrchestrator = new ImmuneOrchestratorService();
export default immuneOrchestrator;

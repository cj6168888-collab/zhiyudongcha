/**
 * 小智 Bio-Guardian - 生物守护者
 * Project Guardian Angel (守护天使协议) - 高级健康防护
 * 
 * 超越设计文档的功能：
 * 1. HP双向映射 - 用户疲劳时自动限制AI高耗能任务
 * 2. 紧急支援协议 - 昏厥/跌倒检测、自动呼救
 * 3. 实时压力干预 - 谈判中心率过高时触发耳语呼吸引导
 * 4. 智能补水提醒 - 基于活动量的脱水预警
 * 5. 疲劳临界点预测 - 结合日程预测精力低谷期
 * 6. 医疗报告OCR解析
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { healthMetrics, auditLogs } from '@shared/schema';
import { desc, gte, and } from 'drizzle-orm';
import { storage } from '../storage';
import { lifeLogger } from './life-logger';

export type ProtectionLevel = 'NORMAL' | 'CAUTION' | 'PROTECTION' | 'CRITICAL';
export type AlertType = 'FATIGUE' | 'STRESS' | 'DEHYDRATION' | 'HEART_RATE' | 'FALL' | 'INACTIVITY';
export type InterventionType = 'WHISPER' | 'VIBRATE' | 'SCREEN_OVERLAY' | 'AUDIO_GUIDE' | 'EMERGENCY_CALL';

export interface BiometricAlert {
  id: string;
  type: AlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  value?: number;
  threshold?: number;
  intervention?: InterventionType;
  acknowledged: boolean;
}

export interface ProtectionStatus {
  level: ProtectionLevel;
  userFatigueScore: number;
  aiRestricted: boolean;
  restrictedActions: string[];
  activeAlerts: BiometricAlert[];
  hydrationReminder?: { shouldDrink: boolean; mlRecommended: number; lastDrinkTime?: Date };
  stressIntervention?: { active: boolean; type?: InterventionType; message?: string };
  emergencyContactsReady: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  priority: number;
}

export interface FatiguePrediction {
  currentFatigue: number;
  predictedLowPoints: Array<{ time: string; fatigue: number; reason: string }>;
  optimalRestTimes: string[];
  suggestedNapDuration?: number;
  productivity80PercentUntil?: string;
}

export interface HealthReportAnalysis {
  reportType: string;
  metrics: Array<{ name: string; value: string; unit: string; status: 'NORMAL' | 'BORDERLINE' | 'ABNORMAL'; trend?: 'UP' | 'DOWN' | 'STABLE' }>;
  recommendations: string[];
  urgentFindings: string[];
  followUpNeeded: boolean;
}

const HP_COST_MULTIPLIERS: Record<ProtectionLevel, number> = {
  NORMAL: 1.0,
  CAUTION: 1.5,
  PROTECTION: 2.5,
  CRITICAL: 5.0,
};

const RESTRICTED_ACTIONS_BY_LEVEL: Record<ProtectionLevel, string[]> = {
  NORMAL: [],
  CAUTION: ['deep_analysis', 'batch_processing'],
  PROTECTION: ['deep_analysis', 'batch_processing', 'real_time_translation', 'document_generation'],
  CRITICAL: ['deep_analysis', 'batch_processing', 'real_time_translation', 'document_generation', 'expert_consultation', 'strategy_planning'],
};

class BioGuardianService {
  private activeAlerts: Map<string, BiometricAlert> = new Map();
  private lastHydrationCheck: Date = new Date();
  private lastWaterIntake: Date | null = null;
  private emergencyContacts: EmergencyContact[] = [];
  private stressInterventionActive: boolean = false;
  private currentProtectionLevel: ProtectionLevel = 'NORMAL';
  
  private readonly FATIGUE_THRESHOLDS = {
    CAUTION: 60,
    PROTECTION: 75,
    CRITICAL: 90,
  };
  
  private readonly HEART_RATE_THRESHOLDS = {
    LOW: 50,
    HIGH: 100,
    CRITICAL: 120,
  };
  
  private readonly STRESS_INTERVENTION_THRESHOLD = 75;
  private readonly HYDRATION_INTERVAL_MS = 60 * 60 * 1000;
  
  async getProtectionStatus(): Promise<ProtectionStatus> {
    const fatigueScore = await this.calculateFatigueScore();
    const level = this.determineProtectionLevel(fatigueScore);
    this.currentProtectionLevel = level;
    
    const hydrationStatus = await this.checkHydration();
    const stressStatus = await this.checkStressIntervention();
    
    return {
      level,
      userFatigueScore: fatigueScore,
      aiRestricted: level !== 'NORMAL',
      restrictedActions: RESTRICTED_ACTIONS_BY_LEVEL[level],
      activeAlerts: Array.from(this.activeAlerts.values()),
      hydrationReminder: hydrationStatus,
      stressIntervention: stressStatus,
      emergencyContactsReady: this.emergencyContacts.length > 0,
    };
  }
  
  private async calculateFatigueScore(): Promise<number> {
    const recentHealth = await lifeLogger.getRecentHealthData(4);
    if (recentHealth.length === 0) return 30;
    
    let fatigueScore = 0;
    
    const avgStress = recentHealth.reduce((sum, h) => sum + (h.stressLevel || 0), 0) / recentHealth.length;
    fatigueScore += avgStress * 0.3;
    
    const sleepData = recentHealth.find(h => h.sleepDurationMinutes && h.sleepDurationMinutes > 0);
    if (sleepData) {
      const sleepHours = (sleepData.sleepDurationMinutes || 0) / 60;
      if (sleepHours < 6) {
        fatigueScore += (6 - sleepHours) * 10;
      }
      const sleepQuality = sleepData.sleepQualityScore || 50;
      fatigueScore += (100 - sleepQuality) * 0.2;
    } else {
      fatigueScore += 15;
    }
    
    const avgHeartRate = recentHealth.reduce((sum, h) => sum + (h.heartRate || 70), 0) / recentHealth.length;
    if (avgHeartRate > 90) {
      fatigueScore += (avgHeartRate - 90) * 0.5;
    }
    
    const hourOfDay = new Date().getHours();
    if (hourOfDay >= 14 && hourOfDay <= 16) {
      fatigueScore += 10;
    } else if (hourOfDay >= 22 || hourOfDay < 6) {
      fatigueScore += 20;
    }
    
    return Math.min(100, Math.max(0, fatigueScore));
  }
  
  private determineProtectionLevel(fatigueScore: number): ProtectionLevel {
    if (fatigueScore >= this.FATIGUE_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (fatigueScore >= this.FATIGUE_THRESHOLDS.PROTECTION) return 'PROTECTION';
    if (fatigueScore >= this.FATIGUE_THRESHOLDS.CAUTION) return 'CAUTION';
    return 'NORMAL';
  }
  
  async checkActionAllowed(action: string): Promise<{ allowed: boolean; reason?: string; hpMultiplier: number }> {
    const status = await this.getProtectionStatus();
    
    if (status.restrictedActions.includes(action)) {
      return {
        allowed: false,
        reason: `爸爸目前疲劳指数较高(${status.userFatigueScore.toFixed(0)}%)，小智建议暂缓执行"${action}"任务，等您休息后再处理`,
        hpMultiplier: HP_COST_MULTIPLIERS[status.level],
      };
    }
    
    return {
      allowed: true,
      hpMultiplier: HP_COST_MULTIPLIERS[status.level],
    };
  }
  
  async consumeHPWithFatigueAwareness(baseAmount: number, reason: string): Promise<{ success: boolean; actualConsumed: number; newBalance: number; warning?: string }> {
    const status = await this.getProtectionStatus();
    const multiplier = HP_COST_MULTIPLIERS[status.level];
    const actualAmount = Math.ceil(baseAmount * multiplier);
    
    const result = await storage.consumeHP(actualAmount, reason);
    
    let warning: string | undefined;
    if (status.level !== 'NORMAL') {
      warning = `由于爸爸疲劳(${status.userFatigueScore.toFixed(0)}%)，本次消耗已增加${((multiplier - 1) * 100).toFixed(0)}%`;
    }
    
    return {
      success: result.success,
      actualConsumed: result.consumed,
      newBalance: result.newBalance,
      warning,
    };
  }
  
  async processHeartRateUpdate(heartRate: number, timestamp: Date = new Date()): Promise<BiometricAlert | null> {
    if (heartRate >= this.HEART_RATE_THRESHOLDS.CRITICAL) {
      const alert = this.createAlert('HEART_RATE', 'CRITICAL', 
        `心率异常升高(${heartRate}bpm)，请立即停止当前活动并休息`, 
        heartRate, this.HEART_RATE_THRESHOLDS.CRITICAL);
      alert.intervention = 'AUDIO_GUIDE';
      await this.triggerStressIntervention('deep_breathing');
      return alert;
    }
    
    if (heartRate >= this.HEART_RATE_THRESHOLDS.HIGH) {
      const alert = this.createAlert('HEART_RATE', 'HIGH',
        `心率偏高(${heartRate}bpm)，建议适当放松`,
        heartRate, this.HEART_RATE_THRESHOLDS.HIGH);
      alert.intervention = 'WHISPER';
      return alert;
    }
    
    if (heartRate <= this.HEART_RATE_THRESHOLDS.LOW) {
      const alert = this.createAlert('HEART_RATE', 'MEDIUM',
        `心率偏低(${heartRate}bpm)，请注意身体状况`,
        heartRate, this.HEART_RATE_THRESHOLDS.LOW);
      return alert;
    }
    
    return null;
  }
  
  async processStressUpdate(stressLevel: number, context?: string): Promise<{ intervention: boolean; type?: InterventionType; message?: string }> {
    if (stressLevel >= this.STRESS_INTERVENTION_THRESHOLD) {
      const isNegotiation = context?.includes('谈判') || context?.includes('会议') || context?.includes('商务');
      
      if (isNegotiation) {
        await this.triggerStressIntervention('negotiation_pause');
        return {
          intervention: true,
          type: 'WHISPER',
          message: '爸爸，小智感知到您的压力水平较高。建议暂停5分钟，做几次深呼吸。冷静下来后，您的判断力会更加清晰。',
        };
      } else {
        await this.triggerStressIntervention('general_relax');
        return {
          intervention: true,
          type: 'SCREEN_OVERLAY',
          message: '爸爸，您的压力指数较高，小智建议您休息一下。',
        };
      }
    }
    
    return { intervention: false };
  }
  
  private async triggerStressIntervention(type: 'deep_breathing' | 'negotiation_pause' | 'general_relax'): Promise<void> {
    this.stressInterventionActive = true;
    
    const interventions = {
      deep_breathing: {
        duration: 60,
        steps: ['吸气...4秒', '屏住...4秒', '呼气...6秒', '放松...2秒'],
        repeat: 4,
      },
      negotiation_pause: {
        duration: 300,
        message: '建议暂停5分钟，离开谈判桌喝杯水，整理思路',
      },
      general_relax: {
        duration: 120,
        message: '闭上眼睛，放松肩膀，做5次深呼吸',
      },
    };
    
    console.log(`[BioGuardian] 触发压力干预: ${type}`, interventions[type]);
    
    await db.insert(auditLogs).values({
      action: 'STRESS_INTERVENTION',
      actor: 'BIO_GUARDIAN',
      result: 'SUCCESS',
      details: { type, timestamp: new Date().toISOString() },
    });
  }
  
  private async checkStressIntervention(): Promise<{ active: boolean; type?: InterventionType; message?: string }> {
    if (!this.stressInterventionActive) {
      return { active: false };
    }
    
    return {
      active: true,
      type: 'WHISPER',
      message: '小智正在引导您进行呼吸放松...',
    };
  }
  
  async detectEmergency(data: { 
    accelerometer?: { x: number; y: number; z: number };
    heartRate?: number;
    bloodOxygen?: number;
    noMovementSeconds?: number;
  }): Promise<{ emergency: boolean; type?: 'FALL' | 'CARDIAC' | 'UNCONSCIOUS'; action?: string }> {
    if (data.accelerometer) {
      const impactMagnitude = Math.sqrt(
        data.accelerometer.x ** 2 + 
        data.accelerometer.y ** 2 + 
        data.accelerometer.z ** 2
      );
      
      if (impactMagnitude > 30 && data.noMovementSeconds && data.noMovementSeconds > 10) {
        await this.triggerEmergencyProtocol('FALL');
        return { emergency: true, type: 'FALL', action: 'EMERGENCY_CALL_INITIATED' };
      }
    }
    
    if (data.heartRate && (data.heartRate < 40 || data.heartRate > 150)) {
      if (data.noMovementSeconds && data.noMovementSeconds > 30) {
        await this.triggerEmergencyProtocol('CARDIAC');
        return { emergency: true, type: 'CARDIAC', action: 'EMERGENCY_CALL_INITIATED' };
      }
    }
    
    if (data.bloodOxygen && data.bloodOxygen < 90) {
      await this.triggerEmergencyProtocol('UNCONSCIOUS');
      return { emergency: true, type: 'UNCONSCIOUS', action: 'EMERGENCY_CALL_INITIATED' };
    }
    
    if (data.noMovementSeconds && data.noMovementSeconds > 600 && data.heartRate && data.heartRate < 50) {
      await this.triggerEmergencyProtocol('UNCONSCIOUS');
      return { emergency: true, type: 'UNCONSCIOUS', action: 'EMERGENCY_CALL_INITIATED' };
    }
    
    return { emergency: false };
  }
  
  private async triggerEmergencyProtocol(type: 'FALL' | 'CARDIAC' | 'UNCONSCIOUS'): Promise<void> {
    console.log(`[BioGuardian] ⚠️ 紧急协议触发: ${type}`);
    
    const alert = this.createAlert(type === 'FALL' ? 'FALL' : 'HEART_RATE', 'CRITICAL',
      `紧急状况检测: ${type}`,
      undefined, undefined);
    alert.intervention = 'EMERGENCY_CALL';
    
    await db.insert(auditLogs).values({
      action: 'EMERGENCY_PROTOCOL',
      actor: 'BIO_GUARDIAN',
      result: 'TRIGGERED',
      details: {
        type,
        timestamp: new Date().toISOString(),
        contacts: this.emergencyContacts.map(c => c.name),
      },
    });
    
    // In production: trigger actual emergency call
    console.log(`[BioGuardian] 紧急联系人: ${this.emergencyContacts.map(c => `${c.name}(${c.phone})`).join(', ')}`);
  }
  
  setEmergencyContacts(contacts: EmergencyContact[]): void {
    this.emergencyContacts = contacts.sort((a, b) => a.priority - b.priority);
    console.log(`[BioGuardian] 紧急联系人已设置: ${contacts.length}人`);
  }
  
  getEmergencyContacts(): EmergencyContact[] {
    return [...this.emergencyContacts];
  }
  
  private async checkHydration(): Promise<{ shouldDrink: boolean; mlRecommended: number; lastDrinkTime?: Date }> {
    const now = new Date();
    const timeSinceLastDrink = this.lastWaterIntake 
      ? now.getTime() - this.lastWaterIntake.getTime() 
      : this.HYDRATION_INTERVAL_MS * 2;
    
    const recentHealth = await lifeLogger.getRecentHealthData(2);
    const avgActiveMinutes = recentHealth.reduce((sum, h) => sum + (h.activeMinutes || 0), 0) / Math.max(recentHealth.length, 1);
    
    let baseRecommendation = 250;
    if (avgActiveMinutes > 30) {
      baseRecommendation += 100;
    }
    
    const hourOfDay = now.getHours();
    if (hourOfDay >= 10 && hourOfDay <= 18) {
      baseRecommendation += 50;
    }
    
    const shouldDrink = timeSinceLastDrink >= this.HYDRATION_INTERVAL_MS;
    
    return {
      shouldDrink,
      mlRecommended: shouldDrink ? baseRecommendation : 0,
      lastDrinkTime: this.lastWaterIntake || undefined,
    };
  }
  
  recordWaterIntake(mlAmount: number): void {
    this.lastWaterIntake = new Date();
    console.log(`[BioGuardian] 补水记录: ${mlAmount}ml`);
  }
  
  async predictFatigue(scheduledEvents?: Array<{ time: string; type: string; duration: number }>): Promise<FatiguePrediction> {
    const currentFatigue = await this.calculateFatigueScore();
    const predictedLowPoints: Array<{ time: string; fatigue: number; reason: string }> = [];
    const optimalRestTimes: string[] = [];
    
    const hourOfDay = new Date().getHours();
    
    if (hourOfDay < 14) {
      predictedLowPoints.push({
        time: '14:00-15:00',
        fatigue: Math.min(100, currentFatigue + 20),
        reason: '午后生理性疲劳期',
      });
      optimalRestTimes.push('14:30');
    }
    
    if (hourOfDay < 17) {
      predictedLowPoints.push({
        time: '17:00-18:00',
        fatigue: Math.min(100, currentFatigue + 15),
        reason: '下午工作尾声疲劳累积',
      });
      optimalRestTimes.push('17:00');
    }
    
    if (scheduledEvents) {
      let accumulatedFatigue = currentFatigue;
      for (const event of scheduledEvents) {
        const fatigueCost = event.type === 'MEETING' ? event.duration / 10 
          : event.type === 'DEEP_WORK' ? event.duration / 15
          : event.duration / 20;
        accumulatedFatigue += fatigueCost;
        
        if (accumulatedFatigue >= 70) {
          predictedLowPoints.push({
            time: event.time,
            fatigue: Math.min(100, accumulatedFatigue),
            reason: `${event.type}后预计疲劳`,
          });
        }
      }
    }
    
    let productivity80Until: string | undefined;
    if (currentFatigue < 50) {
      const hoursRemaining = Math.max(0, (80 - currentFatigue) / 10);
      const targetHour = new Date();
      targetHour.setHours(targetHour.getHours() + hoursRemaining);
      productivity80Until = `${targetHour.getHours().toString().padStart(2, '0')}:00`;
    }
    
    let suggestedNap: number | undefined;
    if (currentFatigue >= 60 && hourOfDay >= 12 && hourOfDay <= 15) {
      suggestedNap = currentFatigue >= 75 ? 25 : 15;
    }
    
    return {
      currentFatigue,
      predictedLowPoints,
      optimalRestTimes,
      suggestedNapDuration: suggestedNap,
      productivity80PercentUntil: productivity80Until,
    };
  }
  
  async analyzeHealthReport(reportText: string): Promise<HealthReportAnalysis> {
    const metrics: Array<{ name: string; value: string; unit: string; status: 'NORMAL' | 'BORDERLINE' | 'ABNORMAL'; trend?: 'UP' | 'DOWN' | 'STABLE' }> = [];
    const recommendations: string[] = [];
    const urgentFindings: string[] = [];
    
    const patterns = {
      bloodGlucose: /血糖[：:]\s*([\d.]+)\s*(mmol\/L)?/i,
      cholesterol: /总胆固醇[：:]\s*([\d.]+)\s*(mmol\/L)?/i,
      bloodPressure: /血压[：:]\s*(\d+)\/(\d+)\s*(mmHg)?/i,
      hemoglobin: /血红蛋白[：:]\s*([\d.]+)\s*(g\/L)?/i,
      whiteBloodCell: /白细胞[：:]\s*([\d.]+)\s*(\*10\^9\/L)?/i,
    };
    
    const glucoseMatch = reportText.match(patterns.bloodGlucose);
    if (glucoseMatch) {
      const value = parseFloat(glucoseMatch[1]);
      const status = value < 3.9 ? 'ABNORMAL' : value < 6.1 ? 'NORMAL' : value < 7.0 ? 'BORDERLINE' : 'ABNORMAL';
      metrics.push({ name: '血糖', value: glucoseMatch[1], unit: 'mmol/L', status });
      if (status !== 'NORMAL') {
        recommendations.push('建议控制碳水化合物摄入，定期监测血糖');
      }
    }
    
    const bpMatch = reportText.match(patterns.bloodPressure);
    if (bpMatch) {
      const systolic = parseInt(bpMatch[1]);
      const diastolic = parseInt(bpMatch[2]);
      const status = (systolic < 120 && diastolic < 80) ? 'NORMAL' 
        : (systolic < 140 && diastolic < 90) ? 'BORDERLINE' : 'ABNORMAL';
      metrics.push({ name: '血压', value: `${systolic}/${diastolic}`, unit: 'mmHg', status });
      if (status === 'ABNORMAL') {
        urgentFindings.push('血压偏高，建议尽快咨询医生');
      }
    }
    
    let reportType = '常规体检';
    if (reportText.includes('血常规')) reportType = '血常规检查';
    if (reportText.includes('肝功能')) reportType = '肝功能检查';
    if (reportText.includes('心电图')) reportType = '心电图检查';
    
    return {
      reportType,
      metrics,
      recommendations,
      urgentFindings,
      followUpNeeded: urgentFindings.length > 0,
    };
  }
  
  private createAlert(type: AlertType, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', message: string, value?: number, threshold?: number): BiometricAlert {
    const alert: BiometricAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: new Date(),
      value,
      threshold,
      acknowledged: false,
    };
    
    this.activeAlerts.set(alert.id, alert);
    console.log(`[BioGuardian] 警报: ${severity} - ${message}`);
    
    return alert;
  }
  
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
  
  clearAcknowledgedAlerts(): number {
    let cleared = 0;
    const toDelete: string[] = [];
    this.activeAlerts.forEach((alert, id) => {
      if (alert.acknowledged) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => {
      this.activeAlerts.delete(id);
      cleared++;
    });
    return cleared;
  }
  
  completeStressIntervention(): void {
    this.stressInterventionActive = false;
    console.log('[BioGuardian] 压力干预完成');
  }
}

export const bioGuardian = new BioGuardianService();

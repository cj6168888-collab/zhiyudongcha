import { createServiceLogger } from '../lib/logger';
import { evolutionService } from './EvolutionService';
import { auditService } from './AuditService';

const logger = createServiceLogger('HPService');

export class HPService {
  private readonly MAX_HP = 1000;

  /**
   * 获取当前 HP 状态
   */
  async getHPStatus(): Promise<{
    hp: number;
    maxHp: number;
    academicLevel: string;
  }> {
    const state = await evolutionService.getEvolutionState();
    return {
      hp: state?.academicXp || this.MAX_HP,
      maxHp: this.MAX_HP,
      academicLevel: state?.academicLevel || 'BACHELOR',
    };
  }

  /**
   * 获取 HP 余额详情
   */
  async getHPBalance(): Promise<{
    current: number;
    maximum: number;
    rechargeRate: number;
    lastRecharge: Date;
    academicLevel: string;
    bonusMultiplier: number;
    pendingBonus: number;
  }> {
    const state = await evolutionService.getEvolutionState();
    
    const hpBalance = {
      current: state?.academicXp || this.MAX_HP,
      maximum: this.MAX_HP,
      rechargeRate: 10,
      lastRecharge: state?.hpLastRechargeAt || new Date(),
      academicLevel: state?.academicLevel || 'BACHELOR',
      bonusMultiplier: 1.0,
      pendingBonus: 0,
    };

    switch (state?.academicLevel) {
      case 'MASTER':
        hpBalance.bonusMultiplier = 1.2;
        break;
      case 'PHD':
        hpBalance.bonusMultiplier = 1.5;
        break;
      case 'POSTDOC':
        hpBalance.bonusMultiplier = 2.0;
        break;
    }

    return hpBalance;
  }

  /**
   * 消耗 HP
   */
  async consumeHP(amount: number, reason: string, actor: string = 'SYSTEM'): Promise<{
    success: boolean;
    previousHp: number;
    currentHp: number;
    consumed: number;
  }> {
    if (!amount || amount <= 0) {
      throw new Error('无效的HP消耗量');
    }

    const state = await evolutionService.getEvolutionState();
    const currentHp = state?.academicXp || this.MAX_HP;
    
    if (currentHp < amount) {
      throw new Error(`HP不足: 需要 ${amount}, 当前 ${currentHp}`);
    }

    const newHp = Math.max(0, currentHp - amount);
    await evolutionService.updateEvolutionState({ academicXp: newHp });

    await auditService.logHPConsumption(actor, amount, reason, currentHp, newHp);

    logger.info({ amount, reason, oldHp: currentHp, newHp }, 'HP消耗成功');

    return {
      success: true,
      previousHp: currentHp,
      currentHp: newHp,
      consumed: amount,
    };
  }

  /**
   * 恢复 HP
   */
  async restoreHP(amount: number, actor: string = 'MASTER'): Promise<{
    success: boolean;
    previousHp: number;
    currentHp: number;
    restored: number;
  }> {
    if (!amount || amount <= 0) {
      throw new Error('无效的HP恢复量');
    }

    const state = await evolutionService.getEvolutionState();
    const currentHp = state?.academicXp || 0;
    const newHp = Math.min(this.MAX_HP, currentHp + amount);
    const actualRestored = newHp - currentHp;

    await evolutionService.updateEvolutionState({ academicXp: newHp });

    logger.info({ amount, oldHp: currentHp, newHp }, 'HP恢复成功');

    return {
      success: true,
      previousHp: currentHp,
      currentHp: newHp,
      restored: actualRestored,
    };
  }

  /**
   * 充值 HP（带来源描述）
   */
  async rechargeHP(
    amount: number, 
    source: string, 
    description: string,
    actor: string = 'MASTER'
  ): Promise<{
    success: boolean;
    transaction: unknown;
    currentBalance: number;
    message?: string;
  }> {
    if (!amount || amount <= 0) {
      throw new Error('无效的HP充值量');
    }

    const state = await evolutionService.getEvolutionState();
    const currentHp = state?.academicXp || 0;
    const newHp = Math.min(this.MAX_HP, currentHp + amount);
    const actualRecharge = newHp - currentHp;

    await evolutionService.updateEvolutionState({ academicXp: newHp });

    const transaction = {
      id: `hp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'RECHARGE',
      amount: actualRecharge,
      balanceAfter: newHp,
      source: source || 'MANUAL',
      description: description || 'Manual HP recharge',
      timestamp: new Date().toISOString(),
      overflow: amount - actualRecharge,
    };

    await auditService.logHPRecharge(actor, actualRecharge, source, currentHp, newHp);

    logger.info({ amount, source, oldHp: currentHp, newHp }, 'HP充值成功');

    return {
      success: true,
      transaction,
      currentBalance: newHp,
      message: actualRecharge < amount ? `HP已达上限，实际充值${actualRecharge}点` : undefined,
    };
  }

  /**
   * 服务消费 HP（带服务类型）
   */
  async consumeHPForService(
    amount: number,
    serviceType: string,
    description?: string,
    metadata?: Record<string, unknown>,
    actor: string = 'SYSTEM'
  ): Promise<{
    success: boolean;
    transaction: unknown;
    currentBalance: number;
  }> {
    if (!amount || amount <= 0) {
      throw new Error('无效的HP消耗量');
    }

    if (!serviceType) {
      throw new Error('必须指定服务类型');
    }

    const state = await evolutionService.getEvolutionState();
    const currentHp = state?.academicXp || this.MAX_HP;
    
    if (currentHp < amount) {
      throw new Error(`HP不足: 需要 ${amount}, 当前 ${currentHp}`);
    }

    const newHp = currentHp - amount;
    await evolutionService.updateEvolutionState({ academicXp: newHp });

    const transaction = {
      id: `hp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'CONSUME',
      amount: -amount,
      balanceAfter: newHp,
      serviceType,
      description: description || `${serviceType} service consumption`,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    await auditService.createAuditLog({
      action: 'HP_CONSUMED',
      actor,
      targetType: 'hp',
      targetId: 'singleton',
      details: {
        transactionId: transaction.id,
        amount,
        serviceType,
        oldBalance: currentHp,
        newBalance: newHp,
      },
      result: 'SUCCESS',
    });

    logger.info({ amount, serviceType, oldHp: currentHp, newHp }, '服务HP消耗成功');

    return {
      success: true,
      transaction,
      currentBalance: newHp,
    };
  }
}

export const hpService = new HPService();
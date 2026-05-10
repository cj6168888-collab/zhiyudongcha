import { sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import { createServiceLogger } from '../lib/logger';
import { evolutionStateRepository } from './intel.repository';
import type { InsertEvolutionState } from '../../shared/schema';

const logger = createServiceLogger('HPRepository');

// Minimal interface shared by NodePgDatabase and NodePgTransaction
type Execable = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };

class HPRepository {
  async consumeHP(
    amount: number,
    reason: string,
  ): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }> {
    return this.consumeHPWithLock(amount, reason, 'system');
  }

  async consumeHPWithLock(
    amount: number,
    reason: string,
    userId?: string,
  ): Promise<{ success: boolean; newBalance: number; consumed: number; error?: string }> {
    const db = getDatabase();
    if (!db) throw new Error('Database not available');

    const lockKey = `hp_balance_update:${userId ?? 'system'}`;
    const lockTimeoutMs = 10_000;

    return db.transaction(async (tx) => {
      const exec = tx as unknown as Execable;
      try {
        const acquired = await this.acquireLock(exec, lockKey, lockTimeoutMs);
        if (!acquired) {
          return { success: false, newBalance: 0, consumed: 0, error: '系统繁忙，请稍后重试' };
        }

        const stateResult = await exec.execute(sql`
          SELECT hp_balance, hp_total_consumed FROM evolution_state WHERE id = 'singleton' LIMIT 1
        `);
        const row = stateResult.rows[0] as Record<string, number> | undefined;
        const currentBalance = row?.hp_balance ?? 1000;
        const totalConsumed = row?.hp_total_consumed ?? 0;

        if (amount <= 0) {
          await this.releaseLock(exec, lockKey);
          return { success: false, newBalance: currentBalance, consumed: 0, error: 'Amount must be positive' };
        }

        if (amount > currentBalance) {
          await this.writeAuditLog(exec, 'HP_CONSUME', userId ?? 'SYSTEM', 'HP', reason,
            { requestedAmount: amount, currentBalance, error: 'INSUFFICIENT_BALANCE' }, 'FAILED');
          await this.releaseLock(exec, lockKey);
          return { success: false, newBalance: currentBalance, consumed: 0, error: 'HP余额不足' };
        }

        const newBalance = currentBalance - amount;
        await exec.execute(sql`
          UPDATE evolution_state
          SET hp_balance = ${newBalance},
              hp_total_consumed = ${totalConsumed + amount},
              updated_at = NOW()
          WHERE id = 'singleton'
        `);

        await this.writeAuditLog(exec, 'HP_CONSUME', userId ?? 'SYSTEM', 'HP', reason,
          { amount, previousBalance: currentBalance, newBalance }, 'SUCCESS');

        await this.releaseLock(exec, lockKey);
        return { success: true, newBalance, consumed: amount };
      } catch (error) {
        try { await this.releaseLock(exec, lockKey); } catch { /* ignore */ }
        throw error;
      }
    });
  }

  async rechargeHP(
    amount: number,
    expandMax?: boolean,
  ): Promise<{ success: boolean; newBalance: number; recharged: number; newMaxBalance?: number }> {
    const state = await evolutionStateRepository.getSingleton();
    const currentBalance = state?.hpBalance ?? 0;
    let maxBalance = state?.hpMaxBalance ?? 1000;

    if (amount <= 0) {
      return { success: false, newBalance: currentBalance, recharged: 0 };
    }

    if (expandMax && currentBalance + amount > maxBalance) {
      maxBalance = currentBalance + amount;
    }

    const actualRecharge = Math.min(amount, maxBalance - currentBalance);
    const newBalance = currentBalance + actualRecharge;

    await evolutionStateRepository.updateSingleton({
      hpBalance: newBalance,
      hpMaxBalance: maxBalance,
      hpTotalRecharged: (state?.hpTotalRecharged ?? 0) + actualRecharge,
      hpLastRechargeAt: new Date(),
    } as Partial<InsertEvolutionState>);

    const db = getDatabase();
    if (db) {
      try {
        await this.writeAuditLog(
          db as unknown as Execable,
          'HP_RECHARGE', 'SYSTEM', 'HP', 'recharge',
          { amount: actualRecharge, previousBalance: currentBalance, newBalance, maxBalance },
          'SUCCESS',
        );
      } catch (err) {
        logger.warn({ err }, 'rechargeHP 审计日志写入失败');
      }
    }

    return { success: true, newBalance, recharged: actualRecharge, newMaxBalance: maxBalance };
  }

  private async acquireLock(exec: Execable, lockKey: string, timeoutMs: number): Promise<boolean> {
    const lockId = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const result = await exec.execute(sql`
      INSERT INTO distributed_locks (lock_key, lock_id, expires_at)
      VALUES (
        ${lockKey}, ${lockId},
        NOW() + ${sql.raw(`INTERVAL '${timeoutMs} MILLISECONDS'`)}
      )
      ON CONFLICT (lock_key) DO NOTHING
      RETURNING lock_id
    `);
    return (
      result.rows.length > 0 &&
      (result.rows[0] as { lock_id?: string }).lock_id === lockId
    );
  }

  private async releaseLock(exec: Execable, lockKey: string): Promise<void> {
    await exec.execute(sql`DELETE FROM distributed_locks WHERE lock_key = ${lockKey}`);
  }

  private async writeAuditLog(
    exec: Execable,
    action: string,
    actor: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown>,
    result: string,
  ): Promise<void> {
    await exec.execute(sql`
      INSERT INTO audit_logs (action, actor, target_type, target_id, details, result, created_at)
      VALUES (
        ${action}, ${actor}, ${targetType}, ${targetId},
        ${JSON.stringify(details)}::jsonb,
        ${result}, NOW()
      )
    `);
  }
}

export const hpRepository = new HPRepository();

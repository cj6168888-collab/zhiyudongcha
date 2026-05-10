import { createServiceLogger } from '../../lib/logger';
import { getDatabase } from '../../db';
import { sql } from 'drizzle-orm';
import { randomInt } from 'crypto';

const logger = createServiceLogger('DeviceBindingService');

const BIND_CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟
const VALID_DEVICE_TYPES = ['mobile', 'desktop', 'esp32_voice', 'omi', 'browser'] as const;

export type DeviceType = (typeof VALID_DEVICE_TYPES)[number];

export interface DeviceBindingRecord {
  id: string;
  ownerId: string;
  identityId: string;
  deviceId: string;
  deviceType: string;
  provider: string;
  displayName: string | null;
  status: string;
  capabilities: Record<string, unknown>;
  allowedModes: string[];
  riskPolicy: Record<string, unknown>;
  lastSeenAt: Date | null;
  boundAt: Date;
  revokedAt: Date | null;
}

export interface BindCodeEntry {
  code: string;
  ownerId: string;
  identityId: string;
  createdAt: number;
  expiresAt: number;
}

export interface ConfirmBindingInput {
  code: string;
  deviceId: string;
  deviceType: DeviceType;
  provider?: string;
  displayName?: string;
  capabilities?: Record<string, unknown>;
}

// 内存中的绑定码存储（跨请求生命周期）
const pendingCodes = new Map<string, BindCodeEntry>();

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of pendingCodes) {
    if (v.expiresAt < now) pendingCodes.delete(k);
  }
}

class DeviceBindingService {
  private get db() {
    return getDatabase();
  }

  // ── 觉醒状态检查 ───────────────────────────────────

  async isAwakeningComplete(ownerId: string): Promise<boolean> {
    if (ownerId === 'default') return true; // 开发模式放行

    const db = this.db;
    if (!db) return false;

    // 检查 user_settings 中是否有名称配置
    try {
      const rows = await db.execute(sql`
        SELECT id FROM user_settings WHERE user_id = ${ownerId} LIMIT 1
      `);
      return rows.rows.length > 0;
    } catch {
      // 表不存在或查询失败时放行（降级兼容）
      return true;
    }
  }

  // ── 生成绑定码 ─────────────────────────────────────

  async generateBindCode(ownerId: string, identityId: string): Promise<BindCodeEntry> {
    if (!(await this.isAwakeningComplete(ownerId))) {
      throw new Error('AWAKENING_REQUIRED');
    }

    purgeExpired();

    // 6 位数字码，保证唯一
    let code: string;
    let attempts = 0;
    do {
      code = String(randomInt(100000, 999999));
      attempts++;
      if (attempts > 20) throw new Error('Failed to generate unique bind code');
    } while (pendingCodes.has(code));

    const entry: BindCodeEntry = {
      code,
      ownerId,
      identityId,
      createdAt: Date.now(),
      expiresAt: Date.now() + BIND_CODE_TTL_MS,
    };

    pendingCodes.set(code, entry);
    logger.info({ ownerId, code }, 'Bind code generated');
    return entry;
  }

  // ── 确认绑定 ───────────────────────────────────────

  async confirmBinding(input: ConfirmBindingInput): Promise<DeviceBindingRecord> {
    purgeExpired();

    const entry = pendingCodes.get(input.code);
    if (!entry) throw new Error('INVALID_OR_EXPIRED_CODE');
    if (entry.expiresAt < Date.now()) {
      pendingCodes.delete(input.code);
      throw new Error('INVALID_OR_EXPIRED_CODE');
    }

    if (!VALID_DEVICE_TYPES.includes(input.deviceType)) {
      throw new Error(`Invalid deviceType: ${input.deviceType}`);
    }

    const db = this.db;
    if (!db) throw new Error('Database not available');

    // 如果该 deviceId 已绑定，先撤销旧绑定
    await db.execute(sql`
      UPDATE device_bindings
      SET status = 'revoked', revoked_at = now()
      WHERE device_id = ${input.deviceId} AND status = 'active'
    `);

    const caps = JSON.stringify(input.capabilities ?? {});
    const defaultModes = JSON.stringify(['casual_chat', 'record_note', 'task_request']);
    const defaultPolicy = JSON.stringify({ requireConfirm: ['send', 'delete', 'pay', 'share'] });

    const rows = await db.execute(sql`
      INSERT INTO device_bindings (
        owner_id, identity_id, device_id, device_type, provider,
        display_name, capabilities, allowed_modes, risk_policy
      ) VALUES (
        ${entry.ownerId},
        ${entry.identityId},
        ${input.deviceId},
        ${input.deviceType},
        ${input.provider ?? input.deviceType},
        ${input.displayName ?? null},
        ${caps}::jsonb,
        ${defaultModes}::jsonb,
        ${defaultPolicy}::jsonb
      )
      RETURNING *
    `);

    pendingCodes.delete(input.code);
    const record = this.mapRow(rows.rows[0]);
    logger.info({ deviceId: input.deviceId, ownerId: entry.ownerId }, 'Device bound');
    return record;
  }

  // ── 撤销设备 ───────────────────────────────────────

  async revokeDevice(deviceId: string, ownerId: string): Promise<boolean> {
    const db = this.db;
    if (!db) return false;

    const result = await db.execute(sql`
      UPDATE device_bindings
      SET status = 'revoked', revoked_at = now()
      WHERE device_id = ${deviceId} AND owner_id = ${ownerId} AND status != 'revoked'
      RETURNING id
    `);

    const ok = (result.rowCount ?? 0) > 0;
    if (ok) logger.info({ deviceId, ownerId }, 'Device revoked');
    return ok;
  }

  // ── 查询设备列表 ───────────────────────────────────

  async listDevices(ownerId: string): Promise<DeviceBindingRecord[]> {
    const db = this.db;
    if (!db) return [];

    const rows = await db.execute(sql`
      SELECT * FROM device_bindings
      WHERE owner_id = ${ownerId}
      ORDER BY bound_at DESC
    `);

    return rows.rows.map(r => this.mapRow(r));
  }

  // ── 获取单个设备 ───────────────────────────────────

  async getDevice(deviceId: string, ownerId: string): Promise<DeviceBindingRecord | null> {
    const db = this.db;
    if (!db) return null;

    const rows = await db.execute(sql`
      SELECT * FROM device_bindings
      WHERE device_id = ${deviceId} AND owner_id = ${ownerId}
      LIMIT 1
    `);

    return rows.rows[0] ? this.mapRow(rows.rows[0]) : null;
  }

  // ── 更新设备（displayName、allowedModes） ──────────

  async updateDevice(
    deviceId: string,
    ownerId: string,
    updates: { displayName?: string; allowedModes?: string[] }
  ): Promise<DeviceBindingRecord | null> {
    const db = this.db;
    if (!db) return null;

    const modesJson = updates.allowedModes ? JSON.stringify(updates.allowedModes) : null;

    await db.execute(sql`
      UPDATE device_bindings
      SET
        display_name = COALESCE(${updates.displayName ?? null}, display_name),
        allowed_modes = CASE WHEN ${modesJson} IS NOT NULL THEN ${modesJson}::jsonb ELSE allowed_modes END
      WHERE device_id = ${deviceId} AND owner_id = ${ownerId}
    `);

    return this.getDevice(deviceId, ownerId);
  }

  // ── 心跳更新 ──────────────────────────────────────

  async touchDevice(deviceId: string): Promise<void> {
    const db = this.db;
    if (!db) return;

    await db.execute(sql`
      UPDATE device_bindings SET last_seen_at = now()
      WHERE device_id = ${deviceId} AND status = 'active'
    `);
  }

  // ── 验证设备是否有效（供 WebSocket/其他服务使用） ──

  async validateDevice(deviceId: string): Promise<DeviceBindingRecord | null> {
    const db = this.db;
    if (!db) return null;

    const rows = await db.execute(sql`
      SELECT * FROM device_bindings
      WHERE device_id = ${deviceId} AND status = 'active'
      LIMIT 1
    `);

    return rows.rows[0] ? this.mapRow(rows.rows[0]) : null;
  }

  // ── 映射 ─────────────────────────────────────────

  private mapRow(r: Record<string, unknown>): DeviceBindingRecord {
    return {
      id: r.id,
      ownerId: r.owner_id,
      identityId: r.identity_id,
      deviceId: r.device_id,
      deviceType: r.device_type,
      provider: r.provider,
      displayName: r.display_name,
      status: r.status,
      capabilities: r.capabilities ?? {},
      allowedModes: r.allowed_modes ?? [],
      riskPolicy: r.risk_policy ?? {},
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : null,
      boundAt: new Date(r.bound_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
    };
  }
}

export const deviceBindingService = new DeviceBindingService();

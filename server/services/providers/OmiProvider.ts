/**
 * OmiProvider — P3 Omi 批量导入
 *
 * 规则：
 * - Omi 数据必须进入候选态，不直接写长期记忆
 * - 导入幂等（externalSourceId + source='omi' 唯一）
 * - Omi 不可用不影响本地系统
 * - 每条导入内容保存 remoteId、source、importedAt、rawPayload hash
 */

import { createServiceLogger } from '../../lib/logger';
import { getDatabase } from '../../db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { conversationService } from '../conversation/ConversationService';

const logger = createServiceLogger('OmiProvider');

// ── Omi 原始数据结构（Omi 导出格式）────────────────────

export interface OmiMemory {
  id: string;
  content?: string;
  created_at?: string;
  structured?: {
    title?: string;
    overview?: string;
    emoji?: string;
    action_items?: Array<{ description: string; completed?: boolean }>;
    category?: string;
  };
}

export interface OmiConversation {
  id: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  transcript?: Array<{ speaker: string; text: string; start?: number; end?: number }>;
  summary?: string;
  title?: string;
  action_items?: Array<{ description: string; completed?: boolean }>;
}

export interface OmiExportPayload {
  memories?: OmiMemory[];
  conversations?: OmiConversation[];
}

// ── 导入结果 ────────────────────────────────────────────

export interface ImportResult {
  memoriesImported: number;
  memoriesSkipped: number;
  conversationsImported: number;
  conversationsSkipped: number;
  candidatesCreated: number;
  errors: string[];
}

// ── 同步状态记录 ─────────────────────────────────────────

export interface SyncState {
  id: string;
  ownerId: string;
  provider: string;
  accountRef: string | null;
  cursor: string | null;
  lastSyncedAt: Date | null;
  status: string;
  errorMessage: string | null;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ── OmiProvider ──────────────────────────────────────────

class OmiProvider {
  private get db() {
    return getDatabase();
  }

  // ── 连接 / 保存配置 ─────────────────────────────────

  async connect(ownerId: string, config: { apiKey?: string; accountRef?: string }): Promise<SyncState> {
    const db = this.db;
    if (!db) throw new Error('Database not available');

    const configJson = JSON.stringify({ apiKey: config.apiKey ? '[SET]' : undefined });

    const rows = await db.execute(sql`
      INSERT INTO provider_sync_states (owner_id, provider, account_ref, config, status)
      VALUES (${ownerId}, 'omi', ${config.accountRef ?? null}, ${configJson}::jsonb, 'idle')
      ON CONFLICT DO NOTHING
      RETURNING *
    `);

    if (rows.rows.length === 0) {
      // 已存在，更新配置
      const updated = await db.execute(sql`
        UPDATE provider_sync_states
        SET account_ref = COALESCE(${config.accountRef ?? null}, account_ref),
            status = 'idle',
            error_message = null,
            updated_at = now()
        WHERE owner_id = ${ownerId} AND provider = 'omi'
        RETURNING *
      `);
      return this.mapSyncRow(updated.rows[0]);
    }

    logger.info({ ownerId }, 'Omi provider connected');
    return this.mapSyncRow(rows.rows[0]);
  }

  // ── 获取同步状态 ─────────────────────────────────────

  async getStatus(ownerId: string): Promise<SyncState | null> {
    const db = this.db;
    if (!db) return null;

    const rows = await db.execute(sql`
      SELECT * FROM provider_sync_states
      WHERE owner_id = ${ownerId} AND provider = 'omi'
      LIMIT 1
    `);

    return rows.rows[0] ? this.mapSyncRow(rows.rows[0]) : null;
  }

  // ── 断开连接 ─────────────────────────────────────────

  async disconnect(ownerId: string): Promise<boolean> {
    const db = this.db;
    if (!db) return false;

    const result = await db.execute(sql`
      UPDATE provider_sync_states
      SET status = 'disconnected', updated_at = now()
      WHERE owner_id = ${ownerId} AND provider = 'omi'
    `);

    logger.info({ ownerId }, 'Omi provider disconnected');
    return (result.rowCount ?? 0) > 0;
  }

  // ── 批量导入 ─────────────────────────────────────────

  async importPayload(ownerId: string, payload: OmiExportPayload): Promise<ImportResult> {
    const result: ImportResult = {
      memoriesImported: 0,
      memoriesSkipped: 0,
      conversationsImported: 0,
      conversationsSkipped: 0,
      candidatesCreated: 0,
      errors: [],
    };

    await this.setSyncStatus(ownerId, 'syncing');

    try {
      // 1. 导入 memories（每条 memory → Conversation + MemoryCandidate + TaskCandidates）
      for (const mem of (payload.memories ?? [])) {
        try {
          const imported = await this.importMemory(ownerId, mem);
          if (imported) {
            result.memoriesImported++;
            result.candidatesCreated += imported.candidatesCreated;
          } else {
            result.memoriesSkipped++;
          }
        } catch (err) {
          result.errors.push(`memory ${mem.id}: ${err.message}`);
          logger.error({ omiId: mem.id, err: err.message }, 'Memory import failed');
        }
      }

      // 2. 导入 conversations（每条 → Conversation + 段落 + TaskCandidates）
      for (const conv of (payload.conversations ?? [])) {
        try {
          const imported = await this.importConversation(ownerId, conv);
          if (imported) {
            result.conversationsImported++;
            result.candidatesCreated += imported.candidatesCreated;
          } else {
            result.conversationsSkipped++;
          }
        } catch (err) {
          result.errors.push(`conversation ${conv.id}: ${err.message}`);
          logger.error({ omiId: conv.id, err: err.message }, 'Conversation import failed');
        }
      }

      // 3. 更新 cursor 和最后同步时间
      const cursor = this.buildCursor(payload);
      await this.setSyncStatus(ownerId, 'idle', cursor);

      logger.info({ ownerId, ...result }, 'Omi import complete');
    } catch (err) {
      await this.setSyncStatus(ownerId, 'error', undefined, err.message);
      result.errors.push(`Fatal: ${err.message}`);
    }

    return result;
  }

  // ── 导入单条 Memory ──────────────────────────────────

  private async importMemory(ownerId: string, mem: OmiMemory): Promise<{ candidatesCreated: number } | null> {
    const externalId = `omi-mem-${mem.id}`;
    const rawHash = this.hash(JSON.stringify(mem));

    // 幂等检查
    if (await this.existsByExternalId(externalId)) {
      return null;
    }

    const title = mem.structured?.title ?? mem.content?.slice(0, 80) ?? 'Omi 记忆';
    const summary = mem.structured?.overview ?? mem.content;
    const startedAt = mem.created_at ? new Date(mem.created_at) : new Date();

    const db = this.db;
    if (!db) throw new Error('Database not available');

    const rawPayloadRef = JSON.stringify(mem);

    // 创建 Conversation 记录
    const rows = await db.execute(sql`
      INSERT INTO conversations (
        owner_id, source, external_source_id, mode, status,
        title, summary, hash, raw_payload_ref, started_at, imported_at
      ) VALUES (
        ${ownerId}, 'omi', ${externalId}, 'import', 'completed',
        ${title}, ${summary ?? null}, ${rawHash}, ${rawPayloadRef},
        ${startedAt.toISOString()}::timestamp, now()
      )
      RETURNING id
    `);

    const conversationId: string = (rows.rows[0] as any).id;

    // 把原始内容作为 import_note segment
    if (mem.content) {
      await conversationService.appendSegment({
        conversationId,
        sequence: 1,
        segmentType: 'import_note',
        text: mem.content,
        speaker: 'omi',
        speakerType: 'system',
        source: 'omi',
      });
    }

    let candidatesCreated = 0;

    // memory 候选（主内容）
    if (mem.content || mem.structured?.overview) {
      await conversationService.addCandidate({
        conversationId,
        candidateType: 'memory',
        content: {
          content: mem.structured?.overview ?? mem.content ?? '',
          tags: mem.structured?.category ? [mem.structured.category] : ['omi'],
          source: 'omi',
          remoteId: mem.id,
        },
        confidence: 0.7,
        riskLevel: 'low',
      });
      candidatesCreated++;
    }

    // action_items → task 候选
    for (const item of (mem.structured?.action_items ?? [])) {
      if (!item.description?.trim()) continue;
      await conversationService.addCandidate({
        conversationId,
        candidateType: 'task',
        content: {
          title: item.description,
          description: `来自 Omi 记忆：${title}`,
          source: 'omi',
          remoteId: mem.id,
          completed: item.completed ?? false,
        },
        confidence: 0.75,
        riskLevel: 'low',
      });
      candidatesCreated++;
    }

    // 若有候选项，状态变为 review_pending
    if (candidatesCreated > 0) {
      await conversationService.updateStatus(conversationId, 'review_pending');
    }

    return { candidatesCreated };
  }

  // ── 导入单条 Conversation ────────────────────────────

  private async importConversation(ownerId: string, conv: OmiConversation): Promise<{ candidatesCreated: number } | null> {
    const externalId = `omi-conv-${conv.id}`;
    const rawHash = this.hash(JSON.stringify(conv));

    // 幂等检查
    if (await this.existsByExternalId(externalId)) {
      return null;
    }

    const title = conv.title ?? conv.summary?.slice(0, 80) ?? 'Omi 对话';
    const startedAt = conv.started_at ? new Date(conv.started_at) : (conv.created_at ? new Date(conv.created_at) : new Date());

    const db = this.db;
    if (!db) throw new Error('Database not available');

    const rawPayloadRef = JSON.stringify(conv);

    const rows = await db.execute(sql`
      INSERT INTO conversations (
        owner_id, source, external_source_id, mode, status,
        title, summary, hash, raw_payload_ref, started_at, imported_at
      ) VALUES (
        ${ownerId}, 'omi', ${externalId}, 'import', 'completed',
        ${title}, ${conv.summary ?? null}, ${rawHash}, ${rawPayloadRef},
        ${startedAt.toISOString()}::timestamp, now()
      )
      RETURNING id
    `);

    const conversationId: string = (rows.rows[0] as any).id;

    // 写入 transcript segments
    let seq = 1;
    for (const seg of (conv.transcript ?? [])) {
      if (!seg.text?.trim()) continue;
      await conversationService.appendSegment({
        conversationId,
        sequence: seq++,
        segmentType: 'transcript',
        text: seg.text,
        speaker: seg.speaker,
        speakerType: 'user',
        startMs: seg.start != null ? Math.round(seg.start * 1000) : undefined,
        endMs: seg.end != null ? Math.round(seg.end * 1000) : undefined,
        source: 'omi',
      });
    }

    let candidatesCreated = 0;

    // action_items → task 候选
    for (const item of (conv.action_items ?? [])) {
      if (!item.description?.trim()) continue;
      await conversationService.addCandidate({
        conversationId,
        candidateType: 'task',
        content: {
          title: item.description,
          description: `来自 Omi 对话：${title}`,
          source: 'omi',
          remoteId: conv.id,
          completed: item.completed ?? false,
        },
        confidence: 0.75,
        riskLevel: 'low',
      });
      candidatesCreated++;
    }

    if (candidatesCreated > 0) {
      await conversationService.updateStatus(conversationId, 'review_pending');
    }

    return { candidatesCreated };
  }

  // ── 工具 ─────────────────────────────────────────────

  private async existsByExternalId(externalId: string): Promise<boolean> {
    const db = this.db;
    if (!db) return false;

    const rows = await db.execute(sql`
      SELECT id FROM conversations
      WHERE external_source_id = ${externalId} AND source = 'omi'
      LIMIT 1
    `);
    return rows.rows.length > 0;
  }

  private async setSyncStatus(
    ownerId: string,
    status: string,
    cursor?: string,
    errorMessage?: string
  ): Promise<void> {
    const db = this.db;
    if (!db) return;

    await db.execute(sql`
      INSERT INTO provider_sync_states (owner_id, provider, status, cursor, error_message, last_synced_at)
      VALUES (${ownerId}, 'omi', ${status}, ${cursor ?? null}, ${errorMessage ?? null},
        CASE WHEN ${status} = 'idle' THEN now() ELSE NULL END)
      ON CONFLICT DO NOTHING
    `);

    await db.execute(sql`
      UPDATE provider_sync_states
      SET status = ${status},
          cursor = COALESCE(${cursor ?? null}, cursor),
          error_message = ${errorMessage ?? null},
          last_synced_at = CASE WHEN ${status} = 'idle' THEN now() ELSE last_synced_at END,
          updated_at = now()
      WHERE owner_id = ${ownerId} AND provider = 'omi'
    `);
  }

  private buildCursor(payload: OmiExportPayload): string {
    // cursor = 最大 created_at ISO 字符串，用于下次增量同步
    const dates: string[] = [
      ...(payload.memories ?? []).map(m => m.created_at ?? ''),
      ...(payload.conversations ?? []).map(c => c.created_at ?? c.started_at ?? ''),
    ].filter(Boolean);

    if (dates.length === 0) return new Date().toISOString();
    return dates.sort().at(-1)!;
  }

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  private mapSyncRow(r: Record<string, unknown>): SyncState {
    return {
      id: r.id,
      ownerId: r.owner_id,
      provider: r.provider,
      accountRef: r.account_ref,
      cursor: r.cursor,
      lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at) : null,
      status: r.status,
      errorMessage: r.error_message,
      config: r.config ?? {},
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }
}

export const omiProvider = new OmiProvider();

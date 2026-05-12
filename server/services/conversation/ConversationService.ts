import { getDatabase } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';

export interface ConversationRecord {
  id: string;
  ownerId: string;
  source: string;
  sourceDeviceId?: string | null;
  externalSourceId?: string | null;
  mode?: string | null;
  status: string;
  language?: string | null;
  title?: string | null;
  summary?: string | null;
  keyPoints: unknown[];
  rawPayloadRef?: string | null;
  hash?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  importedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationInboxRecord extends ConversationRecord {
  pendingCount: number;
  candidateCounts: Record<string, number>;
  lastActivityAt: Date;
}

export interface ConversationSegmentRecord {
  id: string;
  conversationId: string;
  sequence: number;
  segmentType: string;
  text?: string | null;
  speaker?: string | null;
  speakerType?: string | null;
  source: string;
  createdAt: Date;
}

export interface ConversationCandidateRecord {
  id: string;
  conversationId: string;
  candidateType: string;
  status: string;
  content: Record<string, unknown>;
  confidence?: string | null;
  riskLevel?: string | null;
  linkedEntityId?: string | null;
  linkedEntityType?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  ownerId: string;
  source: string;
  sourceDeviceId?: string;
  externalSourceId?: string;
  mode?: string;
  language?: string;
  title?: string;
}

export interface AppendSegmentInput {
  conversationId: string;
  sequence: number;
  segmentType: string;
  text?: string;
  speaker?: string;
  speakerType?: string;
  personId?: string;
  startMs?: number;
  endMs?: number;
  confidence?: number;
  source: string;
}

export interface AddCandidateInput {
  conversationId: string;
  candidateType: string;
  content: Record<string, unknown>;
  confidence?: number;
  riskLevel?: string;
}

export interface InboxQuery {
  ownerId: string;
  status?: string;
  limit?: number;
  offset?: number;
}

class ConversationService {
  private get db() {
    return getDatabase();
  }

  async create(input: CreateConversationInput): Promise<ConversationRecord> {
    const db = this.db;
    if (!db) throw new Error('Database not available');

    const rows = await db.execute(sql`
      INSERT INTO conversations (owner_id, source, source_device_id, external_source_id, mode, language, title)
      VALUES (
        ${input.ownerId},
        ${input.source},
        ${input.sourceDeviceId ?? null},
        ${input.externalSourceId ?? null},
        ${input.mode ?? null},
        ${input.language ?? null},
        ${input.title ?? null}
      )
      RETURNING *
    `);

    return this.mapRow(rows.rows[0]);
  }

  async get(id: string, ownerId: string): Promise<ConversationRecord | null> {
    const db = this.db;
    if (!db) return null;

    const rows = await db.execute(sql`
      SELECT * FROM conversations WHERE id = ${id} AND owner_id = ${ownerId} LIMIT 1
    `);

    return rows.rows[0] ? this.mapRow(rows.rows[0]) : null;
  }

  async list(ownerId: string, limit = 20, offset = 0): Promise<ConversationRecord[]> {
    const db = this.db;
    if (!db) return [];

    const rows = await db.execute(sql`
      SELECT * FROM conversations
      WHERE owner_id = ${ownerId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return rows.rows.map(r => this.mapRow(r));
  }

  async updateStatus(id: string, status: string, extra?: { summary?: string; title?: string; endedAt?: Date }): Promise<void> {
    const db = this.db;
    if (!db) return;

    await db.execute(sql`
      UPDATE conversations
      SET status = ${status},
          summary = COALESCE(${extra?.summary ?? null}, summary),
          title = COALESCE(${extra?.title ?? null}, title),
          ended_at = COALESCE(${extra?.endedAt?.toISOString() ?? null}::timestamp, ended_at),
          updated_at = now()
      WHERE id = ${id}
    `);
  }

  async finish(id: string, ownerId: string): Promise<ConversationRecord | null> {
    const db = this.db;
    if (!db) return null;

    await db.execute(sql`
      UPDATE conversations
      SET status = 'processing', ended_at = now(), updated_at = now()
      WHERE id = ${id} AND owner_id = ${ownerId}
    `);

    return this.get(id, ownerId);
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    const db = this.db;
    if (!db) return false;

    // Mark candidates as orphaned rather than hard-deleting
    await db.execute(sql`
      UPDATE conversation_candidates
      SET status = 'rejected', updated_at = now()
      WHERE conversation_id = ${id} AND status = 'pending'
    `);

    const result = await db.execute(sql`
      UPDATE conversations SET status = 'discarded', updated_at = now()
      WHERE id = ${id} AND owner_id = ${ownerId}
    `);

    return (result.rowCount ?? 0) > 0;
  }

  async appendSegment(input: AppendSegmentInput): Promise<ConversationSegmentRecord> {
    const db = this.db;
    if (!db) throw new Error('Database not available');

    const rows = await db.execute(sql`
      INSERT INTO conv_segments (
        conversation_id, sequence, segment_type, text, speaker, speaker_type,
        person_id, start_ms, end_ms, confidence, source
      )
      VALUES (
        ${input.conversationId},
        ${input.sequence},
        ${input.segmentType},
        ${input.text ?? null},
        ${input.speaker ?? null},
        ${input.speakerType ?? null},
        ${input.personId ?? null},
        ${input.startMs ?? null},
        ${input.endMs ?? null},
        ${input.confidence ?? null},
        ${input.source}
      )
      RETURNING *
    `);

    return this.mapSegmentRow(rows.rows[0]);
  }

  async getSegments(conversationId: string): Promise<ConversationSegmentRecord[]> {
    const db = this.db;
    if (!db) return [];

    const rows = await db.execute(sql`
      SELECT * FROM conv_segments
      WHERE conversation_id = ${conversationId}
      ORDER BY sequence ASC
    `);

    return rows.rows.map(r => this.mapSegmentRow(r));
  }

  async addCandidate(input: AddCandidateInput): Promise<ConversationCandidateRecord> {
    const db = this.db;
    if (!db) throw new Error('Database not available');

    const rows = await db.execute(sql`
      INSERT INTO conversation_candidates (conversation_id, candidate_type, content, confidence, risk_level)
      VALUES (
        ${input.conversationId},
        ${input.candidateType},
        ${JSON.stringify(input.content)}::jsonb,
        ${input.confidence ?? null},
        ${input.riskLevel ?? 'low'}
      )
      RETURNING *
    `);

    return this.mapCandidateRow(rows.rows[0]);
  }

  async getCandidates(conversationId: string): Promise<ConversationCandidateRecord[]> {
    const db = this.db;
    if (!db) return [];

    const rows = await db.execute(sql`
      SELECT * FROM conversation_candidates
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `);

    return rows.rows.map(r => this.mapCandidateRow(r));
  }

  async reviewCandidate(
    id: string,
    action: 'accept' | 'reject' | 'edit',
    reviewedBy: string,
    editedContent?: Record<string, unknown>
  ): Promise<ConversationCandidateRecord | null> {
    const db = this.db;
    if (!db) return null;

    const newStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'edited';
    const contentUpdate = editedContent ? JSON.stringify(editedContent) : null;

    const rows = await db.execute(sql`
      UPDATE conversation_candidates
      SET status = ${newStatus},
          reviewed_by = ${reviewedBy},
          reviewed_at = now(),
          content = CASE WHEN ${contentUpdate} IS NOT NULL THEN ${contentUpdate}::jsonb ELSE content END,
          updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `);

    return rows.rows[0] ? this.mapCandidateRow(rows.rows[0]) : null;
  }

  async markCandidateApplied(id: string, linkedEntityId: string, linkedEntityType: string): Promise<void> {
    const db = this.db;
    if (!db) return;

    await db.execute(sql`
      UPDATE conversation_candidates
      SET status = 'applied',
          linked_entity_id = ${linkedEntityId},
          linked_entity_type = ${linkedEntityType},
          updated_at = now()
      WHERE id = ${id}
    `);
  }

  async getInbox(query: InboxQuery): Promise<{ conversations: ConversationInboxRecord[]; total: number }> {
    const db = this.db;
    if (!db) return { conversations: [], total: 0 };

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const rows = await db.execute(sql`
      WITH candidate_summary AS (
        SELECT
          conversation_id,
          COUNT(*) AS candidate_count,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
          COUNT(*) FILTER (WHERE status = 'pending' AND candidate_type = 'task') AS task_pending_count,
          COUNT(*) FILTER (WHERE status = 'pending' AND candidate_type = 'memory') AS memory_pending_count,
          COUNT(*) FILTER (WHERE status = 'pending' AND candidate_type = 'event') AS event_pending_count
        FROM conversation_candidates
        GROUP BY conversation_id
      )
      SELECT
        c.*,
        COUNT(*) OVER() AS total_count,
        COALESCE(cs.candidate_count, 0) AS candidate_count,
        COALESCE(cs.pending_count, 0) AS pending_count,
        COALESCE(cs.task_pending_count, 0) AS task_pending_count,
        COALESCE(cs.memory_pending_count, 0) AS memory_pending_count,
        COALESCE(cs.event_pending_count, 0) AS event_pending_count,
        GREATEST(
          c.updated_at,
          COALESCE(c.ended_at, c.updated_at),
          COALESCE(c.imported_at, c.updated_at)
        ) AS last_activity_at
      FROM conversations c
      LEFT JOIN candidate_summary cs ON cs.conversation_id = c.id
      WHERE c.owner_id = ${query.ownerId}
        AND c.status <> 'discarded'
      ORDER BY last_activity_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = rows.rows[0] ? Number((rows.rows[0] as Record<string, unknown>).total_count) : 0;
    return { conversations: rows.rows.map(r => this.mapInboxRow(r)), total };
  }

  async getInboxCounts(ownerId: string): Promise<Record<string, number>> {
    const db = this.db;
    if (!db) return {};

    const rows = await db.execute(sql`
      SELECT candidate_type, COUNT(*) as cnt
      FROM conversation_candidates cc
      JOIN conversations c ON c.id = cc.conversation_id
      WHERE c.owner_id = ${ownerId} AND cc.status = 'pending'
      GROUP BY candidate_type
    `);

    const counts: Record<string, number> = { total: 0 };
    for (const row of rows.rows) {
      const r = row as Record<string, unknown>;
      counts[r.candidate_type as string] = Number(r.cnt);
      counts.total += Number(r.cnt);
    }
    return counts;
  }

  private mapRow(r: Record<string, unknown>): ConversationRecord {
    return {
      id: r.id,
      ownerId: r.owner_id,
      source: r.source,
      sourceDeviceId: r.source_device_id,
      externalSourceId: r.external_source_id,
      mode: r.mode,
      status: r.status,
      language: r.language,
      title: r.title,
      summary: r.summary,
      keyPoints: r.key_points ?? [],
      rawPayloadRef: r.raw_payload_ref,
      hash: r.hash,
      startedAt: new Date(r.started_at),
      endedAt: r.ended_at ? new Date(r.ended_at) : null,
      importedAt: r.imported_at ? new Date(r.imported_at) : null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  private mapInboxRow(r: Record<string, unknown>): ConversationInboxRecord {
    return {
      ...this.mapRow(r),
      pendingCount: Number(r.pending_count ?? 0),
      candidateCounts: {
        total: Number(r.candidate_count ?? 0),
        task: Number(r.task_pending_count ?? 0),
        memory: Number(r.memory_pending_count ?? 0),
        event: Number(r.event_pending_count ?? 0),
      },
      lastActivityAt: new Date((r.last_activity_at ?? r.updated_at) as string | number | Date),
    };
  }

  private mapSegmentRow(r: Record<string, unknown>): ConversationSegmentRecord {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      sequence: r.sequence,
      segmentType: r.segment_type,
      text: r.text,
      speaker: r.speaker,
      speakerType: r.speaker_type,
      source: r.source,
      createdAt: new Date(r.created_at),
    };
  }

  private mapCandidateRow(r: Record<string, unknown>): ConversationCandidateRecord {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      candidateType: r.candidate_type,
      status: r.status,
      content: r.content ?? {},
      confidence: r.confidence,
      riskLevel: r.risk_level,
      linkedEntityId: r.linked_entity_id,
      linkedEntityType: r.linked_entity_type,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : null,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }
}

export const conversationService = new ConversationService();

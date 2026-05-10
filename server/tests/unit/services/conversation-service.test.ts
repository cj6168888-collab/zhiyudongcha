import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database so tests run without a real PG connection
vi.mock('../../../db', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../../../db';
import { conversationService } from '../../../services/conversation/ConversationService';

function makeDb(rows: any[] = [], rowCount = 1) {
  return { execute: vi.fn().mockResolvedValue({ rows, rowCount }) };
}

const OWNER = 'user-001';
const CONV_ROW = {
  id: 'conv-001',
  owner_id: OWNER,
  source: 'mobile',
  source_device_id: null,
  external_source_id: null,
  mode: 'casual_chat',
  status: 'in_progress',
  language: null,
  title: null,
  summary: null,
  key_points: [],
  raw_payload_ref: null,
  hash: null,
  started_at: new Date().toISOString(),
  ended_at: null,
  imported_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConversationService.create', () => {
  it('returns mapped conversation on success', async () => {
    const db = makeDb([CONV_ROW]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.create({ ownerId: OWNER, source: 'mobile' });

    expect(result.id).toBe('conv-001');
    expect(result.ownerId).toBe(OWNER);
    expect(result.source).toBe('mobile');
    expect(result.status).toBe('in_progress');
  });

  it('throws when database is unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);

    await expect(conversationService.create({ ownerId: OWNER, source: 'mobile' })).rejects.toThrow('Database not available');
  });
});

describe('ConversationService.get', () => {
  it('returns null when no rows', async () => {
    const db = makeDb([]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.get('missing-id', OWNER);
    expect(result).toBeNull();
  });

  it('returns mapped conversation when found', async () => {
    const db = makeDb([CONV_ROW]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.get('conv-001', OWNER);
    expect(result?.id).toBe('conv-001');
  });
});

describe('ConversationService.list', () => {
  it('returns empty array when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await conversationService.list(OWNER);
    expect(result).toEqual([]);
  });

  it('returns mapped list', async () => {
    const db = makeDb([CONV_ROW, { ...CONV_ROW, id: 'conv-002' }]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.list(OWNER, 10, 0);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('conv-001');
  });
});

describe('ConversationService.delete', () => {
  it('returns false when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await conversationService.delete('conv-001', OWNER);
    expect(result).toBe(false);
  });

  it('returns true on successful soft-delete', async () => {
    const db = { execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.delete('conv-001', OWNER);
    expect(result).toBe(true);
    // Two calls: one to update candidates, one to update conversation
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});

describe('ConversationService.addCandidate', () => {
  it('throws when database unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);

    await expect(conversationService.addCandidate({
      conversationId: 'conv-001',
      candidateType: 'task',
      content: { title: 'Test task' },
    })).rejects.toThrow('Database not available');
  });

  it('maps candidate row correctly', async () => {
    const candidateRow = {
      id: 'cand-001',
      conversation_id: 'conv-001',
      candidate_type: 'task',
      status: 'pending',
      content: { title: 'Test task' },
      confidence: '0.8',
      risk_level: 'low',
      linked_entity_id: null,
      linked_entity_type: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const db = makeDb([candidateRow]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.addCandidate({
      conversationId: 'conv-001',
      candidateType: 'task',
      content: { title: 'Test task' },
      confidence: 0.8,
    });

    expect(result.id).toBe('cand-001');
    expect(result.candidateType).toBe('task');
    expect(result.status).toBe('pending');
  });
});

describe('ConversationService.reviewCandidate', () => {
  it('returns null when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await conversationService.reviewCandidate('cand-001', 'reject', OWNER);
    expect(result).toBeNull();
  });

  it('sets status to rejected on reject', async () => {
    const candidateRow = {
      id: 'cand-001',
      conversation_id: 'conv-001',
      candidate_type: 'task',
      status: 'rejected',
      content: {},
      confidence: null,
      risk_level: null,
      linked_entity_id: null,
      linked_entity_type: null,
      reviewed_by: OWNER,
      reviewed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const db = makeDb([candidateRow]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.reviewCandidate('cand-001', 'reject', OWNER);
    expect(result?.status).toBe('rejected');
    expect(result?.reviewedBy).toBe(OWNER);
  });
});

describe('ConversationService.getInboxCounts', () => {
  it('returns empty object when db unavailable', async () => {
    vi.mocked(getDatabase).mockReturnValue(null as any);
    const result = await conversationService.getInboxCounts(OWNER);
    expect(result).toEqual({});
  });

  it('aggregates counts by type', async () => {
    const db = makeDb([
      { candidate_type: 'task', cnt: '3' },
      { candidate_type: 'memory', cnt: '1' },
    ]);
    vi.mocked(getDatabase).mockReturnValue(db as any);

    const result = await conversationService.getInboxCounts(OWNER);
    expect(result.task).toBe(3);
    expect(result.memory).toBe(1);
    expect(result.total).toBe(4);
  });
});

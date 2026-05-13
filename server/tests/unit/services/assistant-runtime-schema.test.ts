import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../db', () => ({
  getDatabase: vi.fn(),
  isDatabaseAvailable: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  createServiceLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getDatabase, isDatabaseAvailable } from '../../../db';
import { ensureAssistantRuntimeSchema } from '../../../services/assistant-runtime-schema';

const execute = vi.fn();

function sqlText(value: unknown): string {
  const chunks = (value as { queryChunks?: Array<{ value?: string[] }> }).queryChunks || [];
  return chunks.flatMap(chunk => chunk.value || []).join('');
}

describe('ensureAssistantRuntimeSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockReset();
  });

  it('skips when database is unavailable', async () => {
    vi.mocked(isDatabaseAvailable).mockReturnValue(false);

    await ensureAssistantRuntimeSchema();

    expect(getDatabase).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('skips when database handle is unavailable', async () => {
    vi.mocked(isDatabaseAvailable).mockReturnValue(true);
    vi.mocked(getDatabase).mockReturnValue(null);

    await ensureAssistantRuntimeSchema();

    expect(getDatabase).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });

  it('ensures runtime tables and indexes in order', async () => {
    vi.mocked(isDatabaseAvailable).mockReturnValue(true);
    vi.mocked(getDatabase).mockReturnValue({ execute } as unknown as ReturnType<typeof getDatabase>);

    await ensureAssistantRuntimeSchema();

    expect(execute).toHaveBeenCalledTimes(4);
    const statements = execute.mock.calls.map(call => sqlText(call[0]));
    expect(statements[0]).toContain('CREATE TABLE IF NOT EXISTS "swarm_tasks"');
    expect(statements[1]).toContain('CREATE TABLE IF NOT EXISTS "pending_actions"');
    expect(statements[2]).toContain('CREATE INDEX IF NOT EXISTS "idx_pending_actions_user_id"');
    expect(statements[3]).toContain('CREATE INDEX IF NOT EXISTS "idx_pending_actions_expires_at"');
  });
});

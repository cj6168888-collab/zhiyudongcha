import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  available: true,
  db: null as unknown,
}));

vi.mock('../../../db', () => ({
  getDatabase: () => dbMock.db,
  isDatabaseAvailable: () => dbMock.available,
}));

import {
  hasGrant,
  loadAuthzContext,
  sessionPrincipalId,
  userPrincipalId,
} from '../../../services/authz/effective-grants';

function createRequest(overrides: Partial<Request> & Record<string, unknown> = {}) {
  return {
    headers: {},
    userRole: 'GUEST',
    ...overrides,
  } as unknown as Request;
}

function createDbWithRows(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where };
}

function createDbWithError(error: Error) {
  const where = vi.fn().mockRejectedValue(error);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where };
}

describe('effective grants', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    dbMock.available = true;
    dbMock.db = null;
    delete process.env.AUTHZ_STRICT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses sessionID before x-session-id when resolving session principal', () => {
    const req = createRequest({
      sessionID: 'cookie-session',
      headers: { 'x-session-id': 'header-session' },
    });

    expect(sessionPrincipalId(req)).toBe('cookie-session');
  });

  it('falls back to x-session-id when express sessionID is absent', () => {
    const req = createRequest({
      headers: { 'x-session-id': 'header-session' },
    });

    expect(sessionPrincipalId(req)).toBe('header-session');
  });

  it('resolves user principal from session userId only when it is a string', () => {
    expect(userPrincipalId(createRequest({ session: { userId: 'user-1' } }))).toBe('user-1');
    expect(userPrincipalId(createRequest({ session: { userId: 123 } }))).toBeNull();
  });

  it('returns legacy master grants when no principal is available', async () => {
    const req = createRequest({ userRole: 'MASTER' });

    const context = await loadAuthzContext(req);

    expect(context.source).toBe('legacy_fallback');
    expect(hasGrant(context.grants, 'FLEET', 'ADMIN')).toBe(true);
    expect(hasGrant(context.grants, 'CHAT', 'WRITE')).toBe(true);
  });

  it('returns legacy guest grants when database is unavailable', async () => {
    dbMock.available = false;
    dbMock.db = createDbWithRows([]);
    const req = createRequest({ headers: { 'x-session-id': 'session-1' }, userRole: 'GUEST' });

    const context = await loadAuthzContext(req);

    expect(context.source).toBe('legacy_fallback');
    expect(hasGrant(context.grants, 'CHAT', 'READ')).toBe(true);
    expect(hasGrant(context.grants, 'FLEET', 'ADMIN')).toBe(false);
  });

  it('merges and deduplicates database grants from available principals', async () => {
    const rows = [
      { resource: 'CHAT', action: 'WRITE', scope: 'OWN' },
      { resource: 'CHAT', action: 'WRITE', scope: 'OWN' },
      { resource: 'TASKS', action: 'EXECUTE', scope: 'ALL' },
    ];
    dbMock.db = createDbWithRows(rows);
    const req = createRequest({
      headers: { 'x-session-id': 'session-1' },
      session: { userId: 'user-1' },
    });

    const context = await loadAuthzContext(req);

    expect(context.source).toBe('db');
    expect(context.grants).toEqual([
      { resource: 'CHAT', action: 'WRITE', scope: 'OWN', source: 'db' },
      { resource: 'TASKS', action: 'EXECUTE', scope: 'ALL', source: 'db' },
    ]);
  });

  it('falls back to legacy grants when lookup fails outside strict mode', async () => {
    dbMock.db = createDbWithError(new Error('missing table'));
    const req = createRequest({ headers: { 'x-session-id': 'session-1' }, userRole: 'MASTER' });

    const context = await loadAuthzContext(req);

    expect(context.source).toBe('legacy_fallback');
    expect(hasGrant(context.grants, 'TASKS', 'EXECUTE')).toBe(true);
  });

  it('throws lookup errors in strict mode', async () => {
    const error = new Error('strict authz failure');
    dbMock.db = createDbWithError(error);
    process.env.AUTHZ_STRICT = 'true';
    const req = createRequest({ headers: { 'x-session-id': 'session-1' } });

    await expect(loadAuthzContext(req)).rejects.toThrow(error);
  });
});

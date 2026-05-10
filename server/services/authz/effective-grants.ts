/**
 * 有效授权：DB authz_grants + 过渡期 legacy_fallback（见 docs/adr/0001-authorization-model.md）
 * SESSION 与 USER 主体合并：任一侧有库内行则合并为 source=db；均无则 legacy。
 */

import { and, eq, or } from 'drizzle-orm';
import type { Request } from 'express';
import { authzGrants } from '@shared/schema';
import { getDatabase, isDatabaseAvailable } from '../../db';
import type { UserRole } from '../../middleware/auth';

export type GrantSource = 'db' | 'legacy_fallback';

export interface EffectiveGrantRow {
  resource: string;
  action: string;
  scope: string;
  source: GrantSource;
}

export interface AuthzContext {
  grants: EffectiveGrantRow[];
  source: GrantSource;
}

const LEGACY_MASTER: EffectiveGrantRow[] = [
  { resource: 'CHAT', action: 'WRITE', scope: 'ALL', source: 'legacy_fallback' },
  { resource: 'KNOWLEDGE', action: 'WRITE', scope: 'ALL', source: 'legacy_fallback' },
  { resource: 'VAULT', action: 'WRITE', scope: 'OWN', source: 'legacy_fallback' },
  { resource: 'INSIGHT', action: 'WRITE', scope: 'OWN', source: 'legacy_fallback' },
  { resource: 'FLEET', action: 'ADMIN', scope: 'ALL', source: 'legacy_fallback' },
  { resource: 'TASKS', action: 'EXECUTE', scope: 'ALL', source: 'legacy_fallback' },
];

const LEGACY_GUEST: EffectiveGrantRow[] = [
  { resource: 'CHAT', action: 'READ', scope: 'OWN', source: 'legacy_fallback' },
  { resource: 'VAULT', action: 'READ', scope: 'OWN', source: 'legacy_fallback' },
  { resource: 'VAULT', action: 'WRITE', scope: 'OWN', source: 'legacy_fallback' },
  { resource: 'VAULT', action: 'DELETE', scope: 'OWN', source: 'legacy_fallback' },
  { resource: 'KNOWLEDGE', action: 'READ', scope: 'OWN', source: 'legacy_fallback' },
];

/** 与 session cookie、或客户端 `x-session-id` 对齐；无稳定 id 时返回 null（仅用 legacy，不查库） */
export function sessionPrincipalId(req: Request): string | null {
  if (req.sessionID) {
    return req.sessionID;
  }
  const header = req.headers['x-session-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  const sid = (req as { session?: { id?: string } }).session?.id;
  return sid || null;
}

/** 业务用户 id（需在 session 中绑定，例如登录后写入） */
export function userPrincipalId(req: Request): string | null {
  const uid = req.session?.userId;
  if (typeof uid === 'string' && uid.length > 0) {
    return uid;
  }
  return null;
}

function rowToGrant(r: typeof authzGrants.$inferSelect): EffectiveGrantRow {
  return {
    resource: r.resource,
    action: r.action,
    scope: r.scope,
    source: 'db',
  };
}

function dedupeGrants(rows: EffectiveGrantRow[]): EffectiveGrantRow[] {
  const seen = new Set<string>();
  const out: EffectiveGrantRow[] = [];
  for (const g of rows) {
    const k = `${g.resource}|${g.action}|${g.scope}`;
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(g);
  }
  return out;
}

export async function loadAuthzContext(req: Request): Promise<AuthzContext> {
  const sid = sessionPrincipalId(req);
  const uid = userPrincipalId(req);

  if (!sid && !uid) {
    return applyLegacy(req.userRole);
  }

  if (!isDatabaseAvailable() || !getDatabase()) {
    return applyLegacy(req.userRole);
  }

  const db = getDatabase()!;

  const parts = [];
  if (sid) {
    parts.push(and(eq(authzGrants.principalKind, 'SESSION'), eq(authzGrants.principalId, sid)));
  }
  if (uid) {
    parts.push(and(eq(authzGrants.principalKind, 'USER'), eq(authzGrants.principalId, uid)));
  }

  let rows: Array<typeof authzGrants.$inferSelect>;
  try {
    rows = await db.select().from(authzGrants).where(parts.length === 1 ? parts[0]! : or(...parts));
  } catch (error) {
    if (process.env['AUTHZ_STRICT'] === 'true') {
      throw error;
    }
    console.warn('Authz grant lookup failed; falling back to legacy grants:', error);
    return applyLegacy(req.userRole);
  }

  if (rows.length === 0) {
    return applyLegacy(req.userRole);
  }

  const grants = dedupeGrants(rows.map(rowToGrant));
  return { grants, source: 'db' };
}

function applyLegacy(role: UserRole | undefined): AuthzContext {
  if (role === 'MASTER') {
    return { grants: LEGACY_MASTER, source: 'legacy_fallback' };
  }
  return { grants: LEGACY_GUEST, source: 'legacy_fallback' };
}

export function hasGrant(
  grants: EffectiveGrantRow[],
  resource: string,
  action: string
): boolean {
  return grants.some((g) => g.resource === resource && g.action === action);
}

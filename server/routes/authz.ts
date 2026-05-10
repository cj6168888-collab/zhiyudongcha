import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { authzGrants } from '@shared/schema';
import { getDatabase, isDatabaseAvailable } from '../db';
import { requireMaster } from '../middleware/auth';
import { userPrincipalId } from '../services/authz/effective-grants';

const createGrantBody = z
  .object({
    principalKind: z.enum(['SESSION', 'USER']),
    principalId: z.string().min(1),
    workspaceId: z.string().optional().default(''),
    resource: z.string().min(1),
    action: z.string().min(1),
    scope: z.string().min(1),
    source: z.enum(['ADMIN', 'PRESET', 'SYSTEM']).optional().default('ADMIN'),
  })
  .strict();

function dbUnavailable(res: Response) {
  return res.status(503).json({ error: '数据库不可用', code: 'DATABASE_UNAVAILABLE' });
}

export function registerAuthzRoutes(app: Express): void {
  app.get('/api/authz/effective', (req: Request, res: Response) => {
    if (!req.authz) {
      return res.status(500).json({ error: '授权上下文未初始化', code: 'AUTHZ_NOT_LOADED' });
    }
    return res.json({
      sessionId: req.sessionID,
      sessionUserId: userPrincipalId(req),
      userRole: req.userRole,
      source: req.authz.source,
      grantCount: req.authz.grants.length,
      grants: req.authz.grants,
    });
  });

  /**
   * 管理员：列出授权行（需 MASTER）
   */
  app.get('/api/authz/grants', requireMaster, async (req: Request, res: Response) => {
    if (!isDatabaseAvailable() || !getDatabase()) {
      return dbUnavailable(res);
    }
    const db = getDatabase()!;
    const kind = req.query.principalKind as string | undefined;
    const pid = req.query.principalId as string | undefined;
    const ws = req.query.workspaceId as string | undefined;

    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 500);

    const conds = [];
    if (kind) {
      conds.push(eq(authzGrants.principalKind, kind));
    }
    if (pid) {
      conds.push(eq(authzGrants.principalId, pid));
    }
    if (ws !== undefined) {
      conds.push(eq(authzGrants.workspaceId, ws));
    }

    const rows =
      conds.length > 0
        ? await db.select().from(authzGrants).where(and(...conds)).limit(limit)
        : await db.select().from(authzGrants).limit(limit);
    return res.json({ count: rows.length, grants: rows });
  });

  /**
   * 管理员：新增一条授权（唯一键冲突时返回 409，请先删后插或换键）
   */
  app.post('/api/authz/grants', requireMaster, async (req: Request, res: Response) => {
    const parsed = createGrantBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: '请求体无效',
        code: 'INVALID_BODY',
        details: parsed.error.flatten(),
      });
    }
    if (!isDatabaseAvailable() || !getDatabase()) {
      return dbUnavailable(res);
    }
    const db = getDatabase()!;
    const v = parsed.data;

    try {
      const [row] = await db
        .insert(authzGrants)
        .values({
          principalKind: v.principalKind,
          principalId: v.principalId,
          workspaceId: v.workspaceId,
          resource: v.resource,
          action: v.action,
          scope: v.scope,
          source: v.source,
        })
        .returning();

      return res.status(201).json(row);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === '23505') {
        return res.status(409).json({
          error: '已存在相同授权键，请删除原行后重试或使用 PUT 覆盖（后续迭代）',
          code: 'DUPLICATE',
        });
      }
      throw e;
    }
  });

  /**
   * 管理员：按 id 删除
   */
  app.delete('/api/authz/grants/:id', requireMaster, async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: '缺少 id', code: 'INVALID_ID' });
    }
    if (!isDatabaseAvailable() || !getDatabase()) {
      return dbUnavailable(res);
    }
    const db = getDatabase()!;
    const deleted = await db.delete(authzGrants).where(eq(authzGrants.id, id)).returning({ id: authzGrants.id });
    if (deleted.length === 0) {
      return res.status(404).json({ error: '未找到', code: 'NOT_FOUND' });
    }
    return res.status(204).send();
  });

  /**
   * 管理员：将会话绑定到业务用户 id，以便合并 USER 主体授权（后续登录流可自动写入）
   */
  app.post('/api/authz/session/bind-user', requireMaster, (req: Request, res: Response) => {
    const body = z.object({ userId: z.string().min(1).max(128) }).strict().safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: '需要 userId', code: 'INVALID_BODY', details: body.error.flatten() });
    }
    if (!req.session) {
      return res.status(500).json({ error: '无 session', code: 'NO_SESSION' });
    }
    req.session.userId = body.data.userId;
    return res.json({ success: true, userId: body.data.userId, message: '已绑定 userId，后续请求将合并 USER 授权' });
  });

  app.delete('/api/authz/session/bind-user', requireMaster, (req: Request, res: Response) => {
    if (req.session) {
      delete req.session.userId;
    }
    return res.json({ success: true, message: '已解除 userId 绑定' });
  });
}

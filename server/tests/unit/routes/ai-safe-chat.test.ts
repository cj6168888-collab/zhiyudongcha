import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditMock = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const aiProviderMock = vi.hoisted(() => ({
  complete: vi.fn(),
}));

vi.mock('../../../storage', () => ({
  storage: auditMock,
}));

vi.mock('../../../lib/ai-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/ai-provider')>();
  return {
    ...actual,
    aiProvider: aiProviderMock,
  };
});

import { attachRole } from '../../../middleware/auth';
import aiRouter from '../../../routes/ai';

const masterHeaders = {
  'x-avatar-role': 'MASTER',
  'x-avatar-secret': 'unit-test-master-secret',
};

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(attachRole);
  app.use('/api/ai', aiRouter);
  return app;
}

describe('AI safe chat route', () => {
  let app: Express;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AVATAR_MASTER_SECRET = 'unit-test-master-secret';
    auditMock.createAuditLog.mockClear();
    aiProviderMock.complete.mockReset();
    aiProviderMock.complete.mockResolvedValue({
      content: '已生成脱敏草稿',
      provider: 'dashscope',
      model: 'qwen-plus',
      latencyMs: 8,
    });
    app = createApp();
  });

  it('requires master authorization', async () => {
    const response = await request(app)
      .post('/api/ai/safe-chat')
      .send({ message: '明天整理待办' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns provider metadata for ordinary safe chat', async () => {
    const response = await request(app)
      .post('/api/ai/safe-chat')
      .set(masterHeaders)
      .send({ message: '明天整理普通待办', systemPrompt: '你是私人助理' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      response: '已生成脱敏草稿',
      cloudUsed: true,
      decision: 'ALLOW_CLOUD',
      redactionApplied: false,
      provider: 'dashscope',
      model: 'qwen-plus',
    });
  });

  it('redacts private details before calling the provider', async () => {
    const response = await request(app)
      .post('/api/ai/safe-chat')
      .set(masterHeaders)
      .send({
        message: '提醒王总明天把招商银行6222020202020202020流水发给李会计，手机号13800138000',
        purpose: 'draft_message',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.decision).toBe('REDACT_THEN_CLOUD');
    expect(response.body.data.redactionApplied).toBe(true);

    const providerPayload = aiProviderMock.complete.mock.calls[0][0];
    const sentContent = providerPayload.messages[0].content;
    expect(sentContent).toContain('{{PERSON_1}}');
    expect(sentContent).toContain('{{ACCOUNT_1}}');
    expect(sentContent).not.toContain('王总');
    expect(sentContent).not.toContain('6222020202020202020');
    expect(sentContent).not.toContain('13800138000');
  });

  it('returns a local-only blocked response for E4 credentials', async () => {
    const response = await request(app)
      .post('/api/ai/safe-chat')
      .set(masterHeaders)
      .send({
        message: '我的招商银行支付密码是123456，帮我记住',
        purpose: 'credential_memory',
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      cloudUsed: false,
      decision: 'LOCAL_ONLY',
      blocked: true,
      requiresConfirm: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('123456');
    expect(aiProviderMock.complete).not.toHaveBeenCalled();
  });
});

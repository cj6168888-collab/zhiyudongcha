import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditMock = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../storage', () => ({
  storage: auditMock,
}));

import { attachRole } from '../../../middleware/auth';
import privacyRouter from '../../../routes/privacy';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(attachRole);
  app.use('/api/privacy', privacyRouter);
  return app;
}

const masterHeaders = {
  'x-avatar-role': 'MASTER',
  'x-avatar-secret': 'unit-test-master-secret',
};

describe('privacy routes', () => {
  let app: Express;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AVATAR_MASTER_SECRET = 'unit-test-master-secret';
    auditMock.createAuditLog.mockClear();
    app = createApp();
  });

  it('requires master authorization for privacy tooling', async () => {
    const response = await request(app)
      .post('/api/privacy/classify')
      .send({ text: '银行卡密码是123456' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('classifies non-exportable credentials without returning raw secrets', async () => {
    const response = await request(app)
      .post('/api/privacy/classify')
      .set(masterHeaders)
      .send({
        text: '我的招商银行密码是123456，找王总确认',
        source: 'chat',
        purpose: 'conversation',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.sensitivity).toBe('S4');
    expect(response.body.data.decision).toBe('deny_cloud');
    expect(response.body.data.redactedText).not.toContain('123456');
    expect(response.body.data.redactedText).not.toContain('王总');
    expect(JSON.stringify(response.body.data.entities)).not.toContain('123456');
  });

  it('redacts cloud text and renders local backfill from the server-held session', async () => {
    const redaction = await request(app)
      .post('/api/privacy/redact-for-cloud')
      .set(masterHeaders)
      .send({
        text: '请让王总联系李会计，电话13800138000，验证码为889900',
        purpose: 'draft_message',
      });

    expect(redaction.status).toBe(200);
    expect(redaction.body.data.cloudText).not.toContain('王总');
    expect(redaction.body.data.cloudText).not.toContain('13800138000');
    expect(redaction.body.data.sessionId).toEqual(expect.any(String));

    const rendered = await request(app)
      .post('/api/privacy/render-local')
      .set(masterHeaders)
      .send({
        sessionId: redaction.body.data.sessionId,
        template: '草稿：请{{PERSON_1}}联系{{PERSON_2}}，电话{{PHONE_1}}，验证码{{CREDENTIAL_1}}。',
      });

    expect(rendered.status).toBe(200);
    expect(rendered.body.data.renderedText).toContain('王总');
    expect(rendered.body.data.renderedText).toContain('李会计');
    expect(rendered.body.data.renderedText).toContain('13800138000');
    expect(rendered.body.data.renderedText).not.toContain('889900');
    expect(rendered.body.data.requiresManualVerification).toBe(true);
  });
});

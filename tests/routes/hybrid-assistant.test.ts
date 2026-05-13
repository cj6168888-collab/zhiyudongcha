import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hybridAssistantMock = vi.hoisted(() => ({
  processMessage: vi.fn(),
}));

const authorizationManagerMock = vi.hoisted(() => ({
  getUserConfig: vi.fn(),
  setAmountThresholds: vi.fn(),
  getUserAuthorizations: vi.fn(),
  generateAuthReport: vi.fn(),
  revokeAuthorization: vi.fn(),
  addPermanentAuthorization: vi.fn(),
}));

const conversationActionExecutorMock = vi.hoisted(() => ({
  execute: vi.fn(),
  storePending: vi.fn(),
  executeByResponseId: vi.fn(),
}));

const conversationExecutionEventRecorderMock = vi.hoisted(() => ({
  record: vi.fn(),
}));

const conversationServiceMock = vi.hoisted(() => ({
  get: vi.fn(),
  getSegments: vi.fn(),
  appendSegment: vi.fn(),
  finish: vi.fn(),
}));

const conversationProcessorMock = vi.hoisted(() => ({
  process: vi.fn(),
}));

const perceptionGatewayMock = vi.hoisted(() => ({
  start: vi.fn(),
}));

const avatarServiceMock = vi.hoisted(() => ({
  createChatMessage: vi.fn(),
  getRecentChatContext: vi.fn(),
}));

vi.mock('../../server/services/assistant/HybridAssistant', () => ({
  hybridAssistant: hybridAssistantMock,
  SCENARIO_CATEGORIES: {
    calendar: {
      name: 'Calendar',
      frequency: 'high',
      handler: 'direct',
      examples: ['tomorrow meeting', 'set reminder', 'weekly sync'],
    },
    booking: {
      name: 'Booking',
      frequency: 'medium',
      handler: 'hybrid',
      examples: ['book hotel', 'reserve dinner', 'buy ticket'],
    },
    writing: {
      name: 'Writing',
      frequency: 'low',
      handler: 'ai',
      examples: ['write email', 'draft memo', 'summarize'],
    },
  },
}));

vi.mock('../../server/services/assistant/AuthorizationManager', () => ({
  authorizationManager: authorizationManagerMock,
  AuthorizationType: { AUTO: 'AUTO' },
  AuthorizationScope: { PERMANENT: 'PERMANENT', BY_TYPE: 'BY_TYPE' },
}));

vi.mock('../../server/services/assistant/ConversationActionExecutor', () => ({
  conversationActionExecutor: conversationActionExecutorMock,
}));

vi.mock('../../server/services/assistant/ConversationExecutionEventRecorder', () => ({
  conversationExecutionEventRecorder: conversationExecutionEventRecorderMock,
}));

vi.mock('../../server/services/conversation/ConversationService', () => ({
  conversationService: conversationServiceMock,
}));

vi.mock('../../server/services/conversation/ConversationProcessor', () => ({
  conversationProcessor: conversationProcessorMock,
}));

vi.mock('../../server/services/perception/PerceptionGateway', () => ({
  perceptionGateway: perceptionGatewayMock,
}));

vi.mock('../../server/services/AvatarService', () => ({
  avatarService: avatarServiceMock,
}));

vi.mock('../../server/middleware/auth', () => ({
  attachRole: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: 'user-1' };
    next();
  },
}));

import hybridAssistantRouter from '../../server/routes/hybrid-assistant';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', hybridAssistantRouter);
  return app;
}

function assistantResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'response-1',
    handler: 'ai',
    category: 'writing',
    type: 'report',
    message: 'Done',
    ...overrides,
  };
}

function flushAsyncRecorder() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

describe('Hybrid Assistant API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hybridAssistantMock.processMessage.mockResolvedValue(assistantResponse());
    authorizationManagerMock.getUserConfig.mockReturnValue({
      amountThresholds: { auto: 100, confirm: 1000 },
      trustLevel: 'normal',
    });
    authorizationManagerMock.getUserAuthorizations.mockReturnValue([{ id: 'auth-1' }]);
    authorizationManagerMock.generateAuthReport.mockReturnValue('auth report');
    authorizationManagerMock.revokeAuthorization.mockReturnValue(true);
    conversationActionExecutorMock.execute.mockResolvedValue({
      success: true,
      action: 'create_task',
      entityType: 'TASK',
      entityId: 'task-1',
    });
    conversationActionExecutorMock.executeByResponseId.mockResolvedValue({
      success: true,
      action: 'create_task',
      entityType: 'TASK',
      entityId: 'task-1',
    });
    conversationServiceMock.get.mockResolvedValue(null);
    conversationServiceMock.getSegments.mockResolvedValue([]);
    conversationServiceMock.appendSegment.mockResolvedValue({ id: 'seg-1' });
    conversationServiceMock.finish.mockResolvedValue({ id: 'conv-new' });
    conversationProcessorMock.process.mockResolvedValue({ summary: 'ok', taskCount: 0, memoryCount: 0, eventCount: 0 });
    perceptionGatewayMock.start.mockResolvedValue({ id: 'conv-new' });
    avatarServiceMock.createChatMessage.mockResolvedValue({ id: 'chat-1' });
    avatarServiceMock.getRecentChatContext.mockResolvedValue([]);
  });

  afterEach(async () => {
    await flushAsyncRecorder();
  });

  it('validates chat messages and forwards valid messages to the assistant', async () => {
    const invalid = await request(app).post('/api/assistant').send({});
    const valid = await request(app).post('/api/assistant').send({ message: 'hello', type: 'text', source: 'app' });

    expect(invalid.status).toBe(400);
    expect(valid.status).toBe(200);
    expect(valid.body).toMatchObject({ success: true, response: { id: 'response-1', message: 'Done' } });
    expect(hybridAssistantMock.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'hello',
        type: 'text',
        source: 'app',
      }),
      'user-1',
    );
  });

  it('executes direct assistant actions and records execution events', async () => {
    hybridAssistantMock.processMessage.mockResolvedValueOnce(
      assistantResponse({ type: 'execute', action: 'create_task' }),
    );

    const response = await request(app).post('/api/assistant').send({ message: 'create a task' });

    expect(response.status).toBe(200);
    expect(response.body.execution).toMatchObject({ success: true, entityType: 'TASK', entityId: 'task-1' });
    expect(conversationActionExecutorMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create_task' }),
      'user-1',
    );
    expect(conversationExecutionEventRecorderMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        source: 'assistant_chat',
      }),
    );
  });

  it('stores confirm actions without executing them immediately', async () => {
    hybridAssistantMock.processMessage.mockResolvedValueOnce(
      assistantResponse({ type: 'confirm', action: 'create_project' }),
    );

    const response = await request(app).post('/api/assistant').send({ message: 'create project after confirmation' });

    expect(response.status).toBe(200);
    expect(response.body.execution).toBeUndefined();
    expect(conversationActionExecutorMock.storePending).toHaveBeenCalledWith(
      'response-1',
      expect.objectContaining({ action: 'create_project' }),
      'user-1',
    );
    expect(conversationActionExecutorMock.execute).not.toHaveBeenCalled();
  });

  it('continues a resumed conversation and records the turn in that conversation', async () => {
    conversationServiceMock.get.mockResolvedValueOnce({
      id: 'conv-pc',
      ownerId: 'user-1',
      title: 'PC 执行回流',
      summary: 'PC 已经整理过重点',
    });
    conversationServiceMock.getSegments.mockResolvedValueOnce([
      {
        id: 'seg-1',
        conversationId: 'conv-pc',
        sequence: 1,
        segmentType: 'transcript',
        text: '帮我让 PC 整理今天最该推进的重点',
        speaker: 'user',
        speakerType: 'user',
        source: 'mobile',
        createdAt: new Date('2026-05-12T06:00:00.000Z'),
      },
      {
        id: 'seg-2',
        conversationId: 'conv-pc',
        sequence: 2,
        segmentType: 'transcript',
        text: '我会让桌面端整理',
        speaker: 'navigator',
        speakerType: 'navigator',
        source: 'mobile',
        createdAt: new Date('2026-05-12T06:01:00.000Z'),
      },
    ]);

    const response = await request(app)
      .post('/api/assistant')
      .send({
        message: '接着刚才那段继续',
        type: 'text',
        source: 'app',
        resumeConversationId: 'conv-pc',
        resumeConversationTitle: 'PC 执行回流',
      });

    expect(response.status).toBe(200);
    expect(response.body.conversation).toEqual({ id: 'conv-pc', resumed: true });
    expect(hybridAssistantMock.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '接着刚才那段继续',
        context: {
          recentMessages: [
            expect.objectContaining({ content: '用户：帮我让 PC 整理今天最该推进的重点' }),
            expect.objectContaining({ content: '小智：我会让桌面端整理' }),
          ],
        },
      }),
      'user-1',
    );

    await flushAsyncRecorder();

    expect(perceptionGatewayMock.start).not.toHaveBeenCalled();
    expect(conversationServiceMock.appendSegment).toHaveBeenNthCalledWith(1, expect.objectContaining({
      conversationId: 'conv-pc',
      sequence: 3,
      text: '接着刚才那段继续',
      speakerType: 'user',
    }));
    expect(conversationServiceMock.appendSegment).toHaveBeenNthCalledWith(2, expect.objectContaining({
      conversationId: 'conv-pc',
      sequence: 4,
      text: 'Done',
      speakerType: 'navigator',
    }));
    expect(conversationServiceMock.finish).toHaveBeenCalledWith('conv-pc', 'user-1');
  });

  it('returns intent and permission metadata and updates thresholds', async () => {
    const intents = await request(app).get('/api/assistant/intents');
    const permissions = await request(app).get('/api/assistant/permissions');
    const invalidThresholds = await request(app).put('/api/assistant/permissions/thresholds').send({ auto: '10' });
    const thresholds = await request(app).put('/api/assistant/permissions/thresholds').send({ auto: 50, confirm: 500 });

    expect(intents.body.summary).toEqual({ high: 1, medium: 1, low: 1 });
    expect(intents.body.intents).toHaveLength(3);
    expect(permissions.body.config).toEqual({
      amountThresholds: { auto: 100, confirm: 1000 },
      trustLevel: 'normal',
    });
    expect(invalidThresholds.status).toBe(400);
    expect(thresholds.body.success).toBe(true);
    expect(authorizationManagerMock.setAmountThresholds).toHaveBeenCalledWith('user-1', 50, 500);
  });

  it('handles authorizations, demos, and batch scenarios', async () => {
    const authorizations = await request(app).get('/api/assistant/authorizations');
    const revoke = await request(app).delete('/api/assistant/authorizations/auth-1');
    authorizationManagerMock.revokeAuthorization.mockReturnValueOnce(false);
    const missingRevoke = await request(app).delete('/api/assistant/authorizations/missing');
    const authorize = await request(app)
      .post('/api/assistant/authorize')
      .send({ responseId: 'response-1', action: 'approve_once' });
    const invalidDemo = await request(app).post('/api/assistant/demo').send({ scenario: 'missing' });
    const demo = await request(app).post('/api/assistant/demo').send({ scenario: 'calendar' });
    hybridAssistantMock.processMessage
      .mockResolvedValueOnce(assistantResponse({ handler: 'direct', category: 'calendar', type: 'report', message: 'A' }))
      .mockResolvedValueOnce(assistantResponse({ handler: 'ai', category: 'writing', type: 'report', message: 'B' }));
    const batch = await request(app)
      .post('/api/assistant/batch')
      .send({ scenarios: ['schedule meeting', 'write memo'] });

    expect(authorizations.body).toEqual({
      success: true,
      authorizations: [{ id: 'auth-1' }],
      report: 'auth report',
    });
    expect(revoke.body.success).toBe(true);
    expect(missingRevoke.status).toBe(404);
    expect(authorize.body.execution).toMatchObject({ success: true, entityId: 'task-1' });
    expect(conversationExecutionEventRecorderMock.record).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'assistant_authorize' }),
    );
    expect(invalidDemo.status).toBe(400);
    expect(demo.body).toMatchObject({ success: true, scenario: 'calendar' });
    expect(batch.body.summary).toEqual({ direct: 1, hybrid: 0, ai: 1 });
  });
});

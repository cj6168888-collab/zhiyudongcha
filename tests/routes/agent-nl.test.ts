import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const naturalLanguageAgentMock = vi.hoisted(() => ({
  processCommand: vi.fn(),
}));

vi.mock('../../server/services/agent/NaturalLanguageAgent', () => ({
  naturalLanguageAgent: naturalLanguageAgentMock,
}));

import agentNlRouter from '../../server/routes/agent-nl';

function createTestApp(options: { user?: { id: string } | null; session?: { userId: string } } = {}): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = options.user === undefined ? { id: 'user-1' } : options.user;
    (req as any).session = options.session ?? { userId: 'session-user-1' };
    next();
  });
  app.use('/api/agent/nl', agentNlRouter);
  return app;
}

const commandResult = {
  success: true,
  taskId: 'task-1',
  steps: [
    {
      step: { id: 'step-1', description: 'Analyze the request' },
      success: true,
      output: { summary: 'ready' },
    },
    {
      step: { id: 'step-2', description: 'Ask for missing data' },
      success: true,
      output: { requiresInput: true, question: 'Which account?' },
    },
  ],
  reflections: ['Need user input'],
  finalResult: { status: 'waiting' },
  suggestions: ['Provide the account'],
};

describe('Natural Language Agent API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    naturalLanguageAgentMock.processCommand.mockResolvedValue(commandResult);
  });

  it('validates commands and maps agent execution results', async () => {
    const invalidResponse = await request(app).post('/api/agent/nl').send({ command: 123 });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(naturalLanguageAgentMock.processCommand).not.toHaveBeenCalled();

    const response = await request(app).post('/api/agent/nl').send({
      command: 'help me file the application',
      context: {
        companyInfo: { name: 'Acme' },
        credentials: { portal: 'available' },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      taskId: 'task-1',
      requiresInput: true,
      finalResult: { status: 'waiting' },
      suggestions: ['Provide the account'],
    });
    expect(response.body.steps).toEqual([
      {
        id: 'step-1',
        description: 'Analyze the request',
        success: true,
        output: { summary: 'ready' },
      },
      {
        id: 'step-2',
        description: 'Ask for missing data',
        success: true,
        output: { requiresInput: true, question: 'Which account?' },
      },
    ]);
    expect(naturalLanguageAgentMock.processCommand).toHaveBeenCalledWith(
      'help me file the application',
      {
        userId: 'user-1',
        companyInfo: { name: 'Acme' },
        credentials: { portal: 'available' },
      },
    );
  });

  it('continues tasks with user input after validating required fields', async () => {
    const invalidResponse = await request(app).post('/api/agent/nl/continue').send({ taskId: 'task-1' });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);

    const response = await request(app).post('/api/agent/nl/continue').send({
      taskId: 'task-1',
      userInput: 'use the finance account',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      taskId: 'task-1',
      finalResult: { status: 'waiting' },
    });
    expect(naturalLanguageAgentMock.processCommand).toHaveBeenCalledWith('use the finance account', {
      continuingTaskId: 'task-1',
    });
  });

  it('falls back to session user id when request user is unavailable', async () => {
    const sessionOnlyApp = createTestApp({ user: null, session: { userId: 'session-only-user' } });

    const response = await request(sessionOnlyApp).post('/api/agent/nl').send({
      command: 'summarize my application status',
    });

    expect(response.status).toBe(200);
    expect(naturalLanguageAgentMock.processCommand).toHaveBeenCalledWith(
      'summarize my application status',
      expect.objectContaining({
        userId: 'session-only-user',
      }),
    );
  });

  it('marks responses as not requiring input when no step asks for it', async () => {
    naturalLanguageAgentMock.processCommand.mockResolvedValueOnce({
      ...commandResult,
      steps: [
        {
          step: { id: 'step-1', description: 'Complete request' },
          success: true,
          output: { done: true },
        },
      ],
    });

    const response = await request(app).post('/api/agent/nl').send({
      command: 'complete the filing',
    });

    expect(response.status).toBe(200);
    expect(response.body.requiresInput).toBe(false);
    expect(response.body.steps).toEqual([
      {
        id: 'step-1',
        description: 'Complete request',
        success: true,
        output: { done: true },
      },
    ]);
  });

  it('maps natural language agent failures to 500 responses', async () => {
    naturalLanguageAgentMock.processCommand.mockRejectedValueOnce(new Error('agent unavailable'));
    naturalLanguageAgentMock.processCommand.mockRejectedValueOnce(new Error('continue unavailable'));

    const commandResponse = await request(app).post('/api/agent/nl').send({
      command: 'help me file the application',
    });
    const continueResponse = await request(app).post('/api/agent/nl/continue').send({
      taskId: 'task-1',
      userInput: 'use finance account',
    });

    expect(commandResponse.status).toBe(500);
    expect(commandResponse.body.success).toBe(false);
    expect(commandResponse.body.error).toContain('agent unavailable');
    expect(continueResponse.status).toBe(500);
    expect(continueResponse.body.success).toBe(false);
  });

  it('returns supported natural language capabilities', async () => {
    const response = await request(app).get('/api/agent/nl/capabilities');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.capabilities.intentTypes).toContain('automation');
    expect(response.body.capabilities.supportedActions).toContain('fill_forms');
    expect(response.body.examples.length).toBeGreaterThan(0);
  });
});

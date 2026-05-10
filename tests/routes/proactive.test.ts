import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const proactiveAgentMock = vi.hoisted(() => ({
  processConversation: vi.fn(),
  processVoiceMessage: vi.fn(),
  generateNotificationSummary: vi.fn(),
}));

vi.mock('../../server/services/agent/ProactiveAgent', () => ({
  proactiveAgent: proactiveAgentMock,
}));

import proactiveRouter from '../../server/routes/proactive';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/proactive', proactiveRouter);
  return app;
}

const proactiveResult = {
  commitments: [
    {
      id: 'commitment-1',
      type: 'pickup',
      title: 'Pick up Chen',
      description: 'Pick up Chen at the station',
      participants: ['Chen'],
      confidence: 0.9,
      suggestedActions: [],
    },
  ],
  actions: [
    {
      type: 'calendar',
      title: 'Create calendar event',
      description: 'Create pickup event',
      priority: 'high',
      params: { title: 'Pick up Chen' },
    },
  ],
  suggestions: ['Found one commitment'],
};

describe('Proactive API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    proactiveAgentMock.processConversation.mockResolvedValue(proactiveResult);
    proactiveAgentMock.processVoiceMessage.mockResolvedValue(proactiveResult);
    proactiveAgentMock.generateNotificationSummary.mockReturnValue('09:00 Pick up Chen');
  });

  it('validates process content and returns notification summaries', async () => {
    const invalidResponse = await request(app).post('/api/proactive/process').send({});

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(proactiveAgentMock.processConversation).not.toHaveBeenCalled();

    const response = await request(app).post('/api/proactive/process').send({
      content: 'Chen arrives tomorrow morning',
      source: 'wechat',
      participants: ['Chen', 'Me'],
      time: '2026-05-01T09:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.commitments).toHaveLength(1);
    expect(response.body.notification).toMatchObject({
      title: expect.any(String),
      body: '09:00 Pick up Chen',
    });
    expect(response.body.notification.actions).toHaveLength(1);
    expect(proactiveAgentMock.processConversation).toHaveBeenCalledWith(
      'Chen arrives tomorrow morning',
      expect.objectContaining({
        source: 'wechat',
        participants: ['Chen', 'Me'],
        time: expect.any(Date),
      }),
    );
  });

  it('returns null notification when no notification summary is generated', async () => {
    proactiveAgentMock.generateNotificationSummary.mockReturnValue('');

    const response = await request(app).post('/api/proactive/process').send({
      content: 'No commitments here',
    });

    expect(response.status).toBe(200);
    expect(response.body.notification).toBeNull();
    expect(proactiveAgentMock.processConversation).toHaveBeenCalledWith(
      'No commitments here',
      expect.objectContaining({
        source: 'other',
        participants: [],
      }),
    );
  });

  it('processes voice messages with default phone source', async () => {
    const response = await request(app).post('/api/proactive/voice').send({
      audioUrl: 'https://example.test/audio.wav',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.commitments).toHaveLength(1);
    expect(proactiveAgentMock.processVoiceMessage).toHaveBeenCalledWith(
      'https://example.test/audio.wav',
      expect.objectContaining({
        source: 'phone',
        participants: [],
      }),
    );
  });

  it('forwards custom voice context when provided', async () => {
    const response = await request(app).post('/api/proactive/voice').send({
      audioUrl: 'https://example.test/custom.wav',
      source: 'wechat',
      participants: ['Alice'],
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(proactiveAgentMock.processVoiceMessage).toHaveBeenCalledWith(
      'https://example.test/custom.wav',
      {
        source: 'wechat',
        participants: ['Alice'],
      },
    );
  });

  it('creates calendar events and reminders with generated ids', async () => {
    const calendarResponse = await request(app).post('/api/proactive/calendar').send({
      title: 'Pickup',
      startTime: '2026-05-01T09:00:00.000Z',
    });
    const reminderResponse = await request(app).post('/api/proactive/reminder').send({
      title: 'Leave early',
      time: '2026-05-01T08:30:00.000Z',
    });

    expect(calendarResponse.status).toBe(200);
    expect(calendarResponse.body.success).toBe(true);
    expect(calendarResponse.body.eventId).toMatch(/^evt_/);
    expect(reminderResponse.status).toBe(200);
    expect(reminderResponse.body.success).toBe(true);
    expect(reminderResponse.body.reminderId).toMatch(/^rem_/);
  });

  it('returns upcoming events and simulate results', async () => {
    const upcomingResponse = await request(app).get('/api/proactive/upcoming?hours=12');
    const simulateResponse = await request(app).post('/api/proactive/simulate').send({});

    expect(upcomingResponse.status).toBe(200);
    expect(upcomingResponse.body.success).toBe(true);
    expect(upcomingResponse.body.events[0]).toHaveProperty('id');
    expect(simulateResponse.status).toBe(200);
    expect(simulateResponse.body.success).toBe(true);
    expect(simulateResponse.body.result).toMatchObject({ commitments: proactiveResult.commitments });
    expect(proactiveAgentMock.processConversation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        source: 'wechat',
        participants: expect.any(Array),
        time: expect.any(Date),
      }),
    );
  });

  it('maps proactive agent failures to 500 responses', async () => {
    proactiveAgentMock.processConversation.mockRejectedValueOnce(new Error('conversation unavailable'));
    proactiveAgentMock.processVoiceMessage.mockRejectedValueOnce(new Error('voice unavailable'));
    proactiveAgentMock.processConversation.mockRejectedValueOnce(new Error('simulate unavailable'));

    const processResponse = await request(app).post('/api/proactive/process').send({
      content: 'Chen arrives tomorrow morning',
    });
    const voiceResponse = await request(app).post('/api/proactive/voice').send({
      audioUrl: 'https://example.test/audio.wav',
    });
    const simulateResponse = await request(app).post('/api/proactive/simulate').send({});

    expect(processResponse.status).toBe(500);
    expect(processResponse.body.success).toBe(false);
    expect(voiceResponse.status).toBe(500);
    expect(voiceResponse.body.success).toBe(false);
    expect(simulateResponse.status).toBe(500);
    expect(simulateResponse.body.success).toBe(false);
  });
});

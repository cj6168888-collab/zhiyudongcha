import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const meetingAgentMock = vi.hoisted(() => ({
  processRequest: vi.fn(),
  generateMinutes: vi.fn(),
  extractWorkSummary: vi.fn(),
  setTeamMembers: vi.fn(),
}));

vi.mock('../../server/services/agent/MeetingAgent', () => ({
  meetingAgent: meetingAgentMock,
}));

vi.mock('../../server/services/agent/NaturalLanguageAgent', () => ({
  naturalLanguageAgent: {},
}));

import meetingRouter from '../../server/routes/meeting';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/meeting', meetingRouter);
  return app;
}

const meetingResult = {
  success: true,
  meeting: {
    id: 'meeting-1',
    title: 'Weekly sync',
    status: 'scheduled',
  },
  actions: [{ type: 'calendar', title: 'Create event' }],
  messages: ['meeting created'],
};

describe('Meeting API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    meetingAgentMock.processRequest.mockResolvedValue(meetingResult);
    meetingAgentMock.generateMinutes.mockResolvedValue('Meeting minutes');
    meetingAgentMock.extractWorkSummary.mockResolvedValue('Weekly work summary');
  });

  it('creates meetings and forwards explicit request options', async () => {
    const response = await request(app)
      .post('/api/meeting/create')
      .send({
        title: 'Weekly sync',
        type: 'weekly',
        startTime: '2026-05-01T09:00:00.000Z',
        duration: 45,
        participants: ['alice', 'bob'],
        recurrence: { frequency: 'weekly' },
        collectMaterials: false,
        generateAgenda: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meeting).toMatchObject({ id: 'meeting-1', title: 'Weekly sync' });
    expect(meetingAgentMock.processRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Weekly sync',
        type: 'weekly',
        duration: 45,
        participants: ['alice', 'bob'],
        recurrence: { frequency: 'weekly' },
        collectMaterials: false,
        generateAgenda: true,
        startTime: expect.any(Date),
      }),
    );
  });

  it('validates natural language meeting commands', async () => {
    const invalidResponse = await request(app).post('/api/meeting/nl').send({});

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(meetingAgentMock.processRequest).not.toHaveBeenCalled();

    const response = await request(app).post('/api/meeting/nl').send({ command: 'schedule a weekly sync' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(meetingAgentMock.processRequest).toHaveBeenCalledWith({ description: 'schedule a weekly sync' });
  });

  it('returns meeting templates and material request ids', async () => {
    const templatesResponse = await request(app).get('/api/meeting/templates');
    const materialsResponse = await request(app).post('/api/meeting/materials').send({
      meetingId: 'meeting-1',
      participantIds: ['alice'],
      requestMessage: 'Please send your notes',
    });

    expect(templatesResponse.status).toBe(200);
    expect(templatesResponse.body.success).toBe(true);
    expect(templatesResponse.body.templates.map((template: { id: string }) => template.id)).toContain('weekly');
    expect(materialsResponse.status).toBe(200);
    expect(materialsResponse.body.success).toBe(true);
    expect(materialsResponse.body.requestId).toMatch(/^req_/);
  });

  it('generates minutes and work summaries through the meeting agent', async () => {
    const minutesResponse = await request(app).post('/api/meeting/minutes').send({
      meetingId: 'meeting-1',
      discussions: ['Decision A', 'Task B'],
    });
    const summaryResponse = await request(app).get('/api/meeting/summary?userId=user-1&weekNumber=18');

    expect(minutesResponse.status).toBe(200);
    expect(minutesResponse.body.minutes).toBe('Meeting minutes');
    expect(meetingAgentMock.generateMinutes).toHaveBeenCalledWith('meeting-1', ['Decision A', 'Task B']);
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.summary).toBe('Weekly work summary');
    expect(meetingAgentMock.extractWorkSummary).toHaveBeenCalledWith('user-1', 18);
  });

  it('uses default work summary parameters when query values are omitted', async () => {
    const response = await request(app).get('/api/meeting/summary');

    expect(response.status).toBe(200);
    expect(response.body.summary).toBe('Weekly work summary');
    expect(meetingAgentMock.extractWorkSummary).toHaveBeenCalledWith('default', undefined);
  });

  it('sets team members only when the request contains an array', async () => {
    const invalidShapeResponse = await request(app).post('/api/meeting/team').send({ members: 'not-array' });

    expect(invalidShapeResponse.status).toBe(200);
    expect(invalidShapeResponse.body.success).toBe(true);
    expect(meetingAgentMock.setTeamMembers).not.toHaveBeenCalled();

    const members = [{ id: 'u1', name: 'Alice', role: 'owner' }];
    const response = await request(app).post('/api/meeting/team').send({ members });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(meetingAgentMock.setTeamMembers).toHaveBeenCalledWith(members);
  });

  it('runs the built-in meeting simulation command through the meeting agent', async () => {
    const response = await request(app).post('/api/meeting/simulate').send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.command).toEqual(expect.any(String));
    expect(response.body.result).toMatchObject({ success: true, meeting: { id: 'meeting-1' } });
    expect(meetingAgentMock.processRequest).toHaveBeenCalledWith({
      description: expect.any(String),
    });
  });

  it('maps meeting agent failures to 500 responses', async () => {
    meetingAgentMock.processRequest.mockRejectedValueOnce(new Error('calendar unavailable'));
    meetingAgentMock.generateMinutes.mockRejectedValueOnce(new Error('minutes unavailable'));
    meetingAgentMock.extractWorkSummary.mockRejectedValueOnce(new Error('summary unavailable'));

    const createResponse = await request(app).post('/api/meeting/create').send({
      title: 'Weekly sync',
    });
    const minutesResponse = await request(app).post('/api/meeting/minutes').send({
      meetingId: 'meeting-1',
      discussions: ['Decision A'],
    });
    const summaryResponse = await request(app).get('/api/meeting/summary?userId=user-1');

    expect(createResponse.status).toBe(500);
    expect(createResponse.body.success).toBe(false);
    expect(minutesResponse.status).toBe(500);
    expect(minutesResponse.body.success).toBe(false);
    expect(summaryResponse.status).toBe(500);
    expect(summaryResponse.body.success).toBe(false);
  });
});

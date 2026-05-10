import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const recommendationEngineMock = vi.hoisted(() => ({
  recommend: vi.fn(),
  book: vi.fn(),
  recordFeedback: vi.fn(),
}));

const proactiveAgentMock = vi.hoisted(() => ({
  processConversation: vi.fn(),
}));

const voicePrintAgentMock = vi.hoisted(() => ({
  processTextDialogue: vi.fn(),
}));

vi.mock('../../server/services/agent/RecommendationEngine', () => ({
  recommendationEngine: recommendationEngineMock,
}));

vi.mock('../../server/services/agent/ProactiveAgent', () => ({
  proactiveAgent: proactiveAgentMock,
}));

vi.mock('../../server/services/agent/VoicePrintAgent', () => ({
  voicePrintAgent: voicePrintAgentMock,
}));

import recommendRouter from '../../server/routes/recommend';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/recommend', recommendRouter);
  return app;
}

const restaurantRecommendation = {
  id: 'rec-restaurant',
  type: 'restaurant',
  name: 'Dinner Place',
  matchScore: 92,
  details: {},
  actions: [],
  tags: [],
};

const hotelRecommendation = {
  id: 'rec-hotel',
  type: 'hotel',
  name: 'Sleep Hotel',
  matchScore: 88,
  details: {},
  actions: [],
  tags: [],
};

describe('Recommendation API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    recommendationEngineMock.recommend.mockResolvedValue([restaurantRecommendation, hotelRecommendation]);
    recommendationEngineMock.book.mockResolvedValue({
      success: true,
      bookingId: 'booking-1',
      confirmationCode: 'ABC123',
    });
    proactiveAgentMock.processConversation.mockResolvedValue({
      commitments: [
        {
          type: 'pickup',
          title: 'Pick up Chen',
          content: 'Pick up at station',
          location: 'East Station',
          startTime: '20:00',
        },
      ],
    });
    voicePrintAgentMock.processTextDialogue.mockResolvedValue({
      commitments: [
        {
          content: 'Need dinner near the station',
          relatedEntity: 'East Station',
        },
      ],
    });
  });

  it('returns general recommendations and records view feedback', async () => {
    const response = await request(app).post('/api/recommend').send({
      type: 'both',
      location: 'East Station',
      time: '2026-05-01T18:00:00.000Z',
      partySize: 3,
      purpose: 'business',
      budget: 'medium',
      preferences: ['quiet'],
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.recommendations).toHaveLength(2);
    expect(recommendationEngineMock.recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'both',
        location: 'East Station',
        time: expect.any(Date),
        partySize: 3,
        purpose: 'business',
        budget: 'medium',
        preferences: ['quiet'],
      }),
    );
    expect(recommendationEngineMock.recordFeedback).toHaveBeenCalledWith('rec-restaurant', 'view');
    expect(recommendationEngineMock.recordFeedback).toHaveBeenCalledWith('rec-hotel', 'view');
  });

  it('uses conversation context before general recommendation', async () => {
    const response = await request(app).post('/api/recommend').send({
      context: {
        conversation: 'Please find dinner near the station',
        source: 'wechat',
        participants: ['me', 'chen'],
      },
    });

    expect(response.status).toBe(200);
    expect(voicePrintAgentMock.processTextDialogue).toHaveBeenCalledWith(
      'Please find dinner near the station',
      { source: 'wechat', participants: ['me', 'chen'] },
    );
    expect(recommendationEngineMock.recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'both',
      }),
    );
  });

  it('returns restaurant and hotel recommendations through dedicated endpoints', async () => {
    const restaurantsResponse = await request(app).post('/api/recommend/restaurants').send({
      location: 'East Station',
      purpose: 'friends',
      partySize: 4,
      budget: 'medium',
      preferences: ['private-room'],
    });
    const hotelsResponse = await request(app).post('/api/recommend/hotels').send({
      location: 'East Station',
      budget: 'high',
    });

    expect(restaurantsResponse.status).toBe(200);
    expect(restaurantsResponse.body.success).toBe(true);
    expect(hotelsResponse.status).toBe(200);
    expect(hotelsResponse.body.success).toBe(true);
    expect(recommendationEngineMock.recommend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'restaurant', location: 'East Station' }),
    );
    expect(recommendationEngineMock.recommend).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'hotel', location: 'East Station', budget: 'high' }),
    );
  });

  it('keeps dedicated restaurant and hotel recommendation payloads scoped to supported fields', async () => {
    await request(app).post('/api/recommend/restaurants').send({
      location: 'East Station',
      purpose: 'friends',
      partySize: 4,
      budget: 'medium',
      preferences: ['private-room'],
      unsupported: 'ignored',
    });
    await request(app).post('/api/recommend/hotels').send({
      location: 'East Station',
      budget: 'high',
      checkInDate: '2026-05-01',
      checkOutDate: '2026-05-02',
    });

    expect(recommendationEngineMock.recommend).toHaveBeenNthCalledWith(1, {
      type: 'restaurant',
      location: 'East Station',
      partySize: 4,
      purpose: 'friends',
      budget: 'medium',
      preferences: ['private-room'],
    });
    expect(recommendationEngineMock.recommend).toHaveBeenNthCalledWith(2, {
      type: 'hotel',
      location: 'East Station',
      budget: 'high',
    });
  });

  it('validates booking requests and records booking feedback on success', async () => {
    const invalidResponse = await request(app).post('/api/recommend/book').send({
      type: 'restaurant',
      itemId: 'rec-restaurant',
      name: 'Alice',
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(recommendationEngineMock.book).not.toHaveBeenCalled();

    const response = await request(app).post('/api/recommend/book').send({
      type: 'restaurant',
      itemId: 'rec-restaurant',
      date: '2026-05-01T00:00:00.000Z',
      time: '18:30',
      partySize: 2,
      name: 'Alice',
      phone: '123456',
      notes: 'Window seat',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, bookingId: 'booking-1' });
    expect(recommendationEngineMock.book).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'restaurant',
        itemId: 'rec-restaurant',
        date: expect.any(Date),
        time: '18:30',
        partySize: 2,
        name: 'Alice',
        phone: '123456',
      }),
    );
    expect(recommendationEngineMock.recordFeedback).toHaveBeenCalledWith('rec-restaurant', 'book');
  });

  it('does not record booking feedback when booking fails', async () => {
    recommendationEngineMock.book.mockResolvedValueOnce({
      success: false,
      error: 'fully booked',
    });

    const response = await request(app).post('/api/recommend/book').send({
      type: 'restaurant',
      itemId: 'rec-restaurant',
      date: '2026-05-01T00:00:00.000Z',
      time: '18:30',
      name: 'Alice',
      phone: '123456',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: false, error: 'fully booked' });
    expect(recommendationEngineMock.recordFeedback).not.toHaveBeenCalledWith('rec-restaurant', 'book');
  });

  it('builds recommendations from conversation commitments', async () => {
    const response = await request(app).post('/api/recommend/from-conversation').send({
      conversation: 'Chen arrives at East Station, arrange dinner and hotel',
      source: 'wechat',
      participants: ['chen'],
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.dialogue.summary).toContain('Pick up Chen');
    expect(response.body.recommendations.restaurants[0]).toMatchObject({ type: 'restaurant' });
    expect(response.body.recommendations.hotels[0]).toMatchObject({ type: 'hotel' });
    expect(proactiveAgentMock.processConversation).toHaveBeenCalledWith(
      'Chen arrives at East Station, arrange dinner and hotel',
      { source: 'wechat', participants: ['chen'] },
    );
    expect(recommendationEngineMock.recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'both',
        location: 'East Station',
      }),
    );
  });

  it('returns recommendation categories', async () => {
    const response = await request(app).get('/api/recommend/categories');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.categories).toHaveProperty('restaurant');
    expect(response.body.categories).toHaveProperty('hotel');
  });

  it('maps recommendation service failures to 500 responses', async () => {
    recommendationEngineMock.recommend.mockRejectedValueOnce(new Error('recommend unavailable'));
    proactiveAgentMock.processConversation.mockRejectedValueOnce(new Error('dialogue unavailable'));
    recommendationEngineMock.book.mockRejectedValueOnce(new Error('booking unavailable'));

    const recommendResponse = await request(app).post('/api/recommend').send({
      location: 'East Station',
    });
    const conversationResponse = await request(app).post('/api/recommend/from-conversation').send({
      conversation: 'Arrange dinner and hotel',
    });
    const bookingResponse = await request(app).post('/api/recommend/book').send({
      type: 'restaurant',
      itemId: 'rec-restaurant',
      name: 'Alice',
      phone: '123456',
    });

    expect(recommendResponse.status).toBe(500);
    expect(recommendResponse.body.success).toBe(false);
    expect(conversationResponse.status).toBe(500);
    expect(conversationResponse.body.success).toBe(false);
    expect(bookingResponse.status).toBe(500);
    expect(bookingResponse.body.success).toBe(false);
  });
});

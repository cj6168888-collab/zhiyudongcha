import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const personServiceMock = vi.hoisted(() => ({
  getAllPersons: vi.fn(),
  getPersonsByApprovalStatus: vi.fn(),
  searchPersonsByWeakness: vi.fn(),
  getRelationshipInsight: vi.fn(),
  getPerson: vi.fn(),
  findConflictingRelationships: vi.fn(),
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  updatePersonApproval: vi.fn(),
  deletePerson: vi.fn(),
}));

const insertPersonSchemaMock = vi.hoisted(() => ({
  parse: vi.fn((body: unknown) => body),
}));

const authMock = vi.hoisted(() => ({
  auditAction: vi.fn(),
  requireMaster: vi.fn((req: Request, res: Response, next: NextFunction) => {
    if ((req as any).userRole !== 'MASTER') {
      res.status(403).json({ error: 'MASTER required' });
      return;
    }
    next();
  }),
}));

vi.mock('../../server/services/PersonService', () => ({
  personService: personServiceMock,
}));

vi.mock('@shared/schema', () => ({
  insertPersonSchema: insertPersonSchemaMock,
}));

vi.mock('../../server/middleware/auth', () => authMock);

import { registerPersonsRoutes } from '../../server/routes/persons';

function createTestApp(role: 'MASTER' | 'GUEST' = 'MASTER'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).userRole = role;
    next();
  });
  registerPersonsRoutes(app, {} as any, vi.fn());
  return app;
}

describe('Persons API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    insertPersonSchemaMock.parse.mockImplementation((body: unknown) => body);
    personServiceMock.getAllPersons.mockResolvedValue([{ id: 'person-1', name: 'Ada' }]);
    personServiceMock.getPersonsByApprovalStatus.mockResolvedValue([{ id: 'person-pending' }]);
    personServiceMock.searchPersonsByWeakness.mockResolvedValue([{ id: 'person-weak' }]);
    personServiceMock.getRelationshipInsight.mockResolvedValue({ name: 'Ada', score: 0.9 });
    personServiceMock.getPerson.mockResolvedValue({ id: 'person-1', name: 'Ada' });
    personServiceMock.findConflictingRelationships.mockResolvedValue([{ id: 'conflict-1' }]);
    personServiceMock.createPerson.mockResolvedValue({ id: 'person-2', name: 'Grace' });
    personServiceMock.updatePerson.mockResolvedValue({ id: 'person-1', name: 'Ada Lovelace' });
    personServiceMock.updatePersonApproval.mockResolvedValue({ id: 'person-1', approvalStatus: 'CONFIRMED' });
    personServiceMock.deletePerson.mockResolvedValue(true);
  });

  it('returns person lists, pending approvals, search results, and relationship insights', async () => {
    const listResponse = await request(app).get('/api/persons?accessLevel=PUBLIC');
    const defaultListResponse = await request(app).get('/api/persons');
    const pendingResponse = await request(app).get('/api/persons/pending');
    const missingSearch = await request(app).get('/api/persons/search/weakness');
    const searchResponse = await request(app).get('/api/persons/search/weakness?q=hesitation');
    const insightResponse = await request(app).get('/api/persons/insight/Ada');

    expect(listResponse.body).toEqual([{ id: 'person-1', name: 'Ada' }]);
    expect(personServiceMock.getAllPersons).toHaveBeenCalledWith('PUBLIC');
    expect(defaultListResponse.body).toEqual([{ id: 'person-1', name: 'Ada' }]);
    expect(personServiceMock.getAllPersons).toHaveBeenCalledWith(undefined);
    expect(pendingResponse.body).toEqual([{ id: 'person-pending' }]);
    expect(personServiceMock.getPersonsByApprovalStatus).toHaveBeenCalledWith('PENDING');
    expect(missingSearch.status).toBe(400);
    expect(searchResponse.body).toEqual([{ id: 'person-weak' }]);
    expect(personServiceMock.searchPersonsByWeakness).toHaveBeenCalledWith('hesitation');
    expect(insightResponse.body).toEqual({ name: 'Ada', score: 0.9 });
  });

  it('returns person detail and conflict resources with missing-resource 404s', async () => {
    const detailResponse = await request(app).get('/api/persons/person-1');
    const conflictsResponse = await request(app).get('/api/persons/person-1/conflicts');

    personServiceMock.getPerson.mockResolvedValueOnce(undefined);
    personServiceMock.getRelationshipInsight.mockResolvedValueOnce(undefined);
    const missingDetail = await request(app).get('/api/persons/missing-person');
    const missingInsight = await request(app).get('/api/persons/insight/Missing');

    expect(detailResponse.body).toEqual({ id: 'person-1', name: 'Ada' });
    expect(conflictsResponse.body).toEqual([{ id: 'conflict-1' }]);
    expect(missingDetail.status).toBe(404);
    expect(missingInsight.status).toBe(404);
  });

  it('validates and creates persons through the insert schema', async () => {
    insertPersonSchemaMock.parse.mockImplementationOnce(() => {
      throw new Error('invalid person');
    });

    const invalidResponse = await request(app).post('/api/persons').send({});
    const createResponse = await request(app).post('/api/persons').send({ name: 'Grace' });

    expect(invalidResponse.status).toBe(400);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({ id: 'person-2', name: 'Grace' });
    expect(personServiceMock.createPerson).toHaveBeenCalledWith(
      { name: 'Grace' },
      expect.objectContaining({
        createMemory: true,
        broadcastDataChange: expect.any(Function),
      }),
    );
  });

  it('updates, approves, and deletes persons with useful status codes', async () => {
    const updateResponse = await request(app).patch('/api/persons/person-1').send({ name: 'Ada Lovelace' });
    const invalidApproval = await request(app).patch('/api/persons/person-1/approval').send({ approvalStatus: 'UNKNOWN' });
    const approvalResponse = await request(app).patch('/api/persons/person-1/approval').send({ approvalStatus: 'CONFIRMED' });
    const deleteResponse = await request(app).delete('/api/persons/person-1');

    personServiceMock.updatePerson.mockResolvedValueOnce(undefined);
    personServiceMock.updatePersonApproval.mockResolvedValueOnce(undefined);
    personServiceMock.deletePerson.mockResolvedValueOnce(false);
    const missingUpdate = await request(app).patch('/api/persons/missing-person').send({ name: 'Missing' });
    const missingApproval = await request(app).patch('/api/persons/missing-person/approval').send({ approvalStatus: 'PENDING' });
    const missingDelete = await request(app).delete('/api/persons/missing-person');

    expect(updateResponse.body).toEqual({ id: 'person-1', name: 'Ada Lovelace' });
    expect(invalidApproval.status).toBe(400);
    expect(approvalResponse.body).toEqual({ id: 'person-1', approvalStatus: 'CONFIRMED' });
    expect(personServiceMock.updatePersonApproval).toHaveBeenCalledWith(
      'person-1',
      'CONFIRMED',
      expect.objectContaining({
        userRole: 'MASTER',
        createMemory: true,
        auditAction: expect.any(Function),
      }),
    );
    expect(deleteResponse.status).toBe(204);
    expect(missingUpdate.status).toBe(404);
    expect(missingApproval.status).toBe(404);
    expect(missingDelete.status).toBe(404);
  });

  it('requires master role for approval updates', async () => {
    const guestApp = createTestApp('GUEST');

    const response = await request(guestApp).patch('/api/persons/person-1/approval').send({ approvalStatus: 'CONFIRMED' });

    expect(response.status).toBe(403);
    expect(personServiceMock.updatePersonApproval).not.toHaveBeenCalled();
  });

  it('maps representative read failures to route-specific 500 responses', async () => {
    personServiceMock.getAllPersons.mockRejectedValueOnce(new Error('list unavailable'));
    const listResponse = await request(app).get('/api/persons');

    personServiceMock.getPersonsByApprovalStatus.mockRejectedValueOnce(new Error('pending unavailable'));
    const pendingResponse = await request(app).get('/api/persons/pending');

    personServiceMock.searchPersonsByWeakness.mockRejectedValueOnce(new Error('search unavailable'));
    const searchResponse = await request(app).get('/api/persons/search/weakness?q=hesitation');

    personServiceMock.getRelationshipInsight.mockRejectedValueOnce(new Error('insight unavailable'));
    const insightResponse = await request(app).get('/api/persons/insight/Ada');

    personServiceMock.getPerson.mockRejectedValueOnce(new Error('detail unavailable'));
    const detailResponse = await request(app).get('/api/persons/person-1');

    personServiceMock.findConflictingRelationships.mockRejectedValueOnce(new Error('conflicts unavailable'));
    const conflictsResponse = await request(app).get('/api/persons/person-1/conflicts');

    expect(listResponse.status).toBe(500);
    expect(listResponse.body).toEqual({ error: 'Failed to fetch persons' });
    expect(pendingResponse.status).toBe(500);
    expect(pendingResponse.body).toEqual({ error: 'Failed to fetch pending persons' });
    expect(searchResponse.status).toBe(500);
    expect(searchResponse.body).toEqual({ error: 'Failed to search persons' });
    expect(insightResponse.status).toBe(500);
    expect(insightResponse.body).toEqual({ error: 'Failed to generate relationship insight' });
    expect(detailResponse.status).toBe(500);
    expect(detailResponse.body).toEqual({ error: 'Failed to fetch person' });
    expect(conflictsResponse.status).toBe(500);
    expect(conflictsResponse.body).toEqual({ error: 'Failed to find conflicts' });
  });

  it('maps representative write failures to current route contracts', async () => {
    personServiceMock.createPerson.mockRejectedValueOnce(new Error('create unavailable'));
    const createResponse = await request(app).post('/api/persons').send({ name: 'Grace' });

    personServiceMock.updatePerson.mockRejectedValueOnce(new Error('update unavailable'));
    const updateResponse = await request(app).patch('/api/persons/person-1').send({ name: 'Ada Lovelace' });

    personServiceMock.updatePersonApproval.mockRejectedValueOnce(new Error('approval unavailable'));
    const approvalResponse = await request(app)
      .patch('/api/persons/person-1/approval')
      .send({ approvalStatus: 'CONFIRMED' });

    personServiceMock.deletePerson.mockRejectedValueOnce(new Error('delete unavailable'));
    const deleteResponse = await request(app).delete('/api/persons/person-1');

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error).toBe('Invalid person data');
    expect(updateResponse.status).toBe(500);
    expect(updateResponse.body).toEqual({ error: 'Failed to update person', details: 'update unavailable' });
    expect(approvalResponse.status).toBe(500);
    expect(approvalResponse.body).toEqual({ error: 'Failed to update person approval' });
    expect(deleteResponse.status).toBe(500);
    expect(deleteResponse.body).toEqual({ error: 'Failed to delete person' });
  });
});

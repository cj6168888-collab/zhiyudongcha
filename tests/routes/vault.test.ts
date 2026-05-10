import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const vaultServiceMock = vi.hoisted(() => ({
  getAllVaultItems: vi.fn(),
  getVaultItem: vi.fn(),
  createVaultItem: vi.fn(),
  updateVaultItem: vi.fn(),
  deleteVaultItem: vi.fn(),
  searchVaultBySemanticTag: vi.fn(),
  searchVaultByIntent: vi.fn(),
  permanentShred: vi.fn(),
}));

const memoryServiceMock = vi.hoisted(() => ({
  getAllMemories: vi.fn(),
  createMemory: vi.fn(),
}));

vi.mock('../../server/services/VaultService', () => ({
  vaultService: vaultServiceMock,
}));

vi.mock('../../server/services/MemoryService', () => ({
  memoryService: memoryServiceMock,
}));

vi.mock('../../server/storage', () => ({
  storage: {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

import { registerVaultRoutes } from '../../server/routes/vault';

const broadcastDataChange = vi.fn();

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userRole = 'MASTER';
    req.sessionId = 'test-session';
    next();
  });
  registerVaultRoutes(app, {} as never, broadcastDataChange);
  return app;
}

const vaultItem = {
  id: 'vault-1',
  category: 'MEMORY',
  fileName: 'decision.md',
  content: 'keep this memory',
};

const memory = {
  id: 'memory-1',
  context: 'meeting decision',
  choiceMade: 'follow up tomorrow',
};

describe('Vault and Memory API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vaultServiceMock.getAllVaultItems.mockResolvedValue([vaultItem]);
    vaultServiceMock.getVaultItem.mockImplementation((id: string) => (id === vaultItem.id ? vaultItem : undefined));
    vaultServiceMock.createVaultItem.mockResolvedValue(vaultItem);
    vaultServiceMock.updateVaultItem.mockImplementation((id: string) =>
      id === vaultItem.id ? { ...vaultItem, content: 'updated' } : undefined,
    );
    vaultServiceMock.deleteVaultItem.mockImplementation((id: string) => Promise.resolve(id === vaultItem.id));
    vaultServiceMock.searchVaultBySemanticTag.mockResolvedValue([vaultItem]);
    vaultServiceMock.searchVaultByIntent.mockResolvedValue([vaultItem]);
    vaultServiceMock.permanentShred.mockResolvedValue({ success: true, message: 'shredded' });
    memoryServiceMock.getAllMemories.mockResolvedValue([memory]);
    memoryServiceMock.createMemory.mockResolvedValue(memory);
  });

  it('lists vault items by zone and returns item details or 404', async () => {
    const listResponse = await request(app).get('/api/vault?zone=ZONE_GREEN');
    const detailResponse = await request(app).get('/api/vault/vault-1');
    const missingResponse = await request(app).get('/api/vault/missing');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toMatchObject({ success: true, data: [vaultItem] });
    expect(vaultServiceMock.getAllVaultItems).toHaveBeenCalledWith('ZONE_GREEN');
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({ id: 'vault-1' });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error.code).toBe('NOT_FOUND');
  });

  it('validates creation, updates existing items, and returns 404 for missing updates', async () => {
    const invalidResponse = await request(app).post('/api/vault').send({ fileName: 'missing-category.md' });
    const createResponse = await request(app).post('/api/vault').send({
      category: 'MEMORY',
      fileName: 'decision.md',
      content: 'keep this memory',
    });
    const updateResponse = await request(app).patch('/api/vault/vault-1').send({ content: 'updated' });
    const missingUpdateResponse = await request(app).patch('/api/vault/missing').send({ content: 'updated' });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({ id: 'vault-1' });
    expect(vaultServiceMock.createVaultItem).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'MEMORY', fileName: 'decision.md' }),
      { broadcastDataChange },
    );
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.content).toBe('updated');
    expect(missingUpdateResponse.status).toBe(404);
  });

  it('deletes vault items and searches by semantic tags or intent', async () => {
    const deleteResponse = await request(app).delete('/api/vault/vault-1');
    const missingDeleteResponse = await request(app).delete('/api/vault/missing');
    const missingTagResponse = await request(app).get('/api/vault/search/semantic');
    const semanticResponse = await request(app).get('/api/vault/search/semantic?tag=decision');
    const missingIntentResponse = await request(app).get('/api/vault/search/intent');
    const intentResponse = await request(app).get('/api/vault/search/intent?q=remember%20decision');

    expect(deleteResponse.status).toBe(204);
    expect(missingDeleteResponse.status).toBe(404);
    expect(missingTagResponse.status).toBe(400);
    expect(semanticResponse.status).toBe(200);
    expect(semanticResponse.body.data).toHaveLength(1);
    expect(vaultServiceMock.searchVaultBySemanticTag).toHaveBeenCalledWith('decision');
    expect(missingIntentResponse.status).toBe(400);
    expect(intentResponse.status).toBe(200);
    expect(vaultServiceMock.searchVaultByIntent).toHaveBeenCalledWith('remember decision');
  });

  it('validates and performs permanent shredding', async () => {
    const missingBodyResponse = await request(app).post('/api/shred').send({ targetId: 'vault-1' });
    const invalidTableResponse = await request(app).post('/api/shred').send({ targetId: 'vault-1', table: 'task' });
    const successResponse = await request(app).post('/api/shred').send({ targetId: 'vault-1', table: 'vault' });

    expect(missingBodyResponse.status).toBe(400);
    expect(invalidTableResponse.status).toBe(400);
    expect(successResponse.status).toBe(200);
    expect(successResponse.body).toMatchObject({ success: true, data: { success: true, message: 'shredded' } });
    expect(vaultServiceMock.permanentShred).toHaveBeenCalledWith(
      'vault-1',
      'vault',
      expect.objectContaining({ userRole: 'MASTER' }),
    );

    vaultServiceMock.permanentShred.mockResolvedValueOnce({ success: false, message: 'not found' });
    const notFoundResponse = await request(app).post('/api/shred').send({ targetId: 'missing', table: 'vault' });

    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.body.error.code).toBe('NOT_FOUND');
  });

  it('maps vault service failures to route-specific error codes', async () => {
    vaultServiceMock.getAllVaultItems.mockRejectedValueOnce(new Error('vault list failed'));
    vaultServiceMock.searchVaultBySemanticTag.mockRejectedValueOnce(new Error('semantic search failed'));
    vaultServiceMock.deleteVaultItem.mockRejectedValueOnce(new Error('delete failed'));
    vaultServiceMock.permanentShred.mockRejectedValueOnce(new Error('shred failed'));

    const listResponse = await request(app).get('/api/vault');
    const searchResponse = await request(app).get('/api/vault/search/semantic?tag=decision');
    const deleteResponse = await request(app).delete('/api/vault/vault-1');
    const shredResponse = await request(app).post('/api/shred').send({ targetId: 'vault-1', table: 'vault' });

    expect(listResponse.status).toBe(500);
    expect(listResponse.body.error.code).toBe('FETCH_ERROR');
    expect(searchResponse.status).toBe(500);
    expect(searchResponse.body.error.code).toBe('SEARCH_ERROR');
    expect(deleteResponse.status).toBe(500);
    expect(deleteResponse.body.error.code).toBe('DELETE_ERROR');
    expect(shredResponse.status).toBe(500);
    expect(shredResponse.body.error.code).toBe('SHRED_ERROR');
  });

  it('lists and creates memories through the memory endpoints', async () => {
    const memoriesResponse = await request(app).get('/api/memories');
    const shadowResponse = await request(app).get('/api/shadow-memory');
    const invalidCreateResponse = await request(app).post('/api/memories').send({ context: 'missing choice' });
    const createResponse = await request(app).post('/api/memories').send({
      context: 'meeting decision',
      choiceMade: 'follow up tomorrow',
      field: 'business',
    });

    expect(memoriesResponse.status).toBe(200);
    expect(memoriesResponse.body.data).toEqual([memory]);
    expect(shadowResponse.status).toBe(200);
    expect(shadowResponse.body.data).toEqual([memory]);
    expect(invalidCreateResponse.status).toBe(400);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).toMatchObject({ id: 'memory-1' });
    expect(memoryServiceMock.createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'meeting decision',
        choiceMade: 'follow up tomorrow',
        field: 'business',
      }),
    );
  });

  it('maps memory service failures to current HTTP error contracts', async () => {
    memoryServiceMock.getAllMemories.mockRejectedValueOnce(new Error('memories unavailable'));
    memoryServiceMock.getAllMemories.mockRejectedValueOnce(new Error('shadow unavailable'));
    memoryServiceMock.createMemory.mockRejectedValueOnce(new Error('create unavailable'));

    const memoriesResponse = await request(app).get('/api/memories');
    const shadowResponse = await request(app).get('/api/shadow-memory');
    const createResponse = await request(app).post('/api/memories').send({
      context: 'meeting decision',
      choiceMade: 'follow up tomorrow',
    });

    expect(memoriesResponse.status).toBe(500);
    expect(memoriesResponse.body.error.code).toBe('FETCH_ERROR');
    expect(shadowResponse.status).toBe(500);
    expect(shadowResponse.body.error.code).toBe('FETCH_ERROR');
    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.code).toBe('VALIDATION_ERROR');
  });
});

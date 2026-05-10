import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const cozeApiMock = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateFromSettings: vi.fn(),
  getWorkflows: vi.fn(),
  getWorkflowsByCategory: vi.fn(),
  getWorkflow: vi.fn(),
  callWorkflow: vi.fn(),
  smartCall: vi.fn(),
  formatDocument: vi.fn(),
  polishContent: vi.fn(),
  translate: vi.fn(),
  summarize: vi.fn(),
  generatePPTContent: vi.fn(),
  generateBusinessReport: vi.fn(),
  intelligentQA: vi.fn(),
  chat: vi.fn(),
  batchProcess: vi.fn(),
}));

vi.mock('../../server/lib/coze-api', () => ({
  cozeAPI: cozeApiMock,
  WorkflowDefinition: {},
}));

import cozeRouter from '../../server/routes/coze';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/coze', cozeRouter);
  return app;
}

const workflow = {
  id: 'wf-doc-format',
  name: 'Document Format',
  category: 'document',
};

describe('Coze API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cozeApiMock.getConfig.mockReturnValue({ configured: true, hasWorkflows: true });
    cozeApiMock.getWorkflows.mockReturnValue([workflow]);
    cozeApiMock.getWorkflowsByCategory.mockReturnValue([workflow]);
    cozeApiMock.getWorkflow.mockImplementation((id: string) => (id === workflow.id ? workflow : undefined));
    cozeApiMock.callWorkflow.mockResolvedValue({ success: true, output: 'workflow-output' });
    cozeApiMock.smartCall.mockResolvedValue({ success: true, result: 'smart-result' });
    cozeApiMock.formatDocument.mockResolvedValue({ success: true, content: 'formatted' });
    cozeApiMock.polishContent.mockResolvedValue({ success: true, content: 'polished' });
    cozeApiMock.translate.mockResolvedValue({ success: true, content: 'translated' });
    cozeApiMock.summarize.mockResolvedValue({ success: true, content: 'summary' });
    cozeApiMock.generatePPTContent.mockResolvedValue({ success: true, slides: [] });
    cozeApiMock.generateBusinessReport.mockResolvedValue({ success: true, report: 'report' });
    cozeApiMock.intelligentQA.mockResolvedValue({ success: true, answer: 'answer' });
    cozeApiMock.chat.mockResolvedValue({ success: true, message: 'reply' });
    cozeApiMock.batchProcess.mockResolvedValue([{ success: true }]);
  });

  it('returns and updates Coze configuration state', async () => {
    const statusResponse = await request(app).get('/api/coze/status');
    const configResponse = await request(app).get('/api/coze/config');
    const updateResponse = await request(app).post('/api/coze/config').send({ cozeApiKey: 'pat-test' });
    const fieldsResponse = await request(app).get('/api/coze/config/fields');

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toMatchObject({ success: true, configured: true, workflowsConfigured: true });
    expect(configResponse.status).toBe(200);
    expect(configResponse.body.configured).toBe(true);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(cozeApiMock.updateFromSettings).toHaveBeenCalledWith({ cozeApiKey: 'pat-test' });
    expect(fieldsResponse.status).toBe(200);
    expect(fieldsResponse.body.fields).toHaveProperty('cozeApiKey');
  });

  it('lists workflows, filters by category, and returns 404 for missing workflow detail', async () => {
    const listResponse = await request(app).get('/api/coze/workflows');
    const filteredResponse = await request(app).get('/api/coze/workflows?category=document');
    const detailResponse = await request(app).get('/api/coze/workflows/wf-doc-format');
    const missingResponse = await request(app).get('/api/coze/workflows/missing');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.total).toBe(1);
    expect(cozeApiMock.getWorkflows).toHaveBeenCalledOnce();
    expect(filteredResponse.status).toBe(200);
    expect(cozeApiMock.getWorkflowsByCategory).toHaveBeenCalledWith('document');
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({ id: 'wf-doc-format' });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.success).toBe(false);
  });

  it('validates and runs workflows and smart calls', async () => {
    const invalidWorkflowResponse = await request(app).post('/api/coze/workflows/run').send({ workflowId: 'wf-doc-format' });
    const workflowResponse = await request(app).post('/api/coze/workflows/run').send({
      workflowId: 'wf-doc-format',
      input: { content: 'hello' },
    });
    const invalidSmartResponse = await request(app).post('/api/coze/smart').send({});
    const smartResponse = await request(app).post('/api/coze/smart').send({
      content: 'make this better',
      context: { type: 'doc' },
    });

    expect(invalidWorkflowResponse.status).toBe(400);
    expect(workflowResponse.status).toBe(200);
    expect(workflowResponse.body).toMatchObject({ success: true, output: 'workflow-output' });
    expect(cozeApiMock.callWorkflow).toHaveBeenCalledWith('wf-doc-format', { content: 'hello' });
    expect(invalidSmartResponse.status).toBe(400);
    expect(smartResponse.status).toBe(200);
    expect(cozeApiMock.smartCall).toHaveBeenCalledWith('make this better', { type: 'doc' });
  });

  it('validates and dispatches document helper endpoints', async () => {
    const invalidResponse = await request(app).post('/api/coze/document/format').send({});
    const formatResponse = await request(app).post('/api/coze/document/format').send({ content: 'raw' });
    const polishResponse = await request(app).post('/api/coze/document/polish').send({ content: 'draft', style: 'formal' });
    const translateResponse = await request(app).post('/api/coze/document/translate').send({ content: 'hello', targetLang: 'English' });
    const summarizeResponse = await request(app).post('/api/coze/document/summarize').send({ content: 'long text', maxLength: 100 });

    expect(invalidResponse.status).toBe(400);
    expect(formatResponse.body).toMatchObject({ success: true, content: 'formatted' });
    expect(polishResponse.body).toMatchObject({ success: true, content: 'polished' });
    expect(translateResponse.body).toMatchObject({ success: true, content: 'translated' });
    expect(summarizeResponse.body).toMatchObject({ success: true, content: 'summary' });
    expect(cozeApiMock.polishContent).toHaveBeenCalledWith('draft', 'formal');
    expect(cozeApiMock.translate).toHaveBeenCalledWith('hello', 'English');
    expect(cozeApiMock.summarize).toHaveBeenCalledWith('long text', 100);
  });

  it('uses the route default target language when translation target is omitted', async () => {
    const response = await request(app)
      .post('/api/coze/document/translate')
      .send({ content: 'hello' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, content: 'translated' });
    expect(cozeApiMock.translate).toHaveBeenCalledWith('hello', expect.any(String));
  });

  it('validates PPT, report, QA, chat, and batch processing endpoints', async () => {
    const invalidPptResponse = await request(app).post('/api/coze/ppt/generate').send({});
    const pptResponse = await request(app).post('/api/coze/ppt/generate').send({ topic: 'Roadmap', slides: 5, audience: 'team' });
    const invalidReportResponse = await request(app).post('/api/coze/report/generate').send({ type: 'weekly', data: {} });
    const reportResponse = await request(app).post('/api/coze/report/generate').send({ type: 'monthly', data: { revenue: 1 }, period: '2026-04' });
    const invalidQaResponse = await request(app).post('/api/coze/qa').send({});
    const qaResponse = await request(app).post('/api/coze/qa').send({ question: 'What changed?', category: 'release' });
    const invalidChatResponse = await request(app).post('/api/coze/chat').send({});
    const chatResponse = await request(app).post('/api/coze/chat').send({ message: 'hello' });
    const invalidBatchResponse = await request(app).post('/api/coze/batch').send({ items: [] });
    const batchResponse = await request(app).post('/api/coze/batch').send({ items: [{ content: 'a' }] });

    expect(invalidPptResponse.status).toBe(400);
    expect(pptResponse.body.success).toBe(true);
    expect(cozeApiMock.generatePPTContent).toHaveBeenCalledWith('Roadmap', 5, 'team');
    expect(invalidReportResponse.status).toBe(400);
    expect(reportResponse.body.success).toBe(true);
    expect(cozeApiMock.generateBusinessReport).toHaveBeenCalledWith('monthly', { revenue: 1 }, '2026-04');
    expect(invalidQaResponse.status).toBe(400);
    expect(qaResponse.body.answer).toBe('answer');
    expect(invalidChatResponse.status).toBe(400);
    expect(chatResponse.body.message).toBe('reply');
    expect(invalidBatchResponse.status).toBe(400);
    expect(batchResponse.body).toMatchObject({ success: true, results: [{ success: true }] });
  });

  it('maps Coze service failures to 500 responses', async () => {
    cozeApiMock.callWorkflow.mockRejectedValueOnce(new Error('coze workflow offline'));
    cozeApiMock.batchProcess.mockRejectedValueOnce(new Error('coze batch offline'));

    const workflowResponse = await request(app).post('/api/coze/workflows/run').send({
      workflowId: 'wf-doc-format',
      input: { content: 'hello' },
    });
    const batchResponse = await request(app).post('/api/coze/batch').send({
      items: [{ content: 'a' }],
    });

    expect(workflowResponse.status).toBe(500);
    expect(workflowResponse.body.success).toBe(false);
    expect(workflowResponse.body.error).toContain('coze workflow offline');
    expect(batchResponse.status).toBe(500);
    expect(batchResponse.body.success).toBe(false);
    expect(batchResponse.body.error).toContain('coze batch offline');
  });
});

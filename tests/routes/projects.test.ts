import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const projectServiceMock = vi.hoisted(() => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  updateProjectStatus: vi.fn(),
  getProjectNotes: vi.fn(),
  createProjectNote: vi.fn(),
  deleteProjectNote: vi.fn(),
  getProjectFiles: vi.fn(),
  createProjectFile: vi.fn(),
  updateProjectFile: vi.fn(),
  deleteProjectFile: vi.fn(),
}));

const projectEngineServiceMock = vi.hoisted(() => ({
  decomposeProject: vi.fn(),
  createProjectFromDecomposition: vi.fn(),
  getProjectProgress: vi.fn(),
  getProgressAlerts: vi.fn(),
  getMilestones: vi.fn(),
  getTasks: vi.fn(),
  updateTaskStatus: vi.fn(),
  getRisks: vi.fn(),
  addRisk: vi.fn(),
  resolveRisk: vi.fn(),
  getProjectLogs: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  requireAuth: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  requireMaster: vi.fn((req: Request, res: Response, next: NextFunction) => {
    if ((req as any).userRole !== 'MASTER') {
      res.status(403).json({ error: 'MASTER required' });
      return;
    }
    next();
  }),
}));

vi.mock('../../server/services/ProjectService', () => ({
  projectService: projectServiceMock,
}));

vi.mock('../../server/services/project-engine', () => ({
  projectEngineService: projectEngineServiceMock,
}));

vi.mock('../../server/middleware/auth', () => authMock);

vi.mock('../../server/routes/projects/ai-helpers', () => ({
  analyzeFileWithAI: vi.fn().mockResolvedValue('AI analysis'),
  generateProjectInsights: vi.fn().mockResolvedValue([{ type: 'info', title: 'Insight' }]),
}));

import { registerProjectRoutes } from '../../server/routes/projects';

function createTestApp(role: 'MASTER' | 'GUEST' = 'MASTER'): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).userRole = role;
    next();
  });
  registerProjectRoutes(app, {} as any, {} as any);
  return app;
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    title: 'R1 launch',
    status: 'IN_PROGRESS',
    category: 'BUSINESS',
    priority: 1,
    updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-04-01T00:00:00Z',
    description: 'Ship R1',
    ...overrides,
  };
}

describe('Project API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    projectServiceMock.getProjects.mockResolvedValue([
      project(),
      project({ id: 'project-2', title: 'Review queue', status: 'PENDING_REVIEW', priority: 5 }),
    ]);
    projectServiceMock.getProject.mockResolvedValue(project());
    projectServiceMock.createProject.mockResolvedValue(project({ id: 'project-new', title: 'New Project' }));
    projectServiceMock.updateProject.mockResolvedValue(project({ title: 'Updated' }));
    projectServiceMock.updateProjectStatus.mockResolvedValue(project({ status: 'COMPLETED' }));
    projectServiceMock.getProjectNotes.mockResolvedValue([{ id: 'note-1', content: 'note' }]);
    projectServiceMock.createProjectNote.mockResolvedValue({ id: 'note-2', content: 'new note' });
    projectServiceMock.deleteProjectNote.mockResolvedValue(true);
    projectServiceMock.getProjectFiles.mockResolvedValue([
      { id: 'file-1', fileName: 'brief.txt', fileContent: 'hello' },
    ]);
    projectServiceMock.createProjectFile.mockResolvedValue({ id: 'file-2', fileName: 'brief.txt' });
    projectServiceMock.updateProjectFile.mockResolvedValue({ id: 'file-1', aiAnalysis: 'AI analysis' });
    projectServiceMock.deleteProjectFile.mockResolvedValue(true);
    projectEngineServiceMock.decomposeProject.mockResolvedValue({ title: 'Decomposed' });
    projectEngineServiceMock.createProjectFromDecomposition.mockResolvedValue({ id: 'project-from-decomp' });
    projectEngineServiceMock.getProjectProgress.mockResolvedValue({ percent: 60 });
    projectEngineServiceMock.getProgressAlerts.mockResolvedValue([{ id: 'alert-1' }]);
    projectEngineServiceMock.getMilestones.mockResolvedValue([{ id: 'milestone-1' }]);
    projectEngineServiceMock.getTasks.mockResolvedValue([{ id: 'task-1' }]);
    projectEngineServiceMock.updateTaskStatus.mockResolvedValue({ id: 'task-1', status: 'DONE' });
    projectEngineServiceMock.getRisks.mockResolvedValue([{ id: 'risk-1' }]);
    projectEngineServiceMock.addRisk.mockResolvedValue({ id: 'risk-2' });
    projectEngineServiceMock.resolveRisk.mockResolvedValue({ id: 'risk-1', resolved: true });
    projectEngineServiceMock.getProjectLogs.mockResolvedValue([{ id: 'log-1' }]);
  });

  it('returns dashboard summaries, AI insights, and risk alerts', async () => {
    const summary = await request(app).get('/api/projects/dashboard/summary');
    const insights = await request(app).get('/api/projects/dashboard/ai-insights');
    const alerts = await request(app).get('/api/projects/dashboard/risk-alerts');

    expect(summary.body).toMatchObject({
      total: 2,
      statusBreakdown: { IN_PROGRESS: 1, PENDING_REVIEW: 1 },
      alerts: { critical: 1, pending: 1 },
    });
    expect(insights.body).toMatchObject({ projectCount: 2, insights: [{ type: 'info', title: 'Insight' }] });
    expect(alerts.body.totalAlerts).toBeGreaterThanOrEqual(2);
    expect(alerts.body.criticalCount).toBe(1);
  });

  it('manages project CRUD and status updates with master protection', async () => {
    const list = await request(app).get('/api/projects');
    const detail = await request(app).get('/api/projects/project-1');
    const create = await request(app).post('/api/projects').send({ title: 'New Project' });
    const update = await request(app).put('/api/projects/project-1').send({ title: 'Updated' });
    const missingStatus = await request(app).patch('/api/projects/project-1/status').send({});
    const status = await request(app).patch('/api/projects/project-1/status').send({ status: 'COMPLETED' });

    projectServiceMock.getProject.mockResolvedValueOnce(undefined);
    projectServiceMock.updateProject.mockResolvedValueOnce(undefined);
    projectServiceMock.updateProjectStatus.mockResolvedValueOnce(undefined);
    const missingDetail = await request(app).get('/api/projects/missing');
    const missingUpdate = await request(app).put('/api/projects/missing').send({ title: 'x' });
    const missingStatusTarget = await request(app).patch('/api/projects/missing/status').send({ status: 'DONE' });

    const guestApp = createTestApp('GUEST');
    const guestCreate = await request(guestApp).post('/api/projects').send({ title: 'Nope' });

    expect(list.body).toHaveLength(2);
    expect(detail.body).toMatchObject({ id: 'project-1' });
    expect(create.status).toBe(201);
    expect(update.body.title).toBe('Updated');
    expect(missingStatus.status).toBe(400);
    expect(status.body.status).toBe('COMPLETED');
    expect(missingDetail.status).toBe(404);
    expect(missingUpdate.status).toBe(404);
    expect(missingStatusTarget.status).toBe(404);
    expect(guestCreate.status).toBe(403);
  });

  it('manages project notes and files, including AI file analysis', async () => {
    const notes = await request(app).get('/api/projects/project-1/notes');
    const invalidNote = await request(app).post('/api/projects/project-1/notes').send({});
    const createNote = await request(app).post('/api/projects/project-1/notes').send({ content: 'new note' });
    const deleteNote = await request(app).delete('/api/projects/project-1/notes/note-1');
    const files = await request(app).get('/api/projects/project-1/files');
    const invalidFile = await request(app).post('/api/projects/project-1/files').send({ fileName: 'brief.txt' });
    const createFile = await request(app)
      .post('/api/projects/project-1/files')
      .send({ fileName: 'brief.txt', content: 'hello' });
    const analyze = await request(app).post('/api/projects/project-1/files/file-1/analyze').send({});
    const deleteFile = await request(app).delete('/api/projects/project-1/files/file-1');

    projectServiceMock.deleteProjectNote.mockResolvedValueOnce(false);
    projectServiceMock.getProjectFiles.mockResolvedValueOnce([]);
    projectServiceMock.deleteProjectFile.mockResolvedValueOnce(false);
    const missingNote = await request(app).delete('/api/projects/project-1/notes/missing-note');
    const missingAnalyze = await request(app).post('/api/projects/project-1/files/missing-file/analyze').send({});
    const missingFileDelete = await request(app).delete('/api/projects/project-1/files/missing-file');

    expect(notes.body).toEqual([{ id: 'note-1', content: 'note' }]);
    expect(invalidNote.status).toBe(400);
    expect(createNote.status).toBe(201);
    expect(deleteNote.body).toEqual({ success: true });
    expect(files.body[0]).toMatchObject({ id: 'file-1' });
    expect(invalidFile.status).toBe(400);
    expect(createFile.status).toBe(201);
    expect(analyze.body).toMatchObject({ success: true, analysis: 'AI analysis' });
    expect(deleteFile.body).toEqual({ success: true });
    expect(missingNote.status).toBe(404);
    expect(missingAnalyze.status).toBe(404);
    expect(missingFileDelete.status).toBe(404);
  });

  it('handles project engine decomposition, progress, task, risk, and log routes', async () => {
    const invalidDecompose = await request(app).post('/api/projects/decompose').send({ description: 'short' });
    const decompose = await request(app)
      .post('/api/projects/decompose')
      .send({ description: 'This project should be decomposed', category: 'SOFTWARE' });
    const missingCreate = await request(app).post('/api/projects/create-from-decomposition').send({});
    const createFromDecomp = await request(app)
      .post('/api/projects/create-from-decomposition')
      .send({ decomposition: { title: 'Plan' } });
    const progress = await request(app).get('/api/projects/project-1/progress');
    const alerts = await request(app).get('/api/projects/project-1/alerts');
    const milestones = await request(app).get('/api/projects/project-1/milestones');
    const tasks = await request(app).get('/api/projects/project-1/tasks?milestoneId=milestone-1');
    const allTasks = await request(app).get('/api/projects/project-1/tasks');
    const missingTaskStatus = await request(app).patch('/api/projects/project-1/tasks/task-1/status').send({});
    const taskStatus = await request(app).patch('/api/projects/project-1/tasks/task-1/status').send({ status: 'DONE' });
    const risks = await request(app).get('/api/projects/project-1/risks');
    const addRisk = await request(app).post('/api/projects/project-1/risks').send({ title: 'Risk' });
    const resolveRisk = await request(app).patch('/api/projects/project-1/risks/risk-1/resolve').send({ resolutionNotes: 'done' });
    const logs = await request(app).get('/api/projects/project-1/logs?limit=5');

    projectEngineServiceMock.updateTaskStatus.mockResolvedValueOnce(undefined);
    projectEngineServiceMock.resolveRisk.mockResolvedValueOnce(undefined);
    const missingTask = await request(app).patch('/api/projects/project-1/tasks/missing/status').send({ status: 'DONE' });
    const missingRisk = await request(app).patch('/api/projects/project-1/risks/missing/resolve').send({});

    expect(invalidDecompose.status).toBe(400);
    expect(decompose.body).toEqual({ success: true, decomposition: { title: 'Decomposed' } });
    expect(projectEngineServiceMock.decomposeProject).toHaveBeenCalledWith('This project should be decomposed', 'SOFTWARE');
    expect(missingCreate.status).toBe(400);
    expect(createFromDecomp.status).toBe(201);
    expect(progress.body).toEqual({ percent: 60 });
    expect(alerts.body.alerts).toEqual([{ id: 'alert-1' }]);
    expect(milestones.body.milestones).toEqual([{ id: 'milestone-1' }]);
    expect(tasks.body.tasks).toEqual([{ id: 'task-1' }]);
    expect(projectEngineServiceMock.getTasks).toHaveBeenCalledWith('project-1', 'milestone-1');
    expect(allTasks.body.tasks).toEqual([{ id: 'task-1' }]);
    expect(projectEngineServiceMock.getTasks).toHaveBeenCalledWith('project-1', undefined);
    expect(missingTaskStatus.status).toBe(400);
    expect(taskStatus.body.task).toEqual({ id: 'task-1', status: 'DONE' });
    expect(risks.body.risks).toEqual([{ id: 'risk-1' }]);
    expect(addRisk.status).toBe(201);
    expect(resolveRisk.body.risk).toEqual({ id: 'risk-1', resolved: true });
    expect(logs.body.logs).toEqual([{ id: 'log-1' }]);
    expect(projectEngineServiceMock.getProjectLogs).toHaveBeenCalledWith('project-1', 5);
    expect(missingTask.status).toBe(404);
    expect(missingRisk.status).toBe(404);
  });

  it('returns 400 for SWOT generation and smart-create when AI is not configured', async () => {
    const swot = await request(app).post('/api/projects/project-1/generate-swot').send({});
    const smartInvalid = await request(app).post('/api/projects/smart-create').send({});
    const smartMissingKey = await request(app).post('/api/projects/smart-create').send({ input: 'Create a project' });

    projectServiceMock.getProject.mockResolvedValueOnce(undefined);
    const missingSwotProject = await request(app).post('/api/projects/missing/generate-swot').send({});

    expect(swot.status).toBe(400);
    expect(smartInvalid.status).toBe(400);
    expect(smartMissingKey.status).toBe(400);
    expect(missingSwotProject.status).toBe(404);
  });

  it('maps representative CRUD, note, and file service failures to 500 responses', async () => {
    projectServiceMock.getProjects.mockRejectedValueOnce(new Error('projects unavailable'));
    const listResponse = await request(app).get('/api/projects');

    projectServiceMock.getProject.mockRejectedValueOnce(new Error('project unavailable'));
    const detailResponse = await request(app).get('/api/projects/project-1');

    projectServiceMock.createProject.mockRejectedValueOnce(new Error('create unavailable'));
    const createResponse = await request(app).post('/api/projects').send({ title: 'New Project' });

    projectServiceMock.updateProject.mockRejectedValueOnce(new Error('update unavailable'));
    const updateResponse = await request(app).put('/api/projects/project-1').send({ title: 'Updated' });

    projectServiceMock.updateProjectStatus.mockRejectedValueOnce(new Error('status unavailable'));
    const statusResponse = await request(app).patch('/api/projects/project-1/status').send({ status: 'DONE' });

    projectServiceMock.getProjectNotes.mockRejectedValueOnce(new Error('notes unavailable'));
    const notesResponse = await request(app).get('/api/projects/project-1/notes');

    projectServiceMock.createProjectFile.mockRejectedValueOnce(new Error('file create unavailable'));
    const fileResponse = await request(app)
      .post('/api/projects/project-1/files')
      .send({ fileName: 'brief.txt', content: 'hello' });

    expect(listResponse.status).toBe(500);
    expect(listResponse.body).toEqual({ error: 'Failed to fetch projects' });
    expect(detailResponse.status).toBe(500);
    expect(detailResponse.body).toEqual({ error: 'Failed to fetch project' });
    expect(createResponse.status).toBe(500);
    expect(createResponse.body).toEqual({ error: 'Failed to create project' });
    expect(updateResponse.status).toBe(500);
    expect(updateResponse.body).toEqual({ error: 'Failed to update project' });
    expect(statusResponse.status).toBe(500);
    expect(statusResponse.body).toEqual({ error: 'Failed to update project status' });
    expect(notesResponse.status).toBe(500);
    expect(notesResponse.body).toEqual({ error: 'Failed to fetch notes' });
    expect(fileResponse.status).toBe(500);
    expect(fileResponse.body).toEqual({ error: 'Failed to create file' });
  });

  it('maps representative project engine failures to 500 responses and uses default log limits', async () => {
    projectEngineServiceMock.decomposeProject.mockRejectedValueOnce(new Error('decompose unavailable'));
    const decomposeResponse = await request(app)
      .post('/api/projects/decompose')
      .send({ description: 'This project should be decomposed', category: 'BUSINESS' });

    projectEngineServiceMock.getProjectProgress.mockRejectedValueOnce(new Error('progress unavailable'));
    const progressResponse = await request(app).get('/api/projects/project-1/progress');

    projectEngineServiceMock.updateTaskStatus.mockRejectedValueOnce(new Error('task unavailable'));
    const taskResponse = await request(app).patch('/api/projects/project-1/tasks/task-1/status').send({ status: 'DONE' });

    projectEngineServiceMock.addRisk.mockRejectedValueOnce(new Error('risk unavailable'));
    const addRiskResponse = await request(app).post('/api/projects/project-1/risks').send({ title: 'Risk' });

    projectEngineServiceMock.resolveRisk.mockRejectedValueOnce(new Error('resolve unavailable'));
    const resolveRiskResponse = await request(app).patch('/api/projects/project-1/risks/risk-1/resolve').send({});

    const logsResponse = await request(app).get('/api/projects/project-1/logs');

    expect(decomposeResponse.status).toBe(500);
    expect(decomposeResponse.body).toEqual({ error: '项目拆解失败' });
    expect(progressResponse.status).toBe(500);
    expect(progressResponse.body).toEqual({ error: '获取进度失败' });
    expect(taskResponse.status).toBe(500);
    expect(taskResponse.body).toEqual({ error: '更新任务失败' });
    expect(addRiskResponse.status).toBe(500);
    expect(addRiskResponse.body).toEqual({ error: '添加风险失败' });
    expect(resolveRiskResponse.status).toBe(500);
    expect(resolveRiskResponse.body).toEqual({ error: '解决风险失败' });
    expect(logsResponse.status).toBe(200);
    expect(projectEngineServiceMock.getProjectLogs).toHaveBeenCalledWith('project-1', 50);
  });
});

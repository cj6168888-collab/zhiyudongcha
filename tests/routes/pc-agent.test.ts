import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const pcAgentMock = vi.hoisted(() => ({
  executeTask: vi.fn(),
  getCapabilities: vi.fn(),
}));

const fileOrganizerServiceMock = vi.hoisted(() => ({
  scanDirectory: vi.fn(),
  findGovernmentFiles: vi.fn(),
  findProjectFiles: vi.fn(),
  organizeDesktop: vi.fn(),
  getFileStats: vi.fn(),
}));

const officeAutomationServiceMock = vi.hoisted(() => ({
  getTemplates: vi.fn(),
  generateDocument: vi.fn(),
  formatDocument: vi.fn(),
  generatePPT: vi.fn(),
  openDocument: vi.fn(),
}));

const systemOperationServiceMock = vi.hoisted(() => ({
  getSystemInfo: vi.fn(),
  getProcessList: vi.fn(),
  killProcess: vi.fn(),
  getNetworkInfo: vi.fn(),
  testConnection: vi.fn(),
  getInstalledSoftware: vi.fn(),
  installSoftware: vi.fn(),
  uninstallSoftware: vi.fn(),
  cleanTempFiles: vi.fn(),
  cleanBrowserCache: vi.fn(),
  getOptimizationSuggestions: vi.fn(),
  openSettings: vi.fn(),
  runCommand: vi.fn(),
}));

const programmingAssistantServiceMock = vi.hoisted(() => ({
  openFile: vi.fn(),
  openProject: vi.fn(),
  openTerminal: vi.fn(),
  createCodeFile: vi.fn(),
  readProjectStructure: vi.fn(),
  searchCodeFiles: vi.fn(),
  readCodeFile: vi.fn(),
  getGitStatus: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock('../../server/services/pc-agent/PCAgent', () => ({
  pcAgent: pcAgentMock,
}));

vi.mock('../../server/services/pc-agent/FileOrganizerService', () => ({
  fileOrganizerService: fileOrganizerServiceMock,
}));

vi.mock('../../server/services/pc-agent/OfficeAutomationService', () => ({
  officeAutomationService: officeAutomationServiceMock,
}));

vi.mock('../../server/services/pc-agent/SystemOperationService', () => ({
  systemOperationService: systemOperationServiceMock,
}));

vi.mock('../../server/services/pc-agent/ProgrammingAssistantService', () => ({
  programmingAssistantService: programmingAssistantServiceMock,
}));

import pcAgentRouter from '../../server/routes/pc-agent';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/pc-agent', pcAgentRouter);
  return app;
}

describe('PC Agent API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fileOrganizerServiceMock.scanDirectory.mockResolvedValue([{ path: 'D:/work/a.docx' }]);
    fileOrganizerServiceMock.findGovernmentFiles.mockResolvedValue([{ path: 'D:/work/gov.docx' }]);
    fileOrganizerServiceMock.findProjectFiles.mockResolvedValue([{ path: 'D:/work/project.md' }]);
    fileOrganizerServiceMock.organizeDesktop.mockResolvedValue({ success: true, moved: 2 });
    fileOrganizerServiceMock.getFileStats.mockResolvedValue({ totalFiles: 3 });
    officeAutomationServiceMock.getTemplates.mockReturnValue([{ id: 'tpl-1', name: 'Report' }]);
    officeAutomationServiceMock.generateDocument.mockResolvedValue({ success: true, outputPath: 'D:/out/report.md' });
    officeAutomationServiceMock.formatDocument.mockResolvedValue({ success: true });
    officeAutomationServiceMock.generatePPT.mockResolvedValue({ success: true, outputPath: 'D:/out/deck.pptx' });
    officeAutomationServiceMock.openDocument.mockResolvedValue(true);
    systemOperationServiceMock.getSystemInfo.mockReturnValue({ platform: 'win32' });
    systemOperationServiceMock.getProcessList.mockResolvedValue([{ pid: 123, name: 'node.exe' }]);
    systemOperationServiceMock.killProcess.mockResolvedValue(true);
    systemOperationServiceMock.getNetworkInfo.mockResolvedValue({ adapters: [] });
    systemOperationServiceMock.testConnection.mockResolvedValue({ reachable: true });
    systemOperationServiceMock.getInstalledSoftware.mockResolvedValue([{ name: 'VS Code' }]);
    systemOperationServiceMock.installSoftware.mockResolvedValue({ success: true, message: 'installed' });
    systemOperationServiceMock.uninstallSoftware.mockResolvedValue({ success: true, message: 'removed' });
    systemOperationServiceMock.cleanTempFiles.mockResolvedValue({ removed: 4 });
    systemOperationServiceMock.cleanBrowserCache.mockResolvedValue({ removed: 5 });
    systemOperationServiceMock.getOptimizationSuggestions.mockReturnValue([{ id: 'cleanup' }]);
    systemOperationServiceMock.openSettings.mockResolvedValue(true);
    systemOperationServiceMock.runCommand.mockResolvedValue({ success: true, stdout: 'ok' });
    programmingAssistantServiceMock.openFile.mockResolvedValue(true);
    programmingAssistantServiceMock.openProject.mockResolvedValue(true);
    programmingAssistantServiceMock.openTerminal.mockResolvedValue(true);
    programmingAssistantServiceMock.createCodeFile.mockResolvedValue(true);
    programmingAssistantServiceMock.readProjectStructure.mockResolvedValue({ files: ['src/index.ts'] });
    programmingAssistantServiceMock.searchCodeFiles.mockResolvedValue([{ path: 'src/index.ts' }]);
    programmingAssistantServiceMock.readCodeFile.mockResolvedValue({ content: 'export {};' });
    programmingAssistantServiceMock.getGitStatus.mockResolvedValue({ branch: 'main' });
    programmingAssistantServiceMock.createProject.mockResolvedValue({ success: true, path: 'D:/work/app' });
    pcAgentMock.executeTask.mockResolvedValue({ success: true, taskId: 'pc-task-1' });
    pcAgentMock.getCapabilities.mockReturnValue([{ type: 'files' }]);
  });

  it('validates and forwards file organization requests', async () => {
    const invalidScan = await request(app).post('/api/pc-agent/files/scan').send({ recursive: true });
    const scanResponse = await request(app)
      .post('/api/pc-agent/files/scan')
      .send({ path: 'D:/work', recursive: true });
    const governmentResponse = await request(app)
      .post('/api/pc-agent/files/government')
      .send({ path: 'D:/work' });
    const projectResponse = await request(app)
      .post('/api/pc-agent/files/project')
      .send({ path: 'D:/work', name: 'R1', keywords: ['report'] });
    const organizeResponse = await request(app)
      .post('/api/pc-agent/files/organize')
      .send({ action: 'copy', dryRun: true });
    const statsResponse = await request(app).post('/api/pc-agent/files/stats').send({ path: 'D:/work' });

    expect(invalidScan.status).toBe(400);
    expect(scanResponse.status).toBe(200);
    expect(scanResponse.body.total).toBe(1);
    expect(fileOrganizerServiceMock.scanDirectory).toHaveBeenCalledWith('D:/work', true);
    expect(governmentResponse.status).toBe(200);
    expect(governmentResponse.body.total).toBe(1);
    expect(fileOrganizerServiceMock.findGovernmentFiles).toHaveBeenCalledWith('D:/work');
    expect(projectResponse.status).toBe(200);
    expect(fileOrganizerServiceMock.findProjectFiles).toHaveBeenCalledWith('D:/work', 'R1', ['report']);
    expect(organizeResponse.body.data).toMatchObject({ success: true, moved: 2 });
    expect(statsResponse.body.data).toEqual({ totalFiles: 3 });
  });

  it('validates document automation requests and applies route defaults', async () => {
    const templatesResponse = await request(app).get('/api/pc-agent/documents/templates');
    const invalidGenerate = await request(app).post('/api/pc-agent/documents/generate').send({ title: 'Missing variables' });
    const generateResponse = await request(app)
      .post('/api/pc-agent/documents/generate')
      .send({ title: 'Report', variables: { name: 'Ada' } });
    const formatResponse = await request(app)
      .post('/api/pc-agent/documents/format')
      .send({ filePath: 'D:/out/report.md' });
    const pptResponse = await request(app)
      .post('/api/pc-agent/documents/ppt')
      .send({ title: 'Deck', slides: [{ title: 'One' }] });
    const openResponse = await request(app).post('/api/pc-agent/documents/open').send({ filePath: 'D:/out/report.md' });

    expect(templatesResponse.body.data[0]).toMatchObject({ id: 'tpl-1' });
    expect(invalidGenerate.status).toBe(400);
    expect(generateResponse.status).toBe(200);
    expect(officeAutomationServiceMock.generateDocument).toHaveBeenCalledWith({
      templateId: undefined,
      title: 'Report',
      variables: { name: 'Ada' },
      format: 'md',
      style: 'formal',
    });
    expect(formatResponse.body.success).toBe(true);
    expect(officeAutomationServiceMock.formatDocument).toHaveBeenCalledWith('D:/out/report.md', {});
    expect(pptResponse.body.data).toMatchObject({ outputPath: 'D:/out/deck.pptx' });
    expect(openResponse.body.success).toBe(true);
  });

  it('validates system operations and forwards harmless status requests', async () => {
    const infoResponse = await request(app).get('/api/pc-agent/system/info');
    const invalidKill = await request(app).post('/api/pc-agent/system/processes/kill').send({ pid: 0 });
    const killResponse = await request(app).post('/api/pc-agent/system/processes/kill').send({ pid: 123 });
    const networkResponse = await request(app).post('/api/pc-agent/system/network/test').send({ host: 'localhost' });
    const softwareResponse = await request(app).get('/api/pc-agent/system/software');
    const commandResponse = await request(app).post('/api/pc-agent/system/command').send({ command: 'echo ok' });

    expect(infoResponse.body.data).toEqual({ platform: 'win32' });
    expect(invalidKill.status).toBe(400);
    expect(killResponse.body.success).toBe(true);
    expect(systemOperationServiceMock.killProcess).toHaveBeenCalledWith(123);
    expect(networkResponse.body.data).toEqual({ reachable: true });
    expect(systemOperationServiceMock.testConnection).toHaveBeenCalledWith('localhost', 80);
    expect(softwareResponse.body.total).toBe(1);
    expect(commandResponse.body.data).toMatchObject({ stdout: 'ok' });
  });

  it('forwards software, cleanup, optimization, and settings operations', async () => {
    const installResponse = await request(app)
      .post('/api/pc-agent/system/software/install')
      .send({ path: 'D:/downloads/tool.exe' });
    const uninstallResponse = await request(app)
      .post('/api/pc-agent/system/software/uninstall')
      .send({ name: 'Old Tool' });
    const tempCleanResponse = await request(app).post('/api/pc-agent/system/clean/temp').send({});
    const cacheCleanResponse = await request(app).post('/api/pc-agent/system/clean/cache').send({});
    const suggestionsResponse = await request(app).get('/api/pc-agent/system/optimize/suggestions');
    const settingsResponse = await request(app)
      .post('/api/pc-agent/system/settings/open')
      .send({ category: 'privacy' });

    expect(installResponse.body).toMatchObject({ success: true, message: 'installed' });
    expect(systemOperationServiceMock.installSoftware).toHaveBeenCalledWith('D:/downloads/tool.exe');
    expect(uninstallResponse.body).toMatchObject({ success: true, message: 'removed' });
    expect(systemOperationServiceMock.uninstallSoftware).toHaveBeenCalledWith('Old Tool');
    expect(tempCleanResponse.body.data).toEqual({ removed: 4 });
    expect(cacheCleanResponse.body.data).toEqual({ removed: 5 });
    expect(suggestionsResponse.body.data).toEqual([{ id: 'cleanup' }]);
    expect(settingsResponse.body.success).toBe(true);
    expect(systemOperationServiceMock.openSettings).toHaveBeenCalledWith('privacy');
  });

  it('validates programming assistant requests and returns 404 for missing code files', async () => {
    const invalidOpen = await request(app).post('/api/pc-agent/code/open').send({ filePath: 'D:/work/app.ts', line: 0 });
    const openResponse = await request(app).post('/api/pc-agent/code/open').send({ filePath: 'D:/work/app.ts', line: 10 });
    const structureResponse = await request(app).post('/api/pc-agent/code/project/structure').send({ path: 'D:/work' });
    const searchResponse = await request(app)
      .post('/api/pc-agent/code/search')
      .send({ projectPath: 'D:/work', keyword: 'router', extensions: ['.ts'] });
    const projectResponse = await request(app).post('/api/pc-agent/code/project').send({ path: 'D:/work' });
    const terminalResponse = await request(app).post('/api/pc-agent/code/terminal').send({ cwd: 'D:/work' });
    const createFileResponse = await request(app)
      .post('/api/pc-agent/code/create')
      .send({ filePath: 'D:/work/src/new.ts', language: 'typescript', template: 'module' });

    programmingAssistantServiceMock.readCodeFile.mockResolvedValueOnce(null);
    const missingReadResponse = await request(app).post('/api/pc-agent/code/read').send({ filePath: 'missing.ts' });

    const readResponse = await request(app).post('/api/pc-agent/code/read').send({ filePath: 'src/index.ts' });
    const gitStatusResponse = await request(app)
      .post('/api/pc-agent/code/git/status')
      .send({ projectPath: 'D:/work' });
    const createProjectResponse = await request(app)
      .post('/api/pc-agent/code/project/create')
      .send({ name: 'demo', language: 'ts', framework: 'express', location: 'D:/work' });

    expect(invalidOpen.status).toBe(400);
    expect(openResponse.body.success).toBe(true);
    expect(programmingAssistantServiceMock.openFile).toHaveBeenCalledWith('D:/work/app.ts', 10);
    expect(structureResponse.body.data.files).toEqual(['src/index.ts']);
    expect(searchResponse.body.total).toBe(1);
    expect(projectResponse.body.success).toBe(true);
    expect(programmingAssistantServiceMock.openProject).toHaveBeenCalledWith('D:/work');
    expect(terminalResponse.body.success).toBe(true);
    expect(programmingAssistantServiceMock.openTerminal).toHaveBeenCalledWith('D:/work');
    expect(createFileResponse.body.success).toBe(true);
    expect(programmingAssistantServiceMock.createCodeFile).toHaveBeenCalledWith(
      'D:/work/src/new.ts',
      'typescript',
      'module',
    );
    expect(missingReadResponse.status).toBe(404);
    expect(readResponse.body.data).toEqual({ content: 'export {};' });
    expect(gitStatusResponse.body.data).toEqual({ branch: 'main' });
    expect(programmingAssistantServiceMock.getGitStatus).toHaveBeenCalledWith('D:/work');
    expect(createProjectResponse.body.data).toMatchObject({ path: 'D:/work/app' });
  });

  it('validates unified task execution and returns capabilities', async () => {
    const invalidExecute = await request(app).post('/api/pc-agent/execute').send({ type: 'file' });
    const executeResponse = await request(app)
      .post('/api/pc-agent/execute')
      .send({ type: 'file', description: 'scan files', params: { path: 'D:/work' }, priority: 3 });
    const capabilitiesResponse = await request(app).get('/api/pc-agent/capabilities');

    expect(invalidExecute.status).toBe(400);
    expect(executeResponse.status).toBe(200);
    expect(pcAgentMock.executeTask).toHaveBeenCalledWith({
      type: 'file',
      description: 'scan files',
      params: { path: 'D:/work' },
      priority: 3,
    });
    expect(capabilitiesResponse.body.data).toEqual([{ type: 'files' }]);
  });

  it('maps representative service failures to 500 responses', async () => {
    fileOrganizerServiceMock.scanDirectory.mockRejectedValueOnce(new Error('scan unavailable'));
    const scanResponse = await request(app).post('/api/pc-agent/files/scan').send({ path: 'D:/work' });

    officeAutomationServiceMock.getTemplates.mockImplementationOnce(() => {
      throw new Error('templates unavailable');
    });
    const templatesResponse = await request(app).get('/api/pc-agent/documents/templates');

    systemOperationServiceMock.getSystemInfo.mockImplementationOnce(() => {
      throw new Error('system unavailable');
    });
    const infoResponse = await request(app).get('/api/pc-agent/system/info');

    programmingAssistantServiceMock.openFile.mockRejectedValueOnce(new Error('editor unavailable'));
    const openFileResponse = await request(app).post('/api/pc-agent/code/open').send({ filePath: 'D:/work/app.ts' });

    pcAgentMock.executeTask.mockRejectedValueOnce(new Error('agent unavailable'));
    const executeResponse = await request(app)
      .post('/api/pc-agent/execute')
      .send({ type: 'file', description: 'scan files' });

    pcAgentMock.getCapabilities.mockImplementationOnce(() => {
      throw new Error('capabilities unavailable');
    });
    const capabilitiesResponse = await request(app).get('/api/pc-agent/capabilities');

    expect(scanResponse.status).toBe(500);
    expect(scanResponse.body.success).toBe(false);
    expect(templatesResponse.status).toBe(500);
    expect(templatesResponse.body.success).toBe(false);
    expect(infoResponse.status).toBe(500);
    expect(infoResponse.body.success).toBe(false);
    expect(openFileResponse.status).toBe(500);
    expect(openFileResponse.body.success).toBe(false);
    expect(executeResponse.status).toBe(500);
    expect(executeResponse.body.success).toBe(false);
    expect(capabilitiesResponse.status).toBe(500);
    expect(capabilitiesResponse.body.success).toBe(false);
  });
});

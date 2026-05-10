import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const crossDeviceAssistantMock = vi.hoisted(() => ({
  processRequest: vi.fn(),
  sendWeChatMessage: vi.fn(),
  executeDesktopAction: vi.fn(),
  openDesktopApp: vi.fn(),
  makePhoneCall: vi.fn(),
  navigate: vi.fn(),
  getDeviceSummary: vi.fn(),
}));

const cloudHubMock = vi.hoisted(() => ({
  getAllDevices: vi.fn(),
  getDevice: vi.fn(),
  getDeviceCapabilityDescription: vi.fn(),
  sendToDevice: vi.fn(),
  getAllCapabilitiesDescription: vi.fn(),
  updateDevicePrograms: vi.fn(),
  updateDeviceStatus: vi.fn(),
  updateDeviceResources: vi.fn(),
}));

const deviceRegistryMock = vi.hoisted(() => ({
  createDevice: vi.fn(),
  registerDevice: vi.fn(),
  parsePrograms: vi.fn(),
}));

const crossDeviceRouterMock = vi.hoisted(() => ({
  planTask: vi.fn(),
  executeTask: vi.fn(),
}));

vi.mock('../../server/services/assistant/CrossDeviceAssistant', () => ({
  crossDeviceAssistant: crossDeviceAssistantMock,
}));

vi.mock('../../server/services/cloud/CloudHub', () => ({
  cloudHub: cloudHubMock,
}));

vi.mock('../../server/services/device/DeviceRegistry', () => ({
  deviceRegistry: deviceRegistryMock,
}));

vi.mock('../../server/services/device/CrossDeviceRouter', () => ({
  crossDeviceRouter: crossDeviceRouterMock,
}));

import crossDeviceRouter from '../../server/routes/cross-device';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: 'user-1' };
    next();
  });
  app.use('/api/cross-device', crossDeviceRouter);
  return app;
}

function createAnonymousTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/cross-device', crossDeviceRouter);
  return app;
}

function createDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'device-1',
    name: 'Work PC',
    type: 'desktop',
    status: 'online',
    metadata: { owner: 'user-1' },
    capabilities: {
      execution: { canExecuteCommand: true, canControlOther: false },
      output: { screen: true },
      input: { camera: false },
    },
    programs: [
      {
        id: 'program-1',
        name: 'VS Code',
        category: 'work',
        description: 'Code editor',
        actions: [{ id: 'open', name: 'Open', description: 'Open app' }],
      },
    ],
    ...overrides,
  };
}

describe('Cross Device API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cloudHubMock.getAllDevices.mockReturnValue([
      createDevice(),
      createDevice({ id: 'device-2', name: 'Other Phone', metadata: { owner: 'user-2' } }),
    ]);
    cloudHubMock.getDevice.mockReturnValue(undefined);
    cloudHubMock.getDeviceCapabilityDescription.mockReturnValue('desktop capabilities');
    cloudHubMock.sendToDevice.mockReturnValue(true);
    cloudHubMock.getAllCapabilitiesDescription.mockReturnValue('all capabilities');
    crossDeviceAssistantMock.processRequest.mockResolvedValue({ text: 'done' });
    crossDeviceAssistantMock.sendWeChatMessage.mockResolvedValue({ success: true, id: 'wechat-1' });
    crossDeviceAssistantMock.executeDesktopAction.mockResolvedValue({ success: true });
    crossDeviceAssistantMock.openDesktopApp.mockResolvedValue({ success: true });
    crossDeviceAssistantMock.makePhoneCall.mockResolvedValue({ success: true });
    crossDeviceAssistantMock.navigate.mockResolvedValue({ success: true });
    crossDeviceAssistantMock.getDeviceSummary.mockReturnValue({ online: 1 });
    crossDeviceRouterMock.planTask.mockResolvedValue({ id: 'plan-1', steps: [] });
    crossDeviceRouterMock.executeTask.mockResolvedValue({ success: true, taskId: 'task-1' });
    deviceRegistryMock.createDevice.mockReturnValue(createDevice({ id: 'registered-1' }));
    deviceRegistryMock.parsePrograms.mockReturnValue([{ id: 'parsed-1', name: 'Parsed App' }]);
  });

  it('validates chat input and only passes the current user devices to the assistant', async () => {
    const invalidResponse = await request(app).post('/api/cross-device/chat').send({});

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(crossDeviceAssistantMock.processRequest).not.toHaveBeenCalled();

    const validResponse = await request(app).post('/api/cross-device/chat').send({ message: 'open vscode' });

    expect(validResponse.status).toBe(200);
    expect(validResponse.body).toMatchObject({ success: true, response: { text: 'done' } });
    expect(crossDeviceAssistantMock.processRequest).toHaveBeenCalledWith(
      'open vscode',
      expect.objectContaining({
        userId: 'user-1',
        devices: [expect.objectContaining({ id: 'device-1' })],
      }),
    );
  });

  it('falls back to the default user when no authenticated user is attached', async () => {
    const anonymousApp = createAnonymousTestApp();
    cloudHubMock.getAllDevices.mockReturnValueOnce([
      createDevice({ id: 'default-device', metadata: { owner: 'default' } }),
      createDevice({ id: 'user-device', metadata: { owner: 'user-1' } }),
    ]);

    const response = await request(anonymousApp).post('/api/cross-device/chat').send({ message: 'open notes' });

    expect(response.status).toBe(200);
    expect(crossDeviceAssistantMock.processRequest).toHaveBeenCalledWith(
      'open notes',
      expect.objectContaining({
        userId: 'default',
        devices: [expect.objectContaining({ id: 'default-device' })],
      }),
    );
  });

  it('lists device summaries and returns detail/program resources with 404s for missing devices', async () => {
    const device = createDevice();
    cloudHubMock.getDevice.mockReturnValueOnce(device).mockReturnValueOnce(device).mockReturnValueOnce(undefined);

    const listResponse = await request(app).get('/api/cross-device/devices');
    const detailResponse = await request(app).get('/api/cross-device/devices/device-1');
    const programsResponse = await request(app).get('/api/cross-device/devices/device-1/programs');
    const missingResponse = await request(app).get('/api/cross-device/devices/missing-device');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.devices).toHaveLength(1);
    expect(listResponse.body.devices[0]).toMatchObject({
      id: 'device-1',
      programsCount: 1,
      capabilities: { canExecuteCommand: true, hasScreen: true },
    });
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.programsDescription).toBe('desktop capabilities');
    expect(programsResponse.status).toBe(200);
    expect(programsResponse.body.programs[0]).toMatchObject({ id: 'program-1', actions: [{ id: 'open' }] });
    expect(missingResponse.status).toBe(404);
  });

  it('validates direct execution and maps offline delivery to a client error', async () => {
    const invalidResponse = await request(app).post('/api/cross-device/execute').send({ deviceId: 'device-1' });
    expect(invalidResponse.status).toBe(400);

    cloudHubMock.sendToDevice.mockReturnValueOnce(false);
    const offlineResponse = await request(app)
      .post('/api/cross-device/execute')
      .send({ deviceId: 'device-1', action: 'open', params: { app: 'vscode' } });

    expect(offlineResponse.status).toBe(400);
    expect(offlineResponse.body.success).toBe(false);

    const successResponse = await request(app)
      .post('/api/cross-device/execute')
      .send({ deviceId: 'device-1', action: 'open', params: { app: 'vscode' } });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.success).toBe(true);
    expect(cloudHubMock.sendToDevice).toHaveBeenLastCalledWith('device-1', {
      type: 'action:execute',
      action: 'open',
      parameters: { app: 'vscode' },
    });
  });

  it('validates assistant tool helpers and forwards successful tool requests', async () => {
    const missingWechatDevice = await request(app).post('/api/cross-device/tools/wechat').send({ contact: 'Ada' });
    const missingAppName = await request(app).post('/api/cross-device/tools/open-app').send({});
    const missingCallParams = await request(app).post('/api/cross-device/tools/call').send({ deviceId: 'phone-1' });

    expect(missingWechatDevice.status).toBe(400);
    expect(missingAppName.status).toBe(400);
    expect(missingCallParams.status).toBe(400);

    const wechatResponse = await request(app)
      .post('/api/cross-device/tools/wechat')
      .send({ deviceId: 'phone-1', contact: 'Ada', message: 'hello' });
    const desktopResponse = await request(app)
      .post('/api/cross-device/tools/desktop')
      .send({ action: 'screenshot', params: { full: true } });
    const navigateResponse = await request(app)
      .post('/api/cross-device/tools/navigate')
      .send({ deviceId: 'phone-1', destination: 'office' });

    expect(wechatResponse.status).toBe(200);
    expect(desktopResponse.status).toBe(200);
    expect(navigateResponse.status).toBe(200);
    expect(crossDeviceAssistantMock.sendWeChatMessage).toHaveBeenCalledWith('Ada', 'hello', 'phone-1');
    expect(crossDeviceAssistantMock.executeDesktopAction).toHaveBeenCalledWith('screenshot', { full: true });
    expect(crossDeviceAssistantMock.navigate).toHaveBeenCalledWith('office', 'phone-1');
  });

  it('forwards open-app and phone call helper requests', async () => {
    const openAppResponse = await request(app)
      .post('/api/cross-device/tools/open-app')
      .send({ appName: 'VS Code' });
    const callResponse = await request(app)
      .post('/api/cross-device/tools/call')
      .send({ deviceId: 'phone-1', phoneNumber: '+15551234567' });

    expect(openAppResponse.status).toBe(200);
    expect(openAppResponse.body.success).toBe(true);
    expect(callResponse.status).toBe(200);
    expect(callResponse.body.success).toBe(true);
    expect(crossDeviceAssistantMock.openDesktopApp).toHaveBeenCalledWith('VS Code');
    expect(crossDeviceAssistantMock.makePhoneCall).toHaveBeenCalledWith('+15551234567', 'phone-1');
  });

  it('validates planning requests and returns cross-device summaries/capabilities', async () => {
    const invalidPlan = await request(app).post('/api/cross-device/plan').send({});
    const invalidExecutePlan = await request(app).post('/api/cross-device/execute-plan').send({});

    expect(invalidPlan.status).toBe(400);
    expect(invalidExecutePlan.status).toBe(400);

    const planResponse = await request(app).post('/api/cross-device/plan').send({ description: 'prepare report' });
    const executePlanResponse = await request(app)
      .post('/api/cross-device/execute-plan')
      .send({ plan: { id: 'plan-1' } });
    const summaryResponse = await request(app).get('/api/cross-device/summary');
    const programsResponse = await request(app).get('/api/cross-device/programs');

    expect(planResponse.status).toBe(200);
    expect(planResponse.body.plan).toMatchObject({ id: 'plan-1' });
    expect(crossDeviceRouterMock.planTask).toHaveBeenCalledWith({ description: 'prepare report', userId: 'user-1' });
    expect(executePlanResponse.status).toBe(200);
    expect(executePlanResponse.body.success).toBe(true);
    expect(summaryResponse.body.summary).toEqual({ online: 1 });
    expect(programsResponse.body.capabilities).toBe('all capabilities');
  });

  it('registers devices and accepts heartbeat/program updates from device agents', async () => {
    const registerResponse = await request(app).post('/api/cross-device/device/register').send({
      name: 'Desk Agent',
      type: 'desktop',
      owner: 'user-1',
      os: 'Windows',
      programs: [{ name: 'VS Code' }],
    });
    const heartbeatResponse = await request(app)
      .post('/api/cross-device/device/heartbeat')
      .send({ deviceId: 'registered-1', resources: { cpu: 12 } });
    const invalidProgramsResponse = await request(app).post('/api/cross-device/device/programs').send({ deviceId: '' });
    const programsResponse = await request(app)
      .post('/api/cross-device/device/programs')
      .send({ deviceId: 'registered-1', programs: [{ name: 'VS Code' }] });

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.deviceId).toBe('registered-1');
    expect(deviceRegistryMock.registerDevice).toHaveBeenCalledWith(expect.objectContaining({ id: 'registered-1' }));
    expect(cloudHubMock.updateDevicePrograms).toHaveBeenCalledWith('registered-1', [{ id: 'parsed-1', name: 'Parsed App' }]);
    expect(cloudHubMock.updateDeviceStatus).toHaveBeenCalledWith('registered-1', 'online');
    expect(heartbeatResponse.status).toBe(200);
    expect(cloudHubMock.updateDeviceResources).toHaveBeenCalledWith('registered-1', { cpu: 12 });
    expect(invalidProgramsResponse.status).toBe(400);
    expect(programsResponse.status).toBe(200);
    expect(programsResponse.body.count).toBe(1);
  });

  it('registers devices without program payloads without parsing programs', async () => {
    const registerResponse = await request(app).post('/api/cross-device/device/register').send({
      name: 'Phone Agent',
      type: 'phone',
      owner: 'user-1',
      os: 'Android',
      capabilities: { execution: { canExecuteCommand: false } },
    });

    expect(registerResponse.status).toBe(200);
    expect(registerResponse.body.deviceId).toBe('registered-1');
    expect(deviceRegistryMock.registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'registered-1',
        capabilities: { execution: { canExecuteCommand: false } },
      }),
    );
    expect(deviceRegistryMock.parsePrograms).not.toHaveBeenCalled();
    expect(cloudHubMock.updateDevicePrograms).not.toHaveBeenCalled();
    expect(cloudHubMock.updateDeviceStatus).toHaveBeenCalledWith('registered-1', 'online');
  });

  it('maps representative service failures to 500 responses', async () => {
    crossDeviceAssistantMock.processRequest.mockRejectedValueOnce(new Error('assistant unavailable'));
    const chatResponse = await request(app).post('/api/cross-device/chat').send({ message: 'open vscode' });

    cloudHubMock.sendToDevice.mockImplementationOnce(() => {
      throw new Error('hub unavailable');
    });
    const executeResponse = await request(app)
      .post('/api/cross-device/execute')
      .send({ deviceId: 'device-1', action: 'open' });

    crossDeviceAssistantMock.openDesktopApp.mockRejectedValueOnce(new Error('desktop unavailable'));
    const openAppResponse = await request(app)
      .post('/api/cross-device/tools/open-app')
      .send({ appName: 'VS Code' });

    crossDeviceRouterMock.planTask.mockRejectedValueOnce(new Error('planner unavailable'));
    const planResponse = await request(app).post('/api/cross-device/plan').send({ description: 'prepare report' });

    deviceRegistryMock.createDevice.mockImplementationOnce(() => {
      throw new Error('registry unavailable');
    });
    const registerResponse = await request(app).post('/api/cross-device/device/register').send({
      name: 'Desk Agent',
      type: 'desktop',
      owner: 'user-1',
    });

    cloudHubMock.updateDevicePrograms.mockImplementationOnce(() => {
      throw new Error('program update unavailable');
    });
    const programsResponse = await request(app)
      .post('/api/cross-device/device/programs')
      .send({ deviceId: 'registered-1', programs: [{ name: 'VS Code' }] });

    expect(chatResponse.status).toBe(500);
    expect(chatResponse.body.success).toBe(false);
    expect(executeResponse.status).toBe(500);
    expect(executeResponse.body.success).toBe(false);
    expect(openAppResponse.status).toBe(500);
    expect(openAppResponse.body.success).toBe(false);
    expect(planResponse.status).toBe(500);
    expect(planResponse.body.success).toBe(false);
    expect(registerResponse.status).toBe(500);
    expect(registerResponse.body.success).toBe(false);
    expect(programsResponse.status).toBe(500);
    expect(programsResponse.body.success).toBe(false);
  });
});

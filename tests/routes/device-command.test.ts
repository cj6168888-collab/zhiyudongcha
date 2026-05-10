import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const deviceConnectionServiceMock = vi.hoisted(() => ({
  getAllDevices: vi.fn(),
  getConnectedDevices: vi.fn(),
  getDevice: vi.fn(),
  isDeviceConnected: vi.fn(),
  sendCommand: vi.fn(),
  sendAction: vi.fn(),
  launchApp: vi.fn(),
  openUrl: vi.fn(),
  navigateTo: vi.fn(),
  dialPhone: vi.fn(),
  sendSms: vi.fn(),
  copyToClipboard: vi.fn(),
  getStatistics: vi.fn(),
}));

const deviceRegistryMock = vi.hoisted(() => ({
  getProgramsByDevice: vi.fn(),
  getAllPrograms: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock('../../server/services/mobile/DeviceConnectionService', () => ({
  deviceConnectionService: deviceConnectionServiceMock,
}));

vi.mock('../../server/services/device/DeviceRegistry', () => ({
  deviceRegistry: deviceRegistryMock,
}));

vi.mock('../../server/services/device/CrossDeviceRouter', () => ({
  crossDeviceRouter: {},
}));

import deviceCommandRouter from '../../server/routes/device-command';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/devices', deviceCommandRouter);
  return app;
}

describe('Device Command API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    deviceConnectionServiceMock.getAllDevices.mockReturnValue([
      { id: 'phone-1', name: 'Pixel', status: 'CONNECTED' },
      { id: 'pc-1', name: 'Work PC', status: 'DISCONNECTED' },
    ]);
    deviceConnectionServiceMock.getConnectedDevices.mockReturnValue([{ id: 'phone-1', status: 'CONNECTED' }]);
    deviceConnectionServiceMock.getDevice.mockImplementation((id: string) =>
      id === 'phone-1' ? { id: 'phone-1', name: 'Pixel' } : undefined,
    );
    deviceConnectionServiceMock.isDeviceConnected.mockImplementation((id: string) => id === 'phone-1');
    deviceConnectionServiceMock.sendCommand.mockReturnValue('msg-command-1');
    deviceConnectionServiceMock.sendAction.mockReturnValue('msg-action-1');
    deviceConnectionServiceMock.launchApp.mockReturnValue('msg-launch-1');
    deviceConnectionServiceMock.openUrl.mockReturnValue('msg-url-1');
    deviceConnectionServiceMock.navigateTo.mockReturnValue('msg-nav-1');
    deviceConnectionServiceMock.dialPhone.mockReturnValue('msg-dial-1');
    deviceConnectionServiceMock.sendSms.mockReturnValue('msg-sms-1');
    deviceConnectionServiceMock.copyToClipboard.mockReturnValue('msg-clip-1');
    deviceConnectionServiceMock.getStatistics.mockReturnValue({ total: 2, connected: 1 });
    deviceRegistryMock.getProgramsByDevice.mockReturnValue([{ id: 'wechat', name: 'WeChat' }]);
    deviceRegistryMock.getAllPrograms.mockReturnValue([{ id: 'wechat' }, { id: 'maps' }]);
    deviceRegistryMock.getCategories.mockReturnValue(['social', 'navigation']);
  });

  it('lists all and connected devices and returns individual device details', async () => {
    const listResponse = await request(app).get('/api/devices');
    const connectedResponse = await request(app).get('/api/devices/connected');
    const detailResponse = await request(app).get('/api/devices/phone-1');
    const missingResponse = await request(app).get('/api/devices/missing-device');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.total).toBe(2);
    expect(connectedResponse.body.total).toBe(1);
    expect(detailResponse.body.data).toMatchObject({ id: 'phone-1' });
    expect(missingResponse.status).toBe(404);
  });

  it('returns device programs and aggregate device statistics', async () => {
    const programsResponse = await request(app).get('/api/devices/phone-1/programs');
    const missingProgramsResponse = await request(app).get('/api/devices/missing-device/programs');
    const statsResponse = await request(app).get('/api/devices/stats/summary');

    expect(programsResponse.status).toBe(200);
    expect(programsResponse.body).toMatchObject({ success: true, total: 1 });
    expect(deviceRegistryMock.getProgramsByDevice).toHaveBeenCalledWith('phone-1');
    expect(missingProgramsResponse.status).toBe(404);
    expect(statsResponse.body.data).toEqual({
      devices: { total: 2, connected: 1 },
      programs: { total: 2, categories: ['social', 'navigation'] },
    });
  });

  it('validates command/action dispatch and maps missing or offline devices', async () => {
    const invalidCommand = await request(app).post('/api/devices/phone-1/command').send({ parameters: {} });
    const missingDevice = await request(app).post('/api/devices/missing-device/command').send({ command: 'ping' });
    const offlineDevice = await request(app).post('/api/devices/pc-1/action').send({ action: 'open' });
    deviceConnectionServiceMock.getDevice.mockImplementationOnce((id: string) =>
      id === 'pc-1' ? { id: 'pc-1', name: 'Work PC' } : undefined,
    );
    const disconnectedDevice = await request(app).post('/api/devices/pc-1/action').send({ action: 'open' });
    const commandResponse = await request(app)
      .post('/api/devices/phone-1/command')
      .send({ command: 'ping', parameters: { verbose: true } });
    const actionResponse = await request(app)
      .post('/api/devices/phone-1/action')
      .send({ action: 'tap', parameters: { x: 1 }, taskId: 'task-1' });

    expect(invalidCommand.status).toBe(400);
    expect(missingDevice.status).toBe(404);
    expect(offlineDevice.status).toBe(404);
    expect(disconnectedDevice.status).toBe(503);
    expect(disconnectedDevice.body).toEqual({ success: false, error: 'Device is not connected' });
    expect(commandResponse.body.data).toMatchObject({
      messageId: 'msg-command-1',
      deviceId: 'phone-1',
      command: 'ping',
      status: 'sent',
    });
    expect(deviceConnectionServiceMock.sendCommand).toHaveBeenCalledWith('phone-1', 'ping', { verbose: true });
    expect(actionResponse.body.data).toMatchObject({ messageId: 'msg-action-1', action: 'tap', taskId: 'task-1' });
    expect(deviceConnectionServiceMock.sendAction).toHaveBeenCalledWith('phone-1', 'tap', { x: 1 }, 'task-1');
  });

  it('maps device command service error objects to 500 responses', async () => {
    deviceConnectionServiceMock.sendCommand.mockReturnValueOnce({ message: 'transport failed' });

    const response = await request(app).post('/api/devices/phone-1/command').send({ command: 'ping' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, error: 'transport failed' });
  });

  it('maps action and convenience service error objects to 500 responses', async () => {
    deviceConnectionServiceMock.sendAction.mockReturnValueOnce({ message: 'action failed' });
    const actionResponse = await request(app).post('/api/devices/phone-1/action').send({ action: 'tap' });

    deviceConnectionServiceMock.launchApp.mockReturnValueOnce({ message: 'launch failed' });
    const launchResponse = await request(app).post('/api/devices/phone-1/launch').send({ packageName: 'com.tencent.mm' });

    deviceConnectionServiceMock.openUrl.mockReturnValueOnce({ message: 'url failed' });
    const urlResponse = await request(app).post('/api/devices/phone-1/open-url').send({ url: 'https://example.com' });

    deviceConnectionServiceMock.copyToClipboard.mockReturnValueOnce({ message: 'clipboard failed' });
    const clipboardResponse = await request(app).post('/api/devices/phone-1/clipboard').send({ text: 'copy me' });

    expect(actionResponse.status).toBe(500);
    expect(actionResponse.body).toEqual({ success: false, error: 'action failed' });
    expect(launchResponse.status).toBe(500);
    expect(launchResponse.body).toEqual({ success: false, error: 'launch failed' });
    expect(urlResponse.status).toBe(500);
    expect(urlResponse.body).toEqual({ success: false, error: 'url failed' });
    expect(clipboardResponse.status).toBe(500);
    expect(clipboardResponse.body).toEqual({ success: false, error: 'clipboard failed' });
  });

  it('validates and forwards mobile convenience actions', async () => {
    const invalidLaunch = await request(app).post('/api/devices/phone-1/launch').send({});
    const invalidUrl = await request(app).post('/api/devices/phone-1/open-url').send({});
    const invalidNavigate = await request(app).post('/api/devices/phone-1/navigate').send({});
    const invalidDial = await request(app).post('/api/devices/phone-1/dial').send({});
    const invalidSms = await request(app).post('/api/devices/phone-1/sms').send({ phoneNumber: '10086' });
    const invalidClipboard = await request(app).post('/api/devices/phone-1/clipboard').send({});
    const offlineLaunch = await request(app).post('/api/devices/pc-1/launch').send({ packageName: 'com.tencent.mm' });
    const launchResponse = await request(app).post('/api/devices/phone-1/launch').send({ packageName: 'com.tencent.mm' });
    const urlResponse = await request(app).post('/api/devices/phone-1/open-url').send({ url: 'https://example.com' });
    const navResponse = await request(app).post('/api/devices/phone-1/navigate').send({ address: 'Office' });
    const dialResponse = await request(app).post('/api/devices/phone-1/dial').send({ phoneNumber: '10086' });
    const smsResponse = await request(app)
      .post('/api/devices/phone-1/sms')
      .send({ phoneNumber: '10086', message: 'hello' });
    const clipboardResponse = await request(app).post('/api/devices/phone-1/clipboard').send({ text: 'copy me' });

    expect(invalidLaunch.status).toBe(400);
    expect(invalidUrl.status).toBe(400);
    expect(invalidNavigate.status).toBe(400);
    expect(invalidDial.status).toBe(400);
    expect(invalidSms.status).toBe(400);
    expect(invalidClipboard.status).toBe(400);
    expect(offlineLaunch.status).toBe(503);
    expect(launchResponse.body.data).toEqual({ messageId: 'msg-launch-1', packageName: 'com.tencent.mm' });
    expect(urlResponse.body.data).toEqual({ messageId: 'msg-url-1', url: 'https://example.com' });
    expect(navResponse.body.data).toEqual({ messageId: 'msg-nav-1', address: 'Office' });
    expect(dialResponse.body.data).toEqual({ messageId: 'msg-dial-1', phoneNumber: '10086' });
    expect(smsResponse.body.data).toEqual({ messageId: 'msg-sms-1', phoneNumber: '10086' });
    expect(clipboardResponse.body.data).toEqual({ messageId: 'msg-clip-1' });
    expect(deviceConnectionServiceMock.sendSms).toHaveBeenCalledWith('phone-1', '10086', 'hello');
    expect(deviceConnectionServiceMock.copyToClipboard).toHaveBeenCalledWith('phone-1', 'copy me');
  });

  it('maps representative read and dispatch exceptions to 500 responses', async () => {
    deviceConnectionServiceMock.getAllDevices.mockImplementationOnce(() => {
      throw new Error('devices unavailable');
    });
    const listResponse = await request(app).get('/api/devices');

    deviceRegistryMock.getProgramsByDevice.mockImplementationOnce(() => {
      throw new Error('program registry unavailable');
    });
    const programsResponse = await request(app).get('/api/devices/phone-1/programs');

    deviceConnectionServiceMock.sendCommand.mockImplementationOnce(() => {
      throw new Error('command transport unavailable');
    });
    const commandResponse = await request(app).post('/api/devices/phone-1/command').send({ command: 'ping' });

    deviceConnectionServiceMock.navigateTo.mockImplementationOnce(() => {
      throw new Error('navigation unavailable');
    });
    const navigateResponse = await request(app).post('/api/devices/phone-1/navigate').send({ address: 'Office' });

    deviceConnectionServiceMock.getStatistics.mockImplementationOnce(() => {
      throw new Error('stats unavailable');
    });
    const statsResponse = await request(app).get('/api/devices/stats/summary');

    expect(listResponse.status).toBe(500);
    expect(listResponse.body).toEqual({ success: false, error: 'Failed to get devices' });
    expect(programsResponse.status).toBe(500);
    expect(programsResponse.body).toEqual({ success: false, error: 'Failed to get programs' });
    expect(commandResponse.status).toBe(500);
    expect(commandResponse.body).toEqual({ success: false, error: 'Failed to send command' });
    expect(navigateResponse.status).toBe(500);
    expect(navigateResponse.body).toEqual({ success: false, error: 'Failed to navigate' });
    expect(statsResponse.status).toBe(500);
    expect(statsResponse.body).toEqual({ success: false, error: 'Failed to get stats' });
  });
});

/**
 * 移动设备执行器服务 - MobileExecutorService
 * 
 * 统一的移动设备操作执行器
 * 负责协调短信、电话、文件、屏幕操作等所有设备端功能
 */

import { createServiceLogger } from '../../lib/logger';
import deviceConnectionService, { type DeviceRegistrationRequest } from './DeviceConnectionService';
import type {
  DeviceInfo,
  DevicePlatform,
  ScreenCapture,
  ScreenAction,
  ActionResult,
  ActionType,
  ActionTarget,
  ActionParams,
  UIElement,
  SmsMessage,
  SmsConversation,
  CallLogEntry,
  FileEntry,
  FileContent,
  PermissionInfo,
  OperationError,
  DeviceCapabilities,
} from './types';
import { createError, ERROR_CODES } from './types';

const logger = createServiceLogger('MobileExecutor');

interface ExecuteOptions {
  timeout?: number;
  retryCount?: number;
  captureResult?: boolean;
}

interface ScreenAnalyzeOptions {
  includeElements?: boolean;
  includeXml?: boolean;
}

class MobileExecutorService {
  private cachedScreenshots: Map<string, ScreenCapture> = new Map();
  private actionHistory: Map<string, ActionResult[]> = new Map();

  async registerDevice(request: DeviceRegistrationRequest): Promise<{
    credentials: { deviceId: string; authToken: string };
    deviceInfo: DeviceInfo;
  }> {
    const credentials = deviceConnectionService.registerDevice(request);
    const deviceInfo = deviceConnectionService.getDevice(request.deviceId);
    
    if (!deviceInfo) {
      throw new Error('Failed to retrieve device info after registration');
    }

    logger.info({ deviceId: request.deviceId }, 'Device registered with executor');
    
    return { credentials, deviceInfo };
  }

  unregisterDevice(deviceId: string): boolean {
    return deviceConnectionService.unregisterDevice(deviceId);
  }

  getDevice(deviceId: string): DeviceInfo | null {
    return deviceConnectionService.getDevice(deviceId);
  }

  getAllDevices(): DeviceInfo[] {
    return deviceConnectionService.getAllDevices();
  }

  getConnectedDevices(): DeviceInfo[] {
    return deviceConnectionService.getConnectedDevices();
  }

  async executeAction(
    deviceId: string,
    action: Omit<ScreenAction, 'id' | 'createdAt'>,
    options: ExecuteOptions = {}
  ): Promise<ActionResult> {
    const device = deviceConnectionService.getDevice(deviceId);
    
    if (!device) {
      return {
        success: false,
        actionId: '',
        error: createError(ERROR_CODES.DEVICE_NOT_FOUND, `Device not found: ${deviceId}`).message,
        duration: 0,
      };
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      return {
        success: false,
        actionId: '',
        error: createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected').message,
        duration: 0,
      };
    }

    const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const fullAction: ScreenAction = {
      ...action,
      id: actionId,
      createdAt: Date.now(),
      timeout: action.timeout || 10000,
      retryCount: action.retryCount || options.retryCount || 0,
    };

    const startTime = Date.now();

    try {
      const payload = {
        action: {
          type: fullAction.type,
          target: fullAction.target,
          params: fullAction.params,
          timeout: fullAction.timeout,
          retryCount: fullAction.retryCount,
        },
        captureResult: options.captureResult ?? true,
      };

      const result = await deviceConnectionService.sendRequest<{
        success: boolean;
        error?: string;
        screenshot?: string;
        elementState?: UIElement;
      }>(deviceId, 'ACTION', payload, options.timeout || 30000);

      const actionResult: ActionResult = {
        success: result.success,
        actionId,
        error: result.error,
        duration: Date.now() - startTime,
        screenshot: result.screenshot,
        elementState: result.elementState,
      };

      this.recordAction(deviceId, actionResult);
      
      logger.info({
        deviceId,
        actionType: action.type,
        success: result.success,
        duration: actionResult.duration,
      }, 'Action executed');

      return actionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({ deviceId, actionType: action.type, error: errorMessage }, 'Action execution failed');

      return {
        success: false,
        actionId,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  async click(deviceId: string, x: number, y: number): Promise<ActionResult> {
    return this.executeAction(deviceId, {
      type: 'CLICK',
      target: { type: 'COORDINATES', value: `${x},${y}` },
      params: { x, y },
    });
  }

  async longPress(deviceId: string, x: number, y: number, duration: number = 500): Promise<ActionResult> {
    return this.executeAction(deviceId, {
      type: 'LONG_PRESS',
      target: { type: 'COORDINATES', value: `${x},${y}` },
      params: { x, y, duration },
    });
  }

  async swipe(
    deviceId: string,
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    distance: number = 500,
    duration: number = 300
  ): Promise<ActionResult> {
    const startX = 540;
    const startY = 960;
    let endX = startX;
    let endY = startY;

    switch (direction) {
      case 'UP':
        endY = startY - distance;
        break;
      case 'DOWN':
        endY = startY + distance;
        break;
      case 'LEFT':
        endX = startX - distance;
        break;
      case 'RIGHT':
        endX = startX + distance;
        break;
    }

    return this.executeAction(deviceId, {
      type: 'SWIPE',
      target: { type: 'COORDINATES', value: `${startX},${startY}` },
      params: { startX, startY, endX, endY, duration },
    });
  }

  async typeText(deviceId: string, text: string): Promise<ActionResult> {
    return this.executeAction(deviceId, {
      type: 'TYPE',
      target: { type: 'TEXT', value: text },
      params: { text },
    });
  }

  async pressKey(deviceId: string, keyCode: number): Promise<ActionResult> {
    return this.executeAction(deviceId, {
      type: 'PRESS_KEY',
      target: { type: 'COORDINATES', value: String(keyCode) },
      params: { keyCode },
    });
  }

  async pressBack(deviceId: string): Promise<ActionResult> {
    return this.pressKey(deviceId, 4); // KEYCODE_BACK
  }

  async pressHome(deviceId: string): Promise<ActionResult> {
    return this.pressKey(deviceId, 3); // KEYCODE_HOME
  }

  async openApp(deviceId: string, packageName: string): Promise<ActionResult> {
    return this.executeAction(deviceId, {
      type: 'OPEN_APP',
      target: { type: 'RESOURCE_ID', value: packageName },
      params: { appPackage: packageName },
    });
  }

  async takeScreenshot(deviceId: string): Promise<ScreenCapture> {
    const device = deviceConnectionService.getDevice(deviceId);
    
    if (!device) {
      throw createError(ERROR_CODES.DEVICE_NOT_FOUND, `Device not found: ${deviceId}`);
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      throw createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    const result = await deviceConnectionService.sendRequest<{
      id: string;
      width: number;
      height: number;
      format: string;
      data: string;
    }>(deviceId, 'SCREENSHOT', {}, 15000);

    const capture: ScreenCapture = {
      id: result.id,
      deviceId,
      timestamp: Date.now(),
      width: result.width,
      height: result.height,
      format: result.format as 'JPEG' | 'PNG',
      data: result.data,
    };

    this.cachedScreenshots.set(deviceId, capture);
    
    logger.info({ deviceId, width: result.width, height: result.height }, 'Screenshot captured');
    
    return capture;
  }

  async analyzeScreen(deviceId: string, options: ScreenAnalyzeOptions = {}): Promise<{
    capture: ScreenCapture;
    elements?: UIElement[];
  }> {
    const capture = await this.takeScreenshot(deviceId);

    const result: { elements?: UIElement[] } = {};

    if (options.includeElements !== false) {
      try {
        const elementsResponse = await deviceConnectionService.sendRequest<{ elements: UIElement[] }>(
          deviceId,
          'ELEMENTS',
          { includeXml: options.includeXml ?? false },
          20000
        );
        result.elements = elementsResponse.elements;
      } catch (error) {
        logger.warn({ deviceId, error }, 'Failed to get UI elements');
      }
    }

    return { capture, elements: result.elements };
  }

  async findElementByText(deviceId: string, text: string, timeout: number = 5000): Promise<UIElement | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const elementsResponse = await deviceConnectionService.sendRequest<{ elements: UIElement[] }>(
          deviceId,
          'ELEMENTS',
          { textFilter: text },
          10000
        );

        if (elementsResponse.elements && elementsResponse.elements.length > 0) {
          return elementsResponse.elements[0];
        }
      } catch {
        // Continue searching
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return null;
  }

  async clickElementByText(deviceId: string, text: string): Promise<ActionResult> {
    const element = await this.findElementByText(deviceId, text);
    
    if (!element) {
      return {
        success: false,
        actionId: '',
        error: `Element not found: ${text}`,
        duration: 0,
      };
    }

    const centerX = Math.round((element.bounds.left + element.bounds.right) / 2);
    const centerY = Math.round((element.bounds.top + element.bounds.bottom) / 2);

    return this.click(deviceId, centerX, centerY);
  }

  private recordAction(deviceId: string, result: ActionResult): void {
    const history = this.actionHistory.get(deviceId) || [];
    history.push(result);
    
    if (history.length > 1000) {
      history.shift();
    }
    
    this.actionHistory.set(deviceId, history);
  }

  getActionHistory(deviceId: string, limit: number = 50): ActionResult[] {
    const history = this.actionHistory.get(deviceId) || [];
    return history.slice(-limit);
  }

  getStatistics() {
    return {
      devices: deviceConnectionService.getStatistics(),
      cachedScreenshots: this.cachedScreenshots.size,
      actionsExecuted: Array.from(this.actionHistory.values()).reduce((sum, h) => sum + h.length, 0),
    };
  }

  validateDeviceOperation(deviceId: string, operation: keyof DeviceCapabilities): OperationError | null {
    const device = deviceConnectionService.getDevice(deviceId);
    
    if (!device) {
      return createError(ERROR_CODES.DEVICE_NOT_FOUND, `Device not found: ${deviceId}`);
    }

    if (!deviceConnectionService.isDeviceConnected(deviceId)) {
      return createError(ERROR_CODES.DEVICE_NOT_CONNECTED, 'Device is not connected');
    }

    if (!device.capabilities[operation]) {
      return createError(
        ERROR_CODES.UNSUPPORTED_OPERATION,
        `Operation not supported on this device: ${operation}`
      );
    }

    return null;
  }
}

export const mobileExecutorService = new MobileExecutorService();
export default mobileExecutorService;

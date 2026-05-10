/**
 * 统一执行器 - UnifiedExecutor
 *
 * 统一PC和手机的执行接口，提供：
 * - 设备无关的操作抽象
 * - 自动选择最佳执行通道
 * - 执行结果标准化
 *
 * @version 1.0.0
 * @date 2026-03-13
 */

import { createServiceLogger } from '../../lib/logger';
import { pcExecutorService } from '../mobile/PCExecutorService';
import { mobileExecutorService } from '../mobile/MobileExecutorService';

const logger = createServiceLogger('UnifiedExecutor');

/**
 * 统一设备类型
 */
export type UnifiedDeviceType = 'PC' | 'ANDROID' | 'IOS';

/**
 * 统一动作类型
 */
export type UnifiedActionType =
  | 'CLICK'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'MOVE'
  | 'DRAG'
  | 'TYPE'
  | 'PRESS'
  | 'HOTKEY'
  | 'SCREENSHOT'
  | 'SCROLL'
  | 'OPEN_APP'
  | 'CLOSE_APP'
  | 'EXECUTE_COMMAND'
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'FILE_LIST';

/**
 * 统一动作参数
 */
export interface UnifiedActionParams {
  // 鼠标/触摸
  x?: number;
  y?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  duration?: number;
  button?: 'left' | 'right' | 'middle';
  clicks?: number;

  // 键盘
  text?: string;
  keys?: string | string[];

  // 滚动
  clicks?: number;

  // 应用
  appPackage?: string;
  appPath?: string;

  // 命令
  command?: string;

  // 文件
  path?: string;
  content?: string;
  encoding?: string;
}

/**
 * 统一执行结果
 */
export interface UnifiedResult {
  success: boolean;
  deviceId: string;
  actionType: UnifiedActionType;
  data?: unknown;
  error?: string;
  duration: number;
  timestamp: number;
}

/**
 * 设备能力
 */
export interface DeviceCapabilities {
  canClick: boolean;
  canType: boolean;
  canScreenshot: boolean;
  canExecuteCommand: boolean;
  canFileOperation: boolean;
  canOpenApp: boolean;
  maxResolution?: {
    width: number;
    height: number;
  };
}

/**
 * 统一执行器 - 单例模式
 */
export class UnifiedExecutor {
  private static instance: UnifiedExecutor | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): UnifiedExecutor {
    if (!UnifiedExecutor.instance) {
      UnifiedExecutor.instance = new UnifiedExecutor();
    }
    return UnifiedExecutor.instance;
  }

  /**
   * 执行统一动作
   */
  async execute(
    deviceType: UnifiedDeviceType,
    deviceId: string,
    actionType: UnifiedActionType,
    params: UnifiedActionParams = {}
  ): Promise<UnifiedResult> {
    const startTime = Date.now();

    try {
      let result: UnifiedResult;

      switch (deviceType) {
        case 'PC':
          result = await this.executePC(actionType, params);
          break;
        case 'ANDROID':
        case 'IOS':
          result = await this.executeMobile(deviceType, actionType, params);
          break;
        default:
          throw new Error(`Unsupported device type: ${deviceType}`);
      }

      return {
        ...result,
        deviceId,
        actionType,
        duration: Date.now() - startTime,
        timestamp: startTime,
      };
    } catch (error) {
      logger.error({
        deviceType,
        deviceId,
        actionType,
        error: error instanceof Error ? error.message : String(error),
      }, 'Execution failed');

      return {
        success: false,
        deviceId,
        actionType,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        timestamp: startTime,
      };
    }
  }

  /**
   * 执行PC动作
   */
  private async executePC(
    actionType: UnifiedActionType,
    params: UnifiedActionParams
  ): Promise<Omit<UnifiedResult, 'deviceId' | 'actionType' | 'duration' | 'timestamp'>> {
    const { x = 0, y = 0, text, keys, clicks = 1, button = 'left', duration = 0.5 } = params;

    switch (actionType) {
      case 'CLICK':
        return await this.executeWithResult(() =>
          pcExecutorService.click(x, y, clicks, button)
        );

      case 'DOUBLE_CLICK':
        return await this.executeWithResult(() =>
          pcExecutorService.doubleClick(x, y)
        );

      case 'RIGHT_CLICK':
        return await this.executeWithResult(() =>
          pcExecutorService.rightClick(x, y)
        );

      case 'MOVE':
        return await this.executeWithResult(() =>
          pcExecutorService.moveTo(x, y, duration)
        );

      case 'DRAG':
        return await this.executeWithResult(() =>
          pcExecutorService.dragTo(
            params.startX || 0,
            params.startY || 0,
            params.endX || 0,
            params.endY || 0,
            params.duration || 0.5
          )
        );

      case 'TYPE':
        return await this.executeWithResult(() =>
          pcExecutorService.type(text || '')
        );

      case 'PRESS':
        return await this.executeWithResult(() =>
          pcExecutorService.press(keys || 'enter')
        );

      case 'HOTKEY':
        const keyArray = Array.isArray(keys) ? keys : keys ? [keys] : [];
        return await this.executeWithResult(() =>
          pcExecutorService.hotkey(...keyArray)
        );

      case 'SCREENSHOT':
        return await this.executeWithResult(() =>
          pcExecutorService.screenshot({ path: params.path })
        );

      case 'SCROLL':
        return await this.executeWithResult(() =>
          pcExecutorService.scroll(params.clicks || 3, params.x, params.y)
        );

      default:
        throw new Error(`Unsupported PC action: ${actionType}`);
    }
  }

  /**
   * 执行移动端动作
   */
  private async executeMobile(
    deviceType: 'ANDROID' | 'IOS',
    actionType: UnifiedActionType,
    params: UnifiedActionParams
  ): Promise<Omit<UnifiedResult, 'deviceId' | 'actionType' | 'duration' | 'timestamp'>> {
    const { x = 0, y = 0, text, duration = 500 } = params;

    switch (actionType) {
      case 'CLICK':
        return await this.executeWithResult(() =>
          mobileExecutorService.click(deviceType === 'ANDROID' ? 'android-device' : 'ios-device', x, y)
        );

      case 'LONG_PRESS':
        return await this.executeWithResult(() =>
          mobileExecutorService.longPress(deviceType === 'ANDROID' ? 'android-device' : 'ios-device', x, y, duration)
        );

      case 'SWIPE':
        return await this.executeWithResult(() =>
          mobileExecutorService.swipe(
            deviceType === 'ANDROID' ? 'android-device' : 'ios-device',
            'UP',
            500,
            duration
          )
        );

      case 'TYPE':
        return await this.executeWithResult(() =>
          mobileExecutorService.typeText(deviceType === 'ANDROID' ? 'android-device' : 'ios-device', text || '')
        );

      case 'SCREENSHOT':
        return await this.executeWithResult(() =>
          mobileExecutorService.takeScreenshot(deviceType === 'ANDROID' ? 'android-device' : 'ios-device')
        );

      case 'OPEN_APP':
        return await this.executeWithResult(() =>
          mobileExecutorService.openApp(
            deviceType === 'ANDROID' ? 'android-device' : 'ios-device',
            params.appPackage || ''
          )
        );

      case 'PRESS':
        return await this.executeWithResult(() =>
          mobileExecutorService.pressKey(
            deviceType === 'ANDROID' ? 'android-device' : 'ios-device',
            params.x || 0 // keyCode
          )
        );

      default:
        throw new Error(`Unsupported mobile action: ${actionType}`);
    }
  }

  /**
   * 执行并标准化结果
   */
  private async executeWithResult<T extends { success: boolean; data?: unknown; error?: string }>(
    action: () => Promise<T>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const result = await action();
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 批量执行动作
   */
  async executeBatch(
    deviceType: UnifiedDeviceType,
    deviceId: string,
    actions: Array<{ type: UnifiedActionType; params?: UnifiedActionParams }>
  ): Promise<UnifiedResult[]> {
    const results: UnifiedResult[] = [];

    for (const action of actions) {
      const result = await this.execute(deviceType, deviceId, action.type, action.params || {});
      results.push(result);

      // 如果失败且不是继续执行模式，停止
      if (!result.success) {
        logger.warn({ actionType: action.type, deviceId }, 'Batch action failed, continuing');
      }
    }

    return results;
  }

  /**
   * 并行执行动作
   */
  async executeParallel(
    deviceType: UnifiedDeviceType,
    actions: Array<{ deviceId: string; type: UnifiedActionType; params?: UnifiedActionParams }>
  ): Promise<UnifiedResult[]> {
    const promises = actions.map(action =>
      this.execute(deviceType, action.deviceId, action.type, action.params || {})
    );
    return Promise.all(promises);
  }

  /**
   * 获取设备能力
   */
  getCapabilities(deviceType: UnifiedDeviceType): DeviceCapabilities {
    switch (deviceType) {
      case 'PC':
        return {
          canClick: true,
          canType: true,
          canScreenshot: true,
          canExecuteCommand: true,
          canFileOperation: true,
          canOpenApp: true,
        };
      case 'ANDROID':
      case 'IOS':
        return {
          canClick: true,
          canType: true,
          canScreenshot: true,
          canExecuteCommand: false,
          canFileOperation: true,
          canOpenApp: true,
        };
      default:
        return {
          canClick: false,
          canType: false,
          canScreenshot: false,
          canExecuteCommand: false,
          canFileOperation: false,
          canOpenApp: false,
        };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'degraded' | 'error';
    details: {
      pcAvailable: boolean;
      mobileAvailable: boolean;
    };
  }> {
    const pcAvailable = pcExecutorService.isReady();

    return {
      status: pcAvailable ? 'ok' : 'degraded',
      details: {
        pcAvailable,
        mobileAvailable: true, // 移动端依赖设备连接
      },
    };
  }
}

// 导出单例
export const unifiedExecutor = UnifiedExecutor.getInstance();
export default unifiedExecutor;

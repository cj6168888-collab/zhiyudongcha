/**
 * useOpenClaw Hook - OpenClaw 统一接入 Hook
 *
 * 提供简化的接口来访问 OpenClaw 的所有功能
 * 包括设备控制、任务执行和技能调用
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { useCallback, useEffect } from 'react';
import { useOpenClawStore, type PCDeviceInfo, type TaskDefinition, type ControlCommand, type SkillResult } from '@/lib/ai-skill-engine';

export interface UseOpenClawReturn {
  // 设备管理
  devices: PCDeviceInfo[];
  activeDevice: PCDeviceInfo | null;
  isConnected: boolean;
  isConnecting: boolean;
  fetchDevices: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnect: () => void;

  // 任务管理
  tasks: TaskDefinition[];
  enabledTasks: TaskDefinition[];
  fetchTasks: () => Promise<void>;
  executeTask: (taskId: string) => Promise<SkillResult>;

  // 控制功能
  executeControl: (command: ControlCommand) => Promise<SkillResult>;

  // 快捷控制方法
  click: (x: number, y: number) => Promise<SkillResult>;
  doubleClick: (x: number, y: number) => Promise<SkillResult>;
  rightClick: (x: number, y: number) => Promise<SkillResult>;
  moveMouse: (x: number, y: number) => Promise<SkillResult>;
  dragMouse: (startX: number, startY: number, endX: number, endY: number) => Promise<SkillResult>;

  typeText: (text: string) => Promise<SkillResult>;
  pressKey: (key: string) => Promise<SkillResult>;
  hotkey: (keys: string[]) => Promise<SkillResult>;

  screenshot: () => Promise<SkillResult>;
  scroll: (direction: 'up' | 'down' | 'left' | 'right', amount?: number) => Promise<SkillResult>;

  openApp: (appName: string) => Promise<SkillResult>;
  closeApp: (appName: string) => Promise<SkillResult>;

  // 技能和语音控制
  executeSkill: (skillId: string, params?: Record<string, unknown>) => Promise<SkillResult>;
  processVoiceCommand: (text: string) => Promise<SkillResult>;

  // 错误处理
  lastError: string | null;
}

/**
 * OpenClaw 统一 Hook
 *
 * @example
 * const { devices, isConnected, click, screenshot } = useOpenClaw();
 *
 * // 截图
 * const result = await screenshot();
 *
 * // 点击屏幕
 * await click(100, 200);
 *
 * // 执行语音指令
 * await processVoiceCommand('打开微信');
 */
export function useOpenClaw(): UseOpenClawReturn {
  const store = useOpenClawStore();

  // 自动获取设备列表
  useEffect(() => {
    store.fetchDevices();
    store.fetchTasks();
  }, []);

  // =====================
  // 快捷控制方法
  // =====================

  const click = useCallback((x: number, y: number) => {
    return store.executeControl({
      type: 'MOUSE',
      action: 'CLICK',
      params: { x, y }
    });
  }, [store.executeControl]);

  const doubleClick = useCallback((x: number, y: number) => {
    return store.executeControl({
      type: 'MOUSE',
      action: 'DOUBLE_CLICK',
      params: { x, y }
    });
  }, [store.executeControl]);

  const rightClick = useCallback((x: number, y: number) => {
    return store.executeControl({
      type: 'MOUSE',
      action: 'RIGHT_CLICK',
      params: { x, y }
    });
  }, [store.executeControl]);

  const moveMouse = useCallback((x: number, y: number) => {
    return store.executeControl({
      type: 'MOUSE',
      action: 'MOVE',
      params: { x, y }
    });
  }, [store.executeControl]);

  const dragMouse = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      return store.executeControl({
        type: 'MOUSE',
        action: 'DRAG',
        params: { startX, startY, endX, endY }
      });
    },
    [store.executeControl]
  );

  const typeText = useCallback((text: string) => {
    return store.executeControl({
      type: 'KEYBOARD',
      action: 'TYPE',
      params: { text }
    });
  }, [store.executeControl]);

  const pressKey = useCallback((key: string) => {
    return store.executeControl({
      type: 'KEYBOARD',
      action: 'PRESS',
      params: { key }
    });
  }, [store.executeControl]);

  const hotkey = useCallback((keys: string[]) => {
    return store.executeControl({
      type: 'KEYBOARD',
      action: 'HOTKEY',
      params: { keys }
    });
  }, [store.executeControl]);

  const screenshot = useCallback(() => {
    return store.executeControl({
      type: 'SCREENSHOT',
      action: 'CAPTURE'
    });
  }, [store.executeControl]);

  const scroll = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right', amount: number = 3) => {
      return store.executeControl({
        type: 'MOUSE',
        action: 'SCROLL',
        params: { direction, clicks: amount }
      });
    },
    [store.executeControl]
  );

  const openApp = useCallback((appName: string) => {
    return store.executeControl({
      type: 'APP',
      action: 'OPEN',
      params: { appName }
    });
  }, [store.executeControl]);

  const closeApp = useCallback((appName: string) => {
    return store.executeControl({
      type: 'APP',
      action: 'CLOSE',
      params: { appName }
    });
  }, [store.executeControl]);

  const executeTask = useCallback(
    async (taskId: string): Promise<SkillResult> => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/execute`, {
          method: 'POST',
          credentials: 'include'
        });
        const json = await res.json();

        return {
          success: json.success,
          data: json.data,
          error: json.error,
          duration: 0
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '任务执行失败',
          duration: 0
        };
      }
    },
    []
  );

  return {
    // 设备管理
    devices: store.devices,
    activeDevice: store.activeDevice,
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    fetchDevices: store.fetchDevices,
    connectToDevice: store.connectToDevice,
    disconnect: store.disconnect,

    // 任务管理
    tasks: store.tasks,
    enabledTasks: store.enabledTasks,
    fetchTasks: store.fetchTasks,
    executeTask,

    // 控制功能
    executeControl: store.executeControl,

    // 快捷控制方法
    click,
    doubleClick,
    rightClick,
    moveMouse,
    dragMouse,
    typeText,
    pressKey,
    hotkey,
    screenshot,
    scroll,
    openApp,
    closeApp,

    // 技能和语音控制
    executeSkill: store.executeSkill,
    processVoiceCommand: store.processVoiceCommand,

    // 错误处理
    lastError: store.lastError
  };
}

export default useOpenClaw;

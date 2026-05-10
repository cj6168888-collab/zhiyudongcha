/**
 * Device Services - 设备服务
 */

export { deviceRegistry, default as DeviceRegistry, KNOWN_PROGRAMS } from './DeviceRegistry';
export { crossDeviceRouter, default as CrossDeviceRouter } from './CrossDeviceRouter';
export type {
  TaskRequest,
  TaskPlan,
  SubTaskPlan,
  ExecutionResult
} from './CrossDeviceRouter';

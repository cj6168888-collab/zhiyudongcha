/**
 * 远程控制服务 - 导出索引
 *
 * 统一导出所有远程控制相关的服务
 */

export { RemoteControlService, remoteControlService, default } from './RemoteControlService';
export type {
  PCDeviceInfo,
  PCDeviceCapabilities,
  RemoteSession,
  ControlCommand,
  CommandResult,
  RemoteControlConfig,
} from './RemoteControlService';

/**
 * 移动设备服务模块 - 导出索引
 * 
 * 统一导出所有移动设备相关的服务
 */

export * from './types';

export { deviceConnectionService, default as deviceConnection } from './DeviceConnectionService';
export type { DeviceRegistrationRequest, DeviceConnection } from './DeviceConnectionService';

export { mobileExecutorService, default as mobileExecutor } from './MobileExecutorService';

export { smsService, default as sms } from './SmsService';

export { phoneService, default as phone } from './PhoneService';

export { fileService, default as file } from './FileService';

export { visionRecognitionService, default as vision } from './VisionRecognitionService';

export { pcExecutorService, default as pcExecutor } from './PCExecutorService';

export { mobileWebSocketServer, default as wsServer } from './MobileWebSocketServer';

export { companionAppService, default as companion } from './CompanionAppService';
export type { CompanionAppConfig, FileWatchConfig, CompanionPayload } from './CompanionAppService';

export { weChatFileService, default as weChat } from './WeChatFileService';
export type { DocumentCategory, FileMetadata, ProcessedDocument } from './WeChatFileService';

export { autoProcessWorkflow, default as workflow } from './AutoProcessWorkflow';
export type { WorkflowConfig, WorkflowResult, WorkflowStep } from './AutoProcessWorkflow';

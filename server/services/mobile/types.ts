/**
 * 移动设备自动化服务 - 类型定义
 *
 * 定义所有移动设备控制相关的数据类型
 */

export type DevicePlatform = 'ANDROID' | 'IOS' | 'WINDOWS' | 'MACOS' | 'LINUX' | 'WEB';
export type DeviceStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type ConnectionType = 'WEBSOCKET' | 'ADB' | 'USB';

export interface DeviceInfo {
  id: string;
  name: string;
  platform: DevicePlatform;
  osVersion: string;
  capabilities: DeviceCapabilities;
  status: DeviceStatus;
  lastSeen: number;
  registeredAt: number;
}

export interface DeviceCapabilities {
  screenCapture: boolean;
  touchInput: boolean;
  keyboardInput: boolean;
  fileSystem: boolean;
  sms: boolean;
  phone: boolean;
  contacts: boolean;
  location: boolean;
  camera: boolean;
  microphone: boolean;
  notifications: boolean;
  accessibility: boolean;
  adb: boolean;
  maxResolution: {
    width: number;
    height: number;
  };
}

export interface DeviceCredentials {
  deviceId: string;
  authToken: string;
  publicKey?: string;
}

export interface ScreenCapture {
  id: string;
  deviceId: string;
  timestamp: number;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
  data: string; // base64
}

export interface UIElement {
  id: string;
  type: UIElementType;
  text: string;
  contentDescription?: string;
  resourceId?: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  clickable: boolean;
  scrollable: boolean;
  editable: boolean;
  visible: boolean;
  enabled: boolean;
  children?: UIElement[];
}

export type UIElementType =
  | 'BUTTON'
  | 'TEXT_VIEW'
  | 'EDIT_TEXT'
  | 'IMAGE_VIEW'
  | 'LIST_VIEW'
  | 'SCROLL_VIEW'
  | 'WEB_VIEW'
  | 'CHECK_BOX'
  | 'RADIO_BUTTON'
  | 'SWITCH'
  | 'SEEKBAR'
  | 'DIALOG'
  | 'MENU'
  | 'TOOLBAR'
  | 'UNKNOWN';

export interface ScreenAction {
  id: string;
  type: ActionType;
  target: ActionTarget;
  params?: ActionParams;
  timeout: number;
  retryCount: number;
  createdAt: number;
}

export type ActionType =
  | 'CLICK'
  | 'LONG_PRESS'
  | 'DOUBLE_CLICK'
  | 'SWIPE'
  | 'SCROLL'
  | 'TYPE'
  | 'PRESS_KEY'
  | 'BACK'
  | 'HOME'
  | 'RECENT_APPS'
  | 'NOTIFICATION_CENTER'
  | 'QUICK_SETTINGS'
  | 'TAKE_SCREENSHOT'
  | 'OPEN_APP'
  | 'CLOSE_APP'
  | 'WAIT'
  | 'TEXT_SELECT';

export interface ActionTarget {
  type: 'COORDINATES' | 'ELEMENT_ID' | 'TEXT' | 'RESOURCE_ID' | 'DESCRIPTION';
  value: string;
}

export interface ActionParams {
  x?: number;
  y?: number;
  text?: string;
  duration?: number;
  direction?: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  keyCode?: number;
  appPackage?: string;
}

export interface ActionResult {
  success: boolean;
  actionId: string;
  error?: string;
  duration: number;
  screenshot?: string;
  elementState?: UIElement;
}

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  dateSent: number;
  read: boolean;
  type: number;
  status: number;
  threadId?: number;
}

export interface SmsConversation {
  threadId: number;
  address: string;
  contactName?: string;
  lastMessage: string;
  lastDate: number;
  messageCount: number;
  unreadCount: number;
}

export interface CallLogEntry {
  id: string;
  number: string;
  contactName?: string;
  duration: number;
  date: number;
  type: 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED' | 'VOICEMAIL';
  durationFormatted?: string;
}

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
  mimeType?: string;
  permissions?: string;
}

export interface FileContent {
  path: string;
  content?: string;
  base64?: string;
  encoding: 'utf-8' | 'base64' | 'binary';
  size: number;
}

export interface PermissionInfo {
  permission: string;
  granted: boolean;
  isDangerous: boolean;
  description?: string;
}

export interface DeviceEvent {
  type: 'SCREEN_CHANGE' | 'NOTIFICATION' | 'CALL_STATE' | 'BATTERY' | 'CONNECTIVITY' | 'APP_STATE';
  timestamp: number;
  deviceId: string;
  data: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: MessageType;
  payload: unknown;
  timestamp: number;
  messageId: string;
}

export type MessageType =
  | 'CONNECT'
  | 'DISCONNECT'
  | 'AUTHENTICATE'
  | 'AUTH_RESPONSE'
  | 'SCREENSHOT'
  | 'SCREENSHOT_RESPONSE'
  | 'ACTION'
  | 'ACTION_RESPONSE'
  | 'ELEMENTS'
  | 'ELEMENTS_RESPONSE'
  | 'SMS_LIST'
  | 'SMS_LIST_RESPONSE'
  | 'CALL_LOG'
  | 'CALL_LOG_RESPONSE'
  | 'FILES'
  | 'FILES_RESPONSE'
  | 'FILE_CONTENT'
  | 'FILE_CONTENT_RESPONSE'
  | 'FILE_WRITE'
  | 'FILE_DELETE'
  | 'FILE_MKDIR'
  | 'FILE_COPY'
  | 'FILE_MOVE'
  | 'FILE_SEARCH'
  | 'STORAGE_INFO'
  | 'PERMISSIONS'
  | 'PERMISSIONS_RESPONSE'
  | 'EVENT'
  | 'ERROR'
  | 'HEARTBEAT'
  | 'HEARTBEAT_RESPONSE'
  // 设备指令类型 - 核心功能
  | 'COMMAND_EXECUTE'
  | 'COMMAND_RESULT'
  | 'ACTION_EXECUTE'
  | 'ACTION_RESULT'
  | 'TASK_DISPATCH'
  | 'APP_LAUNCH'
  | 'APP_INSTALL'
  | 'FILE_OPEN'
  | 'URL_OPEN'
  | 'DIAL_PHONE'
  | 'SEND_SMS'
  | 'NAVIGATE_TO'
  | 'COPY_TO_CLIPBOARD'
  | 'DEVICE_PROGRAMS'
  | 'DEVICE_PROGRAMS_RESPONSE';

export interface OperationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

export const ERROR_CODES = {
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  DEVICE_NOT_CONNECTED: 'DEVICE_NOT_CONNECTED',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ACTION_TIMEOUT: 'ACTION_TIMEOUT',
  ACTION_FAILED: 'ACTION_FAILED',
  SCREENSHOT_FAILED: 'SCREENSHOT_FAILED',
  SMS_FAILED: 'SMS_FAILED',
  CALL_FAILED: 'CALL_FAILED',
  FILE_FAILED: 'FILE_FAILED',
  AUTH_FAILED: 'AUTH_FAILED',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export function createError(code: typeof ERROR_CODES[keyof typeof ERROR_CODES], message: string, details?: Record<string, unknown>): OperationError {
  return {
    code,
    message,
    details,
    recoverable: !['AUTH_FAILED', 'DEVICE_NOT_FOUND', 'UNSUPPORTED_OPERATION'].includes(code),
  };
}

export function isOperationError(value: unknown): value is OperationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

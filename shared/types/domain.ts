// @ts-nocheck
/**
 * 领域模型类型定义
 */

import type { User, Person, Project, Email, Voiceprint } from '../schema';

/**
 * 用户相关类型
 */
export type { User };

/**
 * 用户创建请求
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  profile?: UserProfile;
}

/**
 * 用户更新请求
 */
export interface UpdateUserRequest {
  email?: string;
  profile?: Partial<UserProfile>;
}

/**
 * 用户资料
 */
export interface UserProfile {
  displayName?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  timezone?: string;
  language?: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 人脉相关类型
 */
export type { Person };

/**
 * 人脉创建请求
 */
export interface CreatePersonRequest {
  name: string;
  role?: string;
  organization?: string;
  tags?: string[];
  accessLevel?: AccessLevel;
  weakness?: string;
  interestChain?: string[];
}

/**
 * 访问级别
 */
export type AccessLevel = 'ZONE_RED' | 'ZONE_BLUE' | 'ZONE_GREEN' | 'ZONE_YELLOW';

/**
 * 项目相关类型
 */
export type { Project };

/**
 * 项目创建请求
 */
export interface CreateProjectRequest {
  title: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  leaderId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 项目状态
 */
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

/**
 * 优先级
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * 邮件相关类型
 */
export type { Email };

/**
 * 邮件创建请求
 */
export interface CreateEmailRequest {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject?: string;
  body?: string;
  category?: EmailCategory;
}

/**
 * 邮件分类
 */
export type EmailCategory = 'INVOICE' | 'NOTIFICATION' | 'NEWSLETTER' | 'PERSONAL' | 'WORK' | 'OTHER';

/**
 * 声纹相关类型
 */
export type { Voiceprint };

/**
 * 声纹创建请求
 */
export interface CreateVoiceprintRequest {
  userId: string;
  audioData: string;
  label: string;
}

/**
 * 声纹验证请求
 */
export interface VerifyVoiceprintRequest {
  userId: string;
  audioData: string;
}

/**
 * 声纹验证响应
 */
export interface VoiceprintVerificationResult {
  isValid: boolean;
  confidence: number;
  message: string;
}

/**
 * 设备相关类型
 */
export interface Device {
  id: string;
  userId: string;
  name: string;
  type: DeviceType;
  platform: string;
  pushToken?: string;
  lastActiveAt: Date;
  createdAt: Date;
}

/**
 * 设备类型
 */
export type DeviceType = 'MOBILE' | 'TABLET' | 'DESKTOP' | 'WEB' | 'IOT';

/**
 * 设备创建请求
 */
export interface CreateDeviceRequest {
  name: string;
  type: DeviceType;
  platform: string;
  pushToken?: string;
}

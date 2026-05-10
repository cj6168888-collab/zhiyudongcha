/**
 * 认证授权模块 (Auth Module)
 * 
 * 职责: 用户认证、生物特征、密钥管理、访问控制
 * 
 * 本模块重新导出 server/services/ 中的相关服务
 */

// Re-export from services directory
// @ts-ignore - 渐进式迁移，暂不强制类型检查
const authModules = {
  biometric: () => import('../../services/biometric-auth'),
  vault: () => import('../../services/secret-vault'),
  apiKey: () => import('../../services/api-key-resolver'),
  tieredAccess: () => import('../../services/tiered-access'),
};

export { authModules };

export interface AuthModuleConfig {
  biometricEnabled: boolean;
  apiKeyRequired: boolean;
  sessionTimeout: number;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export interface AuthModuleConfig {
  biometricEnabled: boolean;
  apiKeyRequired: boolean;
  sessionTimeout: number;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

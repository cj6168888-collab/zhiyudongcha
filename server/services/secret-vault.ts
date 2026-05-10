/**
 * Z1 协议 - SecretVault 密钥保险库 v1.0
 * 
 * 遵循 Z1 协议 v5.0.1-Bio-CN 铁律1：
 * - 算力主权：必须加密存储 DeepSeek/通义/豆包 的 API Key
 * - 严禁明文存储或日志输出
 * 
 * 实现方案：
 * - AES-256-GCM 对称加密
 * - 主密钥从环境变量 SECRET_VAULT_KEY 获取
 * - 支持从数据库持久化存储/读取
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SecretVault');

import crypto from 'crypto';
import { getDatabase } from '../db';
import { encryptedSecrets } from '@shared/schema';
import { eq } from 'drizzle-orm';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

type SecretKeyType = 'DASHSCOPE_API_KEY' | 'DEEPSEEK_API_KEY' | 'DOUBAO_API_KEY' | 'CUSTOM';

interface EncryptedPayload {
  iv: string;
  authTag: string;
  encrypted: string;
  salt: string;
}

interface SecretEntry {
  keyType: SecretKeyType;
  encryptedValue: string;
  keyFingerprint: string;
  lastRotatedAt: Date;
}

class SecretVault {
  private masterKey: Buffer | null = null;
  private cache: Map<SecretKeyType, string> = new Map();
  private initialized = false;

  constructor() {
    this.initializeMasterKey();
  }

  private initializeMasterKey(): void {
    const envKey = process.env.SECRET_VAULT_KEY;
    if (envKey) {
      this.masterKey = crypto.scryptSync(envKey, 'z1-protocol-salt', 32);
      this.initialized = true;
      logger.info('[SecretVault] 主密钥已初始化 (AES-256-GCM)');
    } else {
      const fallbackKey = process.env.SESSION_SECRET || 'z1-default-vault-key-not-for-production';
      this.masterKey = crypto.scryptSync(fallbackKey, 'z1-protocol-salt', 32);
      this.initialized = true;
      logger.info('[SecretVault] 使用备用密钥初始化 (建议设置 SECRET_VAULT_KEY)');
    }
  }

  private encrypt(plaintext: string): EncryptedPayload {
    if (!this.masterKey) {
      throw new Error('[SecretVault] 主密钥未初始化');
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const derivedKey = crypto.scryptSync(this.masterKey, salt, 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
      salt: salt.toString('hex'),
    };
  }

  private decrypt(payload: EncryptedPayload): string {
    if (!this.masterKey) {
      throw new Error('[SecretVault] 主密钥未初始化');
    }

    const salt = Buffer.from(payload.salt, 'hex');
    const derivedKey = crypto.scryptSync(this.masterKey, salt, 32);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private generateFingerprint(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  async storeSecret(keyType: SecretKeyType, value: string): Promise<boolean> {
    try {
      const encrypted = this.encrypt(value);
      const fingerprint = this.generateFingerprint(value);
      const encryptedJson = JSON.stringify(encrypted);

      const existing = await getDatabase().select()
        .from(encryptedSecrets)
        .where(eq(encryptedSecrets.keyType, keyType))
        .limit(1);

      if (existing.length > 0) {
        await getDatabase().update(encryptedSecrets)
          .set({
            encryptedValue: encryptedJson,
            keyFingerprint: fingerprint,
            lastRotatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(encryptedSecrets.keyType, keyType));
      } else {
        await getDatabase().insert(encryptedSecrets).values({
          keyType,
          encryptedValue: encryptedJson,
          keyFingerprint: fingerprint,
          lastRotatedAt: new Date(),
        });
      }

      this.cache.set(keyType, value);
      logger.info(`[SecretVault] 密钥 ${keyType} 已安全存储 (指纹: ${fingerprint})`);
      return true;
    } catch (error) {
      logger.error({ err: error, keyType }, '存储密钥失败');
      return false;
    }
  }

  async getSecret(keyType: SecretKeyType): Promise<string | null> {
    if (this.cache.has(keyType)) {
      return this.cache.get(keyType)!;
    }

    const envMapping: Record<SecretKeyType, string> = {
      'DASHSCOPE_API_KEY': 'DASHSCOPE_API_KEY',
      'DEEPSEEK_API_KEY': 'DEEPSEEK_API_KEY',
      'DOUBAO_API_KEY': 'DOUBAO_API_KEY',
      'CUSTOM': '',
    };

    const envValue = process.env[envMapping[keyType]];
    if (envValue) {
      this.cache.set(keyType, envValue);
      return envValue;
    }

    try {
      const stored = await getDatabase().select()
        .from(encryptedSecrets)
        .where(eq(encryptedSecrets.keyType, keyType))
        .limit(1);

      if (stored.length > 0 && stored[0].encryptedValue) {
        const payload: EncryptedPayload = JSON.parse(stored[0].encryptedValue);
        const decrypted = this.decrypt(payload);
        this.cache.set(keyType, decrypted);
        return decrypted;
      }
    } catch (error) {
      logger.error({ err: error, keyType }, '读取密钥失败');
    }

    return null;
  }

  async rotateSecret(keyType: SecretKeyType, newValue: string): Promise<boolean> {
    const oldValue = await this.getSecret(keyType);
    if (oldValue) {
      logger.info(`[SecretVault] 轮换密钥 ${keyType}`);
    }
    return this.storeSecret(keyType, newValue);
  }

  async deleteSecret(keyType: SecretKeyType): Promise<boolean> {
    try {
      await getDatabase().delete(encryptedSecrets).where(eq(encryptedSecrets.keyType, keyType));
      this.cache.delete(keyType);
      logger.info(`[SecretVault] 密钥 ${keyType} 已删除`);
      return true;
    } catch (error) {
      logger.error({ err: error, keyType }, '删除密钥失败');
      return false;
    }
  }

  async listSecrets(): Promise<Array<{ keyType: string; fingerprint: string; lastRotated: Date }>> {
    try {
      const secrets = await getDatabase().select({
        keyType: encryptedSecrets.keyType,
        fingerprint: encryptedSecrets.keyFingerprint,
        lastRotated: encryptedSecrets.lastRotatedAt,
      }).from(encryptedSecrets);

      return secrets.map(s => ({
        keyType: s.keyType || '',
        fingerprint: s.fingerprint || '',
        lastRotated: s.lastRotated || new Date(),
      }));
    } catch (error) {
      logger.error({ err: error }, '列出密钥失败');
      return [];
    }
  }

  async verifySecret(keyType: SecretKeyType): Promise<boolean> {
    try {
      const value = await this.getSecret(keyType);
      return value !== null && value.length > 0;
    } catch {
      return false;
    }
  }

  getStatus(): { initialized: boolean; cachedKeys: string[] } {
    return {
      initialized: this.initialized,
      cachedKeys: Array.from(this.cache.keys()),
    };
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('[SecretVault] 缓存已清除');
  }
}

export const secretVault = new SecretVault();

export async function getDashScopeApiKey(): Promise<string | null> {
  return secretVault.getSecret('DASHSCOPE_API_KEY');
}

export async function getDeepSeekApiKey(): Promise<string | null> {
  return secretVault.getSecret('DEEPSEEK_API_KEY');
}

export async function getDoubaoApiKey(): Promise<string | null> {
  return secretVault.getSecret('DOUBAO_API_KEY');
}

export type { SecretVault, SecretKeyType, EncryptedPayload };

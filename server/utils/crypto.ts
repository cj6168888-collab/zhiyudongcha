import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY environment variable is required for security. ' +
      'Please generate a secure 64-character hex key and set it in your environment.'
    );
  }
  
  if (key.length !== 64) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY must be exactly 64 characters (32 bytes) in hex format. ' +
      `Current length: ${key.length}.`
    );
  }
  
  // 验证hex格式
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY must be in valid hex format. ' +
      'Example: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
  }
  
  return Buffer.from(key, 'hex');
}

function generateSecureKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function encryptCredentials(data: object): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  try {
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function decryptCredentials(encrypted: string, iv: string): object {
  const key = getEncryptionKey();
  
  if (!encrypted || !iv) {
    throw new Error('Encrypted data and IV are required for decryption');
  }
  
  const [encData, authTag] = encrypted.split(':');
  if (!encData || !authTag) {
    throw new Error('Invalid encrypted data format');
  }
  
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const parsed = JSON.parse(decrypted);
    
    // 验证解密后的数据结构
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Decrypted data is not a valid object');
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 密钥生成工具
export const KeyUtils = {
  generateSecureKey,
  validateKeyFormat: (key: string): boolean => {
    return /^[0-9a-fA-F]{64}$/.test(key);
  },
  generateKeyWithHash: (seed: string): string => {
    return crypto.createHash('sha256').update(seed).digest().toString('hex').substring(0, 64);
  },
};

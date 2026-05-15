import { createServiceLogger } from './logger';

const logger = createServiceLogger('CryptoStorage');

const CRYPTO_ERRORS = {
  QUOTA_EXCEEDED: 'Storage quota exceeded',
  ENCRYPTION_FAILED: 'Encryption failed',
  DECRYPTION_FAILED: 'Decryption failed',
  INVALID_KEY: 'Invalid encryption key',
  STORAGE_DISABLED: 'Storage is disabled',
} as const;

interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag?: string;
  timestamp: number;
  version: number;
}

const CURRENT_VERSION = 1;
const STORAGE_KEY = 'xiaozhi_master_key';

let masterKey: CryptoKey | null = null;

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  if (masterKey) return masterKey;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const keyData = JSON.parse(atob(stored));
      masterKey = await crypto.subtle.importKey(
        'raw',
        Uint8Array.from(atob(keyData.key), c => c.charCodeAt(0)),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      return masterKey;
    } catch {
      logger.warn('Stored master key is corrupted, creating new one');
    }
  }

  masterKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
  const keyString = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ key: keyString }));

  return masterKey;
}

function validateInput(value: unknown, operation: 'encrypt' | 'decrypt'): void {
  if (operation === 'encrypt' && typeof value !== 'string') {
    throw new Error(`Expected string for encryption, got ${typeof value}`);
  }
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);

    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.keys(parsed).forEach(key => {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
          throw new Error('Prototype pollution attempt detected');
        }
      });
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

export const cryptoStorage = {
  async encrypt(data: string): Promise<string> {
    try {
      validateInput(data, 'encrypt');
      const key = await getOrCreateMasterKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encodedData = new TextEncoder().encode(data);

      const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
      );

      const encryptedData: EncryptedData = {
        iv: btoa(String.fromCharCode(...iv)),
        encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
        timestamp: Date.now(),
        version: CURRENT_VERSION,
      };

      return btoa(JSON.stringify(encryptedData));
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error(CRYPTO_ERRORS.ENCRYPTION_FAILED);
    }
  },

  async decrypt(encryptedString: string): Promise<string> {
    try {
      const key = await getOrCreateMasterKey();
      const encryptedData: EncryptedData = JSON.parse(atob(encryptedString));

      if (encryptedData.version !== CURRENT_VERSION) {
        throw new Error('Unsupported encryption version');
      }

      const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
      const encryptedContent = Uint8Array.from(atob(encryptedData.encryptedData), c => c.charCodeAt(0));

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedContent
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      logger.warn('Decryption failed; stored value will be discarded by caller', error);
      throw new Error(CRYPTO_ERRORS.DECRYPTION_FAILED);
    }
  },

  async setItem<T>(key: string, value: T, maxSize?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);

      if (maxSize && serialized.length > maxSize) {
        logger.warn(`Data size exceeds maximum (${maxSize} bytes)`);
        return false;
      }

      const encrypted = await this.encrypt(serialized);
      localStorage.setItem(key, encrypted);

      return true;
    } catch (error) {
      if ((error as Error).name === 'QuotaExceededError') {
        logger.warn('Storage quota exceeded');
        return false;
      }
      logger.error(`Failed to set item: ${key}`, error);
      return false;
    }
  },

  async getItem<T>(key: string, fallback: T): Promise<T> {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return fallback;

      const decrypted = await this.decrypt(stored);
      return safeJsonParse(decrypted, fallback);
    } catch {
      logger.warn(`Failed to get item: ${key}, clearing corrupted data`);
      localStorage.removeItem(key);
      return fallback;
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
  },

  clear(): void {
    const keysToKeep = [STORAGE_KEY];
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
  },

  async getStorageSize(): Promise<{ used: number; available: number }> {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key !== STORAGE_KEY) {
        used += (localStorage.getItem(key) || '').length * 2;
      }
    }

    return {
      used,
      available: 5 * 1024 * 1024 - used,
    };
  },

  async hasKey(key: string): Promise<boolean> {
    return localStorage.getItem(key) !== null;
  },
};

export type { EncryptedData };
export default cryptoStorage;

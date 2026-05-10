import { useState, useEffect, useCallback, useRef } from 'react';
import { cryptoStorage } from '../lib/crypto-storage';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useSecureStorage');

export type StorageType = 'localStorage' | 'sessionStorage';

export interface SecureStorageConfig<T> {
  key: string;
  defaultValue: T;
  storage?: StorageType;
  maxSize?: number;
  autoRefresh?: number;
  onError?: (error: Error) => void;
}

export interface SecureStorageReturn<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  remove: () => void;
  isLoading: boolean;
  error: Error | null;
}

const STORAGE_CHECK_INTERVAL = 60000;

function detectStorageManipulation<T>(value: T, storedIntegrity: string): boolean {
  try {
    const currentHash = hashValue(value);
    return currentHash !== storedIntegrity;
  } catch {
    return true;
  }
}

function hashValue(value: unknown): string {
  const str = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function useSecureStorage<T>(config: SecureStorageConfig<T>): SecureStorageReturn<T> {
  const {
    key,
    defaultValue,
    storage = 'localStorage',
    maxSize,
    autoRefresh,
    onError,
  } = config;

  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const defaultValueRef = useRef(defaultValue);
  const refreshIntervalRef = useRef<number | null>(null);

  const getStorageKey = useCallback((suffix: string) => `${key}_${suffix}`, [key]);

  const handleError = useCallback((err: Error, context: string) => {
    logger.error(`${context}: ${key}`, err);
    setError(err);
    onError?.(err);
  }, [key, onError]);

  const loadValue = useCallback(async () => {
    try {
      const storageKey = getStorageKey('data');
      const integrityKey = getStorageKey('integrity');

      if (storage === 'localStorage') {
        const storedValue = await cryptoStorage.getItem<T>(storageKey, null as unknown as T);
        const storedIntegrity = localStorage.getItem(integrityKey);

        if (storedIntegrity && detectStorageManipulation(storedValue, storedIntegrity)) {
          logger.warn(`Integrity check failed for key: ${key}`);
          cryptoStorage.removeItem(storageKey);
          localStorage.removeItem(integrityKey);
          setValue(defaultValueRef.current);
          return;
        }

        if (storedValue !== null) {
          setValue(storedValue);
          setError(null);
        } else {
          setValue(defaultValueRef.current);
        }
      } else {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setValue(parsed);
            setError(null);
          } catch {
            sessionStorage.removeItem(storageKey);
            setValue(defaultValueRef.current);
          }
        } else {
          setValue(defaultValueRef.current);
        }
      }
    } catch (err) {
      handleError(err instanceof Error ? err : new Error(String(err)), 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [key, storage, getStorageKey, handleError]);

  useEffect(() => {
    loadValue();

    if (autoRefresh && autoRefresh > 0) {
      refreshIntervalRef.current = window.setInterval(loadValue, autoRefresh * 1000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadValue, autoRefresh]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === getStorageKey('data') && event.newValue) {
        loadValue();
      }
    };

    if (storage === 'localStorage') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [storage, getStorageKey, loadValue]);

  const setNewValue = useCallback((newValue: T | ((prev: T) => T)) => {
    const valueToStore = newValue instanceof Function ? newValue(value) : newValue;

    if (storage === 'localStorage') {
      const storageKey = getStorageKey('data');
      const integrityKey = getStorageKey('integrity');

      cryptoStorage.setItem(storageKey, valueToStore, maxSize).then(success => {
        if (success) {
          const integrity = hashValue(valueToStore);
          localStorage.setItem(integrityKey, integrity);
          setValue(valueToStore);
          setError(null);
        } else {
          setValue(valueToStore);
          setError(new Error(CRYPTO_ERRORS.QUOTA_EXCEEDED));
        }
      }).catch(err => {
        handleError(err instanceof Error ? err : new Error(String(err)), 'Failed to save');
      });
    } else {
      sessionStorage.setItem(getStorageKey('data'), JSON.stringify(valueToStore));
      setValue(valueToStore);
      setError(null);
    }
  }, [key, storage, value, maxSize, getStorageKey, handleError]);

  const remove = useCallback(() => {
    if (storage === 'localStorage') {
      cryptoStorage.removeItem(getStorageKey('data'));
      localStorage.removeItem(getStorageKey('integrity'));
    } else {
      sessionStorage.removeItem(getStorageKey('data'));
    }
    setValue(defaultValueRef.current);
    setError(null);
  }, [key, storage, getStorageKey]);

  return {
    value,
    setValue: setNewValue,
    remove,
    isLoading,
    error,
  };
}

const CRYPTO_ERRORS = {
  QUOTA_EXCEEDED: 'Storage quota exceeded',
  ENCRYPTION_FAILED: 'Encryption failed',
  DECRYPTION_FAILED: 'Decryption failed',
  INVALID_KEY: 'Invalid encryption key',
  STORAGE_DISABLED: 'Storage is disabled',
} as const;

export function useEncryptedState<T>(key: string, defaultValue: T) {
  return useSecureStorage<T>({
    key: `enc_${key}`,
    defaultValue,
    storage: 'localStorage',
  });
}

export function useSessionState<T>(key: string, defaultValue: T) {
  return useSecureStorage<T>({
    key: `sess_${key}`,
    defaultValue,
    storage: 'sessionStorage',
  });
}

export function createSecureStorage<T>(key: string, defaultValue: T) {
  return {
    get: () => useSecureStorage({ key, defaultValue }),
    set: (value: T) => {
      cryptoStorage.setItem(key, value);
    },
    remove: () => cryptoStorage.removeItem(key),
  };
}

export default useSecureStorage;

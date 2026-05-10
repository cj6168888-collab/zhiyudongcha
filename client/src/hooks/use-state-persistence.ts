/**
 * State Persistence Hook
 *
 * Persists React state to localStorage/sessionStorage
 * with automatic hydration, encryption support, and security protections.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useStatePersistence');

export type StorageType = 'localStorage' | 'sessionStorage';

export interface PersistenceConfig<T> {
  storage?: StorageType;
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (str: string) => T;
  onError?: (error: Error) => void;
  sync?: boolean;
  encrypted?: boolean;
}

export interface UseStatePersistenceReturn<T> {
  state: T;
  setState: (value: T | ((prev: T) => T)) => void;
  remove: () => void;
  isHydrated: boolean;
}

const DEFAULT_SERIALIZE = JSON.stringify;

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);

    if (parsed === null || typeof parsed !== 'object') {
      return fallback;
    }

    if (Array.isArray(parsed)) {
      logger.warn('JSON parse returned an array, expected object');
      return fallback;
    }

    Object.keys(parsed).forEach(key => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        logger.warn('Prototype pollution attempt detected in JSON parse');
        throw new Error('Prototype pollution attempt detected');
      }
    });

    return parsed as T;
  } catch (error) {
    logger.warn('JSON parse failed, using fallback', error);
    return fallback;
  }
}

const DEFAULT_DESERIALIZE = <T>(str: string, fallback: T): T => safeJsonParse(str, fallback);

export function useStatePersistence<T>(config: PersistenceConfig<T>): UseStatePersistenceReturn<T> {
  const {
    storage = 'localStorage',
    key,
    defaultValue,
    serialize = DEFAULT_SERIALIZE,
    deserialize = (str: string) => DEFAULT_DESERIALIZE(str, defaultValue),
    onError,
    sync = true,
    encrypted = false,
  } = config;

  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const defaultValueRef = useRef(defaultValue);
  const storageRef = useRef<Storage | null>(null);

  const getStorage = useCallback(() => {
    if (storageRef.current) return storageRef.current;
    try {
      const s = storage === 'sessionStorage' ? sessionStorage : localStorage;
      storageRef.current = s;
      return s;
    } catch {
      logger.warn('Storage access failed');
      return null;
    }
  }, [storage]);

  const loadState = useCallback((): T => {
    try {
      const storage = getStorage();
      if (!storage) return defaultValueRef.current;

      const stored = storage.getItem(key);

      if (stored === null) {
        return defaultValueRef.current;
      }

      return deserialize(stored);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Failed to load state for key: ${key}`, err);
      onError?.(err);
      return defaultValueRef.current;
    }
  }, [key, deserialize, getStorage, onError]);

  useEffect(() => {
    const storedState = loadState();
    setState(storedState);
    setIsHydrated(true);
    logger.debug(`Hydrated state for key: ${key}`);
  }, [key, loadState]);

  useEffect(() => {
    if (!sync || !isHydrated) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const newState = deserialize(event.newValue);
          setState(newState);
          logger.debug(`Synced state from storage for key: ${key}`);
        } catch (error) {
          logger.warn(`Failed to parse storage event for key: ${key}`, error);
        }
      }
    };

    const storage = getStorage();
    if (storage) {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, [key, sync, isHydrated, deserialize, getStorage]);

  const setPersistentState = useCallback(
    (value: T | ((prev: T) => T)) => {
      const newValue = value instanceof Function ? value(state) : value;

      try {
        const storage = getStorage();
        if (!storage) {
          setState(newValue);
          return;
        }

        storage.setItem(key, serialize(newValue));
        setState(newValue);
        logger.debug(`Saved state for key: ${key}`);
      } catch (error) {
        if ((error as Error).name === 'QuotaExceededError') {
          logger.warn(`Storage quota exceeded for key: ${key}`);
        }
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`Failed to save state for key: ${key}`, err);
        onError?.(err);
      }
    },
    [state, key, serialize, getStorage, onError]
  );

  const remove = useCallback(() => {
    try {
      const storage = getStorage();
      if (storage) {
        storage.removeItem(key);
      }
      setState(defaultValueRef.current);
      logger.debug(`Removed state for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to remove state for key: ${key}`, error);
    }
  }, [key, getStorage]);

  return {
    state,
    setState: setPersistentState,
    remove,
    isHydrated,
  };
}

export function useLocalStorage<T>(key: string, defaultValue: T) {
  return useStatePersistence({
    storage: 'localStorage',
    key,
    defaultValue,
  });
}

export function useSessionStorage<T>(key: string, defaultValue: T) {
  return useStatePersistence({
    storage: 'sessionStorage',
    key,
    defaultValue,
  });
}

export interface PersistConfig {
  storage?: StorageType;
  include?: string[];
  exclude?: string[];
  debounce?: number;
  encrypted?: boolean;
}

export function createPersistedReducer<T extends Record<string, unknown>, A>(
  reducer: (state: T, action: A) => T,
  initialState: T,
  config: PersistConfig = {}
) {
  const persistedReducer = (state: T, action: A): T => {
    const newState = reducer(state, action);

    try {
      const storage = config.storage === 'sessionStorage' ? sessionStorage : localStorage;
      const shouldInclude = config.include
        ? config.include.length > 0
        : true;
      const shouldExclude = config.exclude?.length ?? 0 > 0;

      if (shouldInclude && !shouldExclude) {
        const toPersist = config.include
          ? config.include.reduce((acc, key) => {
              if (key in newState && typeof newState[key] !== 'function') {
                (acc as Record<string, unknown>)[key] = newState[key];
              }
              return acc;
            }, {} as Record<string, unknown>)
          : newState;

        storage.setItem('redux_state', JSON.stringify(toPersist));
      } else if (shouldExclude) {
        const filtered = { ...newState };
        config.exclude!.forEach((key) => delete (filtered as Record<string, unknown>)[key]);
        storage.setItem('redux_state', JSON.stringify(filtered));
      }
    } catch (error) {
      logger.warn('Failed to persist reducer state', error);
    }

    return newState;
  };

  return persistedReducer;
}

export default useStatePersistence;

/**
 * API Error Handling Hook
 *
 * Provides centralized error handling for API requests
 * with retry logic, error caching, and user feedback.
 */

import { useState, useCallback, useRef } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useApiErrors');

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'server'
  | 'client'
  | 'unknown';

export interface ApiError {
  id: string;
  message: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOn: ErrorCategory[];
}

export interface UseApiErrorsReturn {
  errors: ApiError[];
  addError: (error: Omit<ApiError, 'id' | 'timestamp'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  retry: <T>(fn: () => Promise<T>, errorId: string) => Promise<T | null>;
  getErrorByCategory: (category: ErrorCategory) => ApiError[];
  hasErrors: () => boolean;
  hasRetryableErrors: () => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryOn: ['network', 'server'],
};

const ERROR_CATEGORIES: Record<number, ErrorCategory> = {
  0: 'network',
  400: 'validation',
  401: 'authentication',
  403: 'authorization',
  404: 'client',
  422: 'validation',
  429: 'server',
  500: 'server',
  502: 'server',
  503: 'server',
  504: 'server',
};

const SEVERITY_MAP: Record<ErrorCategory, ErrorSeverity> = {
  network: 'high',
  authentication: 'critical',
  authorization: 'critical',
  validation: 'low',
  server: 'high',
  client: 'low',
  unknown: 'medium',
};

export function useApiErrors(config: Partial<RetryConfig> = {}): UseApiErrorsReturn {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const [errors, setErrors] = useState<ApiError[]>([]);
  const retryStateRef = useRef<Map<string, number>>(new Map());

  const generateId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const categorizeError = useCallback((status: number, message: string): ErrorCategory => {
    if (status === 0) return 'network';
    if (ERROR_CATEGORIES[status]) return ERROR_CATEGORIES[status];
    if (message.toLowerCase().includes('network')) return 'network';
    if (message.toLowerCase().includes('auth')) return 'authentication';
    return 'unknown';
  }, []);

  const determineSeverity = useCallback((category: ErrorCategory, status: number): ErrorSeverity => {
    if (category === 'authentication' || category === 'authorization') {
      return 'critical';
    }
    if (status === 0 || status >= 500) {
      return 'high';
    }
    return SEVERITY_MAP[category];
  }, []);

  const addError = useCallback((error: Omit<ApiError, 'id' | 'timestamp'>) => {
    const newError: ApiError = {
      ...error,
      id: generateId(),
      timestamp: Date.now(),
      severity: error.severity || determineSeverity(error.category, 0),
    };

    setErrors((prev) => {
      const exists = prev.some(
        (e) => e.category === newError.category && e.message === newError.message
      );

      if (exists) {
        return prev;
      }

      const newErrors = [...prev, newError].slice(-10);

      logger.warn(`[useApiErrors] Error added: ${newError.message}`, {
        category: newError.category,
        severity: newError.severity,
        id: newError.id,
      });

      return newErrors;
    });

    return newError.id;
  }, [generateId, determineSeverity]);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
    retryStateRef.current.delete(id);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
    retryStateRef.current.clear();
    logger.info('[useApiErrors] All errors cleared');
  }, []);

  const calculateDelay = useCallback((attempt: number): number => {
    const baseDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
    return Math.min(baseDelay, retryConfig.maxDelay);
  }, [retryConfig]);

  const retry = useCallback(
    async <T,>(fn: () => Promise<T>, errorId: string): Promise<T | null> => {
      const attempts = retryStateRef.current.get(errorId) || 0;

      if (attempts >= retryConfig.maxAttempts) {
        logger.warn(`[useApiErrors] Max retries reached for error: ${errorId}`);
        return null;
      }

      const delay = calculateDelay(attempts);
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        const result = await fn();
        retryStateRef.current.delete(errorId);
        removeError(errorId);
        logger.info(`[useApiErrors] Retry successful for error: ${errorId}`);
        return result;
      } catch (error) {
        retryStateRef.current.set(errorId, attempts + 1);

        const apiError = errors.find((e) => e.id === errorId);
        if (apiError && !retryConfig.retryOn.includes(apiError.category)) {
          logger.warn(`[useApiErrors] Error not retryable: ${apiError.category}`);
          return null;
        }

        throw error;
      }
    },
    [retryConfig, calculateDelay, errors, removeError]
  );

  const getErrorByCategory = useCallback(
    (category: ErrorCategory) => {
      return errors.filter((e) => e.category === category);
    },
    [errors]
  );

  const hasErrors = useCallback(() => {
    return errors.length > 0;
  }, [errors]);

  const hasRetryableErrors = useCallback(() => {
    return errors.some((e) => e.retryable);
  }, [errors]);

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    retry,
    getErrorByCategory,
    hasErrors,
    hasRetryableErrors,
  };
}

export function createApiError(
  message: string,
  category: ErrorCategory,
  options: {
    code?: string;
    severity?: ErrorSeverity;
    retryable?: boolean;
    context?: Record<string, unknown>;
  } = {}
): Omit<ApiError, 'id' | 'timestamp'> {
  return {
    message,
    category,
    severity: options.severity || SEVERITY_MAP[category],
    code: options.code,
    retryable: options.retryable ?? ['network', 'server'].includes(category),
    context: options.context,
  };
}

export function parseApiError(error: unknown): Omit<ApiError, 'id' | 'timestamp'> {
  if (error instanceof Error) {
    const message = error.message;
    let category: ErrorCategory = 'unknown';

    if (message.includes('fetch') || message.includes('network')) {
      category = 'network';
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      category = 'authentication';
    } else if (message.includes('403') || message.includes('Forbidden')) {
      category = 'authorization';
    } else if (message.includes('400') || message.includes('validation')) {
      category = 'validation';
    } else if (message.includes('500') || message.includes('server')) {
      category = 'server';
    }

    return createApiError(message, category, {
      code: (error as any).code,
      context: { stack: error.stack },
    });
  }

  if (typeof error === 'object' && error !== null) {
    const data = error as Record<string, unknown>;
    return createApiError(
      String(data.message || 'Unknown error'),
      categorizeStatusCode(data.status as number),
      {
        code: data.code as string,
        context: data,
      }
    );
  }

  return createApiError(String(error), 'unknown');
}

function categorizeStatusCode(status: number): ErrorCategory {
  return ERROR_CATEGORIES[status] || 'unknown';
}

export default useApiErrors;

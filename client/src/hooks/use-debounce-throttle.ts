/**
 * Debounce and Throttle Hooks
 *
 * Provides debounce and throttle utilities for
 * performance optimization.
 */

import { useRef, useEffect, useCallback } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): {
  debounced: T;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
} {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastResultRef = useRef<ReturnType<T> | undefined>(undefined);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback((): ReturnType<T> | undefined => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      return lastResultRef.current;
    }
    return undefined;
  }, []);

  const debounced = useCallback(
    ((...args: Parameters<T>) => {
      cancel();

      const result = callback(...args);
      lastResultRef.current = result;

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
      }, delay);

      return result;
    }) as T,
    [callback, delay, cancel]
  );

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { debounced, cancel, flush };
}

export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  interval: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = interval - (now - lastCallRef.current);

      if (remaining <= 0 || remaining > interval) {
        lastCallRef.current = now;
        callback(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = null;
          callback(...args);
        }, remaining);
      }
    }) as T,
    [callback, interval]
  );
}

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number
): {
  throttled: T;
  cancel: () => void;
} {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const throttled = useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = interval - (now - lastCallRef.current);

      if (remaining <= 0 || remaining > interval) {
        lastCallRef.current = now;
        callback(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = null;
          callback(...args);
        }, remaining);
      }
    }) as T,
    [callback, interval, cancel]
  );

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { throttled, cancel };
}

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedState<T>(initialValue: T, delay: number): [T, (value: T) => void] {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setDebouncedValue = useCallback(
    (newValue: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setValue(newValue);
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, setDebouncedValue];
}

export function useDebouncedEffect(effect: () => void | (() => void), deps: any[], delay: number): void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      const cleanup = effect();
      cleanupRef.current = cleanup || null;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, deps);
}

export function debounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  callback: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = interval - (now - lastCall);

    if (remaining <= 0 || remaining > interval) {
      lastCall = now;
      callback(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        callback(...args);
      }, remaining);
    }
  };
}

export function throttlePromise<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  interval: number
): (...args: Args) => Promise<T | null> {
  let lastCall = 0;
  let pending: Promise<T> | null = null;

  return async (...args: Args): Promise<T | null> => {
    const now = Date.now();
    const remaining = interval - (now - lastCall);

    if (pending && remaining > 0) {
      return pending;
    }

    if (remaining <= 0 || remaining > interval) {
      lastCall = now;
      pending = fn(...args);
      try {
        return await pending;
      } finally {
        pending = null;
      }
    }

    return new Promise((resolve) => {
      setTimeout(async () => {
        lastCall = Date.now();
        pending = fn(...args);
        try {
          resolve(await pending);
        } finally {
          pending = null;
        }
      }, remaining);
    });
  };
}

import { useState } from 'react';

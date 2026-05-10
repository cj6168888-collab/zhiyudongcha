/**
 * Toast Notification System
 *
 * Provides a global toast notification system with
 * multiple types, auto-dismiss, and animations.
 */

import { Button } from "@/components/ui/button";
import React, { createContext, useContext, useCallback, useState, useRef, useEffect, ReactNode } from 'react';
import { createServiceLogger } from '../../lib/logger';

const logger = createServiceLogger('Toast');

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  closable?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

export interface ToastConfig {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  maxVisible?: number;
  defaultDuration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: Omit<Toast, 'id'>) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const DEFAULT_CONFIG: Required<ToastConfig> = {
  position: 'top-right',
  maxVisible: 5,
  defaultDuration: 5000,
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  default: '🔔',
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children, config = {} }: { children: ReactNode; config?: ToastConfig }) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const generateId = useCallback(() => {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const removeToast = useCallback((id: string, callback?: () => void) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }

    callback?.();
    logger.debug(`[Toast] Removed toast: ${id}`);
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = generateId();
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration ?? mergedConfig.defaultDuration,
        closable: toast.closable ?? true,
      };

      setToasts((prev) => {
        const updated = [newToast, ...prev].slice(0, mergedConfig.maxVisible);
        return updated;
      });

      if (newToast.duration && newToast.duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
        timersRef.current.set(id, timer);
      }

      logger.debug(`[Toast] Added toast: ${id}`);
      return id;
    },
    [generateId, mergedConfig, removeToast]
  );

  const toast = useCallback(
    (options: Omit<Toast, 'id'>): string => {
      return addToast(options);
    },
    [addToast]
  );

  const success = useCallback(
    (title: string, message?: string): string => {
      return addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string): string => {
      return addToast({ type: 'error', title, message, duration: 8000 });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string): string => {
      return addToast({ type: 'warning', title, message });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string): string => {
      return addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const getPositionStyle = (): React.CSSProperties => {
    switch (mergedConfig.position) {
      case 'top-left':
        return { top: 16, left: 16 };
      case 'top-right':
        return { top: 16, right: 16 };
      case 'bottom-left':
        return { bottom: 16, left: 16 };
      case 'bottom-right':
        return { bottom: 16, right: 16 };
      case 'top-center':
        return { top: 16, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-center':
        return { bottom: 16, left: '50%', transform: 'translateX(-50%)' };
      default:
        return { top: 16, right: 16 };
    }
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss, dismissAll }}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            ...getPositionStyle(),
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }): React.ReactElement {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (toast.duration === 0) return;

    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, toast.duration! - 300);

    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const handleClick = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  const getTypeStyles = (): React.CSSProperties => {
    const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
      success: { bg: '#E8F5E9', border: '#4CAF50', icon: '✅' },
      error: { bg: '#FFEBEE', border: '#F44336', icon: '❌' },
      warning: { bg: '#FFF3E0', border: '#FF9800', icon: '⚠️' },
      info: { bg: '#E3F2FD', border: '#2196F3', icon: 'ℹ️' },
      default: { bg: '#FAFAFA', border: '#9E9E9E', icon: '🔔' },
    };
    return {
      backgroundColor: colors[toast.type].bg,
      borderLeft: `4px solid ${colors[toast.type].border}`,
    };
  };

  return (
    <div
      style={{
        ...getTypeStyles(),
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        maxWidth: '400px',
        minWidth: '300px',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateX(100%)' : 'translateX(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
      role="alert"
      aria-atomic="true"
    >
      <span style={{ fontSize: 20 }}>{TOAST_ICONS[toast.type]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{toast.title}</div>
        {toast.message && (
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>{toast.message}</div>
        )}
        {toast.action && (
          <Button variant="outline" onClick={toast.action.onClick}>{toast.action.label}</Button>
        )}
      </div>
      {toast.closable && (
        <Button variant="outline" onClick={handleClick} aria-label="关闭">✕</Button>
      )}
    </div>
  );
}

export default ToastProvider;

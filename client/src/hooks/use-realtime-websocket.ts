/**
 * Enhanced WebSocket Hook with Exponential Backoff Reconnection
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Reconnection progress tracking
 * - Configurable retry limits
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useRealtimeWebSocket');

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface ReconnectConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export interface UseRealtimeWebSocketOptions {
  url: string;
  reconnectConfig?: Partial<ReconnectConfig>;
  onOpen?: () => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  autoConnect?: boolean;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
};

interface ReconnectState {
  attempt: number;
  nextDelay: number;
  lastConnectedAt: number | null;
}

export interface UseRealtimeWebSocketReturn {
  state: ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectProgress: string;
  reconnectState: ReconnectState;
  connect: () => void;
  disconnect: () => void;
  send: (data: string | ArrayBuffer) => void;
  lastError: string | null;
}

export function useRealtimeWebSocket({
  url,
  reconnectConfig = {},
  onOpen,
  onMessage,
  onClose,
  onError,
  autoConnect = false,
}: UseRealtimeWebSocketOptions): UseRealtimeWebSocketReturn {
  const mergedConfig = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };

  const [state, setState] = useState<ConnectionState>('disconnected');
  const [reconnectState, setReconnectState] = useState<ReconnectState>({
    attempt: 0,
    nextDelay: 0,
    lastConnectedAt: null,
  });
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateDelay = useCallback(
    (attempt: number): number => {
      const baseDelay =
        mergedConfig.initialDelay *
        Math.pow(mergedConfig.backoffMultiplier, attempt);

      const jitter = baseDelay * mergedConfig.jitterFactor;
      const actualDelay = baseDelay + jitter * (Math.random() - 0.5) * 2;

      return Math.min(
        Math.max(actualDelay, mergedConfig.initialDelay * 0.5),
        mergedConfig.maxDelay
      );
    },
    [mergedConfig]
  );

  const getReconnectProgress = useCallback((): string => {
    if (state === 'connected') {
      return '已连接';
    }
    if (state === 'reconnecting') {
      return `重连中 (${reconnectState.attempt}/${mergedConfig.maxAttempts})`;
    }
    if (state === 'failed') {
      return `重连失败 (已尝试 ${reconnectState.attempt} 次)`;
    }
    return '未连接';
  }, [state, reconnectState.attempt, mergedConfig.maxAttempts]);

  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch {
          logger.warn('[useRealtimeWebSocket] Heartbeat failed');
        }
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      logger.debug('[useRealtimeWebSocket] Already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      logger.debug('[useRealtimeWebSocket] Connection in progress');
      return;
    }

    setState('connecting');
    setLastError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.info('[useRealtimeWebSocket] Connected successfully');
        setState('connected');
        setReconnectState({
          attempt: 0,
          nextDelay: 0,
          lastConnectedAt: Date.now(),
        });
        setLastError(null);
        startHeartbeat();
        onOpen?.();
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') {
          return;
        }
        onMessage?.(event);
      };

      ws.onclose = (event) => {
        logger.warn(
          `[useRealtimeWebSocket] Connection closed: ${event.code} - ${event.reason}`
        );
        stopHeartbeat();
        onClose?.(event);

        if (!event.wasClean && reconnectState.attempt < mergedConfig.maxAttempts) {
          const delay = calculateDelay(reconnectState.attempt);
          setReconnectState((prev) => ({
            ...prev,
            attempt: prev.attempt + 1,
            nextDelay: delay,
          }));
          setState('reconnecting');
          setLastError(`连接断开，${delay / 1000}秒后自动重连`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectState.attempt >= mergedConfig.maxAttempts) {
          setState('failed');
          setLastError('重连次数已达上限，请刷新页面重试');
        }
      };

      ws.onerror = (event) => {
        logger.error('[useRealtimeWebSocket] Connection error');
        setLastError('连接发生错误');
        onError?.(event);
      };
    } catch (error) {
      logger.error('[useRealtimeWebSocket] Failed to create connection:', error);
      setLastError('无法建立连接');
      setState('failed');
    }
  }, [
    url,
    onOpen,
    onMessage,
    onClose,
    onError,
    reconnectState.attempt,
    mergedConfig.maxAttempts,
    calculateDelay,
    startHeartbeat,
    stopHeartbeat,
  ]);

  const disconnect = useCallback(() => {
    logger.info('[useRealtimeWebSocket] Manual disconnect');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setState('disconnected');
    setReconnectState({
      attempt: 0,
      nextDelay: 0,
      lastConnectedAt: null,
    });
  }, [stopHeartbeat]);

  const send = useCallback(
    (data: string | ArrayBuffer) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      } else {
        logger.warn('[useRealtimeWebSocket] Cannot send: not connected');
        setLastError('发送失败：连接已断开');
      }
    },
    []
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
    };
  }, [autoConnect, connect, stopHeartbeat]);

  return {
    state,
    isConnected: state === 'connected',
    isReconnecting: state === 'reconnecting',
    reconnectProgress: getReconnectProgress(),
    reconnectState,
    connect,
    disconnect,
    send,
    lastError,
  };
}

export default useRealtimeWebSocket;

/**
 * Reconnection Status Component
 *
 * Displays WebSocket connection status with reconnection progress.
 */

import { Button } from "@/components/ui/button";
import React from 'react';
import { ConnectionState, UseRealtimeWebSocketReturn } from '../../hooks/use-realtime-websocket';

interface ReconnectionStatusProps {
  state: ConnectionState;
  reconnectProgress: string;
  reconnectState: UseRealtimeWebSocketReturn['reconnectState'];
  lastError: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
}

export function ReconnectionStatus({
  state,
  reconnectProgress,
  reconnectState,
  lastError,
  onRetry,
  onRefresh,
}: ReconnectionStatusProps): React.ReactElement | null {
  if (state === 'connected') {
    return null;
  }

  const getStatusConfig = () => {
    switch (state) {
      case 'connecting':
        return {
          icon: '🔄',
          color: '#2196F3',
          bgColor: '#E3F2FD',
          title: '正在连接...',
        };
      case 'reconnecting':
        return {
          icon: '📡',
          color: '#FF9800',
          bgColor: '#FFF3E0',
          title: reconnectProgress,
        };
      case 'failed':
        return {
          icon: '❌',
          color: '#F44336',
          bgColor: '#FFEBEE',
          title: '连接失败',
        };
      default:
        return {
          icon: '🔌',
          color: '#9E9E9E',
          bgColor: '#F5F5F5',
          title: '未连接',
        };
    }
  };

  const config = getStatusConfig();

  const progress =
    state === 'reconnecting'
      ? Math.min((reconnectState.attempt / 5) * 100, 100)
      : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}30`,
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: state === 'reconnecting' ? '12px' : 0,
        }}
      >
        <span
          style={{
            fontSize: '24px',
            marginRight: '12px',
            animation: state === 'connecting' || state === 'reconnecting' ? 'spin 1s linear infinite' : 'none',
          }}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: config.color,
            }}
          >
            {config.title}
          </div>
          {state === 'reconnecting' && (
            <div
              style={{
                fontSize: '12px',
                color: '#E65100',
                marginTop: '4px',
              }}
            >
              等待 {Math.round(reconnectState.nextDelay / 1000)} 秒后重试
            </div>
          )}
        </div>
      </div>

      {state === 'reconnecting' && (
        <div
          style={{
            height: '4px',
            backgroundColor: '#FFE0B2',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: config.color,
              transition: 'width 0.5s ease-out',
            }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {lastError && (
        <div
          style={{
            fontSize: '12px',
            color: '#C62828',
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#FFCDD2',
            borderRadius: '4px',
          }}
          role="alert"
        >
          {lastError}
        </div>
      )}

      {state === 'failed' && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
          }}
        >
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>重新连接</Button>
          )}
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh}>刷新页面</Button>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ReconnectionStatus;

/**
 * 同步状态 Hook
 * 用于监控应用的离线/在线状态和同步统计
 */

import { useState, useEffect, useCallback } from 'react';

interface SyncStats {
  messagesCount: number;
  configsCount: number;
  statesCount: number;
  dbEnabled: boolean;
}

interface UseSyncStatusReturn {
  isOnline: boolean;
  networkStatus: 'ONLINE' | 'OFFLINE' | 'UNSTABLE';
  pendingSyncCount: number;
  lastSyncTime: number | null;
  stats: SyncStats | null;
  refreshStatus: () => Promise<void>;
  clearSyncStorage: () => Promise<void>;
}

const SYNC_STATUS_KEY = 'sync_status_cache';

export function useSyncStatus(userId: string): UseSyncStatusReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkStatus, setNetworkStatus] = useState<
    'ONLINE' | 'OFFLINE' | 'UNSTABLE'
  >('ONLINE');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/sync/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPendingSyncCount(data.data?.pendingCount || 0);
          setLastSyncTime(data.data?.lastSyncTime || null);
          setStats(data.data?.stats || null);
        }
      }
    } catch (error) {
      console.warn('[useSyncStatus] Failed to fetch sync status:', error);
    }
  }, [userId]);

  const clearStorage = useCallback(async () => {
    try {
      await fetch('/api/sync/clear', { method: 'POST' });
      await fetchStatus();
    } catch (error) {
      console.warn('[useSyncStatus] Failed to clear sync storage:', error);
    }
  }, [fetchStatus]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkStatus('ONLINE');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkStatus('OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkNetwork = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        setNetworkStatus('OFFLINE');
        return;
      }

      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch('/api/health', {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        setIsOnline(true);
        setNetworkStatus(latency > 3000 ? 'UNSTABLE' : 'ONLINE');
      } catch {
        setIsOnline(navigator.onLine);
        setNetworkStatus(navigator.onLine ? 'UNSTABLE' : 'OFFLINE');
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      fetchStatus();
    }
  }, [isOnline, fetchStatus]);

  return {
    isOnline,
    networkStatus,
    pendingSyncCount,
    lastSyncTime,
    stats,
    refreshStatus: fetchStatus,
    clearSyncStorage: clearStorage,
  };
}

export default useSyncStatus;

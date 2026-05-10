import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { DiagnosticsPlugin } from '../plugins';
import type { HealthReport } from '../plugins/definitions';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('useDiagnostics');

export interface UseDiagnosticsResult {
  isAvailable: boolean;
  health: HealthReport | null;
  isChecking: boolean;
  checkHealth: () => Promise<void>;
}

export function useDiagnostics(runOnMount = true): UseDiagnosticsResult {
  const [isAvailable] = useState(() => Capacitor.isNativePlatform());
  const [health, setHealth]       = useState<HealthReport | null>(null);
  const [isChecking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    if (!isAvailable) return;
    setChecking(true);
    try {
      const report = await DiagnosticsPlugin.checkHealth();
      setHealth(report);
      log.info('Health check complete', {
        jni:     report.jni_loaded,
        tts:     report.tts_ready,
        storage: report.free_storage_mb,
      });
    } catch (err) {
      log.error('DiagnosticsPlugin.checkHealth failed', err);
    } finally {
      setChecking(false);
    }
  }, [isAvailable]);

  useEffect(() => {
    if (runOnMount) checkHealth();
  }, [runOnMount, checkHealth]);

  return { isAvailable, health, isChecking, checkHealth };
}

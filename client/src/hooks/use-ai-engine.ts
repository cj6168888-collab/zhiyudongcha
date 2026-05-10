import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { AIEngine } from '../plugins';
import type { AIMode, EngineStatus, IntelligenceUpdateEvent } from '../plugins/definitions';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('useAIEngine');

export interface AIEngineQueryOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AIEngineQueryResult {
  /** null means the query must be routed to the cloud backend */
  text: string | null;
  tier: 1 | 2 | 3;
  tierName: string;
}

export interface UseAIEngineResult {
  isAvailable: boolean;
  engineMode: AIMode;
  engineStatus: EngineStatus | null;
  /**
   * Run a query through the 4-tier router.
   * Returns null text when Tier 3/4 (ROUTE_TO_CLOUD) — caller should fall
   * back to the backend HybridAssistant in that case.
   */
  processQuery: (prompt: string, options?: AIEngineQueryOptions) => Promise<AIEngineQueryResult>;
  refreshStatus: () => Promise<void>;
  triggerDownload: () => Promise<void>;
}

export function useAIEngine(): UseAIEngineResult {
  const [isAvailable] = useState(() => Capacitor.isNativePlatform());
  const [engineMode, setEngineMode] = useState<AIMode>('IDLE');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const listenerRef = useRef<PluginListenerHandle | null>(null);

  // Subscribe to intelligence mode updates (situational awareness)
  useEffect(() => {
    if (!isAvailable) return;

    AIEngine.addListener('intelligenceUpdate', (ev: IntelligenceUpdateEvent) => {
      setEngineMode(ev.currentMode);
    })
      .then((handle) => { listenerRef.current = handle; })
      .catch((err) => log.error('Failed to register intelligenceUpdate listener', err));

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [isAvailable]);

  const refreshStatus = useCallback(async () => {
    if (!isAvailable) return;
    try {
      const status = await AIEngine.getEngineStatus();
      setEngineStatus(status);
    } catch (err) {
      log.error('getEngineStatus failed', err);
    }
  }, [isAvailable]);

  const processQuery = useCallback(async (
    prompt: string,
    options?: AIEngineQueryOptions,
  ): Promise<AIEngineQueryResult> => {
    if (!isAvailable) {
      return { text: null, tier: 3, tierName: 'cloud_api' };
    }
    try {
      const res = await AIEngine.processQuery({
        prompt,
        systemPrompt: options?.systemPrompt,
        maxTokens:    options?.maxTokens,
      });

      if (!res.routed || res.result === 'ROUTE_TO_CLOUD') {
        return { text: null, tier: 3, tierName: 'cloud_api' };
      }
      return { text: res.result, tier: res.tier, tierName: res.tierName };
    } catch (err) {
      log.warn('AIEngine.processQuery failed, routing to cloud', err);
      return { text: null, tier: 3, tierName: 'cloud_api' };
    }
  }, [isAvailable]);

  const triggerDownload = useCallback(async () => {
    if (!isAvailable) return;
    try {
      await AIEngine.triggerModelDownload();
      log.info('Model download triggered');
    } catch (err) {
      log.error('triggerModelDownload failed', err);
    }
  }, [isAvailable]);

  return { isAvailable, engineMode, engineStatus, processQuery, refreshStatus, triggerDownload };
}

import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SecurityPlugin } from '../plugins';
import type { BiometricError } from '../plugins/definitions';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('useNativeBiometric');

export type BiometricStatus = 'idle' | 'checking' | 'authenticating' | 'granted' | 'denied';

export interface UseNativeBiometricResult {
  /** Whether the device supports biometric auth */
  isAvailable: boolean;
  /** Specific unavailability reason when isAvailable=false */
  unavailableReason: BiometricError | null;
  status: BiometricStatus;
  /** True once the user has successfully authenticated this session */
  isGranted: boolean;
  /** Trigger the biometric prompt. Resolves true on success, false on failure/cancel */
  authenticate: () => Promise<boolean>;
  /** Reset grant so the next sensitive action re-authenticates */
  revokeGrant: () => void;
}

export function useNativeBiometric(): UseNativeBiometricResult {
  const [isAvailable, setIsAvailable]           = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<BiometricError | null>(null);
  const [status, setStatus]                     = useState<BiometricStatus>('idle');
  const [isGranted, setIsGranted]               = useState(false);

  // Check availability once on mount
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    setStatus('checking');
    SecurityPlugin.checkBiometricAvailability()
      .then(({ available, error }) => {
        setIsAvailable(available);
        setUnavailableReason(error ?? null);
        setStatus('idle');
      })
      .catch((err) => {
        log.error('checkBiometricAvailability failed', err);
        setStatus('idle');
      });
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    // Already granted this session — skip re-prompt
    if (isGranted) return true;

    // Web or no hardware — treat as allowed (no native gate)
    if (!Capacitor.isNativePlatform() || !isAvailable) return true;

    setStatus('authenticating');
    try {
      await SecurityPlugin.authenticate();
      setIsGranted(true);
      setStatus('granted');
      log.info('Biometric authentication succeeded');
      return true;
    } catch (err) {
      setStatus('denied');
      log.warn('Biometric authentication failed or cancelled', err);
      // Reset to idle after a short delay so the user can retry
      setTimeout(() => setStatus('idle'), 1500);
      return false;
    }
  }, [isAvailable, isGranted]);

  const revokeGrant = useCallback(() => {
    setIsGranted(false);
    setStatus('idle');
  }, []);

  return { isAvailable, unavailableReason, status, isGranted, authenticate, revokeGrant };
}

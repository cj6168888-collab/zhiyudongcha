import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InterfaceMode = 'business' | 'anime';

interface OnboardingState {
  hasCompletedSetup: boolean;
  interfaceMode: InterfaceMode;
  setupCompletedAt: number | null;
  
  completeSetup: (mode: InterfaceMode) => void;
  resetSetup: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedSetup: false,
      interfaceMode: 'business',
      setupCompletedAt: null,

      completeSetup: (mode) => {
        set({
          hasCompletedSetup: true,
          interfaceMode: mode,
          setupCompletedAt: Date.now(),
        });
      },

      resetSetup: () => {
        set({
          hasCompletedSetup: false,
          interfaceMode: 'business',
          setupCompletedAt: null,
        });
      },
    }),
    {
      name: 'avatar-onboarding-storage',
    }
  )
);

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { cryptoStorage } from './crypto-storage';

export type InterfaceMode = 'business' | 'anime';

export interface OnboardingState {
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
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          return await cryptoStorage.getItem<string | null>(name, null);
        },
        setItem: async (name: string, value: string) => {
          await cryptoStorage.setItem(name, value);
        },
        removeItem: async (name: string) => {
          cryptoStorage.removeItem(name);
        },
      })),
    }
  )
);

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { cryptoStorage } from '../crypto-storage';
import { createServiceLogger } from '../logger';

const logger = createServiceLogger('Z1GodProtocol');

export type Role = 'MASTER' | 'GUEST';
export type AcademicLevel = 'BACHELOR' | 'MASTER' | 'DOCTOR' | 'PROFESSOR' | 'EXPERT';

export const ACADEMIC_LEVELS: AcademicLevel[] = ['BACHELOR', 'MASTER', 'DOCTOR', 'PROFESSOR', 'EXPERT'];
export const MAX_HP = 1000;

export type AIServiceType = 'PRIMARY' | 'LEGAL' | 'FINANCE' | 'STRATEGY';

export interface AIServiceConfig {
  type: AIServiceType;
  provider: 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'QWEN' | 'CUSTOM';
  name: string;
  endpoint?: string;
  model?: string;
  apiKey?: string;
  isActive: boolean;
  isConfigured: boolean;
  assignedExperts: string[];
}

interface OwnerConfig {
  apiKey?: string;
  masterSecret: string;
  ip: string;
  port: number;
  initialHp: number;
}

interface Z1State {
  role: Role;
  serverNode: {
    ip: string;
    port: number;
    status: 'INITIATING' | 'CONNECTED' | 'DISCONNECTED';
  };
  rootDna: string | null;
  isConnected: boolean;
  hpBalance: number;
  academicLevel: AcademicLevel;
  academicXp: number;
  localModelProgress: number;
  expMatrix: {
    legal: number;
    finance: number;
    strategy: number;
    psychology: number;
    secretary: number;
    planning: number;
  };
  aiServices: AIServiceConfig[];

  initialize: (config: OwnerConfig) => void;
  switchRole: (role: Role) => void;
  consumeHp: (actionType: string) => { success: boolean; message: string };
  syncHpFromServer: () => Promise<void>;
  rechargeHp: (amount: number) => Promise<{ success: boolean; newBalance: number }>;
  triggerEvolution: () => void;
  addXp: (amount: number) => void;
  setLocalModelProgress: (progress: number) => void;
  addAIService: (service: AIServiceConfig) => void;
  updateAIService: (type: AIServiceType, updates: Partial<AIServiceConfig>) => void;
  removeAIService: (type: AIServiceType) => void;
  getActiveService: (expertType?: string) => AIServiceConfig | null;
}

const HP_COSTS: Record<string, number> = {
  INTEL_DEEP_SCAN: 100,
  AUTONOMOUS_EDIT: 50,
  DREAM_SIMULATION: 20,
  BIO_EMERGENCY: 0,
};

const DEFAULT_AI_SERVICES: AIServiceConfig[] = [
  {
    type: 'PRIMARY',
    provider: 'OPENAI',
    name: '主控 AI (Primary)',
    model: 'gpt-4',
    isActive: false,
    isConfigured: false,
    assignedExperts: ['SECRETARY', 'IT_EVOLUTION'],
  },
  {
    type: 'LEGAL',
    provider: 'ANTHROPIC',
    name: '法律专家 (Legal)',
    model: 'claude-3-opus',
    isActive: false,
    isConfigured: false,
    assignedExperts: ['LEGAL'],
  },
  {
    type: 'FINANCE',
    provider: 'DEEPSEEK',
    name: '财务专家 (Finance)',
    model: 'deepseek-chat',
    isActive: false,
    isConfigured: false,
    assignedExperts: ['FINANCE', 'BIO_GUARD'],
  },
  {
    type: 'STRATEGY',
    provider: 'QWEN',
    name: '策略专家 (Strategy)',
    model: 'qwen-max',
    isActive: false,
    isConfigured: false,
    assignedExperts: ['STRATEGY'],
  },
];

async function getSecureRole(): Promise<Role> {
  if (typeof window === 'undefined') return 'MASTER';
  return await cryptoStorage.getItem<Role>('avatar_role', 'MASTER');
}

async function getSecureMasterSecret(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return await cryptoStorage.getItem<string | null>('avatar_master_secret', null);
}

async function setSecureRole(role: Role): Promise<void> {
  if (typeof window === 'undefined') return;
  await cryptoStorage.setItem('avatar_role', role);
}

async function setSecureMasterSecret(secret: string): Promise<void> {
  if (typeof window === 'undefined') return;
  await cryptoStorage.setItem('avatar_master_secret', secret);
}

async function removeSecureCredentials(): Promise<void> {
  if (typeof window === 'undefined') return;
  cryptoStorage.removeItem('avatar_role');
  cryptoStorage.removeItem('avatar_master_secret');
}

export const useZ1Store = create<Z1State>()(
  persist(
    (set, get) => ({
      role: 'MASTER',
      serverNode: {
        ip: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
        port: typeof window !== 'undefined' ? parseInt(window.location.port) || 5000 : 5000,
        status: 'INITIATING',
      },
      rootDna: null,
      isConnected: true,
      hpBalance: 1000,
      academicLevel: 'BACHELOR',
      academicXp: 0,
      localModelProgress: 0,
      expMatrix: { legal: 0, finance: 0, strategy: 0, psychology: 0, secretary: 0, planning: 0 },
      aiServices: DEFAULT_AI_SERVICES,

      initialize: async (config) => {
        const rootDnaHash = crypto.randomUUID ? crypto.randomUUID() : `DNA_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        await setSecureRole('MASTER');
        if (config.masterSecret) {
          await setSecureMasterSecret(config.masterSecret);
        }

        set({
          rootDna: rootDnaHash,
          serverNode: {
            ip: config.ip,
            port: config.port,
            status: 'CONNECTED',
          },
          hpBalance: config.initialHp,
          role: 'MASTER',
        });

        logger.info('Z1 Protocol initialized with secure storage');
      },

      switchRole: async (role) => {
        await setSecureRole(role);
        set({ role });
      },

      consumeHp: (actionType) => {
        const cost = HP_COSTS[actionType] ?? 10;
        const currentHp = get().hpBalance;

        if (currentHp >= cost) {
          const newBalance = currentHp - cost;
          set({ hpBalance: newBalance });

          fetch('/api/hp/consume', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Avatar-Role': 'MASTER',
            },
            body: JSON.stringify({ amount: cost, reason: actionType }),
          }).then(res => res.json()).then(data => {
            if (data.balance !== undefined) {
              set({ hpBalance: data.balance });
            } else if (data.error) {
              console.error('[Z1] HP consume failed, reverting:', data.error);
              set({ hpBalance: currentHp });
            }
          }).catch(e => {
            console.error('[Z1] HP sync error:', e);
            set({ hpBalance: currentHp });
          });

          return { success: true, message: `Action ${actionType} confirmed. Remaining HP: ${newBalance}` };
        } else {
          return { success: false, message: "Insufficient HP. Please purchase computing power." };
        }
      },

      syncHpFromServer: async () => {
        try {
          const response = await fetch('/api/hp/balance', {
            headers: { 'X-Avatar-Role': 'MASTER' },
          });
          if (response.ok) {
            const data = await response.json();
            set({ hpBalance: data.balance || 1000 });
          }
        } catch (e) {
          console.error('[Z1] Failed to sync HP from server:', e);
        }
      },

      rechargeHp: async (amount) => {
        try {
          const response = await fetch('/api/hp/recharge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Avatar-Role': 'MASTER',
            },
            body: JSON.stringify({ amount }),
          });
          if (response.ok) {
            const data = await response.json();
            set({ hpBalance: data.balance });
            return { success: true, newBalance: data.balance };
          }
          return { success: false, newBalance: get().hpBalance };
        } catch (e) {
          console.error('[Z1] Failed to recharge HP:', e);
          return { success: false, newBalance: get().hpBalance };
        }
      },

      triggerEvolution: () => {
        set((state) => {
          const currentIndex = ACADEMIC_LEVELS.indexOf(state.academicLevel);
          const nextIndex = Math.min(currentIndex + 1, ACADEMIC_LEVELS.length - 1);
          return {
            academicLevel: ACADEMIC_LEVELS[nextIndex],
            academicXp: 0,
          };
        });
      },

      addXp: (amount) => {
        set((state) => {
          const newXp = state.academicXp + amount;
          const currentIndex = ACADEMIC_LEVELS.indexOf(state.academicLevel);
          const xpForNext = (currentIndex + 1) * 1000;

          if (newXp >= xpForNext && currentIndex < ACADEMIC_LEVELS.length - 1) {
            return {
              academicXp: newXp - xpForNext,
              academicLevel: ACADEMIC_LEVELS[currentIndex + 1],
            };
          }
          return { academicXp: newXp };
        });
      },

      setLocalModelProgress: (progress) => {
        set({ localModelProgress: Math.min(1, Math.max(0, progress)) });
      },

      addAIService: (service) => {
        set((state) => ({
          aiServices: [...state.aiServices.filter(s => s.type !== service.type), service]
        }));
      },

      updateAIService: (type, updates) => {
        set((state) => ({
          aiServices: state.aiServices.map(s =>
            s.type === type ? { ...s, ...updates } : s
          )
        }));
      },

      removeAIService: (type) => {
        set((state) => ({
          aiServices: state.aiServices.filter(s => s.type !== type)
        }));
      },

      getActiveService: (expertType) => {
        const { aiServices } = get();

        if (expertType) {
          const service = aiServices.find(
            s => s.isActive && s.assignedExperts.includes(expertType)
          );
          if (service) return service;
        }

        return aiServices.find(s => s.type === 'PRIMARY' && s.isActive) || null;
      },
    }),
    {
      name: 'z1-god-protocol-storage',
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

export async function getAuthCredentials(): Promise<{ role: Role; secret: string | null }> {
  const role = await getSecureRole();
  const secret = await getSecureMasterSecret();
  return { role, secret };
}

export async function clearAuthCredentials(): Promise<void> {
  await removeSecureCredentials();
}

export const Z1_SCHEMA = {
  protocol: "God_Protocol_v6",
  roles: {
    MASTER: { view: "FULL_COMMAND", can_edit_config: true },
    GUEST: { view: "ANIME_OR_BUBBLE", can_edit_config: false }
  },
  senses: {
    visual: "Vision_Scan_Protocol",
    audio: "Whisper_Earphone_Protocol"
  }
};

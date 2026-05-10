import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types based on Z1 Python definition
export type Role = 'MASTER' | 'GUEST';
export type AcademicLevel = 'BACHELOR' | 'MASTER' | 'PHD';

// AI Service Types (多AI服务配置)
export type AIServiceType = 'PRIMARY' | 'LEGAL' | 'FINANCE' | 'STRATEGY';

export interface AIServiceConfig {
  type: AIServiceType;
  provider: 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'QWEN' | 'CUSTOM';
  name: string;
  apiKey: string;
  endpoint?: string;
  model?: string;
  isActive: boolean;
  assignedExperts: string[];
}

interface OwnerConfig {
  apiKey: string;
  masterSecret: string;
  ip: string;
  port: number;
  initialHp: number;
}

interface Z1State {
  // 1. Identity & Connection
  role: Role;
  serverNode: {
    ip: string;
    port: number;
    status: 'INITIATING' | 'CONNECTED' | 'DISCONNECTED';
  };
  rootDna: string | null;

  // 2. Economy (HP)
  hpBalance: number;
  
  // 3. Evolution
  academicLevel: AcademicLevel;
  expMatrix: {
    legal: number;
    finance: number;
    strategy: number;
    it: number;
  };

  // 4. AI Services (多AI服务)
  aiServices: AIServiceConfig[];

  // Actions
  initialize: (config: OwnerConfig) => void;
  switchRole: (role: Role) => void;
  consumeHp: (actionType: string) => { success: boolean; message: string };
  triggerEvolution: () => void;
  
  // AI Service Actions
  addAIService: (service: AIServiceConfig) => void;
  updateAIService: (type: AIServiceType, updates: Partial<AIServiceConfig>) => void;
  removeAIService: (type: AIServiceType) => void;
  getActiveService: (expertType?: string) => AIServiceConfig | null;
}

// HP Cost Table
const HP_COSTS: Record<string, number> = {
  INTEL_DEEP_SCAN: 100,
  AUTONOMOUS_EDIT: 50,
  DREAM_SIMULATION: 20,
  BIO_EMERGENCY: 0,
};

// Default AI Services Configuration
const DEFAULT_AI_SERVICES: AIServiceConfig[] = [
  {
    type: 'PRIMARY',
    provider: 'OPENAI',
    name: '主控 AI (Primary)',
    apiKey: '',
    model: 'gpt-4',
    isActive: false,
    assignedExperts: ['SECRETARY', 'IT_EVOLUTION'],
  },
  {
    type: 'LEGAL',
    provider: 'ANTHROPIC',
    name: '法律专家 (Legal)',
    apiKey: '',
    model: 'claude-3-opus',
    isActive: false,
    assignedExperts: ['LEGAL'],
  },
  {
    type: 'FINANCE',
    provider: 'DEEPSEEK',
    name: '财务专家 (Finance)',
    apiKey: '',
    model: 'deepseek-chat',
    isActive: false,
    assignedExperts: ['FINANCE', 'BIO_GUARD'],
  },
  {
    type: 'STRATEGY',
    provider: 'QWEN',
    name: '策略专家 (Strategy)',
    apiKey: '',
    model: 'qwen-max',
    isActive: false,
    assignedExperts: ['STRATEGY'],
  },
];

export const useZ1Store = create<Z1State>()(
  persist(
    (set, get) => ({
      role: 'MASTER',
      serverNode: {
        ip: '127.0.0.1',
        port: 8080,
        status: 'INITIATING',
      },
      rootDna: null,
      hpBalance: 1000,
      academicLevel: 'BACHELOR',
      expMatrix: { legal: 0, finance: 0, strategy: 0, it: 0 },
      aiServices: DEFAULT_AI_SERVICES,

      initialize: (config) => {
        const mockDna = `OWNER_${config.apiKey}_HASHED`; 
        if (typeof window !== 'undefined') {
          localStorage.setItem('avatar_role', 'MASTER');
          if (config.masterSecret) {
            localStorage.setItem('avatar_master_secret', config.masterSecret);
          }
        }
        set({
          rootDna: mockDna,
          serverNode: {
            ip: config.ip,
            port: config.port,
            status: 'CONNECTED',
          },
          hpBalance: config.initialHp,
          role: 'MASTER'
        });
      },

      switchRole: (role) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('avatar_role', role);
        }
        set({ role });
      },

      consumeHp: (actionType) => {
        const cost = HP_COSTS[actionType] ?? 10;
        const currentHp = get().hpBalance;

        if (currentHp >= cost) {
          set({ hpBalance: currentHp - cost });
          return { success: true, message: `Action ${actionType} confirmed. Remaining HP: ${currentHp - cost}` };
        } else {
          return { success: false, message: "Insufficient HP. Please purchase computing power." };
        }
      },

      triggerEvolution: () => {
        set((state) => ({
           academicLevel: state.academicLevel === 'BACHELOR' ? 'MASTER' : 'PHD'
        }));
      },

      // AI Service Management
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
    }
  )
);

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

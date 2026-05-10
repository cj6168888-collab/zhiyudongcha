import { create } from 'zustand';
import { apiRequest } from '@/lib/queryClient';

export interface DreamInsight {
  id: string;
  type: 'BUSINESS' | 'RISK' | 'OPPORTUNITY' | 'EVOLUTION';
  title: string;
  content: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: number;
  isRead: boolean;
  details?: {
    simulationCount?: number;
    decisionsOptimized?: number;
    topRisk?: string;
    recommendations?: string[];
  };
}

interface DreamInsightStore {
  insights: DreamInsight[];
  showBubble: boolean;
  currentInsight: DreamInsight | null;
  lastSyncTime: number;
  isSyncing: boolean;
  markAsRead: (id: string) => void;
  dismissBubble: () => void;
  showLatestInsight: () => void;
  syncWithBackend: () => Promise<void>;
}

const DREAM_TYPE_MAP: Record<string, DreamInsight['type']> = {
  'BUSINESS_SIMULATION': 'BUSINESS',
  'SELF_EVOLUTION': 'EVOLUTION',
  'MEMORY_CONSOLIDATION': 'OPPORTUNITY',
};

const DREAM_TITLES: Record<string, string> = {
  'BUSINESS_SIMULATION': '商业推演洞察',
  'SELF_EVOLUTION': '系统自举完成',
  'MEMORY_CONSOLIDATION': '记忆巩固报告',
};

const DREAM_CONTENTS: Record<string, string> = {
  'BUSINESS_SIMULATION': '主人，我昨晚做了个梦，对当前商业环境进行了深度推演，发现了一些值得关注的信号。',
  'SELF_EVOLUTION': '主人，我在深夜完成了自我进化，决策能力有所提升。',
  'MEMORY_CONSOLIDATION': '主人，昨夜我整理巩固了近期的记忆数据，优化了知识检索效率。',
};

function getReadState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem('dream_insight_read_state');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveReadState(state: Record<string, boolean>) {
  try {
    localStorage.setItem('dream_insight_read_state', JSON.stringify(state));
  } catch {
  }
}

function convertLogToInsight(log: any, readState: Record<string, boolean>): DreamInsight | null {
  if (!log || log.status !== 'AWAKENED') return null;
  
  const insightId = `backend_${log.id}`;
  const type = DREAM_TYPE_MAP[log.dreamType] || 'BUSINESS';
  const title = DREAM_TITLES[log.dreamType] || '梦境洞察';
  const content = DREAM_CONTENTS[log.dreamType] || '主人，我完成了一次梦境推演。';

  return {
    id: insightId,
    type,
    title,
    content,
    urgency: log.dreamType === 'BUSINESS_SIMULATION' ? 'MEDIUM' : 'LOW',
    timestamp: new Date(log.createdAt).getTime(),
    isRead: !!readState[insightId],
    details: {
      simulationCount: log.simulationCount,
      decisionsOptimized: log.decisionsOptimized,
      topRisk: log.insightsDiscovered?.topRisk,
      recommendations: log.patchesGenerated || [],
    },
  };
}

export const useDreamInsightStore = create<DreamInsightStore>((set, get) => ({
  insights: [],
  showBubble: false,
  currentInsight: null,
  lastSyncTime: 0,
  isSyncing: false,

  markAsRead: (id) => {
    const readState = getReadState();
    readState[id] = true;
    saveReadState(readState);
    
    set((state) => ({
      insights: state.insights.map((i) =>
        i.id === id ? { ...i, isRead: true } : i
      ),
    }));
  },

  dismissBubble: () => {
    const { currentInsight, markAsRead } = get();
    if (currentInsight) {
      markAsRead(currentInsight.id);
    }
    set({ showBubble: false, currentInsight: null });
  },

  showLatestInsight: () => {
    const { insights } = get();
    const unread = insights.find((i) => !i.isRead);
    if (unread) {
      set({ currentInsight: unread, showBubble: true });
    }
  },

  syncWithBackend: async () => {
    const { isSyncing, showBubble } = get();
    if (isSyncing) return;
    
    set({ isSyncing: true });
    
    try {
      const response = await apiRequest('GET', '/api/z6/dream');
      const logs = await response.json();
      
      if (!Array.isArray(logs)) {
        set({ isSyncing: false });
        return;
      }

      const readState = getReadState();
      
      const backendInsights: DreamInsight[] = logs
        .map((log: any) => convertLogToInsight(log, readState))
        .filter((i): i is DreamInsight => i !== null)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
      
      const latestUnread = backendInsights.find(i => !i.isRead);
      const previousInsightIds = new Set(get().insights.map(i => i.id));
      const hasNewInsights = backendInsights.some(i => !previousInsightIds.has(i.id));
      
      const shouldShowBubble = latestUnread && (!showBubble || hasNewInsights);
      
      set({
        insights: backendInsights,
        lastSyncTime: Date.now(),
        isSyncing: false,
        ...(shouldShowBubble ? { 
          currentInsight: latestUnread, 
          showBubble: true 
        } : {}),
      });
    } catch (error) {
      console.error('Failed to sync dream insights:', error);
      set({ isSyncing: false });
    }
  },
}));

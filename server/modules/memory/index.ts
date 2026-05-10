/**
 * 记忆系统模块 (Memory Module)
 * 
 * 职责: 情感记忆、灵魂单例、向量存储、洞察倾听
 */

const memoryModules = {
  emotionalMemory: () => import('../../services/emotional-memory'),
  spiritSingleton: () => import('../../services/spirit-singleton'),
  vectorMemory: () => import('../../services/vector-memory'),
  insightListener: () => import('../../services/insight-listener'),
  dreamService: () => import('../../services/dream-service'),
  dreamAnalyzer: () => import('../../services/dream-analyzer'),
};

export { memoryModules };

export interface MemoryEntry {
  id: string;
  type: 'emotional' | 'factual' | 'procedural';
  content: string;
  embedding?: number[];
  timestamp: Date;
  importance: number;
}

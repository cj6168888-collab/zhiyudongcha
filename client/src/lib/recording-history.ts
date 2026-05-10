/**
 * Recording History Service - 录音历史服务
 * 
 * 提供录音记录的持久化存储和检索功能
 */

import { AudioAnalysisResult } from '@/hooks/use-audio-analyzer';

export interface RecordingEntry {
  id: string;
  timestamp: number;
  duration: number;
  audioData?: string; // base64 encoded audio
  analysis: AudioAnalysisResult | null;
  tags?: string[];
  notes?: string;
}

const STORAGE_KEY = 'xiaozhi_recording_history';
const MAX_ENTRIES = 100;

export const recordingHistoryService = {
  getAll(): RecordingEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  add(entry: Omit<RecordingEntry, 'id' | 'timestamp'>): RecordingEntry {
    const entries = this.getAll();
    const newEntry: RecordingEntry = {
      ...entry,
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    entries.unshift(newEntry);
    
    // Keep only the latest MAX_ENTRIES
    if (entries.length > MAX_ENTRIES) {
      entries.pop();
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return newEntry;
  },

  delete(id: string): boolean {
    const entries = this.getAll();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return false;
    
    entries.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  },

  update(id: string, updates: Partial<RecordingEntry>): RecordingEntry | null {
    const entries = this.getAll();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    entries[index] = { ...entries[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entries[index];
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  getById(id: string): RecordingEntry | null {
    const entries = this.getAll();
    return entries.find(e => e.id === id) || null;
  },

  search(query: string): RecordingEntry[] {
    const entries = this.getAll();
    const lowerQuery = query.toLowerCase();
    return entries.filter(e => 
      e.notes?.toLowerCase().includes(lowerQuery) ||
      e.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }
};

import { create } from 'zustand';

export type ListeningMode = 'idle' | 'listening' | 'processing' | 'analyzing';

interface ListeningState {
  mode: ListeningMode;
  transcript: string;
  interimTranscript: string;
  volumeLevel: number;
  analyser: AnalyserNode | null;
  sessionId: string | null;
  analysisProgress: number;
  analysisEta: number;
  
  setMode: (mode: ListeningMode) => void;
  setTranscript: (text: string) => void;
  setInterimTranscript: (text: string) => void;
  setVolumeLevel: (level: number) => void;
  setAnalyser: (analyser: AnalyserNode | null) => void;
  setSessionId: (id: string | null) => void;
  setAnalysisProgress: (progress: number, eta?: number) => void;
  reset: () => void;
}

export const useListeningStore = create<ListeningState>((set) => ({
  mode: 'idle',
  transcript: '',
  interimTranscript: '',
  volumeLevel: 0,
  analyser: null,
  sessionId: null,
  analysisProgress: 0,
  analysisEta: 0,
  
  setMode: (mode) => set({ mode }),
  setTranscript: (transcript) => set({ transcript }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setVolumeLevel: (volumeLevel) => set({ volumeLevel }),
  setAnalyser: (analyser) => set({ analyser }),
  setSessionId: (sessionId) => set({ sessionId }),
  setAnalysisProgress: (analysisProgress, analysisEta = 0) => set({ analysisProgress, analysisEta }),
  reset: () => set({
    mode: 'idle',
    transcript: '',
    interimTranscript: '',
    volumeLevel: 0,
    sessionId: null,
    analysisProgress: 0,
    analysisEta: 0,
  }),
}));

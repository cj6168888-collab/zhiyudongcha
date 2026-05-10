import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  command?: {
    action: string;
    entity: string;
    data?: any;
  };
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  command?: {
    action: string;
    entity: string;
    data?: any;
  };
}

interface AvatarState {
  messages: Message[];
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  wakeWordEnabled: boolean;
  chatOpen: boolean;
  chatMinimized: boolean;
  voiceEnabled: boolean;
  sessionId: string;

  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setListening: (listening: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setChatMinimized: (minimized: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  executeCommand: (text: string) => Promise<CommandResult>;
  speak: (text: string) => void;
}

const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set, get) => ({
      messages: [],
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      wakeWordEnabled: false,
      chatOpen: false,
      chatMinimized: false,
      voiceEnabled: true,
      sessionId: generateSessionId(),

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages.slice(-50), message],
        }));
      },

      clearMessages: () => {
        const { sessionId } = get();
        fetch(`/api/avatar/chat/${sessionId}`, { method: 'DELETE' }).catch(() => {});
        set({ messages: [], sessionId: generateSessionId() });
      },

      setListening: (listening) => set({ isListening: listening }),
      setSpeaking: (speaking) => set({ isSpeaking: speaking }),
      setProcessing: (processing) => set({ isProcessing: processing }),
      setWakeWordEnabled: (enabled) => set({ wakeWordEnabled: enabled }),
      setChatOpen: (open) => set({ chatOpen: open }),
      setChatMinimized: (minimized) => set({ chatMinimized: minimized }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),

      executeCommand: async (text: string): Promise<CommandResult> => {
        const { sessionId } = get();
        const cleanText = text.replace(/小智[，,]?/g, '').trim();
        
        if (!cleanText) {
          return {
            success: true,
            message: '你好！有什么我可以帮你的吗？',
          };
        }

        try {
          const response = await fetch('/api/avatar/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: cleanText,
              sessionId,
            }),
          });

          if (!response.ok) {
            throw new Error('API request failed');
          }

          const data = await response.json();
          
          return {
            success: data.success,
            message: data.message,
            command: data.command,
            data: data.data,
          };
        } catch (error) {
          console.error('Avatar command error:', error);
          return {
            success: false,
            message: '抱歉，网络连接出现问题。请稍后再试。',
          };
        }
      },

      speak: (text: string) => {
        const { voiceEnabled } = get();
        if (!voiceEnabled) return;

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          
          const cleanText = text.replace(/[*#`]/g, '').substring(0, 200);
          
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'zh-CN';
          utterance.rate = 1;
          utterance.pitch = 1;
          
          utterance.onstart = () => set({ isSpeaking: true });
          utterance.onend = () => set({ isSpeaking: false });
          utterance.onerror = () => set({ isSpeaking: false });
          
          window.speechSynthesis.speak(utterance);
        }
      },
    }),
    {
      name: 'avatar-chat-storage',
      partialize: (state) => ({
        messages: state.messages.slice(-20),
        wakeWordEnabled: state.wakeWordEnabled,
        voiceEnabled: state.voiceEnabled,
        sessionId: state.sessionId,
      }),
    }
  )
);

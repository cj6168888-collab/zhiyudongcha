import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { cryptoStorage } from '../crypto-storage';

const fallbackToSpeechSynthesis = (
  text: string,
  voiceSettings: { voiceSpeed: number; voicePitch: number },
  set: (state: Partial<{ isSpeaking: boolean; speakingEndTime: number; currentTtsText: string }>) => void
) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = voiceSettings.voiceSpeed;
    utterance.pitch = voiceSettings.voicePitch;
    utterance.onstart = () => set({ isSpeaking: true });
    utterance.onend = () => {
      const endTime = Date.now();
      set({ isSpeaking: false, speakingEndTime: endTime });
      setTimeout(() => set({ currentTtsText: '' }), 3000);
    };
    utterance.onerror = () => {
      set({ isSpeaking: false, speakingEndTime: Date.now() });
      setTimeout(() => set({ currentTtsText: '' }), 2000);
    };
    window.speechSynthesis.speak(utterance);
  } else {
    set({ isSpeaking: false });
  }
};

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
  currentTtsText: string;
  speakingEndTime: number;

  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
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
  stopSpeaking: () => void;
  isSelfVoice: (text: string) => boolean;
  setCurrentTtsText: (text: string) => void;
}

const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

async function getVoiceSettings(): Promise<{ voiceType: string; voiceSpeed: number; voicePitch: number }> {
  try {
    return await cryptoStorage.getItem('xiaozhiVoiceSettings', {
      voiceType: 'longanhuan',
      voiceSpeed: 1.0,
      voicePitch: 1.0,
    });
  } catch {
    return { voiceType: 'longanhuan', voiceSpeed: 1.0, voicePitch: 1.0 };
  }
}

async function saveVoiceSettings(settings: { voiceType: string; voiceSpeed: number; voicePitch: number }): Promise<void> {
  try {
    await cryptoStorage.setItem('xiaozhiVoiceSettings', settings);
  } catch {}
}

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
      currentTtsText: '',
      speakingEndTime: 0,

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages.slice(-50), message],
        }));
      },

      setMessages: (messages) => {
        set({ messages: messages.slice(-50) });
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
        const cleanText = text.replace(/小星[，,]?/g, '').trim();

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

      speak: async (text: string) => {
        const { voiceEnabled } = get();
        if (!voiceEnabled) return;

        const thinkingPatterns = [
          /让我(想想|思考|分析|考虑)[一下]*[。，,.]*/g,
          /我(来|先|需要)(想想|思考|分析|考虑)[一下]*[。，,.]*/g,
          /首先[，,]?(让我)?(分析|思考|考虑)[一下]*[。，,.]*/g,
          /(思考|分析|推理)(过程|中)[：:].*/g,
          /\[思考\][\s\S]*?\[\/思考\]/g,
          /<think>[\s\S]*?<\/think>/g,
          /\(思考中[^)]*\)/g,
          /嗯[，,]让我[想思考]*/g,
        ];

        let cleanText = text.replace(/[*#`]/g, '');
        thinkingPatterns.forEach(pattern => {
          cleanText = cleanText.replace(pattern, '');
        });

        cleanText = cleanText
          .replace(/\[态势\]\s*/g, '')
          .replace(/\[变量\]\s*/g, '')
          .replace(/\[行动\]\s*/g, '')
          .replace(/\[Z4推演\]\s*/g, '')
          .replace(/\[对冲\]\s*/g, '')
          .replace(/\[[^\]]*\]\s*/g, '');

        const firstSentence = cleanText.split(/[。！？\n]/)[0];
        cleanText = (firstSentence || cleanText).replace(/^[，,。.\s]+/, '').trim().substring(0, 150);

        if (!cleanText) return;

        set({ currentTtsText: cleanText, isSpeaking: true });

        const voiceSettings = await getVoiceSettings();

        try {
          const response = await fetch('/api/voice/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText,
              voice: voiceSettings.voiceType,
              rate: voiceSettings.voiceSpeed,
              pitch: voiceSettings.voicePitch,
            }),
          });
          const result = await response.json();

          if (result.success && result.audioBase64) {
            const audio = new Audio(`data:audio/mp3;base64,${result.audioBase64}`);
            audio.onended = () => {
              const endTime = Date.now();
              set({ isSpeaking: false, speakingEndTime: endTime });
              setTimeout(() => set({ currentTtsText: '' }), 3000);
            };
            audio.onerror = () => {
              set({ isSpeaking: false, speakingEndTime: Date.now() });
              setTimeout(() => set({ currentTtsText: '' }), 2000);
            };
            audio.play().catch(() => {
              fallbackToSpeechSynthesis(cleanText, voiceSettings, set);
            });
          } else {
            fallbackToSpeechSynthesis(cleanText, voiceSettings, set);
          }
        } catch {
          fallbackToSpeechSynthesis(cleanText, voiceSettings, set);
        }
      },

      stopSpeaking: () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        set({ isSpeaking: false, currentTtsText: '' });
      },

      isSelfVoice: (text: string): boolean => {
        const { currentTtsText, isSpeaking, speakingEndTime } = get();

        const COOLDOWN_MS = 2500;
        const isInCooldown = speakingEndTime > 0 && (Date.now() - speakingEndTime) < COOLDOWN_MS;

        if (!isSpeaking && !isInCooldown) return false;

        if (!currentTtsText || !text) return false;

        const normalizedTts = currentTtsText.replace(/[，。！？、\s]/g, '').toLowerCase();
        const normalizedInput = text.replace(/[，。！？、\s]/g, '').toLowerCase();

        if (normalizedInput.length < 2) return false;

        if (normalizedTts.includes(normalizedInput) || normalizedInput.includes(normalizedTts)) {
          return true;
        }

        let matchCount = 0;
        for (let i = 0; i <= normalizedInput.length - 2; i++) {
          const bigram = normalizedInput.substring(i, i + 2);
          if (normalizedTts.includes(bigram)) {
            matchCount++;
          }
        }
        const similarity = matchCount / Math.max(1, normalizedInput.length - 1);

        const threshold = isInCooldown ? 0.3 : 0.5;
        return similarity > threshold;
      },

      setCurrentTtsText: (text) => set({ currentTtsText: text }),
    }),
    {
      name: 'avatar-chat-storage',
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
      partialize: (state) => ({
        messages: state.messages.slice(-20),
        wakeWordEnabled: state.wakeWordEnabled,
        voiceEnabled: state.voiceEnabled,
        sessionId: state.sessionId,
      }),
    }
  )
);

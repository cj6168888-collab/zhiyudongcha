import { WebPlugin } from '@capacitor/core';
import type {
  VoicePluginPlugin,
  SpeechResultEvent,
  SpeechStatusEvent,
  SpeechErrorEvent,
} from './definitions';

/**
 * Web fallback: wraps the browser Web Speech API with the same
 * event schema that the Android VoicePlugin emits, so the hook
 * (use-native-voice.ts) can listen to a single unified event set.
 */
export class VoicePluginWeb extends WebPlugin implements VoicePluginPlugin {
  private recognition: SpeechRecognition | null = null;
  private isRecognizing = false;
  private currentMode: 'daily' | 'attentive' = 'daily';

  async isAvailable(): Promise<{ available: boolean }> {
    const available =
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    return { available };
  }

  async setListeningMode(options: { mode: 'daily' | 'attentive' }): Promise<{ currentMode: string }> {
    this.currentMode = options.mode;
    return { currentMode: options.mode };
  }

  async startListening(): Promise<{ status: string }> {
    const { available } = await this.isAvailable();
    if (!available) {
      const err: SpeechErrorEvent = { code: -1, message: 'STT_NOT_AVAILABLE' };
      this.notifyListeners('speechError', err);
      return { status: 'unavailable' };
    }

    if (this.isRecognizing) return { status: 'already_listening' };

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    this.recognition = new SpeechRecognitionClass() as SpeechRecognition;
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN';
    this.recognition.maxAlternatives = 1;

    if (this.currentMode === 'attentive') {
      // No direct silence-length API on web; continuous=true approximates it
      this.recognition.continuous = true;
    }

    this.recognition.onstart = () => {
      this.isRecognizing = true;
      const ev: SpeechStatusEvent = { status: 'ready' };
      this.notifyListeners('speechStatus', ev);
      setTimeout(() => {
        if (this.isRecognizing) {
          this.notifyListeners('speechStatus', { status: 'listening' } as SpeechStatusEvent);
        }
      }, 200);
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      const confidence = result[0].confidence ?? 1.0;
      const isFinal = result.isFinal;
      const ev: SpeechResultEvent = { text, confidence, isFinal };
      this.notifyListeners('speechResult', ev);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.isRecognizing = false;
      const ev: SpeechErrorEvent = { code: -1, message: event.error };
      this.notifyListeners('speechError', ev);
    };

    this.recognition.onend = () => {
      this.isRecognizing = false;
      this.notifyListeners('speechStatus', { status: 'processing' } as SpeechStatusEvent);
    };

    this.recognition.start();
    return { status: 'started' };
  }

  async stopListening(): Promise<{ status: string }> {
    this.recognition?.stop();
    this.recognition = null;
    this.isRecognizing = false;
    return { status: 'stopped' };
  }
}

/**
 * 语音服务模块 (Voice Module)
 * 
 * 职责: ASR、TTS、实时语音、声纹识别
 */

const voiceModules = {
  alibabaAsr: () => import('../../services/alibaba-asr'),
  azureTts: () => import('../../services/azure-tts'),
  streamingTts: () => import('../../services/streaming-tts'),
  voiceCommander: () => import('../../services/voice-commander'),
  voiceprint: () => import('../../services/voiceprint'),
  whisperAssistant: () => import('../../services/whisper-assistant'),
  realtimeVoice: () => import('../../services/realtime-voice'),
  voiceSynthesis: () => import('../../services/voice-synthesis'),
};

export { voiceModules };

export interface VoiceInput {
  audioData: Buffer;
  sampleRate: number;
  duration: number;
}

export interface VoiceOutput {
  audioData: Buffer;
  format: 'mp3' | 'wav' | 'pcm';
}

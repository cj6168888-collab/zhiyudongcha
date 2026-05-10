import type { PluginListenerHandle } from '@capacitor/core';

// ─────────────────────────────────────────────────────────────────────────────
// VoicePlugin  (name = "VoicePlugin")
// ─────────────────────────────────────────────────────────────────────────────

export interface SpeechResultEvent {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechStatusEvent {
  status: 'ready' | 'listening' | 'processing';
}

export interface SpeechRmsEvent {
  rms: number;
}

export interface SpeechErrorEvent {
  code: number;
  message: string;
}

export interface VoicePluginPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  startListening(): Promise<{ status: string }>;
  stopListening(): Promise<{ status: string }>;
  setListeningMode(options: { mode: 'daily' | 'attentive' }): Promise<{ currentMode: string }>;

  addListener(eventName: 'speechResult',  listenerFunc: (data: SpeechResultEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'speechStatus',  listenerFunc: (data: SpeechStatusEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'speechRms',     listenerFunc: (data: SpeechRmsEvent)    => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'speechError',   listenerFunc: (data: SpeechErrorEvent)  => void): Promise<PluginListenerHandle>;
  addListener(eventName: string,          listenerFunc: (data: any)               => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AIEnginePlugin  (name = "AIEngine")  ← LocalLLMPlugin.java
// ─────────────────────────────────────────────────────────────────────────────

export type AIMode = 'IDLE' | 'LIFESTYLE' | 'LEGAL' | 'FINANCE';

export interface IntelligenceUpdateEvent {
  currentMode: AIMode;
  suggestion?: string;
  autoPersona?: string;
  actionHint?: string;
}

export interface EngineStatus {
  tier1_local: boolean;
  tier1_info: string;
  tier2_lan: boolean;
  tier2_endpoint: string;
  tier3_online: boolean;
  currentMode: AIMode;
}

export interface QueryResult {
  result: string;
  tier: 1 | 2 | 3;
  tierName: 'local_llm' | 'lan_pc' | 'cloud_api';
  routed: boolean;
}

export interface AIEnginePlugin {
  evaluateSituationalAwareness(options: { text: string }): Promise<IntelligenceUpdateEvent>;
  processQuery(options: { prompt: string; systemPrompt?: string; maxTokens?: number }): Promise<QueryResult>;
  getEngineStatus(): Promise<EngineStatus>;
  triggerModelDownload(): Promise<{ status: string }>;

  addListener(eventName: 'intelligenceUpdate', listenerFunc: (data: IntelligenceUpdateEvent) => void): Promise<PluginListenerHandle>;
  addListener(eventName: string,               listenerFunc: (data: any)                     => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TTSPlugin  (name = "TTS")
// ─────────────────────────────────────────────────────────────────────────────

export type TTSPersona =
  | 'default'
  | 'good_daughter'
  | 'taiwan_girlfriend'
  | 'genius_boy'
  | 'wise_strategist'
  | 'ceo'
  | 'mobile_assistant';

export type TTSExpert = 'none' | 'legal' | 'finance' | 'psychology' | 'planner' | 'assistant';

export type TTSEmotion = 'normal' | 'happy' | 'sad' | 'angry';

export interface TTSPluginPlugin {
  speak(options: {
    text: string;
    persona?: TTSPersona;
    expert?: TTSExpert;
    emotion?: TTSEmotion;
  }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceprintPlugin  (name = "Voiceprint")
// ─────────────────────────────────────────────────────────────────────────────

export interface VoiceprintPluginPlugin {
  registerOwnerVoice(): Promise<{ status: string }>;
  identifySpeaker(): Promise<{ isOwner: boolean; identity: 'Master' | 'Stranger' }>;
  setLoyaltyMode(options: { enabled: boolean }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SecurityPlugin  (name = "Security")
// ─────────────────────────────────────────────────────────────────────────────

export type BiometricError = 'NO_HARDWARE' | 'HW_UNAVAILABLE' | 'NONE_ENROLLED' | 'UNKNOWN';

export interface SecurityPluginPlugin {
  checkBiometricAvailability(): Promise<{ available: boolean; error?: BiometricError }>;
  authenticate(): Promise<{ success: true }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionPlugin  (name = "Action")
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionPluginPlugin {
  makeCall(options: { number: string }): Promise<void>;
  sendEmailWithAttachment(options: {
    to: string;
    subject?: string;
    filePath?: string;
  }): Promise<void>;
  addToCalendar(options: {
    title: string;
    location?: string;
    startTime?: number;
  }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DocumentPlugin  (name = "Document")
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanSessionInfo {
  sessionId: string;
  projectId: string;
  status: string;
  pageCount: number;
}

export interface AnalysisResult {
  sessionId: string;
  projectId: string;
  totalPages: number;
  action: string;
  pages: string[];
}

export interface SessionStatus {
  inSession: boolean;
  sessionId?: string;
  projectId?: string;
  pageCount: number;
  createdAt?: number;
  activeSessions?: number;
}

export interface DocumentPluginPlugin {
  startScanSession(options?: { projectId?: string }): Promise<ScanSessionInfo>;
  addPage(options: { sessionId: string; uri: string }): Promise<{ sessionId: string; pageCount: number }>;
  finishAndAnalyze(options: { sessionId: string }): Promise<AnalysisResult>;
  getSessionStatus(options?: { sessionId?: string }): Promise<SessionStatus>;
  cancelSession(options: { sessionId: string }): Promise<{ sessionId: string; cancelled: boolean }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// FileProcessorPlugin  (name = "FileProcessor")
// ─────────────────────────────────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  compressedSize: number;
}

export interface FileProcessorPluginPlugin {
  createSimpleDocx(options?: { content?: string; fileName?: string }): Promise<{ path: string }>;
  zipProject(options: { projectDir: string; zipName?: string }): Promise<{ zipPath: string }>;
  inspectZip(options: { zipPath: string }): Promise<{
    entries: ZipEntry[];
    entryCount: number;
    totalUncompressedBytes: number;
  }>;
  unzip(options: { zipPath: string; destDir: string }): Promise<{
    destDir: string;
    filesExtracted: number;
    totalBytes: number;
  }>;
  extractOfficeText(options: { filePath: string }): Promise<{
    text: string;
    charCount: number;
    filePath: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DiagnosticsPlugin  (name = "Diagnostics")
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionsReport {
  RECORD_AUDIO: boolean;
  CAMERA: boolean;
  WRITE_CALENDAR: boolean;
  USE_BIOMETRIC: boolean;
}

export interface HealthReport {
  permissions: PermissionsReport;
  jni_loaded: boolean;
  jni_error?: string;
  tts_ready: boolean;
  free_storage_mb: number;
}

export interface DiagnosticsPluginPlugin {
  checkHealth(): Promise<HealthReport>;
}

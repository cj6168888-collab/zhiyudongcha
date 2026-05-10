import { registerPlugin } from '@capacitor/core';
import type {
  VoicePluginPlugin,
  AIEnginePlugin,
  TTSPluginPlugin,
  VoiceprintPluginPlugin,
  SecurityPluginPlugin,
  ActionPluginPlugin,
  DocumentPluginPlugin,
  FileProcessorPluginPlugin,
  DiagnosticsPluginPlugin,
} from './definitions';

// Web fallback only for VoicePlugin — all other plugins are native-only
const VoicePlugin = registerPlugin<VoicePluginPlugin>('VoicePlugin', {
  web: () => import('./web').then((m) => new m.VoicePluginWeb()),
});

const AIEngine = registerPlugin<AIEnginePlugin>('AIEngine');

const TTSPlugin = registerPlugin<TTSPluginPlugin>('TTS');

const VoiceprintPlugin = registerPlugin<VoiceprintPluginPlugin>('Voiceprint');

const SecurityPlugin = registerPlugin<SecurityPluginPlugin>('Security');

const ActionPlugin = registerPlugin<ActionPluginPlugin>('Action');

const DocumentPlugin = registerPlugin<DocumentPluginPlugin>('Document');

const FileProcessorPlugin = registerPlugin<FileProcessorPluginPlugin>('FileProcessor');

const DiagnosticsPlugin = registerPlugin<DiagnosticsPluginPlugin>('Diagnostics');

export {
  VoicePlugin,
  AIEngine,
  TTSPlugin,
  VoiceprintPlugin,
  SecurityPlugin,
  ActionPlugin,
  DocumentPlugin,
  FileProcessorPlugin,
  DiagnosticsPlugin,
};
export * from './definitions';

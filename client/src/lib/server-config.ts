import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'xiaozhi_server_config';

export interface ServerConfig {
  serverUrl: string;
  useLocalModel: boolean;
  autoConnect: boolean;
}

const DEFAULT_CONFIG: ServerConfig = {
  serverUrl: '',
  useLocalModel: false,
  autoConnect: true,
};

export function getServerConfig(): ServerConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[ServerConfig] Failed to load config:', e);
  }
  return DEFAULT_CONFIG;
}

export function saveServerConfig(config: Partial<ServerConfig>): void {
  try {
    const current = getServerConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[ServerConfig] Failed to save config:', e);
  }
}

export function getApiBaseUrl(): string {
  if (!Capacitor.isNativePlatform()) {
    return '';
  }
  
  const config = getServerConfig();
  if (!config.serverUrl) {
    return '';
  }
  
  let url = config.serverUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isServerConfigured(): boolean {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  const config = getServerConfig();
  return !!config.serverUrl;
}

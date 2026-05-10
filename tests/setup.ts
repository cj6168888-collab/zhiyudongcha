/**
 * Vitest 测试配置和设置
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Only run browser-specific mocks in jsdom environment
const isBrowserEnv = typeof window !== 'undefined';

if (isBrowserEnv) {
  // Mock Web Audio API
  Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createMediaStreamSource: vi.fn(),
    createAnalyser: vi.fn().mockReturnValue({
      fftSize: 2048,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      frequencyBinCount: 1024,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createScriptProcessor: vi.fn().mockReturnValue(() => ({
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: {},
    sampleRate: 44100,
    state: 'running',
    close: vi.fn(),
  })),
});

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN,
  OPEN: WebSocket.OPEN,
  CONNECTING: WebSocket.CONNECTING,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,
}));

// Mock Audio elements
global.HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue();
global.HTMLAudioElement.prototype.pause = vi.fn();
global.HTMLAudioElement.prototype.load = vi.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('mock-audio-url');
global.URL.revokeObjectURL = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
global.localStorage = localStorageMock as Storage;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
global.sessionStorage = sessionStorageMock as Storage;

// Mock process.env
beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '1.0.0');
});

// Mock performance
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    ...performance,
    timing: {
      navigationStart: Date.now() - 1000,
      loadEventEnd: Date.now(),
    },
    getEntriesByType: vi.fn().mockReturnValue([]),
    now: vi.fn().mockReturnValue(0),
  },
});
}

// Mock Sentry
vi.mock('../client/src/lib/monitoring/sentry', () => ({
  __esModule: true,
  default: vi.fn(),
  initSentry: vi.fn(),
  captureError: vi.fn(),
  trackPerformance: vi.fn(),
}));

// Mock OpenReplay
vi.mock('../client/src/lib/monitoring/openreplay', () => ({
  __esModule: true,
  openReplayTracker: {
    init: vi.fn(),
    track: vi.fn(),
    trackVoiceInteraction: vi.fn(),
    trackError: vi.fn(),
    trackPerformance: vi.fn(),
    stop: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
  },
  initSessionReplay: vi.fn(),
  trackUserEvent: vi.fn(),
  trackVoiceEvent: vi.fn(),
  trackErrorEvent: vi.fn(),
  trackPerformanceEvent: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock console methods in test environment
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

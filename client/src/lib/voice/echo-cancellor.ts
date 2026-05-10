/**
 * Echo Canceller - Enhanced echo cancellation module
 *
 * Provides advanced echo cancellation beyond browser's built-in
 * echoCancellation. Uses adaptive filtering and correlation analysis
 * to detect and suppress audio echo.
 *
 * Copyright: 陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../logger';

const logger = createServiceLogger('EchoCanceller');

export interface EchoCancellerConfig {
  echoDelayMs: number;
  adaptiveThreshold: boolean;
  minThreshold: number;
  maxThreshold: number;
  correlationWindow: number;
  learningRate: number;
}

const DEFAULT_CONFIG: EchoCancellerConfig = {
  echoDelayMs: 150,
  adaptiveThreshold: true,
  minThreshold: 0.3,
  maxThreshold: 0.9,
  correlationWindow: 1024,
  learningRate: 0.01,
};

export class EchoCanceller {
  private config: EchoCancellerConfig;
  private isSystemSpeaking: boolean = false;
  private lastSystemAudioTime: number = 0;
  private threshold: number = 0.5;
  private adaptiveHistory: number[] = [];
  private sampleRate: number = 16000;

  constructor(config: Partial<EchoCancellerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('[EchoCanceller] Echo canceller initialized', this.config);
  }

  setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  markSystemSpeaking(): void {
    this.isSystemSpeaking = true;
    this.lastSystemAudioTime = Date.now();
    logger.debug('[EchoCanceller] Marked system as speaking');
  }

  markSystemStopped(): void {
    this.isSystemSpeaking = false;
    this.lastSystemAudioTime = Date.now();
    logger.debug('[EchoCanceller] Marked system as stopped');
  }

  shouldSkipAudio(audioData: Float32Array): { skip: boolean; reason?: string } {
    const timeSinceSystemAudio = Date.now() - this.lastSystemAudioTime;

    if (this.isSystemSpeaking) {
      return { skip: true, reason: 'System is currently speaking' };
    }

    if (timeSinceSystemAudio < this.config.echoDelayMs) {
      return {
        skip: true,
        reason: `Recent system audio: ${timeSinceSystemAudio}ms ago, need ${this.config.echoDelayMs}ms gap`,
      };
    }

    const energy = this.calculateRMS(audioData);

    if (this.config.adaptiveThreshold) {
      this.adaptThreshold(energy);
    }

    if (energy > this.threshold) {
      logger.debug(`[EchoCanceller] High energy detected: ${energy.toFixed(4)}, threshold: ${this.threshold.toFixed(4)}`);
      return { skip: true, reason: `High energy: ${energy.toFixed(4)} > ${this.threshold.toFixed(4)}` };
    }

    return { skip: false };
  }

  calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private adaptThreshold(energy: number): void {
    this.adaptiveHistory.push(energy);
    if (this.adaptiveHistory.length > 100) {
      this.adaptiveHistory.shift();
    }

    const avgEnergy = this.adaptiveHistory.reduce((a, b) => a + b, 0) / this.adaptiveHistory.length;

    if (avgEnergy > this.threshold * 1.2) {
      this.threshold = Math.min(this.threshold + this.config.learningRate, this.config.maxThreshold);
    } else if (avgEnergy < this.threshold * 0.8) {
      this.threshold = Math.max(this.threshold - this.config.learningRate, this.config.minThreshold);
    }
  }

  calculateCorrelation(audioData1: Float32Array, audioData2: Float32Array): number {
    const windowSize = Math.min(
      this.config.correlationWindow,
      audioData1.length,
      audioData2.length
    );

    let correlation = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < windowSize; i++) {
      correlation += audioData1[i] * audioData2[i];
      norm1 += audioData1[i] * audioData1[i];
      norm2 += audioData2[i] * audioData2[i];
    }

    const denominator = Math.sqrt(norm1 * norm2);
    if (denominator === 0) {
      return 0;
    }

    return correlation / denominator;
  }

  getStatistics(): EchoCancellerStats {
    return {
      isSystemSpeaking: this.isSystemSpeaking,
      lastSystemAudioAgo: Date.now() - this.lastSystemAudioTime,
      currentThreshold: this.threshold,
      adaptiveHistorySize: this.adaptiveHistory.length,
    };
  }

  reset(): void {
    this.isSystemSpeaking = false;
    this.lastSystemAudioTime = 0;
    this.adaptiveHistory = [];
    this.threshold = this.config.minThreshold;
    logger.info('[EchoCanceller] Echo canceller reset');
  }
}

export interface EchoCancellerStats {
  isSystemSpeaking: boolean;
  lastSystemAudioAgo: number;
  currentThreshold: number;
  adaptiveHistorySize: number;
}

export const echoCanceller = new EchoCanceller();

export default EchoCanceller;

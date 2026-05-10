/**
 * Voiceprint Authentication Service (声纹锁服务)
 * 
 * 基于Web Audio API提取声纹特征，实现：
 * 1. 主人声纹录入 (3次采样建立模板)
 * 2. 实时声纹验证 (比对说话人身份)
 * 3. 授权白名单管理
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('Voiceprint');

import crypto from 'crypto';

export interface VoiceSample {
  audioData: number[];
  duration: number;
  sampleRate: number;
}

export interface VoiceFeatures {
  mfcc: number[];
  pitch: number;
  energy: number;
  spectralCentroid: number;
  zeroCrossRate: number;
}

export interface VerificationResult {
  isMatch: boolean;
  confidence: number;
  matchedUserId?: string;
  message: string;
}

export interface AuthorizationCheck {
  allowed: boolean;
  reason: string;
  requiresMasterAuth: boolean;
}

const SAMPLE_REQUIREMENT = 3;
const DEFAULT_THRESHOLD = 0.72;

function extractFeatures(audioData: number[], sampleRate: number): VoiceFeatures {
  const frameSize = Math.floor(sampleRate * 0.025);
  const hopSize = Math.floor(sampleRate * 0.01);
  const numFrames = Math.floor((audioData.length - frameSize) / hopSize);
  
  let totalEnergy = 0;
  let zeroCrossings = 0;
  let spectralSum = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    totalEnergy += audioData[i] * audioData[i];
    if (i > 0 && (audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
      zeroCrossings++;
    }
  }
  
  const energy = Math.sqrt(totalEnergy / audioData.length);
  const zeroCrossRate = zeroCrossings / audioData.length;
  
  const mfcc: number[] = [];
  for (let i = 0; i < 13; i++) {
    let sum = 0;
    for (let j = 0; j < Math.min(numFrames, 100); j++) {
      const frameStart = j * hopSize;
      let frameEnergy = 0;
      for (let k = 0; k < frameSize && frameStart + k < audioData.length; k++) {
        frameEnergy += Math.abs(audioData[frameStart + k]);
      }
      sum += Math.cos((Math.PI * i * (j + 0.5)) / numFrames) * Math.log(frameEnergy + 1);
    }
    mfcc.push(sum / numFrames);
  }
  
  let pitchSum = 0;
  let pitchCount = 0;
  for (let i = 50; i < 400; i++) {
    let autocorr = 0;
    const lag = Math.floor(sampleRate / i);
    for (let j = 0; j < audioData.length - lag; j++) {
      autocorr += audioData[j] * audioData[j + lag];
    }
    if (autocorr > pitchSum) {
      pitchSum = autocorr;
      pitchCount = i;
    }
  }
  const pitch = pitchCount || 150;
  
  let weightedFreqSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < audioData.length; i++) {
    const magnitude = Math.abs(audioData[i]);
    weightedFreqSum += i * magnitude;
    magnitudeSum += magnitude;
  }
  const spectralCentroid = magnitudeSum > 0 ? weightedFreqSum / magnitudeSum : 0;
  
  return { mfcc, pitch, energy, spectralCentroid, zeroCrossRate };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function featuresToVector(features: VoiceFeatures): number[] {
  return [
    ...features.mfcc,
    features.pitch / 500,
    features.energy,
    features.spectralCentroid / 10000,
    features.zeroCrossRate,
  ];
}

export function processVoiceSample(sample: VoiceSample): VoiceFeatures {
  return extractFeatures(sample.audioData, sample.sampleRate);
}

export function generateSampleHash(sample: VoiceSample): string {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(sample.audioData.slice(0, 1000).map(v => Math.round(v * 1000)).join(',')));
  return hash.digest('hex').substring(0, 16);
}

export function mergeFeatureTemplates(samples: VoiceFeatures[]): number[] {
  if (samples.length === 0) return [];
  
  const vectorLength = 17;
  const merged = new Array(vectorLength).fill(0);
  
  for (const sample of samples) {
    const vector = featuresToVector(sample);
    for (let i = 0; i < vectorLength; i++) {
      merged[i] += vector[i] / samples.length;
    }
  }
  
  return merged;
}

export function verifyVoiceprint(
  inputSample: VoiceSample,
  storedTemplate: number[],
  threshold: number = DEFAULT_THRESHOLD
): VerificationResult {
  if (!storedTemplate || storedTemplate.length === 0) {
    return {
      isMatch: false,
      confidence: 0,
      message: '未找到已注册声纹',
    };
  }
  
  const inputFeatures = processVoiceSample(inputSample);
  const inputVector = featuresToVector(inputFeatures);
  
  const similarity = cosineSimilarity(inputVector, storedTemplate);
  const confidence = Math.max(0, Math.min(1, (similarity + 1) / 2));
  
  return {
    isMatch: confidence >= threshold,
    confidence,
    message: confidence >= threshold 
      ? '声纹验证通过' 
      : `声纹不匹配 (置信度: ${(confidence * 100).toFixed(1)}%)`,
  };
}

export function checkVoiceAuthorization(
  target: string,
  authType: 'PERSON' | 'ACTION' | 'TEMPORARY',
  authorizations: Array<{ authType: string; target: string; isActive: number; expiresAt: Date | null }>
): AuthorizationCheck {
  const now = new Date();
  
  const matchingAuth = authorizations.find(auth => 
    auth.authType === authType &&
    auth.target.toLowerCase() === target.toLowerCase() &&
    auth.isActive === 1 &&
    (!auth.expiresAt || new Date(auth.expiresAt) > now)
  );
  
  if (matchingAuth) {
    return {
      allowed: true,
      reason: `已获得主人授权: ${authType} -> ${target}`,
      requiresMasterAuth: false,
    };
  }
  
  return {
    allowed: false,
    reason: `需要主人授权才能${authType === 'PERSON' ? '与该人对话' : '执行该操作'}`,
    requiresMasterAuth: true,
  };
}

export const VOICEPRINT_CONFIG = {
  sampleRequirement: SAMPLE_REQUIREMENT,
  defaultThreshold: DEFAULT_THRESHOLD,
  minSampleDuration: 2,
  maxSampleDuration: 10,
  supportedSampleRates: [16000, 22050, 44100, 48000],
};

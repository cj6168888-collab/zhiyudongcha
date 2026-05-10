/**
 * Z1 Wake Word Service - 唤醒词检测服务
 * 
 * 功能：
 * 1. 检测用户语音/文本中的唤醒词
 * 2. 支持自定义唤醒词配置
 * 3. 模糊匹配（处理语音识别误差）
 * 4. 唤醒词热词学习
 */

interface WakeWordConfig {
  userId: string;
  wakeWords: string[];
  primaryWakeWord: string;
  sensitivity: number;
}

interface WakeWordResult {
  detected: boolean;
  wakeWord: string | null;
  confidence: number;
  remainingText: string;
  position: number;
}

const DEFAULT_WAKE_WORDS = ['小智', '小智小智', '智智', '嘿小智'];

const userWakeConfigs: Map<string, WakeWordConfig> = new Map();

const SIMILAR_CHARS: Record<string, string[]> = {
  '智': ['知', '之', '质', '志', '芝'],
  '小': ['晓', '肖', '校', '笑'],
  '嘿': ['嗨', '黑', '嘻'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、：；""'']/g, '');
}

function computeSimilarity(text: string, wakeWord: string): number {
  const normalizedText = normalizeText(text);
  const normalizedWake = normalizeText(wakeWord);
  
  if (normalizedText.includes(normalizedWake)) {
    return 1.0;
  }
  
  let maxSimilarity = 0;
  
  for (let i = 0; i <= normalizedText.length - normalizedWake.length; i++) {
    const segment = normalizedText.slice(i, i + normalizedWake.length);
    let matches = 0;
    
    for (let j = 0; j < normalizedWake.length; j++) {
      const wakeChar = normalizedWake[j];
      const textChar = segment[j];
      
      if (wakeChar === textChar) {
        matches++;
      } else if (SIMILAR_CHARS[wakeChar]?.includes(textChar)) {
        matches += 0.8;
      }
    }
    
    const similarity = matches / normalizedWake.length;
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  return maxSimilarity;
}

function findWakeWordPosition(text: string, wakeWord: string): number {
  const normalizedText = normalizeText(text);
  const normalizedWake = normalizeText(wakeWord);
  
  const exactPos = normalizedText.indexOf(normalizedWake);
  if (exactPos >= 0) return exactPos;
  
  for (const [key, variants] of Object.entries(SIMILAR_CHARS)) {
    for (const variant of variants) {
      const variantWake = normalizedWake.replace(new RegExp(key, 'g'), variant);
      const variantPos = normalizedText.indexOf(variantWake);
      if (variantPos >= 0) return variantPos;
    }
  }
  
  return -1;
}

export function detectWakeWord(
  text: string, 
  userId: string = 'default'
): WakeWordResult {
  const config = userWakeConfigs.get(userId) || {
    userId,
    wakeWords: DEFAULT_WAKE_WORDS,
    primaryWakeWord: '小智',
    sensitivity: 0.8,
  };
  
  let bestMatch = {
    wakeWord: null as string | null,
    confidence: 0,
    position: -1,
  };
  
  for (const wakeWord of config.wakeWords) {
    const similarity = computeSimilarity(text, wakeWord);
    
    if (similarity > bestMatch.confidence) {
      bestMatch = {
        wakeWord,
        confidence: similarity,
        position: findWakeWordPosition(text, wakeWord),
      };
    }
  }
  
  const detected = bestMatch.confidence >= config.sensitivity;
  
  let remainingText = text;
  if (detected && bestMatch.position >= 0 && bestMatch.wakeWord) {
    const wakeLen = bestMatch.wakeWord.length;
    remainingText = text.slice(bestMatch.position + wakeLen).trim();
    
    if (remainingText.startsWith('，') || remainingText.startsWith(',')) {
      remainingText = remainingText.slice(1).trim();
    }
  }
  
  return {
    detected,
    wakeWord: detected ? bestMatch.wakeWord : null,
    confidence: bestMatch.confidence,
    remainingText: detected ? remainingText : text,
    position: bestMatch.position,
  };
}

export function setUserWakeConfig(
  userId: string,
  wakeWords: string[],
  primaryWakeWord?: string,
  sensitivity?: number
): WakeWordConfig {
  const config: WakeWordConfig = {
    userId,
    wakeWords: wakeWords.length > 0 ? wakeWords : DEFAULT_WAKE_WORDS,
    primaryWakeWord: primaryWakeWord || wakeWords[0] || '小智',
    sensitivity: sensitivity ?? 0.8,
  };
  
  userWakeConfigs.set(userId, config);
  return config;
}

export function getUserWakeConfig(userId: string): WakeWordConfig | null {
  return userWakeConfigs.get(userId) || null;
}

export function removeUserWakeConfig(userId: string): boolean {
  return userWakeConfigs.delete(userId);
}

export function addWakeWord(userId: string, wakeWord: string): WakeWordConfig {
  const config = userWakeConfigs.get(userId) || {
    userId,
    wakeWords: [...DEFAULT_WAKE_WORDS],
    primaryWakeWord: '小智',
    sensitivity: 0.8,
  };
  
  if (!config.wakeWords.includes(wakeWord)) {
    config.wakeWords.push(wakeWord);
  }
  
  userWakeConfigs.set(userId, config);
  return config;
}

export function removeWakeWord(userId: string, wakeWord: string): WakeWordConfig | null {
  const config = userWakeConfigs.get(userId);
  if (!config) return null;
  
  config.wakeWords = config.wakeWords.filter(w => w !== wakeWord);
  
  if (config.wakeWords.length === 0) {
    config.wakeWords = [...DEFAULT_WAKE_WORDS];
  }
  
  if (config.primaryWakeWord === wakeWord) {
    config.primaryWakeWord = config.wakeWords[0];
  }
  
  userWakeConfigs.set(userId, config);
  return config;
}

export function setPrimaryWakeWord(userId: string, wakeWord: string): WakeWordConfig | null {
  const config = userWakeConfigs.get(userId);
  if (!config) return null;
  
  if (!config.wakeWords.includes(wakeWord)) {
    config.wakeWords.unshift(wakeWord);
  }
  
  config.primaryWakeWord = wakeWord;
  userWakeConfigs.set(userId, config);
  return config;
}

export function validateWakeWord(wakeWord: string): { valid: boolean; reason?: string } {
  if (!wakeWord || typeof wakeWord !== 'string') {
    return { valid: false, reason: '唤醒词不能为空' };
  }
  
  const trimmed = wakeWord.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, reason: '唤醒词至少需要2个字符' };
  }
  
  if (trimmed.length > 10) {
    return { valid: false, reason: '唤醒词不能超过10个字符' };
  }
  
  if (/^[0-9]+$/.test(trimmed)) {
    return { valid: false, reason: '唤醒词不能只包含数字' };
  }
  
  const commonWords = ['你好', '好的', '是的', '不是', '可以', '不行', '什么', '怎么'];
  if (commonWords.includes(trimmed)) {
    return { valid: false, reason: '唤醒词过于常用，容易误触发' };
  }
  
  return { valid: true };
}

export function getDefaultWakeWords(): string[] {
  return [...DEFAULT_WAKE_WORDS];
}

export function getAllConfigs(): Map<string, WakeWordConfig> {
  return new Map(userWakeConfigs);
}

export function loadConfigFromDB(settings: {
  userId: string;
  wakeWords: string[] | null;
  primaryWakeWord: string | null;
  wakeWordSensitivity: number | null;
}): void {
  if (settings.wakeWords && settings.wakeWords.length > 0) {
    setUserWakeConfig(
      settings.userId,
      settings.wakeWords,
      settings.primaryWakeWord || undefined,
      settings.wakeWordSensitivity || undefined
    );
  }
}

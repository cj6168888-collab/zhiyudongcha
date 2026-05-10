/**
 * Azure Text-to-Speech Service
 *
 * Azure语音服务 - 作为DashScope的备选方案
 * 支持中国区世纪互联运营的Azure服务
 *
 * 功能：
 * 1. 多种神经语音（包括童声）
 * 2. SSML支持情感和风格调整
 * 3. 自动区分全球/中国区端点
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('AzureTTS');

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastasia';

// 全球区端点
const GLOBAL_TOKEN_URL = `https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
const GLOBAL_TTS_URL = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

// 中国区端点 (世纪互联)
const CHINA_TOKEN_URL = `https://${AZURE_SPEECH_REGION}.api.cognitive.azure.cn/sts/v1.0/issueToken`;
const CHINA_TTS_URL = `https://${AZURE_SPEECH_REGION}.tts.speech.azure.cn/cognitiveservices/v1`;

// 判断是否为中国区
const isChina = AZURE_SPEECH_REGION?.startsWith('china');
const TOKEN_URL = isChina ? CHINA_TOKEN_URL : GLOBAL_TOKEN_URL;
const TTS_URL = isChina ? CHINA_TTS_URL : GLOBAL_TTS_URL;

export interface AzureVoice {
  id: string;
  name: string;
  shortName: string;
  locale: string;
  gender: 'male' | 'female';
  age: 'child' | 'teen' | 'adult' | 'senior';
  description: string;
  styles?: string[];
}

// Azure中文语音列表（重点：童声和年轻声音）
export const AZURE_VOICES: AzureVoice[] = [
  // 童声/年轻女声
  {
    id: 'xiaoxiao',
    name: '晓晓',
    shortName: 'zh-CN-XiaoxiaoNeural',
    locale: 'zh-CN',
    gender: 'female',
    age: 'teen',
    description: '活泼可爱的女声，支持多种情感风格',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'disgruntled', 'serious', 'affectionate', 'gentle', 'lyrical'],
  },
  {
    id: 'xiaoyi',
    name: '晓伊',
    shortName: 'zh-CN-XiaoyiNeural',
    locale: 'zh-CN',
    gender: 'female',
    age: 'child',
    description: '儿童女声，天真活泼',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'disgruntled', 'serious', 'affectionate', 'gentle'],
  },
  {
    id: 'xiaomo',
    name: '晓墨',
    shortName: 'zh-CN-XiaomoNeural',
    locale: 'zh-CN',
    gender: 'female',
    age: 'teen',
    description: '温柔可人的少女音',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'serious', 'affectionate', 'gentle', 'embarrassed'],
  },
  {
    id: 'xiaoxuan',
    name: '晓萱',
    shortName: 'zh-CN-XiaoxuanNeural',
    locale: 'zh-CN',
    gender: 'female',
    age: 'teen',
    description: '温婉知性的女声',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'serious', 'gentle', 'calm'],
  },
  {
    id: 'xiaohan',
    name: '晓涵',
    shortName: 'zh-CN-XiaohanNeural',
    locale: 'zh-CN',
    gender: 'female',
    age: 'adult',
    description: '成熟稳重的女声',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'serious', 'gentle', 'affectionate', 'calm'],
  },
  {
    id: 'xiaorui',
    name: '晓睿',
    shortName: 'zh-CN-XiaoruiNeural',
    locale: 'zh-CN',
    gender: 'female',
    age: 'adult',
    description: '专业沉稳的女声',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'serious', 'gentle', 'calm'],
  },
  // 男声
  {
    id: 'yunxi',
    name: '云希',
    shortName: 'zh-CN-YunxiNeural',
    locale: 'zh-CN',
    gender: 'male',
    age: 'teen',
    description: '阳光男声，可调年轻风格',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'serious', 'depressed', 'embarrassed', 'narration-relaxed', 'boy'],
  },
  {
    id: 'yunyang',
    name: '云扬',
    shortName: 'zh-CN-YunyangNeural',
    locale: 'zh-CN',
    gender: 'male',
    age: 'adult',
    description: '专业播音员风格',
    styles: ['cheerful', 'sad', 'angry', 'fearful', 'serious', 'gentle', 'calm', 'customerservice'],
  },
  {
    id: 'yunjian',
    name: '云健',
    shortName: 'zh-CN-YunjianNeural',
    locale: 'zh-CN',
    gender: 'male',
    age: 'adult',
    description: '沉稳大气的男声',
    styles: ['narration-relaxed', 'sports-commentary', 'sports-commentary-excited', 'documentary-narration'],
  },
  // 英文童声（可选）
  {
    id: 'jenny',
    name: 'Jenny',
    shortName: 'en-US-JennyNeural',
    locale: 'en-US',
    gender: 'female',
    age: 'adult',
    description: 'Friendly American female voice',
    styles: ['cheerful', 'sad', 'angry', 'excited', 'friendly', 'hopeful', 'shouting', 'whispering'],
  },
  {
    id: 'aria',
    name: 'Aria',
    shortName: 'en-US-AriaNeural',
    locale: 'en-US',
    gender: 'female',
    age: 'teen',
    description: 'Young American female voice',
    styles: ['cheerful', 'sad', 'angry', 'excited', 'friendly', 'hopeful', 'shouting', 'whispering', 'chat'],
  },
];

export interface AzureTTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  style?: string;
  styleDegree?: number;
}

export interface AzureTTSResult {
  success: boolean;
  audioBase64?: string;
  format: string;
  voice: string;
  error?: string;
  provider: 'azure';
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!AZURE_SPEECH_KEY) {
    throw new Error('Azure Speech key not configured');
  }

  // 使用缓存的token（9分钟有效期）
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get Azure token: ${response.status}`);
  }

  const token = await response.text();
  cachedToken = {
    token,
    expiresAt: Date.now() + 9 * 60 * 1000, // 9分钟后过期
  };

  return token;
}

function buildSSML(text: string, options: AzureTTSOptions): string {
  const voice = AZURE_VOICES.find(v => v.id === options.voice) || AZURE_VOICES[0];
  const rate = options.rate ? `${Math.round((options.rate - 1) * 100)}%` : '0%';
  const pitch = options.pitch ? `${Math.round((options.pitch - 1) * 50)}%` : '0%';
  const volume = options.volume ? `${options.volume}%` : '100%';

  let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.locale}">
  <voice name="${voice.shortName}">`;

  // 添加情感风格
  if (options.style && voice.styles?.includes(options.style)) {
    const degree = options.styleDegree || 1;
    ssml += `<mstts:express-as style="${options.style}" styledegree="${degree}">`;
  }

  ssml += `<prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escapeXml(text)}</prosody>`;

  if (options.style && voice.styles?.includes(options.style)) {
    ssml += `</mstts:express-as>`;
  }

  ssml += `</voice></speak>`;

  return ssml;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function synthesizeWithAzure(
  text: string,
  options: AzureTTSOptions = {}
): Promise<AzureTTSResult> {
  const voiceId = options.voice || 'xiaoxiao';
  const voice = AZURE_VOICES.find(v => v.id === voiceId);

  if (!AZURE_SPEECH_KEY) {
    return {
      success: false,
      format: 'mp3',
      voice: voiceId,
      error: 'Azure语音服务未配置。需要设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION 环境变量。',
      provider: 'azure',
    };
  }

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      format: 'mp3',
      voice: voiceId,
      error: '合成文本不能为空',
      provider: 'azure',
    };
  }

  try {
    const token = await getAccessToken();
    const ssml = buildSSML(text, { ...options, voice: voiceId });

    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'Navigator-X',
      },
      body: ssml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        format: 'mp3',
        voice: voiceId,
        error: `Azure语音合成失败: ${response.status} - ${errorText}`,
        provider: 'azure',
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return {
      success: true,
      audioBase64,
      format: 'mp3',
      voice: voiceId,
      provider: 'azure',
    };
  } catch (error) {
    logger.error({ error }, 'Azure TTS error');
    return {
      success: false,
      format: 'mp3',
      voice: voiceId,
      error: `Azure语音合成请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
      provider: 'azure',
    };
  }
}

export function getAzureVoices(): AzureVoice[] {
  return AZURE_VOICES;
}

export function getAzureVoiceById(id: string): AzureVoice | undefined {
  return AZURE_VOICES.find(v => v.id === id);
}

export function getAzureChildVoices(): AzureVoice[] {
  return AZURE_VOICES.filter(v => v.age === 'child' || v.age === 'teen');
}

export function isAzureConfigured(): boolean {
  return !!AZURE_SPEECH_KEY;
}

export function getAzureRegion(): string {
  return AZURE_SPEECH_REGION || 'not configured';
}

/**
 * Z5 Voice Synthesis Service - 语音合成服务
 * 
 * 使用 DashScope CosyVoice 真实语音模型
 * 功能：
 * 1. 多音色支持（儿童、少年、成人等）
 * 2. 自然流畅、有感情的语音合成
 * 3. 语速、音调可调节
 * 4. 情感控制支持
 */

import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('VoiceSynthesis');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const TTS_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2speech/generation';

export interface VoiceProfile {
  id: string;
  name: string;
  nameEn: string;
  gender: 'male' | 'female' | 'child';
  age: string;
  ageGroup: 'child' | 'teen' | 'young' | 'adult' | 'mature' | 'elderly';
  personality: string;
  description: string;
  model: string;
  sampleText: string;
  supportsSSML: boolean;
  supportsInstruct: boolean;
  category: string;
}

export interface SynthesisOptions {
  voice: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  format?: 'mp3' | 'wav' | 'pcm';
  sampleRate?: number;
  emotion?: string;
  instruction?: string;
}

export interface SynthesisResult {
  success: boolean;
  audioData?: Buffer;
  audioBase64?: string;
  duration?: number;
  format: string;
  voice: string;
  error?: string;
}

// DashScope CosyVoice 真实音色列表
// 来源: https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
export const VOICE_PROFILES: VoiceProfile[] = [
  // === 童声 (Child Voices) ===
  {
    id: 'longhuhu_v3',
    name: '龙呼呼',
    nameEn: 'Huhu',
    gender: 'child',
    age: '6~10岁',
    ageGroup: 'child',
    personality: '天真烂漫',
    description: '天真烂漫女童声，活泼可爱，充满童趣',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸爸爸，我来帮你啦！今天也要开心哦～',
    supportsSSML: true,
    supportsInstruct: true,
    category: '童声',
  },

  // === 社交陪伴 (Social Companion) ===
  {
    id: 'longanyang',
    name: '龙安洋',
    nameEn: 'Anyang',
    gender: 'male',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '阳光大男孩',
    description: '阳光开朗的年轻男声，温暖有活力',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸好！今天有什么需要我帮忙的吗？',
    supportsSSML: true,
    supportsInstruct: true,
    category: '社交陪伴',
  },
  {
    id: 'longanhuan',
    name: '龙安欢',
    nameEn: 'Anhuan',
    gender: 'female',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '欢脱元气',
    description: '欢脱元气女声，活泼俏皮',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸～我一直都在呢，有什么可以帮你的？',
    supportsSSML: true,
    supportsInstruct: true,
    category: '社交陪伴',
  },

  // === 陪伴闲聊 (Companion Chat) ===
  {
    id: 'longanrou_v3',
    name: '龙安柔',
    nameEn: 'Anrou',
    gender: 'female',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '温柔闺蜜',
    description: '温柔体贴的女声，像闺蜜一样亲切',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，我会一直陪在你身边的～',
    supportsSSML: true,
    supportsInstruct: false,
    category: '陪伴闲聊',
  },
  {
    id: 'longhan_v3',
    name: '龙寒',
    nameEn: 'Han',
    gender: 'male',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '温暖痴情',
    description: '温暖深情的男声，富有磁性',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，无论发生什么，我都会守护你。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '陪伴闲聊',
  },
  {
    id: 'longanzhi_v3',
    name: '龙安智',
    nameEn: 'Anzhi',
    gender: 'male',
    age: '25~35岁',
    ageGroup: 'adult',
    personality: '睿智轻熟',
    description: '睿智成熟的男声，沉稳可靠',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，让我为您分析一下当前情况。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '陪伴闲聊',
  },
  {
    id: 'longanling_v3',
    name: '龙安灵',
    nameEn: 'Anling',
    gender: 'female',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '灵动聪慧',
    description: '思维灵活的女声，机智灵敏',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，我想到了一个好主意！',
    supportsSSML: true,
    supportsInstruct: false,
    category: '陪伴闲聊',
  },
  {
    id: 'longanya_v3',
    name: '龙安雅',
    nameEn: 'Anya',
    gender: 'female',
    age: '25~35岁',
    ageGroup: 'adult',
    personality: '高雅气质',
    description: '高雅大气的女声，端庄优美',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸好，今天过得怎么样？',
    supportsSSML: true,
    supportsInstruct: false,
    category: '陪伴闲聊',
  },
  {
    id: 'longanqin_v3',
    name: '龙安亲',
    nameEn: 'Anqin',
    gender: 'female',
    age: '20~25岁',
    ageGroup: 'young',
    personality: '亲和活泼',
    description: '亲切活泼的年轻女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸～有什么开心的事要和我分享吗？',
    supportsSSML: true,
    supportsInstruct: false,
    category: '陪伴闲聊',
  },

  // === 语音助手 (Voice Assistant) ===
  {
    id: 'longanyun_v3',
    name: '龙安昀',
    nameEn: 'Anyun',
    gender: 'male',
    age: '30~35岁',
    ageGroup: 'adult',
    personality: '居家暖男',
    description: '温暖贴心的成熟男声',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，交给我来处理吧。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '语音助手',
  },
  {
    id: 'longanwen_v3',
    name: '龙安温',
    nameEn: 'Anwen',
    gender: 'female',
    age: '25~35岁',
    ageGroup: 'adult',
    personality: '优雅知性',
    description: '优雅知性的成熟女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，我来为您安排一下。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '语音助手',
  },
  {
    id: 'longanli_v3',
    name: '龙安莉',
    nameEn: 'Anli',
    gender: 'female',
    age: '25~35岁',
    ageGroup: 'adult',
    personality: '利落从容',
    description: '干练从容的女声，专业可靠',
    model: 'cosyvoice-v3-flash',
    sampleText: '爸爸，根据我的分析，建议这样做。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '语音助手',
  },
  {
    id: 'longanlang_v3',
    name: '龙安朗',
    nameEn: 'Anlang',
    gender: 'male',
    age: '20~25岁',
    ageGroup: 'young',
    personality: '清爽利落',
    description: '清爽利落的年轻男声',
    model: 'cosyvoice-v3-flash',
    sampleText: '收到！马上为您处理！',
    supportsSSML: true,
    supportsInstruct: false,
    category: '语音助手',
  },

  // === 有声书 (Audiobook) ===
  {
    id: 'longwanjun_v3',
    name: '龙婉君',
    nameEn: 'Wanjun',
    gender: 'female',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '细腻柔声',
    description: '细腻柔美的女声，适合讲故事',
    model: 'cosyvoice-v3-flash',
    sampleText: '从前有一座山，山里有一座庙...',
    supportsSSML: true,
    supportsInstruct: false,
    category: '有声书',
  },
  {
    id: 'longyichen_v3',
    name: '龙逸尘',
    nameEn: 'Yichen',
    gender: 'male',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '洒脱活力',
    description: '洒脱有活力的男声',
    model: 'cosyvoice-v3-flash',
    sampleText: '这个故事，要从很久以前说起...',
    supportsSSML: true,
    supportsInstruct: false,
    category: '有声书',
  },
  {
    id: 'longlaobo_v3',
    name: '龙老伯',
    nameEn: 'Laobo',
    gender: 'male',
    age: '60岁以上',
    ageGroup: 'elderly',
    personality: '沧桑岁月',
    description: '沧桑有故事感的老年男声',
    model: 'cosyvoice-v3-flash',
    sampleText: '想当年，我年轻的时候啊...',
    supportsSSML: true,
    supportsInstruct: false,
    category: '有声书',
  },
  {
    id: 'longlaoyi_v3',
    name: '龙老姨',
    nameEn: 'Laoyi',
    gender: 'female',
    age: '60岁以上',
    ageGroup: 'elderly',
    personality: '烟火从容',
    description: '慈祥温暖的老年女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '来，孩子，奶奶给你讲个故事...',
    supportsSSML: true,
    supportsInstruct: false,
    category: '有声书',
  },

  // === 短视频配音 (Video Dubbing) ===
  {
    id: 'longdaiyu_v3',
    name: '龙黛玉',
    nameEn: 'Daiyu',
    gender: 'female',
    age: '15~25岁',
    ageGroup: 'teen',
    personality: '娇率才女',
    description: '娇柔有才气的少女音，接近12-15岁',
    model: 'cosyvoice-v3-flash',
    sampleText: '这世间的烦恼，不过是过眼云烟罢了。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '短视频',
  },
  {
    id: 'longjiqi_v3',
    name: '龙机器',
    nameEn: 'Robot',
    gender: 'male',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '呆萌机器人',
    description: '呆萌可爱的机器人音效',
    model: 'cosyvoice-v3-flash',
    sampleText: '滴滴～系统运行正常！',
    supportsSSML: true,
    supportsInstruct: false,
    category: '短视频',
  },
  {
    id: 'longhouge_v3',
    name: '龙猴哥',
    nameEn: 'Monkey',
    gender: 'male',
    age: '20~25岁',
    ageGroup: 'young',
    personality: '经典猴哥',
    description: '活泼有趣的猴哥配音风格',
    model: 'cosyvoice-v3-flash',
    sampleText: '俺老孙来也！',
    supportsSSML: true,
    supportsInstruct: false,
    category: '短视频',
  },

  // === 客服 (Customer Service) ===
  {
    id: 'longyingjing_v3',
    name: '龙应静',
    nameEn: 'Yingjing',
    gender: 'female',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '低调冷静',
    description: '冷静专业的客服女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '您好，很高兴为您服务。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '客服',
  },
  {
    id: 'longyingling_v3',
    name: '龙应聆',
    nameEn: 'Yingling',
    gender: 'female',
    age: '20~30岁',
    ageGroup: 'young',
    personality: '温和共情',
    description: '温和有同理心的客服女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '我理解您的感受，让我来帮您解决。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '客服',
  },
  {
    id: 'longyingtao_v3',
    name: '龙应桃',
    nameEn: 'Yingtao',
    gender: 'female',
    age: '25~30岁',
    ageGroup: 'adult',
    personality: '温柔淡定',
    description: '温柔淡定的成熟客服女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '请放心，这个问题我来处理。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '客服',
  },

  // === 电话助手/销售/客服 ===
  {
    id: 'longyingmu_v3',
    name: '龙应沐',
    nameEn: 'Yingmu',
    gender: 'female',
    age: '25~30岁',
    ageGroup: 'adult',
    personality: '优雅知性',
    description: '优雅知性的专业女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '您好，我是您的专属助手。',
    supportsSSML: true,
    supportsInstruct: false,
    category: '电话助手',
  },
  {
    id: 'longyingxiao_v3',
    name: '龙应笑',
    nameEn: 'Yingxiao',
    gender: 'female',
    age: '20~25岁',
    ageGroup: 'young',
    personality: '清甜推销',
    description: '清甜活泼的年轻女声',
    model: 'cosyvoice-v3-flash',
    sampleText: '这个产品超级棒的，您一定会喜欢！',
    supportsSSML: true,
    supportsInstruct: false,
    category: '电话销售',
  },
  {
    id: 'longyingxun_v3',
    name: '龙应询',
    nameEn: 'Yingxun',
    gender: 'male',
    age: '20~25岁',
    ageGroup: 'young',
    personality: '年轻青涩',
    description: '年轻有朝气的男声',
    model: 'cosyvoice-v3-flash',
    sampleText: '您好！请问有什么可以帮到您的？',
    supportsSSML: true,
    supportsInstruct: false,
    category: '电话客服',
  },
];

const DEFAULT_VOICE = 'longanhuan';

export function getVoiceProfiles(): VoiceProfile[] {
  return VOICE_PROFILES;
}

export function getVoiceById(voiceId: string): VoiceProfile | undefined {
  return VOICE_PROFILES.find(v => v.id === voiceId);
}

export function getVoicesByGender(gender: 'male' | 'female' | 'child'): VoiceProfile[] {
  return VOICE_PROFILES.filter(v => v.gender === gender);
}

export function getVoicesByAgeGroup(ageGroup: 'child' | 'teen' | 'young' | 'adult' | 'mature' | 'elderly'): VoiceProfile[] {
  return VOICE_PROFILES.filter(v => v.ageGroup === ageGroup);
}

export function getVoicesByCategory(category: string): VoiceProfile[] {
  return VOICE_PROFILES.filter(v => v.category === category);
}

export function getRecommendedVoice(personality?: string): VoiceProfile {
  if (personality) {
    const match = VOICE_PROFILES.find(v => 
      v.personality.includes(personality) || v.description.includes(personality)
    );
    if (match) return match;
  }
  return VOICE_PROFILES.find(v => v.id === DEFAULT_VOICE) || VOICE_PROFILES[0];
}

export async function synthesizeSpeech(
  text: string,
  options: SynthesisOptions = { voice: DEFAULT_VOICE }
): Promise<SynthesisResult> {
  const voice = options.voice || DEFAULT_VOICE;
  
  // 检查是否是Azure语音（以azure_开头）
  if (voice.startsWith('azure_')) {
    const { synthesizeWithAzure, isAzureConfigured } = await import('./azure-tts');
    if (!isAzureConfigured()) {
      return {
        success: false,
        format: options.format || 'mp3',
        voice,
        error: 'Azure语音服务未配置。需要设置 AZURE_SPEECH_KEY 环境变量。',
      };
    }
    const azureVoiceId = voice.replace('azure_', '');
    const result = await synthesizeWithAzure(text, {
      voice: azureVoiceId,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      style: options.emotion,
    });
    return {
      success: result.success,
      audioBase64: result.audioBase64,
      format: result.format,
      voice: result.voice,
      error: result.error,
    };
  }
  
  // DashScope语音
  const voiceProfile = getVoiceById(voice);
  const model = voiceProfile?.model || 'cosyvoice-v3-flash';
  
  if (!DASHSCOPE_API_KEY) {
    // 尝试回退到Azure
    const { synthesizeWithAzure, isAzureConfigured, getAzureVoices } = await import('./azure-tts');
    if (isAzureConfigured()) {
      logger.info('[Voice Synthesis] DashScope not configured, falling back to Azure');
      const azureVoices = getAzureVoices();
      const fallbackVoice = azureVoices[0]?.id || 'xiaoxiao';
      const result = await synthesizeWithAzure(text, {
        voice: fallbackVoice,
        rate: options.rate,
        pitch: options.pitch,
        volume: options.volume,
      });
      return {
        success: result.success,
        audioBase64: result.audioBase64,
        format: result.format,
        voice: `azure_${result.voice}`,
        error: result.error,
      };
    }
    return {
      success: false,
      format: options.format || 'mp3',
      voice,
      error: '语音合成服务未配置。需要在环境变量中设置 DASHSCOPE_API_KEY 或 AZURE_SPEECH_KEY。',
    };
  }
  
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      format: options.format || 'mp3',
      voice,
      error: '合成文本不能为空',
    };
  }

  try {
    const parameters: Record<string, any> = {
      voice,
      format: options.format || 'mp3',
      sample_rate: options.sampleRate || 22050,
      volume: options.volume || 50,
      rate: options.rate || 1.0,
      pitch: options.pitch || 1.0,
    };

    if (voiceProfile?.supportsInstruct && options.emotion) {
      parameters.instruction = `你说话的情感是${options.emotion}。`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'disable',
      },
      body: JSON.stringify({
        model,
        input: {
          text: text.slice(0, 500),
        },
        parameters,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      // DashScope失败，尝试Azure回退
      const { synthesizeWithAzure, isAzureConfigured } = await import('./azure-tts');
      if (isAzureConfigured()) {
        logger.info('[Voice Synthesis] DashScope failed, falling back to Azure');
        const result = await synthesizeWithAzure(text, {
          voice: 'xiaoxiao',
          rate: options.rate,
          pitch: options.pitch,
        });
        return {
          success: result.success,
          audioBase64: result.audioBase64,
          format: result.format,
          voice: `azure_${result.voice}`,
          error: result.error,
        };
      }
      return {
        success: false,
        format: options.format || 'mp3',
        voice,
        error: `语音合成失败: ${errorData.message || response.statusText}`,
      };
    }

    const data = await response.json();
    
    if (data.output?.audio) {
      return {
        success: true,
        audioBase64: data.output.audio,
        format: options.format || 'mp3',
        voice,
        duration: data.output.duration,
      };
    }
    
    return {
      success: false,
      format: options.format || 'mp3',
      voice,
      error: '未获取到音频数据',
    };
  } catch (error) {
    logger.error({ error }, 'Voice synthesis error');
    // 网络错误时尝试Azure回退
    const { synthesizeWithAzure, isAzureConfigured } = await import('./azure-tts');
    if (isAzureConfigured()) {
      logger.info('[Voice Synthesis] DashScope network error, falling back to Azure');
      const result = await synthesizeWithAzure(text, {
        voice: 'xiaoxiao',
        rate: options.rate,
        pitch: options.pitch,
      });
      return {
        success: result.success,
        audioBase64: result.audioBase64,
        format: result.format,
        voice: `azure_${result.voice}`,
        error: result.error,
      };
    }
    return {
      success: false,
      format: options.format || 'mp3',
      voice,
      error: `语音合成请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

export function generateSSML(
  text: string,
  options: {
    emotion?: 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'neutral' | 'disgusted';
    emphasis?: 'strong' | 'moderate' | 'reduced';
    breakTime?: number;
  } = {}
): string {
  let ssml = '<speak>';
  
  if (options.emotion) {
    ssml += `<emotion category="${options.emotion}">`;
  }
  
  if (options.emphasis) {
    ssml += `<emphasis level="${options.emphasis}">`;
  }
  
  ssml += text;
  
  if (options.emphasis) {
    ssml += '</emphasis>';
  }
  
  if (options.emotion) {
    ssml += '</emotion>';
  }
  
  if (options.breakTime) {
    ssml += `<break time="${options.breakTime}ms"/>`;
  }
  
  ssml += '</speak>';
  
  return ssml;
}

export interface VoiceSettings {
  voiceId: string;
  rate: number;
  pitch: number;
  volume: number;
  emotion: string;
}

const userVoiceSettings: Map<string, VoiceSettings> = new Map();

export function setUserVoiceSettings(userId: string, settings: Partial<VoiceSettings>): VoiceSettings {
  const current = userVoiceSettings.get(userId) || {
    voiceId: DEFAULT_VOICE,
    rate: 1.0,
    pitch: 1.0,
    volume: 50,
    emotion: 'neutral',
  };
  
  const updated = { ...current, ...settings };
  userVoiceSettings.set(userId, updated);
  return updated;
}

export function getUserVoiceSettings(userId: string): VoiceSettings {
  return userVoiceSettings.get(userId) || {
    voiceId: DEFAULT_VOICE,
    rate: 1.0,
    pitch: 1.0,
    volume: 50,
    emotion: 'neutral',
  };
}

export function getVoicePreview(voiceId: string): string {
  const voice = getVoiceById(voiceId);
  return voice?.sampleText || '爸爸好，我是小智，很高兴为你服务。';
}

export function formatTextForSpeech(text: string): string {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/【.*?】/g, '')
    .replace(/\n+/g, '。')
    .replace(/。+/g, '。')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

// 获取音色分组
export function getVoiceCategories(): { category: string; voices: VoiceProfile[] }[] {
  const categories = Array.from(new Set(VOICE_PROFILES.map(v => v.category)));
  return categories.map(category => ({
    category,
    voices: VOICE_PROFILES.filter(v => v.category === category),
  }));
}

// 保持向后兼容 - 按年龄分组 (使用旧的age字段)
export function getVoicesByAge(age: 'child' | 'young' | 'adult' | 'mature'): VoiceProfile[] {
  const ageGroupMap: Record<string, string[]> = {
    'child': ['child', 'teen'],
    'young': ['young'],
    'adult': ['adult', 'mature'],
    'mature': ['mature', 'elderly'],
  };
  const groups = ageGroupMap[age] || [age];
  return VOICE_PROFILES.filter(v => groups.includes(v.ageGroup));
}

// 获取推荐的儿童/少年音色
export function getChildVoices(): VoiceProfile[] {
  return VOICE_PROFILES.filter(v => v.ageGroup === 'child' || v.ageGroup === 'teen');
}

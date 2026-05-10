import type {
  ChatConfig,
  ModelType,
  TaskType,
  SelectedModel,
  ModelCapability,
} from './types';

const MODEL_CAPABILITIES: Map<string, ModelCapability> = new Map([
  ['local-ollama', {
    type: 'local',
    maxTokens: 4096,
    contextLength: 8192,
    strengths: ['CHAT', 'CODE'],
    weaknesses: ['ANALYSIS', 'CREATIVE'],
    speed: 'fast',
    quality: 'medium',
    offlineCapable: true,
  }],
  ['local-webllm', {
    type: 'local',
    maxTokens: 2048,
    contextLength: 4096,
    strengths: ['CHAT'],
    weaknesses: ['CODE', 'ANALYSIS'],
    speed: 'medium',
    quality: 'medium',
    offlineCapable: true,
  }],
  ['deepseek-chat', {
    type: 'cloud',
    maxTokens: 4096,
    contextLength: 65536,
    strengths: ['CHAT', 'CODE', 'ANALYSIS'],
    weaknesses: [],
    speed: 'medium',
    quality: 'high',
    offlineCapable: false,
  }],
  ['deepseek-reasoner', {
    type: 'cloud',
    maxTokens: 8192,
    contextLength: 131072,
    strengths: ['ANALYSIS', 'CODE'],
    weaknesses: [],
    speed: 'slow',
    quality: 'high',
    offlineCapable: false,
  }],
  ['qwen-max', {
    type: 'cloud',
    maxTokens: 6144,
    contextLength: 32768,
    strengths: ['CHAT', 'VISION', 'ANALYSIS', 'CREATIVE'],
    weaknesses: [],
    speed: 'fast',
    quality: 'high',
    offlineCapable: false,
  }],
  ['qwen-plus', {
    type: 'cloud',
    maxTokens: 6144,
    contextLength: 32768,
    strengths: ['CHAT', 'ANALYSIS'],
    weaknesses: [],
    speed: 'fast',
    quality: 'medium',
    offlineCapable: false,
  }],
  ['doubao-pro', {
    type: 'cloud',
    maxTokens: 8192,
    contextLength: 32768,
    strengths: ['CHAT', 'CREATIVE', 'ANALYSIS'],
    weaknesses: [],
    speed: 'fast',
    quality: 'high',
    offlineCapable: false,
  }],
  ['doubao-lite', {
    type: 'cloud',
    maxTokens: 4096,
    contextLength: 16384,
    strengths: ['CHAT'],
    weaknesses: [],
    speed: 'fast',
    quality: 'medium',
    offlineCapable: false,
  }],
]);

const CODE_PATTERN = /\b(function|class|def|import|var|let|const|return|if|else|switch|case|for|while|async|await|try|catch|throw|new|this|super|extends)\b/i;
const ANALYSIS_PATTERN = /\b(分析|比较|评估|研究|调查|分析|对比|总结|归纳)\b/i;
const EN_ANALYSIS_PATTERN = /\b(analyze|compare|evaluate|research|investigate|review|assess|examine)\b/i;
const VISION_PATTERN = /\b(图片|图像|照片|视觉|看图|图片中|截图)\b/i;
const EN_VISION_PATTERN = /\b(image|picture|photo|visual|see|look at|screenshot|capture)\b/i;
const CREATIVE_PATTERN = /\b(写诗|创作|写歌|故事|小说|创意|编写|撰写|生成)\b/i;
const EN_CREATIVE_PATTERN = /\b(write poem|create song|story|novel|creative|compose|write|generate)\b/i;

export class ModelRouter {
  private customCapabilities: Map<string, ModelCapability> = new Map();

  async selectModel(
    userMessage: string,
    config: ChatConfig,
    conversationHistory: unknown[] = []
  ): Promise<SelectedModel> {
    const taskType = this.classifyTask(userMessage);

    switch (config.mode) {
      case 'SINGLE':
        return this.selectSingleModel(config.primaryModel, taskType);
      case 'ENSEMBLE':
        return this.selectEnsembleModel(config, taskType);
      case 'AUTO':
      default:
        return this.selectOptimalModel(taskType, config, conversationHistory);
    }
  }

  private classifyTask(message: string): TaskType {
    const lower = message.toLowerCase();

    if (
      CODE_PATTERN.test(lower) ||
      lower.includes('代码') ||
      lower.includes('function') ||
      lower.includes('algorithm')
    ) {
      return 'CODE';
    }

    if (
      ANALYSIS_PATTERN.test(lower) ||
      EN_ANALYSIS_PATTERN.test(lower) ||
      lower.includes('分析') ||
      lower.includes('reasoning')
    ) {
      return 'ANALYSIS';
    }

    if (
      VISION_PATTERN.test(lower) ||
      EN_VISION_PATTERN.test(lower) ||
      lower.includes('vision') ||
      lower.includes('图片') ||
      lower.includes('image')
    ) {
      return 'VISION';
    }

    if (
      CREATIVE_PATTERN.test(lower) ||
      EN_CREATIVE_PATTERN.test(lower) ||
      lower.includes('创作') ||
      lower.includes('写一首') ||
      lower.includes('写一个')
    ) {
      return 'CREATIVE';
    }

    return 'CHAT';
  }

  private selectSingleModel(
    modelName: string,
    _taskType: TaskType
  ): SelectedModel {
    const capability = this.getCapability(modelName);

    if (!capability) {
      return {
        type: 'cloud',
        name: 'qwen-max',
        confidence: 0.5,
        reason: '指定模型不可用，使用默认云端模型',
      };
    }

    return {
      type: capability.type,
      name: modelName,
      confidence: 0.9,
      reason: `用户指定模型: ${modelName}`,
    };
  }

  private selectEnsembleModel(
    config: ChatConfig,
    _taskType: TaskType
  ): SelectedModel {
    const models = [config.primaryModel, ...config.fallbackModels].filter(
      m => m !== config.primaryModel
    );

    return {
      type: 'ensemble',
      name: `${config.primaryModel}+${models.join('+')}`,
      confidence: 0.85,
      reason: `集成模式: ${[config.primaryModel, ...models].join(', ')}`,
    };
  }

  private selectOptimalModel(
    taskType: TaskType,
    config: ChatConfig,
    _history: unknown[]
  ): SelectedModel {
    const candidates = Array.from(this.getAllCapabilities().entries())
      .filter(([_, cap]) => this.isAvailable(cap))
      .map(([name, cap]) => this.evaluateModel(name, cap, taskType, config));

    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];

    if (
      best.type !== 'cloud' &&
      (taskType === 'ANALYSIS' || taskType === 'CREATIVE')
    ) {
      const cloudCandidate = candidates.find(c => c.type === 'cloud');
      if (cloudCandidate) {
        return {
          type: 'ensemble',
          name: `${best.name}+${cloudCandidate.name}`,
          confidence: 0.8,
          reason: `混合: ${best.name}快速 + ${cloudCandidate.name}高质量`,
        };
      }
    }

    return {
      type: best.type,
      name: best.name,
      confidence: best.score,
      reason: best.reason,
    };
  }

  private evaluateModel(
    name: string,
    capability: ModelCapability,
    taskType: TaskType,
    config: ChatConfig
  ): { name: string; type: ModelType; score: number; reason: string } {
    let score = 0;
    let reason = '';

    if (capability.strengths.includes(taskType)) {
      score += 40;
      reason = `擅长 ${taskType}`;
    } else if (capability.weaknesses.includes(taskType)) {
      score -= 20;
      reason = `不擅长 ${taskType}`;
    } else {
      score += 20;
      reason = `支持 ${taskType}`;
    }

    if (capability.quality === 'high') {
      score += config.preferOffline ? 15 : 30;
    } else if (capability.quality === 'medium') {
      score += config.preferOffline ? 25 : 15;
    }

    if (capability.speed === 'fast') {
      score += config.preferOffline ? 20 : 10;
    } else if (capability.speed === 'medium') {
      score += config.preferOffline ? 15 : 10;
    }

    if (config.preferOffline && capability.offlineCapable) {
      score += 10;
      reason += ', 离线可用';
    }

    return { name, type: capability.type as ModelType, score, reason };
  }

  private isAvailable(capability: ModelCapability): boolean {
    if (capability.type === 'local') {
      return capability.offlineCapable;
    }
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  private getCapability(modelName: string): ModelCapability | undefined {
    return (
      this.customCapabilities.get(modelName) ?? MODEL_CAPABILITIES.get(modelName)
    );
  }

  private getAllCapabilities(): Map<string, ModelCapability> {
    const all = new Map(MODEL_CAPABILITIES);
    for (const [name, cap] of this.customCapabilities) {
      all.set(name, cap);
    }
    return all;
  }

  getAvailableModels(): { name: string; type: ModelType; offlineCapable: boolean }[] {
    return Array.from(this.getAllCapabilities().entries())
      .filter(([_, cap]) => this.isAvailable(cap))
      .map(([name, cap]) => ({
        name,
        type: cap.type as ModelType,
        offlineCapable: cap.offlineCapable,
      }));
  }

  getModelInfo(modelName: string): ModelCapability | undefined {
    return this.getCapability(modelName);
  }

  registerModel(name: string, capability: ModelCapability): void {
    this.customCapabilities.set(name, capability);
  }

  unregisterModel(name: string): boolean {
    return this.customCapabilities.delete(name);
  }

  getTaskSuggestions(taskType: TaskType): string[] {
    const models = Array.from(this.getAllCapabilities().entries())
      .filter(([_, cap]) => cap.strengths.includes(taskType))
      .sort((a, b) => {
        const aScore = a[1].quality === 'high' ? 2 : 1;
        const bScore = b[1].quality === 'high' ? 2 : 1;
        return bScore - aScore;
      })
      .map(([name]) => name);

    return models.slice(0, 3);
  }
}

export const modelRouter = new ModelRouter();

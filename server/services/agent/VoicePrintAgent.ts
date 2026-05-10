/**
 * VoicePrintAgent - 声纹识别与对话分析
 *
 * 核心能力：
 * - 声纹分离：分清谁说了什么话
 * - 说话人识别：识别"兄弟"、"陈哥"分别是谁
 * - 对话角色标注：标注每个发言者
 * - 上下文理解：理解对话中的指代关系
 *
 * 使用场景：
 * - 微信语音消息
 * - 电话录音
 * - 会议录音
 */

import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('VoicePrintAgent');

import { AIProviderChain } from '../../lib/ai-provider';
import { randomUUID } from 'crypto';

export interface Speaker {
  id: string;
  name: string;           // 如 "兄弟", "陈哥"
  role?: string;         // 如 "朋友", "同事", "客户"
  voiceFeatures?: string; // 声纹特征描述
  confidence: number;     // 识别置信度
}

export interface DialogueSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  startTime: number;     // 秒
  endTime: number;
  text: string;
  audioUrl?: string;
}

export interface DialogueAnalysis {
  id: string;

  // 对话元信息
  source: string;
  duration: number;
  language: string;

  // 识别出的说话人
  speakers: Speaker[];

  // 对话片段（按时间排序）
  segments: DialogueSegment[];

  // 对话摘要
  summary: string;

  // 关键信息提取
  commitments: Commitment[];

  // 行动建议
  actions: Action[];
}

export interface Commitment {
  speaker: string;       // 谁承诺的
  content: string;       // 承诺内容
  type: 'promise' | 'request' | 'agreement' | 'question';
  relatedEntity?: string; // 关联实体
}

export interface Action {
  type: 'calendar' | 'reminder' | 'navigation' | 'booking' | 'call' | 'notify';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  params: Record<string, any>;
}

class VoicePrintAgent {
  private static instance: VoicePrintAgent | null = null;

  private aiProvider: AIProviderChain;

  // 用户通讯录（用于匹配说话人）
  private contacts: Map<string, { name: string; voicePrint?: string; relation?: string }> = new Map();

  private constructor() {
    this.aiProvider = new AIProviderChain();
  }

  public static getInstance(): VoicePrintAgent {
    if (!VoicePrintAgent.instance) {
      VoicePrintAgent.instance = new VoicePrintAgent();
    }
    return VoicePrintAgent.instance;
  }

  /**
   * 设置用户通讯录
   */
  public setContacts(contacts: Array<{ id: string; name: string; relation?: string }>): void {
    for (const contact of contacts) {
      this.contacts.set(contact.id, { name: contact.name, relation: contact.relation });
    }
    logger.info({ count: contacts.length }, 'Contacts loaded');
  }

  /**
   * 添加单个联系人
   */
  public addContact(id: string, name: string, relation?: string): void {
    this.contacts.set(id, { name, relation });
  }

  /**
   * 处理对话音频
   *
   * @param audioUrl 音频文件URL
   * @param options 处理选项
   */
  public async processAudio(
    audioUrl: string,
    options?: {
      transcribeOnly?: boolean;
      source?: string;
    }
  ): Promise<DialogueAnalysis> {
    const analysisId = `dlg_${randomUUID().slice(0, 8)}`;
    logger.info({ analysisId, audioUrl }, 'Processing audio');

    // 1. 语音转文字 + 说话人分离
    const transcription = await this.speechToText(audioUrl);

    // 2. 说话人识别
    const speakers = await this.identifySpeakers(transcription.segments, options?.source);

    // 3. 角色标注
    const labeledSegments = await this.labelRoles(transcription.segments, speakers);

    // 4. 对话摘要
    const summary = await this.generateSummary(labeledSegments);

    // 5. 提取承诺和行动
    const commitments = await this.extractCommitments(labeledSegments);
    const actions = this.generateActions(commitments, speakers);

    return {
      id: analysisId,
      source: options?.source || 'unknown',
      duration: transcription.duration,
      language: transcription.language || 'zh-CN',
      speakers,
      segments: labeledSegments,
      summary,
      commitments,
      actions,
    };
  }

  /**
   * 处理文本对话（模拟声纹场景）
   */
  public async processTextDialogue(
    dialogue: string,
    options?: { source?: string; participants?: string[] }
  ): Promise<DialogueAnalysis> {
    const analysisId = `dlg_${randomUUID().slice(0, 8)}`;
    logger.info({ analysisId }, 'Processing text dialogue');

    // 解析对话格式：尝试识别说话人标签
    const segments = this.parseDialogue(dialogue);

    // 如果没有明确的说话人标注，使用AI猜测
    if (segments.every(s => s.speakerName === 'unknown')) {
      const guessedSegments = await this.guessSpeakers(segments, options?.participants);
      segments.length = 0;
      segments.push(...guessedSegments);
    }

    // 识别说话人身份
    const speakers = await this.identifySpeakersFromSegments(segments);

    // 角色标注
    const labeledSegments = await this.labelRoles(segments, speakers);

    // 对话摘要
    const summary = await this.generateSummary(labeledSegments);

    // 提取承诺
    const commitments = await this.extractCommitments(labeledSegments);
    const actions = this.generateActions(commitments, speakers);

    return {
      id: analysisId,
      source: options?.source || 'text',
      duration: 0,
      language: 'zh-CN',
      speakers,
      segments: labeledSegments,
      summary,
      commitments,
      actions,
    };
  }

  /**
   * 语音转文字（实际应该调用语音服务）
   */
  private async speechToText(audioUrl: string): Promise<{
    segments: Array<{ startTime: number; endTime: number; text: string; speakerIndex?: number }>;
    duration: number;
    language?: string;
  }> {
    // 实际应该调用：阿里云 ASR / 讯飞 / Whisper 等
    // 这里返回模拟数据

    logger.debug({ audioUrl }, 'Speech to text (mock)');

    // 返回带说话人信息的转写结果
    return {
      segments: [
        { startTime: 0, endTime: 5, text: '我晚上10点到郑州，你有时间来接我吗？', speakerIndex: 1 },
        { startTime: 5, endTime: 8, text: '有的兄弟，需要我帮你安排房间吗？到了咱们去小酌一杯。', speakerIndex: 0 },
        { startTime: 8, endTime: 12, text: '好的陈哥，10点见，我从高铁站东出站口出。', speakerIndex: 1 },
        { startTime: 12, endTime: 15, text: '好的兄弟，我的车牌号0L5Z7。', speakerIndex: 1 },
      ],
      duration: 15,
      language: 'zh-CN',
    };
  }

  /**
   * 识别说话人
   */
  private async identifySpeakers(
    segments: Array<{ text: string; speakerIndex?: number }>,
    source?: string
  ): Promise<Speaker[]> {
    // 基于对话内容识别说话人身份
    const systemPrompt = `你是一个对话分析专家。根据对话内容，识别每个说话人的身份。

对话内容：
${segments.map((s, i) => `说话人${s.speakerIndex ?? i}: "${s.text}"`).join('\n')}

请分析：
1. 谁是"兄弟"/"老弟"？（称呼对方为兄弟的人）
2. 谁是"陈哥"？（被称呼为"陈哥"的人）
3. 他们的关系是什么？

返回JSON格式：
{
  "speakers": [
    {
      "id": "speaker_0",
      "name": "王二",
      "role": "朋友",
      "confidence": 0.95,
      "evidence": "称呼对方为'陈哥'"
    },
    {
      "id": "speaker_1",
      "name": "陈哥",
      "role": "朋友",
      "confidence": 0.95,
      "evidence": "被称呼为'陈哥'"
    }
  ]
}`;

    const response = await this.aiProvider.chat(
      '请分析这段对话中谁是谁',
      systemPrompt,
      { temperature: 0.3, maxTokens: 1000 }
    );

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        return parsed.speakers || [];
      }
    } catch {
      logger.warn({ response }, 'Failed to parse speaker identification');
    }

    // 默认返回
    return [
      { id: 'speaker_0', name: '说话人A', confidence: 0.5 },
      { id: 'speaker_1', name: '说话人B', confidence: 0.5 },
    ];
  }

  /**
   * 从文本对话片段识别说话人
   */
  private async identifySpeakersFromSegments(
    segments: DialogueSegment[]
  ): Promise<Speaker[]> {
    // 使用同样的AI分析方法
    return this.identifySpeakers(
      segments.map(s => ({ text: s.text })),
      'text'
    );
  }

  /**
   * 解析对话文本（识别说话人标签）
   */
  private parseDialogue(text: string): DialogueSegment[] {
    const segments: DialogueSegment[] = [];

    // 尝试识别说话人标签格式
    // 格式1: "A: xxx" "B: xxx"
    // 格式2: "【A】xxx" "【B】xxx"
    // 格式3: 通过换行和缩进判断

    const lines = text.split('\n').filter(l => l.trim());
    let currentSpeaker = 'unknown';

    for (const line of lines) {
      // 检测说话人切换
      const speakerMatch = line.match(/^([^\s:：]+)[:：]/);
      if (speakerMatch) {
        currentSpeaker = speakerMatch[1];
      }

      segments.push({
        id: `seg_${segments.length}`,
        speakerId: 'unknown',
        speakerName: currentSpeaker,
        startTime: 0,
        endTime: 0,
        text: line.replace(/^[^\s:：]+[:：]\s*/, ''),
      });
    }

    return segments;
  }

  /**
   * AI猜测说话人
   */
  private async guessSpeakers(
    segments: DialogueSegment[],
    participants?: string[]
  ): Promise<DialogueSegment[]> {
    // 如果有通讯录信息，优先匹配
    const contactNames = Array.from(this.contacts.values()).map(c => c.name);

    const systemPrompt = `分析以下对话，猜测每个说话人的身份。

对话内容：
${segments.map((s, i) => `段${i + 1}: "${s.text}"`).join('\n')}

已知联系人：${contactNames.join(', ') || '无'}

请根据：
1. 称呼方式（"兄弟"、"陈哥"、"老板"等）
2. 内容判断谁更可能是发起者
3. 谁在请求，谁在回应

返回JSON格式（speaker字段填猜测的名称）：
{
  "segments": [
    {
      "speaker": "猜测的说话人名称",
      "text": "对话内容"
    }
  ]
}`;

    const response = await this.aiProvider.chat(
      '请分析这段对话',
      systemPrompt,
      { temperature: 0.3, maxTokens: 1000 }
    );

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        if (parsed.segments) {
          return parsed.segments.map((s: Record<string, unknown>, i: number) => ({
            ...segments[i],
            speakerName: s.speaker,
          }));
        }
      }
    } catch {
      logger.warn({ response }, 'Failed to guess speakers');
    }

    return segments;
  }

  /**
   * 标注角色
   */
  private async labelRoles(
    segments: Array<{ text: string; speakerIndex?: number; speakerName?: string }>,
    speakers: Speaker[]
  ): Promise<DialogueSegment[]> {
    return segments.map((s, i) => ({
      id: `seg_${i}`,
      speakerId: speakers.find(sp => sp.name === s.speakerName)?.id || 'unknown',
      speakerName: s.speakerName || 'unknown',
      startTime: (s as Record<string, unknown>).startTime || 0,
      endTime: (s as Record<string, unknown>).endTime || 0,
      text: s.text,
    }));
  }

  /**
   * 生成对话摘要
   */
  private async generateSummary(segments: DialogueSegment[]): Promise<string> {
    const systemPrompt = `请用一句话总结以下对话的核心内容（20字以内）：

${segments.map(s => `${s.speakerName}: ${s.text}`).join('\n')}`;

    const summary = await this.aiProvider.chat('', systemPrompt, {
      temperature: 0.3,
      maxTokens: 100,
    });

    return summary.trim();
  }

  /**
   * 提取承诺和请求
   */
  private async extractCommitments(segments: DialogueSegment[]): Promise<Commitment[]> {
    const systemPrompt = `分析以下对话，提取所有承诺、请求、约定。

对话内容：
${segments.map(s => `${s.speakerName}: ${s.text}`).join('\n')}

请提取：
1. 谁承诺了什么
2. 谁请求了什么
3. 达成的约定
4. 涉及的关键实体（时间、地点、物品）

返回JSON格式：
{
  "commitments": [
    {
      "speaker": "说话人名称",
      "content": "承诺/请求内容",
      "type": "promise|request|agreement|question",
      "relatedEntity": "关键实体（如时间、地点）"
    }
  ]
}`;

    const response = await this.aiProvider.chat('', systemPrompt, {
      temperature: 0.3,
      maxTokens: 1000,
    });

    try {
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        return parsed.commitments || [];
      }
    } catch {
      logger.warn({ response }, 'Failed to extract commitments');
    }

    return [];
  }

  /**
   * 生成行动建议
   */
  private generateActions(commitments: Commitment[], speakers: Speaker[]): Action[] {
    const actions: Action[] = [];

    for (const commitment of commitments) {
      if (commitment.type === 'agreement' || commitment.type === 'promise') {
        // 时间约定
        const timeMatch = commitment.content.match(/(\d{1,2})[点时]|\d{4}[-/]\d{1,2}/);
        if (timeMatch) {
          actions.push({
            type: 'calendar',
            title: `与${commitment.speaker}的约定`,
            description: commitment.content,
            priority: 'high',
            params: {
              time: timeMatch[0],
              participants: [commitment.speaker],
            },
          });
        }

        // 地点
        if (commitment.content.includes('站') || commitment.content.includes('机场')) {
          const location = commitment.relatedEntity || this.extractLocation(commitment.content);
          actions.push({
            type: 'navigation',
            title: `去接${commitment.speaker}`,
            description: location,
            priority: 'high',
            params: { destination: location },
          });
        }

        // 车牌号
        const plateMatch = commitment.content.match(/[京沪津渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉贵粤青藏川宁琼使领][A-Z][A-Z0-9]{4,5}/);
        if (plateMatch) {
          actions.push({
            type: 'reminder',
            title: '记住车牌号',
            description: `${commitment.speaker}的车牌：${plateMatch[0]}`,
            priority: 'medium',
            params: { plate: plateMatch[0] },
          });
        }

        // 酒店/房间
        if (commitment.content.includes('房间') || commitment.content.includes('酒店')) {
          actions.push({
            type: 'booking',
            title: '预订酒店',
            description: `为${commitment.speaker}安排房间`,
            priority: 'medium',
            params: { type: 'hotel' },
          });
        }

        // 喝酒
        if (commitment.content.includes('酒') || commitment.content.includes('酌')) {
          actions.push({
            type: 'suggest',
            title: '推荐餐厅',
            description: '推荐适合小酌的餐厅',
            priority: 'low',
            params: { type: 'restaurant', category: 'bar' },
          });
        }
      }
    }

    return actions;
  }

  /**
   * 提取地点
   */
  private extractLocation(text: string): string {
    // 简单提取
    const locationMatch = text.match(/(.+?(?:站|机场|酒店|机场|码头))(?:东|西|南|北)?出站口?/);
    return locationMatch ? locationMatch[0] : '';
  }
}

export const voicePrintAgent = VoicePrintAgent.getInstance();
export default voicePrintAgent;

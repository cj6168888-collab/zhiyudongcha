import { createServiceLogger } from '../../lib/logger';
import { AIProviderChain } from '../../lib/ai-provider';
import { conversationService } from './ConversationService';
import { classifyCloudPrivacy } from '../privacy/PrivacyGateway';

const logger = createServiceLogger('ConversationProcessor');

const PROCESSOR_SYSTEM_PROMPT = `你是一个信息提取助手。用户会给你一段对话或笔记内容。
请从中提取以下候选项（只提取明确存在的，不要猜测）：
- tasks: 需要做的事情，格式 [{title, description, dueDate?}]
- memories: 值得长期记忆的信息，格式 [{content, tags?}]
- events: 日历事件，格式 [{title, date, time?}]

返回纯 JSON，格式：
{
  "summary": "一句话摘要",
  "tasks": [],
  "memories": [],
  "events": []
}
如果某类没有则为空数组。不要输出任何解释文字。`;

interface ProcessingResult {
  summary: string;
  taskCount: number;
  memoryCount: number;
  eventCount: number;
}

class ConversationProcessor {
  private ai: AIProviderChain;

  constructor() {
    this.ai = new AIProviderChain();
  }

  async process(conversationId: string, ownerId: string): Promise<ProcessingResult | null> {
    const conversation = await conversationService.get(conversationId, ownerId);
    if (!conversation) {
      logger.warn('Conversation not found', { conversationId });
      return null;
    }

    const segments = await conversationService.getSegments(conversationId);
    if (segments.length === 0) {
      await conversationService.updateStatus(conversationId, 'completed');
      return { summary: '', taskCount: 0, memoryCount: 0, eventCount: 0 };
    }

    const transcript = segments
      .filter(s => s.text)
      .map(s => `[${s.speaker ?? s.speakerType ?? 'user'}]: ${s.text}`)
      .join('\n');

    await conversationService.updateStatus(conversationId, 'processing');

    const privacyDecision = classifyCloudPrivacy(transcript);
    logger.info('Conversation privacy decision', {
      conversationId,
      decision: privacyDecision.decision,
      sensitivity: privacyDecision.classification.sensitivityLevel,
      categories: privacyDecision.classification.sensitiveCategories,
      transcript: privacyDecision.safeLog,
    });

    if (privacyDecision.decision === 'LOCAL_ONLY') {
      const summary = '包含高敏内容，已阻断云端对话处理，等待本地模型或手工确认。';
      await conversationService.updateStatus(conversationId, 'completed', { summary });
      return { summary, taskCount: 0, memoryCount: 0, eventCount: 0 };
    }

    let parsed: { summary?: string; tasks?: unknown[]; memories?: unknown[]; events?: unknown[] } = {};

    try {
      const result = await this.ai.complete({
        messages: [
          { role: 'system', content: PROCESSOR_SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        maxTokens: 1000,
      });

      const raw = result.content.trim();
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      }
    } catch (err) {
      logger.warn('AI processing failed, marking completed without candidates', { conversationId, err });
      await conversationService.updateStatus(conversationId, 'completed', { summary: '' });
      return { summary: '', taskCount: 0, memoryCount: 0, eventCount: 0 };
    }

    const summary = parsed.summary ?? '';
    let taskCount = 0;
    let memoryCount = 0;
    let eventCount = 0;

    for (const task of (parsed.tasks ?? [])) {
      try {
        await conversationService.addCandidate({
          conversationId,
          candidateType: 'task',
          content: { title: task.title, description: task.description ?? '', dueDate: task.dueDate },
          confidence: 0.8,
          riskLevel: 'low',
        });
        taskCount++;
      } catch (e) {
        logger.error('Failed to add task candidate', { conversationId, e });
      }
    }

    for (const memory of (parsed.memories ?? [])) {
      try {
        await conversationService.addCandidate({
          conversationId,
          candidateType: 'memory',
          content: { content: memory.content, tags: memory.tags ?? [] },
          confidence: 0.75,
          riskLevel: 'low',
        });
        memoryCount++;
      } catch (e) {
        logger.error('Failed to add memory candidate', { conversationId, e });
      }
    }

    for (const event of (parsed.events ?? [])) {
      try {
        await conversationService.addCandidate({
          conversationId,
          candidateType: 'event',
          content: { title: event.title, date: event.date, time: event.time },
          confidence: 0.8,
          riskLevel: 'low',
        });
        eventCount++;
      } catch (e) {
        logger.error('Failed to add event candidate', { conversationId, e });
      }
    }

    const hasCandidates = taskCount + memoryCount + eventCount > 0;
    await conversationService.updateStatus(conversationId, hasCandidates ? 'review_pending' : 'completed', { summary });

    logger.info('Conversation processed', { conversationId, taskCount, memoryCount, eventCount });
    return { summary, taskCount, memoryCount, eventCount };
  }
}

export const conversationProcessor = new ConversationProcessor();

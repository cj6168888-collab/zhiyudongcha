import {
  aiProvider,
  type AICompletionOptions,
  type AICompletionResult,
  type AIMessage,
} from '../../lib/ai-provider';
import { AIServiceError } from '../../lib/errors';
import { createServiceLogger } from '../../lib/logger';
import { createPrivacySafeTextMetadata } from '../../lib/privacy-redaction';
import { classifyCloudPrivacy } from './PrivacyGateway';
import {
  redactedInferenceGateway,
  type PrivacySensitivity,
  type PublicSensitiveEntity,
} from './RedactedInferenceGateway';

const logger = createServiceLogger('LLMProxyGateway');

export type LLMProxyDecision = 'ALLOW_CLOUD' | 'REDACT_THEN_CLOUD' | 'LOCAL_ONLY';
export type LLMProxyRedactionMode = 'AUTO' | 'DISABLED';

export interface LLMProxyOptions extends AICompletionOptions {
  purpose?: string;
  allowCloud?: boolean;
  redactionMode?: LLMProxyRedactionMode;
}

export interface PreparedLLMProxyRequest {
  messages: AIMessage[];
  decision: LLMProxyDecision;
  reason: string;
  redactionApplied: boolean;
  requiresConfirm: boolean;
  redactionSessionIds: string[];
  entities: PublicSensitiveEntity[];
  sensitivity: PrivacySensitivity;
  categories: string[];
}

export interface LLMProxyCompletionResult extends AICompletionResult {
  cloudUsed: boolean;
  decision: LLMProxyDecision;
  redactionApplied: boolean;
  requiresConfirm: boolean;
  redactionSessionIds: string[];
  entities: PublicSensitiveEntity[];
  sensitivity: PrivacySensitivity;
  categories: string[];
}

const SENSITIVITY_PRIORITY: Record<PrivacySensitivity, number> = {
  S0: 0,
  S1: 1,
  S2: 2,
  S3: 3,
  S4: 4,
};

function mapClassifierSensitivity(level: string): PrivacySensitivity {
  switch (level) {
    case 'CRITICAL':
      return 'S4';
    case 'HIGH':
      return 'S3';
    case 'MEDIUM':
      return 'S2';
    case 'LOW':
    default:
      return 'S1';
  }
}

function maxSensitivity(values: PrivacySensitivity[]): PrivacySensitivity {
  return values.reduce<PrivacySensitivity>((highest, value) => {
    return SENSITIVITY_PRIORITY[value] > SENSITIVITY_PRIORITY[highest] ? value : highest;
  }, 'S1');
}

function hasNonExportableEntity(entities: PublicSensitiveEntity[]): boolean {
  return entities.some(entity => entity.exportLevel === 'E4');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export class LLMProxyGateway {
  prepareCompletionRequest(options: LLMProxyOptions): PreparedLLMProxyRequest {
    const allowCloud = options.allowCloud ?? true;
    const redactionMode = options.redactionMode ?? 'AUTO';
    const userContent = options.messages
      .filter(message => message.role === 'user')
      .map(message => message.content)
      .join('\n');

    const cloudPrivacy = classifyCloudPrivacy(userContent || options.messages.map(message => message.content).join('\n'));
    const redactedMessages: AIMessage[] = [];
    const entities: PublicSensitiveEntity[] = [];
    const redactionSessionIds: string[] = [];
    let redactionApplied = false;
    let requiresConfirm = false;

    for (const message of options.messages) {
      if (redactionMode === 'DISABLED') {
        redactedMessages.push(message);
        continue;
      }

      const redaction = redactedInferenceGateway.redactForCloud(message.content, {
        purpose: options.purpose,
        storeSession: message.role !== 'system',
      });

      redactedMessages.push({ ...message, content: redaction.cloudText });
      redactionApplied = redactionApplied || redaction.redactionApplied;
      requiresConfirm = requiresConfirm || redaction.requiresConfirm;
      entities.push(...redaction.entities);
      if (redaction.sessionId) {
        redactionSessionIds.push(redaction.sessionId);
      }
    }

    const classifierSensitivity = mapClassifierSensitivity(cloudPrivacy.classification.sensitivityLevel);
    const sensitivity = maxSensitivity([classifierSensitivity, ...entities.map(entity => entity.sensitivity)]);
    const categories = unique([
      ...cloudPrivacy.classification.sensitiveCategories,
      ...entities.map(entity => entity.type),
    ]);

    let decision: LLMProxyDecision = 'ALLOW_CLOUD';
    let reason = '低敏或已满足云端调用条件';

    if (!allowCloud) {
      decision = 'LOCAL_ONLY';
      reason = '调用方禁止云端模型';
    } else if (hasNonExportableEntity(entities)) {
      decision = 'LOCAL_ONLY';
      reason = '包含 E4 不可导出秘密，禁止云端模型';
    } else if (redactionApplied) {
      decision = 'REDACT_THEN_CLOUD';
      reason = '敏感实体已替换为占位符，可进行脱敏云端推理';
    } else if (cloudPrivacy.decision === 'LOCAL_ONLY') {
      decision = 'LOCAL_ONLY';
      reason = cloudPrivacy.reason;
    }

    logger.info({
      decision,
      sensitivity,
      categories,
      redactionApplied,
      requiresConfirm,
      redactionSessionCount: redactionSessionIds.length,
      input: createPrivacySafeTextMetadata(userContent || ''),
    }, 'LLM 代理出口判定');

    return {
      messages: redactedMessages,
      decision,
      reason,
      redactionApplied,
      requiresConfirm: requiresConfirm || decision === 'LOCAL_ONLY',
      redactionSessionIds,
      entities,
      sensitivity,
      categories,
    };
  }

  async complete(options: LLMProxyOptions): Promise<LLMProxyCompletionResult> {
    const prepared = this.prepareCompletionRequest(options);

    if (prepared.decision === 'LOCAL_ONLY') {
      throw new AIServiceError(
        '请求被隐私代理拦截，未发送给云端模型',
        'llm-proxy-gateway',
        false,
        {
          reason: prepared.reason,
          sensitivity: prepared.sensitivity,
          categories: prepared.categories,
          redactionApplied: prepared.redactionApplied,
        },
      );
    }

    const result = await aiProvider.complete({
      ...options,
      messages: prepared.messages,
    });

    return {
      ...result,
      cloudUsed: true,
      decision: prepared.decision,
      redactionApplied: prepared.redactionApplied,
      requiresConfirm: prepared.requiresConfirm,
      redactionSessionIds: prepared.redactionSessionIds,
      entities: prepared.entities,
      sensitivity: prepared.sensitivity,
      categories: prepared.categories,
    };
  }

  async chat(
    message: string,
    systemPrompt?: string,
    options: Omit<Partial<LLMProxyOptions>, 'messages'> = {},
  ): Promise<LLMProxyCompletionResult> {
    const messages: AIMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    return this.complete({
      messages,
      ...options,
    });
  }
}

export const llmProxyGateway = new LLMProxyGateway();

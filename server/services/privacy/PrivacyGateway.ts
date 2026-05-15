import type { RoutingMode } from '@shared/schema';
import { createPrivacySafeTextMetadata, type PrivacySafeTextMetadata } from '../../lib/privacy-redaction';
import { taskClassifier, type ClassificationResult } from '../task-classifier';

export type CloudPrivacyDecision = 'ALLOW_CLOUD' | 'LOCAL_ONLY';

export interface PrivacyGatewayDecision {
  decision: CloudPrivacyDecision;
  classification: ClassificationResult;
  safeLog: PrivacySafeTextMetadata;
  reason: string;
}

export function classifyCloudPrivacy(
  text: string,
  options: { routingMode?: RoutingMode } = {},
): PrivacyGatewayDecision {
  const routingMode = options.routingMode ?? 'PRIVACY_FIRST';
  const classification = taskClassifier.classify(text, routingMode);
  const localOnly = classification.shouldForceLocal
    || classification.sensitivityLevel === 'HIGH'
    || classification.sensitivityLevel === 'CRITICAL';

  return {
    decision: localOnly ? 'LOCAL_ONLY' : 'ALLOW_CLOUD',
    classification,
    safeLog: createPrivacySafeTextMetadata(text),
    reason: localOnly
      ? `敏感等级 ${classification.sensitivityLevel}，类别 ${classification.sensitiveCategories.join(', ') || 'UNKNOWN'}，禁止明文上云`
      : `敏感等级 ${classification.sensitivityLevel}，允许进入普通模型路由`,
  };
}

export function createLocalOnlyAssistantMessage(decision: PrivacyGatewayDecision): string {
  const categories = decision.classification.sensitiveCategories.join('、') || '敏感信息';
  return [
    '这条请求可能包含高敏信息，我已切换到本地保护模式，未发送给云端大模型。',
    `命中类别：${categories}。`,
    '请在本地保险箱或本地模型能力可用后继续；涉及账号、密码、证件、银行卡、合同和私密关系时，默认不做云端明文推理。',
  ].join('\n');
}

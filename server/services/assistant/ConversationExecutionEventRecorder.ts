/**
 * ConversationExecutionEventRecorder
 *
 * 将对话执行结果写入审计日志和进化事件流，让 UI 回流结果可以进入后续复盘。
 */

import { createServiceLogger } from '../../lib/logger';
import { storage } from '../../storage';
import type { AssistantResponse } from './HybridAssistant';
import type { ExecutionResult } from './ConversationActionExecutor';

const logger = createServiceLogger('ConversationExecutionEventRecorder');

export interface ConversationExecutionRecordInput {
  response: AssistantResponse;
  execution: ExecutionResult;
  userId: string;
  source: 'assistant_chat' | 'assistant_authorize';
}

export class ConversationExecutionEventRecorder {
  async record(input: ConversationExecutionRecordInput): Promise<void> {
    const { response, execution, userId, source } = input;
    const result = execution.success ? 'SUCCESS' : 'FAILURE';
    const eventType = execution.success
      ? 'ASSISTANT_EXECUTION_SUCCEEDED'
      : 'ASSISTANT_EXECUTION_FAILED';

    const details = {
      responseId: response.id,
      handler: response.handler,
      responseType: response.type,
      category: response.category,
      source,
      action: execution.action,
      entityType: execution.entityType,
      entityId: execution.entityId,
      entityData: execution.entityData,
      errorMessage: execution.errorMessage,
    };

    try {
      await storage.createAuditLog({
        action: `ASSISTANT_${execution.action.toUpperCase()}`,
        actor: userId,
        targetType: execution.entityType ?? 'assistant_action',
        targetId: execution.entityId ?? response.id,
        details,
        result,
      });
    } catch (err) {
      logger.warn({ err, responseId: response.id }, 'Failed to record assistant execution audit log');
    }

    try {
      await storage.createEvolutionEvent({
        sourceModule: 'HybridAssistant',
        eventType,
        previousValue: {
          userMessageResponseId: response.id,
          source,
        },
        newValue: details,
        deltaDescription: execution.success
          ? `对话动作已执行：${execution.action}`
          : `对话动作执行失败：${execution.action}`,
        triggeredBy: userId,
      });
    } catch (err) {
      logger.warn({ err, responseId: response.id }, 'Failed to record assistant execution evolution event');
    }
  }
}

export const conversationExecutionEventRecorder = new ConversationExecutionEventRecorder();

/**
 * P4 — Screen Awareness Bridge
 * 在已有 Z5 screen-monitor 之上叠加 Conversation底座集成。
 * 每次屏幕捕获先过敏感内容门控，通过后写入 Conversation 留存溯源。
 */
import { createServiceLogger } from '../../lib/logger';
import { conversationService } from '../conversation/ConversationService';

const logger = createServiceLogger('ScreenAwarenessBridge');

// 敏感内容模式 — 命中则阻断记录
const SENSITIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'password_field',  pattern: /密码[：:]\s*\S+|password\s*[:=]\s*\S+/i },
  { label: 'private_key',     pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'credit_card',     pattern: /\b(?:\d[ -]?){13,16}\b/ },
  { label: 'verification_code', pattern: /验证码[：:]\s*\d{4,8}/ },
  { label: 'totp_secret',     pattern: /[A-Z2-7]{32,}/ },
];

interface CaptureInput {
  text: string;
  appContext?: string;
  source?: 'ocr' | 'accessibility' | 'manual';
}

export interface CaptureResult {
  stored: boolean;
  blocked: boolean;
  blockReason?: string;
  conversationId?: string;
}

// 每个 ownerId 的开关状态（默认关闭）
const enabledOwners = new Set<string>();

class ScreenAwarenessBridge {
  isEnabled(ownerId: string): boolean {
    return enabledOwners.has(ownerId);
  }

  enable(ownerId: string): void {
    enabledOwners.add(ownerId);
    logger.info('Screen awareness enabled', { ownerId });
  }

  disable(ownerId: string): void {
    enabledOwners.delete(ownerId);
    logger.info('Screen awareness disabled', { ownerId });
  }

  /**
   * 提交一帧屏幕捕获。
   * 未开启 → 静默忽略。
   * 敏感内容 → blocked=true，不写 DB。
   * 正常内容 → 写一条 Conversation(source='desktop', mode='record_note') 留存。
   */
  async processCapture(ownerId: string, input: CaptureInput): Promise<CaptureResult> {
    if (!this.isEnabled(ownerId)) {
      return { stored: false, blocked: false };
    }

    const sensitive = this.detectSensitive(input.text);
    if (sensitive) {
      logger.warn('Sensitive content blocked', { ownerId, label: sensitive });
      return { stored: false, blocked: true, blockReason: sensitive };
    }

    try {
      const title = input.appContext
        ? `屏幕捕获 — ${input.appContext}`
        : '屏幕捕获';

      const conversation = await conversationService.create({
        ownerId,
        source: 'desktop',
        mode: 'record_note',
        title,
      });

      await conversationService.appendSegment({
        conversationId: conversation.id,
        sequence: 1,
        segmentType: 'screen',
        text: input.text.slice(0, 4000),
        speaker: 'screen',
        speakerType: 'system',
        source: input.source ?? 'ocr',
      });

      await conversationService.finish(conversation.id, ownerId);

      logger.info('Screen capture stored', { ownerId, conversationId: conversation.id });
      return { stored: true, blocked: false, conversationId: conversation.id };
    } catch (err) {
      logger.error('processCapture failed', { ownerId, err });
      return { stored: false, blocked: false };
    }
  }

  private detectSensitive(text: string): string | null {
    for (const { label, pattern } of SENSITIVE_PATTERNS) {
      if (pattern.test(text)) return label;
    }
    return null;
  }
}

export const screenAwarenessBridge = new ScreenAwarenessBridge();

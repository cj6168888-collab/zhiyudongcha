import { createServiceLogger } from '../../lib/logger';
import { conversationService, ConversationRecord } from '../conversation/ConversationService';
import { conversationProcessor } from '../conversation/ConversationProcessor';

const logger = createServiceLogger('PerceptionGateway');

export type PerceptionSource =
  | 'mobile'
  | 'desktop'
  | 'xiaozhi_device'
  | 'omi'
  | 'browser'
  | 'file'
  | 'manual'
  | 'import';

export type PerceptionMode =
  | 'casual_chat'
  | 'record_note'
  | 'conversation_record'
  | 'task_request';

export interface TextIngestionInput {
  ownerId: string;
  source: PerceptionSource;
  mode?: PerceptionMode;
  text: string;
  speaker?: string;
  speakerType?: 'user' | 'navigator' | 'device' | 'system';
  sourceDeviceId?: string;
  language?: string;
  title?: string;
  autoProcess?: boolean;
}

export interface IngestResult {
  conversation: ConversationRecord;
  segmentId: string;
  processed: boolean;
}

class PerceptionGateway {
  async ingestText(input: TextIngestionInput): Promise<IngestResult> {
    const conversation = await conversationService.create({
      ownerId: input.ownerId,
      source: input.source,
      sourceDeviceId: input.sourceDeviceId,
      mode: input.mode ?? 'casual_chat',
      language: input.language,
      title: input.title,
    });

    const segment = await conversationService.appendSegment({
      conversationId: conversation.id,
      sequence: 1,
      segmentType: 'transcript',
      text: input.text,
      speaker: input.speaker ?? input.speakerType ?? 'user',
      speakerType: input.speakerType ?? 'user',
      source: input.source,
    });

    let processed = false;
    if (input.autoProcess && input.mode !== 'casual_chat') {
      try {
        await conversationService.finish(conversation.id, input.ownerId);
        await conversationProcessor.process(conversation.id, input.ownerId);
        processed = true;
      } catch (err) {
        logger.error('Auto-process failed', { conversationId: conversation.id, err });
      }
    } else {
      await conversationService.finish(conversation.id, input.ownerId);
    }

    logger.info('Text ingested', {
      conversationId: conversation.id,
      source: input.source,
      mode: input.mode,
      processed,
    });

    return { conversation, segmentId: segment.id, processed };
  }

  // For multi-turn conversations: start → append segments → finish → process
  async start(input: Omit<TextIngestionInput, 'text' | 'speaker' | 'speakerType' | 'autoProcess'>): Promise<ConversationRecord> {
    return conversationService.create({
      ownerId: input.ownerId,
      source: input.source,
      sourceDeviceId: input.sourceDeviceId,
      mode: input.mode ?? 'casual_chat',
      language: input.language,
      title: input.title,
    });
  }

  async appendText(
    conversationId: string,
    sequence: number,
    text: string,
    speaker: string,
    speakerType: 'user' | 'navigator' | 'device' | 'system',
    source: PerceptionSource
  ): Promise<string> {
    const segment = await conversationService.appendSegment({
      conversationId,
      sequence,
      segmentType: 'transcript',
      text,
      speaker,
      speakerType,
      source,
    });
    return segment.id;
  }

  async finishAndProcess(conversationId: string, ownerId: string): Promise<boolean> {
    await conversationService.finish(conversationId, ownerId);
    try {
      await conversationProcessor.process(conversationId, ownerId);
      return true;
    } catch (err) {
      logger.error('Process failed after finish', { conversationId, err });
      return false;
    }
  }
}

export const perceptionGateway = new PerceptionGateway();

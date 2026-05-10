import { talkSessionRepository, conversationSegmentRepository, extractedEntityRepository, opportunitySignalRepository } from '../../repositories';
import type { TalkSession, ConversationSegment, ExtractedEntity, OpportunitySignal, InsertTalkSession, InsertConversationSegment, InsertExtractedEntity, InsertOpportunitySignal } from '@shared/schema';

export interface IConversationStorage {
  createTalkSession(session: InsertTalkSession): Promise<TalkSession>;
  getTalkSession(id: string): Promise<TalkSession | undefined>;
  updateTalkSession(id: string, updates: Partial<InsertTalkSession>): Promise<TalkSession | undefined>;
  getAllTalkSessions(limit?: number): Promise<TalkSession[]>;
  
  createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment>;
  getSessionSegments(sessionId: string): Promise<ConversationSegment[]>;
  
  createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity>;
  getSessionEntities(sessionId: string): Promise<ExtractedEntity[]>;
  updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined>;
  
  createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal>;
  getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]>;
  updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined>;
}

export class ConversationStorage implements IConversationStorage {
  async createTalkSession(session: InsertTalkSession): Promise<TalkSession> {
    return await talkSessionRepository.create(session);
  }

  async getTalkSession(id: string): Promise<TalkSession | undefined> {
    return await talkSessionRepository.findById(id);
  }

  async updateTalkSession(id: string, updates: Partial<InsertTalkSession>): Promise<TalkSession | undefined> {
    return await talkSessionRepository.update(id, updates);
  }

  async getAllTalkSessions(limit?: number): Promise<TalkSession[]> {
    return await talkSessionRepository.getRecent(limit || 50);
  }
  
  async createConversationSegment(segment: InsertConversationSegment): Promise<ConversationSegment> {
    return await conversationSegmentRepository.create(segment);
  }

  async getSessionSegments(sessionId: string): Promise<ConversationSegment[]> {
    return await conversationSegmentRepository.getBySessionId(sessionId);
  }
  
  async createExtractedEntity(entity: InsertExtractedEntity): Promise<ExtractedEntity> {
    return await extractedEntityRepository.create(entity);
  }

  async getSessionEntities(sessionId: string): Promise<ExtractedEntity[]> {
    return await extractedEntityRepository.getBySessionId(sessionId);
  }

  async updateExtractedEntity(id: string, updates: Partial<InsertExtractedEntity>): Promise<ExtractedEntity | undefined> {
    return await extractedEntityRepository.update(id, updates);
  }
  
  async createOpportunitySignal(signal: InsertOpportunitySignal): Promise<OpportunitySignal> {
    return await opportunitySignalRepository.create(signal);
  }

  async getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]> {
    return await opportunitySignalRepository.getBySessionId(sessionId);
  }

  async updateOpportunitySignal(id: string, updates: Partial<InsertOpportunitySignal>): Promise<OpportunitySignal | undefined> {
    return await opportunitySignalRepository.update(id, updates);
  }
}

export const conversationStorage = new ConversationStorage();

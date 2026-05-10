import { createServiceLogger } from '../lib/logger';
import { conversationStorage } from '../storage/domains';
import { personService } from './PersonService';
import { analyzeTalkContent, identifyTalkType, type TalkAnalysisResult, type ExtractedEntityData, type OpportunityData } from './talk-analyzer';
import type { TalkSession, InsertTalkSession, ExtractedEntity, InsertExtractedEntity, OpportunitySignal, InsertOpportunitySignal, Person } from '@shared/schema';

const logger = createServiceLogger('TalkService');

export class TalkService {
  /**
   * 创建新的谈话会话
   */
  async createTalkSession(language = 'zh-CN'): Promise<TalkSession> {
    const session = await conversationStorage.createTalkSession({
      status: 'LISTENING',
      language,
      talkType: 'UNKNOWN',
    });
    logger.debug({ sessionId: session.id, language }, '谈话会话创建成功');
    return session;
  }

  /**
   * 获取谈话会话
   */
  async getTalkSession(id: string): Promise<TalkSession | undefined> {
    return await conversationStorage.getTalkSession(id);
  }

  /**
   * 停止并分析谈话会话
   */
  async stopAndAnalyzeTalkSession(sessionId: string, rawTranscript: string): Promise<TalkSession> {
    const session = await conversationStorage.getTalkSession(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    await conversationStorage.updateTalkSession(sessionId, {
      status: 'ANALYZING',
      rawTranscript,
      endedAt: new Date(),
    });

    const analysis = await analyzeTalkContent(rawTranscript || '');

    for (const entity of analysis.entities) {
      await conversationStorage.createExtractedEntity({
        sessionId,
        entityType: entity.type,
        entityValue: entity.name,
        normalizedValue: entity.name,
        context: entity.context,
        confidence: entity.confidence,
        linkedPersonId: null,
        linkedProjectId: null,
        metadata: { role: entity.role, organization: entity.organization },
      });
    }

    for (const opp of analysis.opportunities) {
      await conversationStorage.createOpportunitySignal({
        sessionId,
        opportunityType: opp.type,
        title: opp.title,
        description: opp.description,
        estimatedValue: opp.potentialValue ? parseFloat(opp.potentialValue.replace(/[^0-9.]/g, '')) || null : null,
        urgency: opp.urgency,
        suggestedActions: opp.nextSteps,
        relatedPersonIds: opp.relatedEntities,
        status: 'DETECTED',
      });
    }

    const updatedSession = await conversationStorage.updateTalkSession(sessionId, {
      status: 'COMPLETED',
      talkType: analysis.talkType,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      sentiment: analysis.sentiment,
      actionItems: analysis.actionItems,
    });

    if (!updatedSession) {
      throw new Error('更新会话状态失败');
    }

    logger.info({ sessionId, talkType: analysis.talkType, entities: analysis.entities.length, opportunities: analysis.opportunities.length }, '谈话会话分析完成');
    return updatedSession;
  }

  /**
   * 分析谈话类型
   */
  async analyzeTalkType(sessionId: string, text: string): Promise<{ talkType: string }> {
    if (!text) {
      throw new Error('缺少文本内容');
    }

    const talkType = await identifyTalkType(text);
    if (talkType !== 'UNKNOWN') {
      await conversationStorage.updateTalkSession(sessionId, { talkType });
    }

    logger.debug({ sessionId, talkType }, '谈话类型分析完成');
    return { talkType };
  }

  /**
   * 获取会话中的实体
   */
  async getSessionEntities(sessionId: string): Promise<ExtractedEntity[]> {
    return await conversationStorage.getSessionEntities(sessionId);
  }

  /**
   * 获取会话中的商机信号
   */
  async getSessionOpportunities(sessionId: string): Promise<OpportunitySignal[]> {
    return await conversationStorage.getSessionOpportunities(sessionId);
  }

  /**
   * 链接实体到人员或项目
   */
  async linkEntity(entityId: string, personId?: string, projectId?: string): Promise<ExtractedEntity | undefined> {
    const updated = await conversationStorage.updateExtractedEntity(entityId, {
      linkedPersonId: personId || null,
      linkedProjectId: projectId || null,
    });
    if (updated) {
      logger.debug({ entityId, personId, projectId }, '实体链接成功');
    }
    return updated;
  }

  /**
   * 更新商机状态
   */
  async updateOpportunityStatus(oppId: string, status: string): Promise<OpportunitySignal | undefined> {
    const updated = await conversationStorage.updateOpportunitySignal(oppId, { status });
    if (updated) {
      logger.debug({ oppId, status }, '商机状态更新成功');
    }
    return updated;
  }

  /**
   * 从实体自动创建联系人
   */
  async createContactsFromSession(sessionId: string): Promise<{ created: Person[]; count: number }> {
    const entities = await conversationStorage.getSessionEntities(sessionId);
    const personEntities = entities.filter(e => e.entityType === 'PERSON' && !e.linkedPersonId);

    const created: Person[] = [];
    for (const entity of personEntities) {
      const metadata = entity.metadata as { role?: string; organization?: string } || {};
      const person = await personService.createPerson({
        name: entity.entityValue,
        role: metadata.role || undefined,
        organization: metadata.organization || undefined,
        addedBy: 'AI_TALK',
        approvalStatus: 'PENDING',
        accessLevel: 'ZONE_BLUE',
      }, { createMemory: false });

      await conversationStorage.updateExtractedEntity(entity.id, { linkedPersonId: person.id });
      created.push(person);
    }

    logger.info({ sessionId, createdCount: created.length }, '自动创建联系人完成');
    return { created, count: created.length };
  }

  /**
   * 获取最近的谈话会话
   */
  async getRecentTalkSessions(limit = 50): Promise<TalkSession[]> {
    return await conversationStorage.getAllTalkSessions(limit);
  }

  /**
   * 获取会话的对话分段（如果有）
   */
  async getSessionSegments(sessionId: string): Promise<unknown[]> {
    // 注意：ConversationStorage目前没有getSessionSegments方法，但接口中有
    // 临时返回空数组，后续需要实现
    return [];
  }
}

export const talkService = new TalkService();
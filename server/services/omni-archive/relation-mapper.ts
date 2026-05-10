import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('RelationMapper');

import { getDatabase } from "../../db";
import { relationLinks, fileKnowledge, chatExtracts, unifiedContacts, type InsertRelationLink, type RelationLink } from "@shared/schema";
import { eq, and, or, sql, ilike } from "drizzle-orm";

interface ConflictDetection {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  description: string;
  evidence: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class RelationMapper {
  private dashscopeApiKey: string | undefined;

  constructor() {
    this.dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
  }

  async createLink(link: InsertRelationLink): Promise<RelationLink> {
    const existing = await this.findExistingLink(link.sourceType, link.sourceId, link.targetType, link.targetId);
    if (existing) {
      return existing;
    }

    const [created] = await getDatabase().insert(relationLinks).values(link).returning();
    return created;
  }

  private async findExistingLink(sourceType: string, sourceId: string, targetType: string, targetId: string): Promise<RelationLink | null> {
    const [existing] = await getDatabase().select().from(relationLinks)
      .where(and(
        eq(relationLinks.sourceType, sourceType),
        eq(relationLinks.sourceId, sourceId),
        eq(relationLinks.targetType, targetType),
        eq(relationLinks.targetId, targetId)
      ));
    return existing || null;
  }

  async autoLinkFileToContacts(fileId: string): Promise<RelationLink[]> {
    const [file] = await getDatabase().select().from(fileKnowledge).where(eq(fileKnowledge.id, fileId));
    if (!file || !file.entities) return [];

    const entities = file.entities as { people?: string[]; orgs?: string[] };
    const links: RelationLink[] = [];

    const searchTerms = [...(entities.people || []), ...(entities.orgs || [])];
    
    for (const term of searchTerms) {
      const contacts = await getDatabase().select().from(unifiedContacts)
        .where(or(
          ilike(unifiedContacts.name, `%${term}%`),
          ilike(unifiedContacts.organization, `%${term}%`)
        ))
        .limit(5);

      for (const contact of contacts) {
        const link = await this.createLink({
          sourceType: 'file',
          sourceId: fileId,
          targetType: 'contact',
          targetId: contact.id,
          linkType: 'MENTION',
          confidence: 0.7,
          description: `文件中提到了 ${contact.name}`,
          detectedBy: 'AI'
        });
        links.push(link);
      }
    }

    return links;
  }

  async autoLinkChatToContacts(chatId: string): Promise<RelationLink[]> {
    const [chat] = await getDatabase().select().from(chatExtracts).where(eq(chatExtracts.id, chatId));
    if (!chat) return [];

    const links: RelationLink[] = [];

    if (chat.contactId) {
      const link = await this.createLink({
        sourceType: 'chat',
        sourceId: chatId,
        targetType: 'contact',
        targetId: chat.contactId,
        linkType: 'RELATED',
        confidence: 1.0,
        detectedBy: 'AI'
      });
      links.push(link);
    }

    return links;
  }

  async detectConflicts(contactId: string): Promise<ConflictDetection[]> {
    const conflicts: ConflictDetection[] = [];

    const chatLinks = await getDatabase().select().from(relationLinks)
      .where(and(
        eq(relationLinks.targetType, 'contact'),
        eq(relationLinks.targetId, contactId),
        eq(relationLinks.sourceType, 'chat')
      ));

    const fileLinks = await getDatabase().select().from(relationLinks)
      .where(and(
        eq(relationLinks.targetType, 'contact'),
        eq(relationLinks.targetId, contactId),
        eq(relationLinks.sourceType, 'file')
      ));

    if (chatLinks.length > 0 && fileLinks.length > 0 && this.dashscopeApiKey) {
      const chatIds = chatLinks.map(l => l.sourceId);
      const fileIds = fileLinks.map(l => l.sourceId);

      const chats = await getDatabase().select().from(chatExtracts)
        .where(sql`${chatExtracts.id} IN (${sql.raw(chatIds.map(id => `'${id}'`).join(','))})`);
      
      const files = await getDatabase().select().from(fileKnowledge)
        .where(sql`${fileKnowledge.id} IN (${sql.raw(fileIds.map(id => `'${id}'`).join(','))})`);

      const chatCommitments = chats.flatMap(c => (c.commitments as unknown[]) || []);
      const fileTerms = files.flatMap(f => Object.entries((f.contractTerms as Record<string, string>) || {}));

      if (chatCommitments.length > 0 && fileTerms.length > 0) {
        const detected = await this.compareWithAI(chatCommitments, fileTerms);
        conflicts.push(...detected);
      }
    }

    return conflicts;
  }

  private async compareWithAI(commitments: unknown[], contractTerms: [string, string][]): Promise<ConflictDetection[]> {
    if (!this.dashscopeApiKey) return [];

    const prompt = `请比较以下聊天承诺和合同条款，找出不一致之处：

聊天承诺：
${JSON.stringify(commitments, null, 2)}

合同条款：
${JSON.stringify(Object.fromEntries(contractTerms), null, 2)}

如有冲突，请以JSON数组格式输出：
[{
  "description": "冲突描述",
  "evidence": "证据",
  "severity": "HIGH/MEDIUM/LOW"
}]

如无冲突，输出空数组 []`;

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dashscopeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              { role: 'system', content: '你是一个合同审核专家，擅长发现承诺与合同的不一致。' },
              { role: 'user', content: prompt }
            ]
          }
        })
      });

      const result = await response.json();
      const content = result.output?.text || result.output?.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error({ error }, 'Conflict detection failed');
    }

    return [];
  }

  async saveConflict(conflict: ConflictDetection, chatId: string, fileId: string): Promise<RelationLink> {
    const [link] = await getDatabase().insert(relationLinks).values({
      sourceType: 'chat',
      sourceId: chatId,
      targetType: 'file',
      targetId: fileId,
      linkType: 'CONFLICT',
      description: conflict.description,
      evidence: conflict.evidence,
      isConflict: true,
      conflictSeverity: conflict.severity,
      confidence: 0.9,
      detectedBy: 'AI'
    }).returning();
    
    return link;
  }

  async getLinksForEntity(entityType: string, entityId: string): Promise<RelationLink[]> {
    return getDatabase().select().from(relationLinks)
      .where(or(
        and(eq(relationLinks.sourceType, entityType), eq(relationLinks.sourceId, entityId)),
        and(eq(relationLinks.targetType, entityType), eq(relationLinks.targetId, entityId))
      ));
  }

  async getUnresolvedConflicts(): Promise<RelationLink[]> {
    return getDatabase().select().from(relationLinks)
      .where(and(
        eq(relationLinks.isConflict, true),
        eq(relationLinks.resolved, false)
      ));
  }

  async resolveConflict(linkId: string, reviewedBy: string): Promise<void> {
    await getDatabase().update(relationLinks).set({
      resolved: true,
      reviewedBy
    }).where(eq(relationLinks.id, linkId));
  }
}

export const relationMapper = new RelationMapper();

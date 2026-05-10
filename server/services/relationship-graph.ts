/**
 * Relationship Graph Service (关系图谱引擎) - Phase 2.4
 * 
 * 功能：
 * 1. 关系CRUD管理
 * 2. 关系强度计算
 * 3. 自动关系推断
 * 4. 联系维护建议
 * 5. 图谱数据输出（用于可视化）
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('RelationshipGraph');

import { getDatabase } from '../db';
import { 
  relationshipEdges, 
  relationshipSuggestions,
  persons,
  InsertRelationshipEdge,
  InsertRelationshipSuggestion,
  RelationshipEdge,
  RelationshipSuggestion
} from '@shared/schema';
import { eq, and, or, desc, sql, gte, lte, isNull } from 'drizzle-orm';

export type RelationshipType = 
  | 'FAMILY'
  | 'FRIEND'
  | 'COLLEAGUE'
  | 'CLIENT'
  | 'PARTNER'
  | 'MENTOR'
  | 'STUDENT'
  | 'ACQUAINTANCE'
  | 'OTHER';

export type SuggestionType = 
  | 'CONTACT_REMINDER'
  | 'BIRTHDAY_REMINDER'
  | 'FOLLOW_UP'
  | 'RELATIONSHIP_DECAY'
  | 'OPPORTUNITY';

export type SuggestionPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type SuggestionStatus = 'PENDING' | 'DISMISSED' | 'COMPLETED';

export interface GraphNode {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  avatar?: string;
  connectionCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  lastInteraction?: Date;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RelationshipStats {
  totalRelationships: number;
  byType: Record<string, number>;
  averageStrength: number;
  needsAttention: number;
  recentInteractions: number;
}

const DECAY_DAYS = 30;
const DECAY_THRESHOLD = 0.3;

class RelationshipGraphService {
  async createEdge(input: InsertRelationshipEdge): Promise<RelationshipEdge> {
    const existing = await this.getEdgeBetween(input.fromPersonId, input.toPersonId);
    
    if (existing) {
      return await this.updateEdge(existing.id, {
        relationshipType: input.relationshipType,
        strength: input.strength,
        notes: input.notes,
        tags: input.tags,
      });
    }

    const [edge] = await getDatabase().insert(relationshipEdges)
      .values(input)
      .returning();
    
    logger.info(`[RelationshipGraph] Edge created: ${input.fromPersonId} -> ${input.toPersonId}`);
    return edge;
  }

  async getEdge(id: string): Promise<RelationshipEdge | null> {
    const [edge] = await getDatabase().select()
      .from(relationshipEdges)
      .where(eq(relationshipEdges.id, id))
      .limit(1);
    
    return edge || null;
  }

  async getEdgeBetween(personA: string, personB: string): Promise<RelationshipEdge | null> {
    const [edge] = await getDatabase().select()
      .from(relationshipEdges)
      .where(
        or(
          and(
            eq(relationshipEdges.fromPersonId, personA),
            eq(relationshipEdges.toPersonId, personB)
          ),
          and(
            eq(relationshipEdges.fromPersonId, personB),
            eq(relationshipEdges.toPersonId, personA)
          )
        )
      )
      .limit(1);
    
    return edge || null;
  }

  async updateEdge(id: string, updates: Partial<InsertRelationshipEdge>): Promise<RelationshipEdge> {
    const [edge] = await getDatabase().update(relationshipEdges)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(relationshipEdges.id, id))
      .returning();
    
    return edge;
  }

  async deleteEdge(id: string): Promise<void> {
    await getDatabase().delete(relationshipEdges)
      .where(eq(relationshipEdges.id, id));
    
    logger.info(`[RelationshipGraph] Edge deleted: ${id}`);
  }

  async getPersonEdges(personId: string): Promise<RelationshipEdge[]> {
    return await getDatabase().select()
      .from(relationshipEdges)
      .where(
        and(
          or(
            eq(relationshipEdges.fromPersonId, personId),
            eq(relationshipEdges.toPersonId, personId)
          ),
          eq(relationshipEdges.isActive, true)
        )
      )
      .orderBy(desc(relationshipEdges.strength));
  }

  async getAllEdges(): Promise<RelationshipEdge[]> {
    return await getDatabase().select()
      .from(relationshipEdges)
      .where(eq(relationshipEdges.isActive, true))
      .orderBy(desc(relationshipEdges.updatedAt));
  }

  async recordInteraction(
    personAId: string, 
    personBId: string, 
    sentiment?: number
  ): Promise<RelationshipEdge> {
    let edge = await this.getEdgeBetween(personAId, personBId);
    
    if (!edge) {
      edge = await this.createEdge({
        fromPersonId: personAId,
        toPersonId: personBId,
        relationshipType: 'ACQUAINTANCE',
        strength: 0.3,
      });
    }

    const newCount = (edge.interactionCount || 0) + 1;
    const newStrength = Math.min(1, (edge.strength || 0.5) + 0.05);
    
    let newSentiment = edge.sentimentAvg || 0;
    if (sentiment !== undefined) {
      newSentiment = ((edge.sentimentAvg || 0) * (edge.interactionCount || 0) + sentiment) / newCount;
    }

    return await this.updateEdge(edge.id, {
      lastInteraction: new Date(),
      interactionCount: newCount,
      strength: newStrength,
      sentimentAvg: newSentiment,
    });
  }

  calculateDecay(lastInteraction: Date | null, currentStrength: number): number {
    if (!lastInteraction) return currentStrength;
    
    const daysSinceInteraction = Math.floor(
      (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceInteraction <= DECAY_DAYS) return currentStrength;
    
    const decayFactor = Math.pow(0.95, (daysSinceInteraction - DECAY_DAYS) / 7);
    return Math.max(DECAY_THRESHOLD, currentStrength * decayFactor);
  }

  async getGraphData(): Promise<GraphData> {
    const edges = await this.getAllEdges();
    
    const personIds = new Set<string>();
    edges.forEach(edge => {
      personIds.add(edge.fromPersonId);
      personIds.add(edge.toPersonId);
    });

    const personIdsArray = Array.from(personIds);
    const personsData = personIdsArray.length > 0 
      ? await getDatabase().select()
          .from(persons)
          .where(sql`${persons.id} = ANY(ARRAY[${personIdsArray.map(id => `'${id}'`).join(',')}]::varchar[])`)
      : [];

    const connectionCount: Record<string, number> = {};
    edges.forEach(edge => {
      connectionCount[edge.fromPersonId] = (connectionCount[edge.fromPersonId] || 0) + 1;
      connectionCount[edge.toPersonId] = (connectionCount[edge.toPersonId] || 0) + 1;
    });

    const nodes: GraphNode[] = personsData.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role || undefined,
      organization: p.organization || undefined,
      avatar: undefined,
      connectionCount: connectionCount[p.id] || 0,
    }));

    const graphEdges: GraphEdge[] = edges.map(e => ({
      id: e.id,
      source: e.fromPersonId,
      target: e.toPersonId,
      type: e.relationshipType,
      strength: this.calculateDecay(e.lastInteraction, e.strength || 0.5),
      lastInteraction: e.lastInteraction || undefined,
    }));

    return { nodes, edges: graphEdges };
  }

  async getStats(): Promise<RelationshipStats> {
    const edges = await this.getAllEdges();
    
    const byType: Record<string, number> = {};
    let totalStrength = 0;
    let needsAttention = 0;
    let recentInteractions = 0;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    edges.forEach(edge => {
      byType[edge.relationshipType] = (byType[edge.relationshipType] || 0) + 1;
      totalStrength += edge.strength || 0.5;
      
      if (!edge.lastInteraction || new Date(edge.lastInteraction) < thirtyDaysAgo) {
        needsAttention++;
      }
      
      if (edge.lastInteraction && new Date(edge.lastInteraction) >= thirtyDaysAgo) {
        recentInteractions++;
      }
    });

    return {
      totalRelationships: edges.length,
      byType,
      averageStrength: edges.length > 0 ? totalStrength / edges.length : 0,
      needsAttention,
      recentInteractions,
    };
  }

  async createSuggestion(input: InsertRelationshipSuggestion): Promise<RelationshipSuggestion> {
    const [suggestion] = await getDatabase().insert(relationshipSuggestions)
      .values(input)
      .returning();
    
    logger.info(`[RelationshipGraph] Suggestion created: ${suggestion.suggestionType} for person ${input.personId}`);
    return suggestion;
  }

  async getSuggestions(options?: {
    personId?: string;
    status?: SuggestionStatus;
    priority?: SuggestionPriority;
  }): Promise<RelationshipSuggestion[]> {
    const conditions = [];
    
    if (options?.personId) {
      conditions.push(eq(relationshipSuggestions.personId, options.personId));
    }
    
    if (options?.status) {
      conditions.push(eq(relationshipSuggestions.status, options.status));
    }
    
    if (options?.priority) {
      conditions.push(eq(relationshipSuggestions.priority, options.priority));
    }

    return await getDatabase().select()
      .from(relationshipSuggestions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(relationshipSuggestions.createdAt));
  }

  async dismissSuggestion(id: string): Promise<void> {
    await getDatabase().update(relationshipSuggestions)
      .set({
        status: 'DISMISSED',
        dismissedAt: new Date(),
      })
      .where(eq(relationshipSuggestions.id, id));
  }

  async completeSuggestion(id: string): Promise<void> {
    await getDatabase().update(relationshipSuggestions)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
      })
      .where(eq(relationshipSuggestions.id, id));
  }

  async generateContactReminders(): Promise<RelationshipSuggestion[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const staleEdges = await getDatabase().select()
      .from(relationshipEdges)
      .where(
        and(
          eq(relationshipEdges.isActive, true),
          or(
            isNull(relationshipEdges.lastInteraction),
            lte(relationshipEdges.lastInteraction, thirtyDaysAgo)
          ),
          gte(relationshipEdges.strength, 0.5)
        )
      );

    const suggestions: RelationshipSuggestion[] = [];
    
    for (const edge of staleEdges) {
      const personToContact = edge.toPersonId;
      
      const existing = await getDatabase().select()
        .from(relationshipSuggestions)
        .where(
          and(
            eq(relationshipSuggestions.personId, personToContact),
            eq(relationshipSuggestions.suggestionType, 'CONTACT_REMINDER'),
            eq(relationshipSuggestions.status, 'PENDING')
          )
        )
        .limit(1);
      
      if (existing.length > 0) continue;

      const [person] = await getDatabase().select()
        .from(persons)
        .where(eq(persons.id, personToContact))
        .limit(1);

      if (!person) continue;

      const daysSince = edge.lastInteraction 
        ? Math.floor((Date.now() - new Date(edge.lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const suggestion = await this.createSuggestion({
        personId: personToContact,
        suggestionType: 'CONTACT_REMINDER',
        message: `您已经${daysSince}天没有联系${person.name}了，关系强度: ${((edge.strength || 0.5) * 100).toFixed(0)}%`,
        priority: daysSince > 60 ? 'HIGH' : 'MEDIUM',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        metadata: {
          edgeId: edge.id,
          daysSinceContact: daysSince,
          relationshipType: edge.relationshipType,
        },
      });

      suggestions.push(suggestion);
    }

    logger.info(`[RelationshipGraph] Generated ${suggestions.length} contact reminders`);
    return suggestions;
  }

  async inferRelationshipFromInteraction(
    personAId: string,
    personBId: string,
    context: {
      source: 'CALL' | 'EMAIL' | 'MEETING' | 'MESSAGE';
      duration?: number;
      sentiment?: number;
    }
  ): Promise<RelationshipEdge> {
    let edge = await this.getEdgeBetween(personAId, personBId);
    
    if (!edge) {
      const inferredType: RelationshipType = 'ACQUAINTANCE';
      
      edge = await this.createEdge({
        fromPersonId: personAId,
        toPersonId: personBId,
        relationshipType: inferredType,
        strength: 0.3,
        metadata: {
          inferredFrom: context.source,
          firstContact: new Date().toISOString(),
        },
      });
    }

    return await this.recordInteraction(personAId, personBId, context.sentiment);
  }
}

export const relationshipGraph = new RelationshipGraphService();

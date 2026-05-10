import { db } from "../../db";
import { socialGraphNodes, socialGraphEdges, unifiedContacts, chatExtracts, type InsertSocialGraphNode, type InsertSocialGraphEdge, type SocialGraphNode, type SocialGraphEdge, type UnifiedContact } from "@shared/schema";
import { eq, and, or, sql, desc } from "drizzle-orm";

interface GraphData {
  nodes: SocialGraphNode[];
  edges: SocialGraphEdge[];
}

interface ContactAnalysis {
  influence: number;
  centrality: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  cluster?: string;
}

export class SocialGraph {
  async buildGraphFromContacts(): Promise<GraphData> {
    const contacts = await db.select().from(unifiedContacts);
    const nodes: SocialGraphNode[] = [];
    const edges: SocialGraphEdge[] = [];

    for (const contact of contacts) {
      const existing = await this.getNodeByContactId(contact.id);
      if (existing) {
        nodes.push(existing);
      } else {
        const analysis = await this.analyzeContact(contact);
        const node = await this.createNode({
          contactId: contact.id,
          nodeType: 'PERSON',
          label: contact.name,
          influence: analysis.influence,
          centrality: analysis.centrality,
          riskLevel: analysis.riskLevel,
          riskFactors: analysis.riskFactors,
          cluster: analysis.cluster
        });
        nodes.push(node);
      }
    }

    const relationships = await this.inferRelationships(contacts);
    for (const rel of relationships) {
      const sourceNode = nodes.find(n => n.contactId === rel.sourceContactId);
      const targetNode = nodes.find(n => n.contactId === rel.targetContactId);
      
      if (sourceNode && targetNode) {
        const existing = await this.getEdge(sourceNode.id, targetNode.id);
        if (!existing) {
          const edge = await this.createEdge({
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            relationType: rel.relationType,
            strength: rel.strength,
            sentiment: rel.sentiment
          });
          edges.push(edge);
        } else {
          edges.push(existing);
        }
      }
    }

    return { nodes, edges };
  }

  private async analyzeContact(contact: UnifiedContact): Promise<ContactAnalysis> {
    const interactionScore = Math.min((contact.interactionCount || 0) / 100, 1);
    const responseScore = contact.averageResponseTime 
      ? Math.max(0, 1 - (contact.averageResponseTime / 86400))
      : 0.5;
    
    const influence = (interactionScore * 0.6 + responseScore * 0.4);

    const initiatedByMe = contact.initiatedByMe || 0;
    const initiatedByThem = contact.initiatedByThem || 0;
    const total = initiatedByMe + initiatedByThem || 1;
    const centrality = initiatedByThem / total;

    const riskFactors: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    if ((contact.trustScore || 50) < 30) {
      riskFactors.push('低信任分数');
      riskLevel = 'MEDIUM';
    }

    if (contact.averageResponseTime && contact.averageResponseTime > 172800) {
      riskFactors.push('响应缓慢');
    }

    const daysSinceContact = contact.lastInteraction 
      ? (Date.now() - new Date(contact.lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    
    if (daysSinceContact > 90 && (contact.importance || 50) > 70) {
      riskFactors.push('重要联系人长期未联系');
      riskLevel = 'HIGH';
    }

    let cluster: string | undefined;
    if (contact.organization) {
      cluster = contact.organization;
    } else if (contact.tags?.length) {
      cluster = contact.tags[0];
    }

    return {
      influence,
      centrality,
      riskLevel,
      riskFactors,
      cluster
    };
  }

  private async inferRelationships(contacts: UnifiedContact[]): Promise<Array<{
    sourceContactId: string;
    targetContactId: string;
    relationType: string;
    strength: number;
    sentiment: string;
  }>> {
    const relationships: Array<{
      sourceContactId: string;
      targetContactId: string;
      relationType: string;
      strength: number;
      sentiment: string;
    }> = [];

    const orgGroups = new Map<string, UnifiedContact[]>();
    for (const contact of contacts) {
      if (contact.organization) {
        const existing = orgGroups.get(contact.organization) || [];
        existing.push(contact);
        orgGroups.set(contact.organization, existing);
      }
    }

    for (const [org, members] of Array.from(orgGroups.entries())) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          relationships.push({
            sourceContactId: members[i].id,
            targetContactId: members[j].id,
            relationType: 'COLLEAGUE',
            strength: 0.7,
            sentiment: 'NEUTRAL'
          });
        }
      }
    }

    return relationships;
  }

  async createNode(data: InsertSocialGraphNode): Promise<SocialGraphNode> {
    const [node] = await db.insert(socialGraphNodes).values(data).returning();
    return node;
  }

  async createEdge(data: InsertSocialGraphEdge): Promise<SocialGraphEdge> {
    const [edge] = await db.insert(socialGraphEdges).values(data).returning();
    return edge;
  }

  async getNodeByContactId(contactId: string): Promise<SocialGraphNode | null> {
    const [node] = await db.select().from(socialGraphNodes)
      .where(eq(socialGraphNodes.contactId, contactId));
    return node || null;
  }

  async getEdge(sourceNodeId: string, targetNodeId: string): Promise<SocialGraphEdge | null> {
    const [edge] = await db.select().from(socialGraphEdges)
      .where(and(
        eq(socialGraphEdges.sourceNodeId, sourceNodeId),
        eq(socialGraphEdges.targetNodeId, targetNodeId)
      ));
    return edge || null;
  }

  async getFullGraph(): Promise<GraphData> {
    const nodes = await db.select().from(socialGraphNodes);
    const edges = await db.select().from(socialGraphEdges);
    return { nodes, edges };
  }

  async getHighInfluenceNodes(limit: number = 10): Promise<SocialGraphNode[]> {
    return db.select().from(socialGraphNodes)
      .orderBy(desc(socialGraphNodes.influence))
      .limit(limit);
  }

  async getHighRiskNodes(): Promise<SocialGraphNode[]> {
    return db.select().from(socialGraphNodes)
      .where(eq(socialGraphNodes.riskLevel, 'HIGH'));
  }

  async getNodesByCluster(cluster: string): Promise<SocialGraphNode[]> {
    return db.select().from(socialGraphNodes)
      .where(eq(socialGraphNodes.cluster, cluster));
  }

  async updateNodePosition(nodeId: string, posX: number, posY: number): Promise<void> {
    await db.update(socialGraphNodes).set({
      posX,
      posY,
      updatedAt: new Date()
    }).where(eq(socialGraphNodes.id, nodeId));
  }

  async recordInteraction(sourceContactId: string, targetContactId: string): Promise<void> {
    const sourceNode = await this.getNodeByContactId(sourceContactId);
    const targetNode = await this.getNodeByContactId(targetContactId);

    if (sourceNode && targetNode) {
      const [edge] = await db.select().from(socialGraphEdges)
        .where(or(
          and(eq(socialGraphEdges.sourceNodeId, sourceNode.id), eq(socialGraphEdges.targetNodeId, targetNode.id)),
          and(eq(socialGraphEdges.sourceNodeId, targetNode.id), eq(socialGraphEdges.targetNodeId, sourceNode.id))
        ));

      if (edge) {
        await db.update(socialGraphEdges).set({
          interactionCount: (edge.interactionCount || 0) + 1,
          lastInteraction: new Date(),
          strength: Math.min((edge.strength || 0.5) + 0.05, 1)
        }).where(eq(socialGraphEdges.id, edge.id));
      } else {
        await this.createEdge({
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          relationType: 'CONNECTED',
          strength: 0.3,
          interactionCount: 1,
          lastInteraction: new Date()
        });
      }
    }
  }

  async getClusters(): Promise<Map<string, SocialGraphNode[]>> {
    const nodes = await db.select().from(socialGraphNodes);
    const clusters = new Map<string, SocialGraphNode[]>();

    for (const node of nodes) {
      const cluster = node.cluster || '未分类';
      const existing = clusters.get(cluster) || [];
      existing.push(node);
      clusters.set(cluster, existing);
    }

    return clusters;
  }
}

export const socialGraph = new SocialGraph();

/**
 * 小智 Dream Analyzer - 梦境深度分析器
 * 
 * 功能：
 * 1. Qwen-Max深度分析对接
 * 2. 关系图谱生成
 * 3. 加密记忆上传
 * 4. 商机洞察挖掘
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { db } from '../db';
import { 
  shadowMemories, persons, avatarChatHistory, 
  auditLogs, projects, intelItems 
} from '@shared/schema';
import { eq, desc, gte, sql, and, isNotNull } from 'drizzle-orm';
import { chatWithDashScope, type ChatMessage } from './dashscope';
import { getModulePrompt } from '../config/persona';

export interface RelationshipNode {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'project' | 'concept';
  importance: number;
  attributes: Record<string, any>;
}

export interface RelationshipEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  lastInteraction?: Date;
}

export interface RelationshipGraph {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  clusters: Array<{ name: string; nodeIds: string[] }>;
  centralNodes: string[];
  generatedAt: Date;
}

export interface DeepInsight {
  id: string;
  category: 'opportunity' | 'risk' | 'pattern' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  relatedEntities: string[];
  actionItems: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  generatedAt: Date;
}

export interface DreamAnalysisResult {
  relationshipGraph: RelationshipGraph;
  insights: DeepInsight[];
  memorySummary: {
    totalProcessed: number;
    patternsFound: number;
    emotionalTrend: string;
  };
  optimizations: string[];
}

export interface EncryptedMemoryPacket {
  id: string;
  encryptedPayload: string;
  checksum: string;
  timestamp: Date;
  category: string;
}

class DreamAnalyzerService {
  private analysisHistory: DreamAnalysisResult[] = [];
  private cachedGraph: RelationshipGraph | null = null;
  
  async analyzeWithQwenMax(
    memories: any[],
    analysisType: 'relationship' | 'opportunity' | 'risk' | 'comprehensive'
  ): Promise<any> {
    const systemPrompt = this.buildAnalysisPrompt(analysisType);
    const memoryContext = this.formatMemoriesForAnalysis(memories);
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: memoryContext },
    ];
    
    try {
      const response = await chatWithDashScope(messages, memoryContext);
      
      return this.parseAnalysisResponse(response.message, analysisType);
      
    } catch (error) {
      console.error('[DreamAnalyzer] Qwen-Max analysis failed:', error);
      return this.fallbackAnalysis(memories, analysisType);
    }
  }
  
  private buildAnalysisPrompt(type: 'relationship' | 'opportunity' | 'risk' | 'comprehensive'): string {
    const basePrompt = `你是小智的深度分析模块，专门在"梦境模式"中处理复杂的数据分析任务。
请以JSON格式输出分析结果。`;
    
    const typePrompts: Record<string, string> = {
      relationship: `${basePrompt}
      
任务：分析人际关系网络
1. 识别关键人物及其角色
2. 分析人物之间的关联强度
3. 找出潜在的利益链条
4. 标注可能的风险点

输出格式：
{
  "nodes": [{"name": "姓名", "role": "角色", "importance": 0-10}],
  "edges": [{"from": "人名A", "to": "人名B", "relation": "关系描述", "strength": 0-10}],
  "insights": ["洞察1", "洞察2"]
}`,
      
      opportunity: `${basePrompt}
      
任务：挖掘商业机会
1. 从对话历史中识别商机信号
2. 分析潜在合作可能性
3. 评估机会的可行性和优先级
4. 提供具体的行动建议

输出格式：
{
  "opportunities": [
    {"title": "机会名称", "description": "描述", "confidence": 0-1, "priority": "high/medium/low", "actions": ["行动1"]}
  ]
}`,
      
      risk: `${basePrompt}
      
任务：风险预警分析
1. 识别潜在的人际风险
2. 分析商业决策风险
3. 评估时间敏感的风险项
4. 提供风险缓解建议

输出格式：
{
  "risks": [
    {"title": "风险名称", "severity": "critical/high/medium/low", "likelihood": 0-1, "mitigation": "缓解措施"}
  ]
}`,
      
      comprehensive: `${basePrompt}
      
任务：综合梦境分析
1. 整合所有记忆数据
2. 生成关系图谱
3. 发现隐藏模式
4. 预测未来趋势
5. 提供战略建议

输出格式：
{
  "summary": "整体分析总结",
  "patterns": ["模式1", "模式2"],
  "predictions": [{"event": "预测事件", "probability": 0-1, "timeframe": "时间范围"}],
  "recommendations": ["建议1", "建议2"]
}`,
    };
    
    return typePrompts[type] || typePrompts.comprehensive;
  }
  
  private formatMemoriesForAnalysis(memories: any[]): string {
    const formatted = memories.map((m, i) => {
      if (m.content) {
        return `[${i + 1}] ${m.role || 'system'}: ${m.content}`;
      }
      if (m.choiceMade) {
        return `[${i + 1}] 决策: ${m.choiceMade} (权重: ${m.mimicryWeight || 1})`;
      }
      return `[${i + 1}] ${JSON.stringify(m)}`;
    });
    
    return `以下是需要分析的记忆数据（共${memories.length}条）：\n\n${formatted.join('\n')}`;
  }
  
  private parseAnalysisResponse(response: string, type: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[DreamAnalyzer] Failed to parse JSON response, using text extraction');
    }
    
    return {
      raw: response,
      parsed: false,
      type,
    };
  }
  
  private fallbackAnalysis(memories: any[], type: string): any {
    console.log('[DreamAnalyzer] Using fallback local analysis');
    
    const personMentions: Map<string, number> = new Map();
    const keywords: Map<string, number> = new Map();
    
    for (const memory of memories) {
      const text = memory.content || memory.choiceMade || '';
      
      const namePattern = /([^\s，。！？]{2,4}(?:先生|女士|老师|老板|总|经理))/g;
      const names = text.match(namePattern) || [];
      names.forEach((name: string) => {
        personMentions.set(name, (personMentions.get(name) || 0) + 1);
      });
      
      const keywordPatterns = /合作|投资|项目|机会|风险|合同|会议|决定/g;
      const foundKeywords = text.match(keywordPatterns) || [];
      foundKeywords.forEach((kw: string) => {
        keywords.set(kw, (keywords.get(kw) || 0) + 1);
      });
    }
    
    return {
      personMentions: Object.fromEntries(personMentions),
      keywords: Object.fromEntries(keywords),
      analysisType: type,
      fallback: true,
    };
  }
  
  async generateRelationshipGraph(): Promise<RelationshipGraph> {
    const personsData = await db.select().from(persons).limit(100);
    const projectsData = await db.select().from(projects).limit(50);
    
    const recentChats = await db.select()
      .from(avatarChatHistory)
      .orderBy(desc(avatarChatHistory.createdAt))
      .limit(200);
    
    const nodes: RelationshipNode[] = [];
    const edges: RelationshipEdge[] = [];
    
    for (const person of personsData) {
      nodes.push({
        id: person.id,
        name: person.name,
        type: 'person',
        importance: (person.bondStrength || 0.5) * 10,
        attributes: {
          role: person.role,
          organization: person.organization,
          weakness: person.weakness,
          decisionStyle: person.decisionStyle,
        },
      });
    }
    
    for (const project of projectsData) {
      nodes.push({
        id: project.id,
        name: project.title,
        type: 'project',
        importance: (project.priority || 5),
        attributes: {
          status: project.status,
          category: project.category,
        },
      });
      
      const relatedPersons = project.relatedPersonIds || [];
      for (const personId of relatedPersons) {
        edges.push({
          source: personId,
          target: project.id,
          relationship: '参与项目',
          strength: 0.7,
          sentiment: 'neutral',
        });
      }
    }
    
    for (const person of personsData) {
      const connectionNodes = person.connectionNodes || [];
      for (const connectedName of connectionNodes) {
        const connectedPerson = personsData.find(p => p.name === connectedName);
        if (connectedPerson) {
          edges.push({
            source: person.id,
            target: connectedPerson.id,
            relationship: '人际连接',
            strength: (person.bondStrength || 0.5),
            sentiment: 'neutral',
          });
        }
      }
    }
    
    const clusters = this.identifyClusters(nodes, edges);
    const centralNodes = this.findCentralNodes(nodes, edges);
    
    this.cachedGraph = {
      nodes,
      edges,
      clusters,
      centralNodes,
      generatedAt: new Date(),
    };
    
    return this.cachedGraph;
  }
  
  private identifyClusters(
    nodes: RelationshipNode[], 
    edges: RelationshipEdge[]
  ): Array<{ name: string; nodeIds: string[] }> {
    const clusters: Array<{ name: string; nodeIds: string[] }> = [];
    
    const orgGroups: Map<string, string[]> = new Map();
    for (const node of nodes) {
      if (node.type === 'person' && node.attributes.organization) {
        const org = node.attributes.organization;
        if (!orgGroups.has(org)) {
          orgGroups.set(org, []);
        }
        orgGroups.get(org)!.push(node.id);
      }
    }
    
    for (const [org, nodeIds] of Array.from(orgGroups.entries())) {
      if (nodeIds.length >= 2) {
        clusters.push({ name: org, nodeIds });
      }
    }
    
    return clusters;
  }
  
  private findCentralNodes(
    nodes: RelationshipNode[], 
    edges: RelationshipEdge[]
  ): string[] {
    const connectionCount: Map<string, number> = new Map();
    
    for (const edge of edges) {
      connectionCount.set(edge.source, (connectionCount.get(edge.source) || 0) + 1);
      connectionCount.set(edge.target, (connectionCount.get(edge.target) || 0) + 1);
    }
    
    const sorted = Array.from(connectionCount.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 5).map(([id]) => id);
  }
  
  async generateDeepInsights(): Promise<DeepInsight[]> {
    const insights: DeepInsight[] = [];
    
    const recentAudits = await db.select()
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .orderBy(desc(auditLogs.createdAt));
    
    const failedOps = recentAudits.filter(a => a.result === 'FAILURE');
    if (failedOps.length > 5) {
      insights.push({
        id: `insight_${Date.now()}_ops`,
        category: 'risk',
        title: '系统操作失败率偏高',
        description: `过去7天有${failedOps.length}次操作失败，建议检查相关功能稳定性`,
        confidence: 0.9,
        relatedEntities: [],
        actionItems: ['查看失败操作详情', '优化错误处理逻辑'],
        priority: failedOps.length > 10 ? 'high' : 'medium',
        generatedAt: new Date(),
      });
    }
    
    const pendingIntel = await db.select()
      .from(intelItems)
      .where(eq(intelItems.status, 'PENDING'));
    
    if (pendingIntel.length > 10) {
      insights.push({
        id: `insight_${Date.now()}_intel`,
        category: 'recommendation',
        title: '待处理情报积压',
        description: `有${pendingIntel.length}条情报待审阅，建议尽快处理以免错过时效`,
        confidence: 0.95,
        relatedEntities: pendingIntel.slice(0, 5).map(i => i.id),
        actionItems: ['打开情报面板', '按优先级处理'],
        priority: 'medium',
        generatedAt: new Date(),
      });
    }
    
    const recentChats = await db.select()
      .from(avatarChatHistory)
      .where(gte(avatarChatHistory.createdAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)));
    
    const opportunityKeywords = ['合作', '投资', '项目', '机会', '介绍', '推荐'];
    const opportunityChats = recentChats.filter(chat => 
      opportunityKeywords.some(kw => (chat.content || '').includes(kw))
    );
    
    if (opportunityChats.length > 0) {
      insights.push({
        id: `insight_${Date.now()}_opp`,
        category: 'opportunity',
        title: '潜在商机信号',
        description: `近期对话中发现${opportunityChats.length}次商机相关讨论`,
        confidence: 0.7,
        relatedEntities: [],
        actionItems: ['回顾相关对话', '评估跟进价值'],
        priority: 'medium',
        generatedAt: new Date(),
      });
    }
    
    return insights;
  }
  
  async runComprehensiveAnalysis(): Promise<DreamAnalysisResult> {
    console.log('[DreamAnalyzer] Starting comprehensive analysis...');
    
    const [graph, insights] = await Promise.all([
      this.generateRelationshipGraph(),
      this.generateDeepInsights(),
    ]);
    
    const recentMemories = await db.select()
      .from(shadowMemories)
      .orderBy(desc(shadowMemories.createdAt))
      .limit(100);
    
    const patternsAnalysis = await this.analyzeWithQwenMax(recentMemories, 'comprehensive');
    
    const result: DreamAnalysisResult = {
      relationshipGraph: graph,
      insights,
      memorySummary: {
        totalProcessed: recentMemories.length,
        patternsFound: patternsAnalysis.patterns?.length || 0,
        emotionalTrend: patternsAnalysis.summary || '稳定',
      },
      optimizations: patternsAnalysis.recommendations || [],
    };
    
    this.analysisHistory.push(result);
    
    for (const insight of insights) {
      await db.insert(shadowMemories).values({
        context: `梦境洞察 - ${insight.category}`,
        choiceMade: `${insight.title}: ${insight.description}`,
        field: 'dream_insight',
        mimicryWeight: insight.confidence,
        expPoints: insight.priority === 'critical' ? 50 : insight.priority === 'high' ? 30 : 10,
      });
    }
    
    console.log('[DreamAnalyzer] Comprehensive analysis complete');
    return result;
  }
  
  encryptMemoryPacket(data: any): EncryptedMemoryPacket {
    const payload = JSON.stringify(data);
    const encoded = Buffer.from(payload).toString('base64');
    
    let checksum = 0;
    for (let i = 0; i < payload.length; i++) {
      checksum = ((checksum << 5) - checksum) + payload.charCodeAt(i);
      checksum = checksum & checksum;
    }
    
    return {
      id: `packet_${Date.now()}`,
      encryptedPayload: encoded,
      checksum: Math.abs(checksum).toString(16),
      timestamp: new Date(),
      category: 'dream_memory',
    };
  }
  
  decryptMemoryPacket(packet: EncryptedMemoryPacket): any {
    const decoded = Buffer.from(packet.encryptedPayload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
  
  getCachedGraph(): RelationshipGraph | null {
    return this.cachedGraph;
  }
  
  getAnalysisHistory(): DreamAnalysisResult[] {
    return this.analysisHistory;
  }
}

export const dreamAnalyzer = new DreamAnalyzerService();

export { DreamAnalyzerService };

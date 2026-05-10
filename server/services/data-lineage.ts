/**
 * 数据血缘追踪服务 - Phase 11.5
 * 
 * 基于PRD需求-27/28:
 * - 跨应用数据关联：追踪数据在不同应用间的流转
 * - 知识图谱增强：建立数据实体间的关系网络
 * 
 * 功能：
 * 1. 数据节点注册 - 追踪数据源和数据目标
 * 2. 血缘链路追踪 - 记录数据流转路径
 * 3. 影响分析 - 上下游影响评估
 * 4. 数据质量监控 - 检测数据异常
 * 5. 可视化导出 - 生成血缘图谱
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DataLineage');

import { EventEmitter } from 'events';
import { getDatabase } from '../db';
import { auditLogs } from '@shared/schema';
import crypto from 'crypto';

// ============ 类型定义 ============

export interface DataNode {
  id: string;
  name: string;
  type: DataNodeType;
  source: DataSource;
  schema?: DataSchema;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  qualityScore?: number;
}

export type DataNodeType = 
  | 'DATABASE_TABLE'
  | 'API_ENDPOINT'
  | 'FILE'
  | 'MESSAGE_QUEUE'
  | 'CACHE'
  | 'EXTERNAL_SERVICE'
  | 'TRANSFORMATION'
  | 'USER_INPUT'
  | 'SYSTEM_OUTPUT';

export interface DataSource {
  system: string;
  location: string;
  connectionType: 'INTERNAL' | 'EXTERNAL' | 'HYBRID';
  accessLevel: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
}

export interface DataSchema {
  fields: DataField[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
}

export interface DataField {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  sensitivity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ForeignKey {
  fields: string[];
  referencedNode: string;
  referencedFields: string[];
}

export interface DataEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  transformation?: TransformationInfo;
  volume?: DataVolume;
  frequency: EdgeFrequency;
  metadata: Record<string, any>;
  createdAt: number;
  lastFlowAt?: number;
}

export type EdgeType = 
  | 'COPY'
  | 'TRANSFORM'
  | 'AGGREGATE'
  | 'JOIN'
  | 'FILTER'
  | 'ENRICH'
  | 'REFERENCE';

export interface TransformationInfo {
  name: string;
  logic: string;
  fieldMappings: { source: string; target: string; transform?: string }[];
}

export interface DataVolume {
  recordsPerDay: number;
  sizePerDay: number;  // bytes
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

export type EdgeFrequency = 
  | 'REALTIME'
  | 'NEAR_REALTIME'
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY'
  | 'ON_DEMAND';

export interface LineagePath {
  nodes: DataNode[];
  edges: DataEdge[];
  depth: number;
  totalTransformations: number;
}

export interface ImpactAnalysis {
  nodeId: string;
  upstreamNodes: { node: DataNode; depth: number }[];
  downstreamNodes: { node: DataNode; depth: number }[];
  criticalPaths: LineagePath[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
}

export interface DataQualityIssue {
  id: string;
  nodeId: string;
  type: QualityIssueType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  detectedAt: number;
  resolvedAt?: number;
  resolution?: string;
}

export type QualityIssueType = 
  | 'MISSING_DATA'
  | 'DUPLICATE_DATA'
  | 'SCHEMA_DRIFT'
  | 'STALE_DATA'
  | 'INCONSISTENT_DATA'
  | 'ORPHAN_NODE';

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [DataLineage] ${message}`);
}

// ============ 数据血缘服务类 ============

class DataLineageService extends EventEmitter {
  private nodes: Map<string, DataNode> = new Map();
  private edges: Map<string, DataEdge> = new Map();
  private issues: Map<string, DataQualityIssue> = new Map();

  constructor() {
    super();
    this.initializeSystemNodes();
    log('数据血缘追踪服务已初始化 (Phase 11.5)');
  }

  private initializeSystemNodes(): void {
    // 注册系统核心数据节点
    const systemNodes = [
      { name: 'avatar_chat_history', type: 'DATABASE_TABLE' as DataNodeType, system: 'PostgreSQL' },
      { name: 'persons', type: 'DATABASE_TABLE' as DataNodeType, system: 'PostgreSQL' },
      { name: 'shadow_memories', type: 'DATABASE_TABLE' as DataNodeType, system: 'PostgreSQL' },
      { name: 'knowledge_base', type: 'DATABASE_TABLE' as DataNodeType, system: 'PostgreSQL' },
      { name: 'insight_sessions', type: 'DATABASE_TABLE' as DataNodeType, system: 'PostgreSQL' },
      { name: 'dashscope_api', type: 'EXTERNAL_SERVICE' as DataNodeType, system: 'DashScope' },
      { name: 'user_voice_input', type: 'USER_INPUT' as DataNodeType, system: 'WebRTC' },
      { name: 'tts_output', type: 'SYSTEM_OUTPUT' as DataNodeType, system: 'StreamingTTS' },
    ];

    for (const node of systemNodes) {
      this.registerNode({
        name: node.name,
        type: node.type,
        source: {
          system: node.system,
          location: `internal://${node.name}`,
          connectionType: node.type === 'EXTERNAL_SERVICE' ? 'EXTERNAL' : 'INTERNAL',
          accessLevel: 'INTERNAL',
        },
      });
    }

    log(`已注册 ${this.nodes.size} 个系统数据节点`);
  }

  // ============ 节点管理 ============

  registerNode(config: {
    name: string;
    type: DataNodeType;
    source: DataSource;
    schema?: DataSchema;
    metadata?: Record<string, any>;
  }): DataNode {
    const id = `node_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const node: DataNode = {
      id,
      name: config.name,
      type: config.type,
      source: config.source,
      schema: config.schema,
      metadata: config.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      qualityScore: 100,
    };

    this.nodes.set(id, node);
    this.emit('node_registered', node);
    log(`注册数据节点: ${config.name} (${id})`);

    return node;
  }

  updateNode(id: string, updates: Partial<Omit<DataNode, 'id' | 'createdAt'>>): DataNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`节点不存在: ${id}`);

    Object.assign(node, updates, { updatedAt: Date.now() });
    this.emit('node_updated', node);

    return node;
  }

  getNode(id: string): DataNode | undefined {
    return this.nodes.get(id);
  }

  findNodeByName(name: string): DataNode | undefined {
    return Array.from(this.nodes.values()).find(n => n.name === name);
  }

  listNodes(filter?: { type?: DataNodeType; system?: string }): DataNode[] {
    let nodes = Array.from(this.nodes.values());

    if (filter?.type) {
      nodes = nodes.filter(n => n.type === filter.type);
    }
    if (filter?.system) {
      nodes = nodes.filter(n => n.source.system === filter.system);
    }

    return nodes;
  }

  // ============ 边管理 ============

  createEdge(config: {
    sourceId: string;
    targetId: string;
    type: EdgeType;
    transformation?: TransformationInfo;
    frequency: EdgeFrequency;
    metadata?: Record<string, any>;
  }): DataEdge {
    const sourceNode = this.nodes.get(config.sourceId);
    const targetNode = this.nodes.get(config.targetId);

    if (!sourceNode) throw new Error(`源节点不存在: ${config.sourceId}`);
    if (!targetNode) throw new Error(`目标节点不存在: ${config.targetId}`);

    const id = `edge_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const edge: DataEdge = {
      id,
      sourceId: config.sourceId,
      targetId: config.targetId,
      type: config.type,
      transformation: config.transformation,
      frequency: config.frequency,
      metadata: config.metadata || {},
      createdAt: Date.now(),
    };

    this.edges.set(id, edge);
    this.emit('edge_created', edge);
    log(`创建数据边: ${sourceNode.name} -> ${targetNode.name} (${config.type})`);

    return edge;
  }

  recordDataFlow(edgeId: string, volume?: Partial<DataVolume>): void {
    const edge = this.edges.get(edgeId);
    if (!edge) throw new Error(`边不存在: ${edgeId}`);

    edge.lastFlowAt = Date.now();
    if (volume) {
      edge.volume = { ...edge.volume, ...volume } as DataVolume;
    }

    // 更新节点访问时间
    const sourceNode = this.nodes.get(edge.sourceId);
    const targetNode = this.nodes.get(edge.targetId);
    if (sourceNode) sourceNode.lastAccessedAt = Date.now();
    if (targetNode) targetNode.lastAccessedAt = Date.now();

    this.emit('data_flow_recorded', { edgeId, timestamp: Date.now() });
  }

  listEdges(nodeId?: string): DataEdge[] {
    let edges = Array.from(this.edges.values());

    if (nodeId) {
      edges = edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId);
    }

    return edges;
  }

  // ============ 血缘追踪 ============

  traceUpstream(nodeId: string, maxDepth = 10): LineagePath {
    const visited = new Set<string>();
    const nodes: DataNode[] = [];
    const edges: DataEdge[] = [];

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (node) nodes.push(node);

      const incomingEdges = Array.from(this.edges.values()).filter(e => e.targetId === currentId);
      for (const edge of incomingEdges) {
        edges.push(edge);
        traverse(edge.sourceId, depth + 1);
      }
    };

    traverse(nodeId, 0);

    return {
      nodes,
      edges,
      depth: maxDepth,
      totalTransformations: edges.filter(e => e.type === 'TRANSFORM').length,
    };
  }

  traceDownstream(nodeId: string, maxDepth = 10): LineagePath {
    const visited = new Set<string>();
    const nodes: DataNode[] = [];
    const edges: DataEdge[] = [];

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (node) nodes.push(node);

      const outgoingEdges = Array.from(this.edges.values()).filter(e => e.sourceId === currentId);
      for (const edge of outgoingEdges) {
        edges.push(edge);
        traverse(edge.targetId, depth + 1);
      }
    };

    traverse(nodeId, 0);

    return {
      nodes,
      edges,
      depth: maxDepth,
      totalTransformations: edges.filter(e => e.type === 'TRANSFORM').length,
    };
  }

  // ============ 影响分析 ============

  analyzeImpact(nodeId: string): ImpactAnalysis {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`节点不存在: ${nodeId}`);

    const upstream = this.traceUpstream(nodeId);
    const downstream = this.traceDownstream(nodeId);

    const upstreamNodes = upstream.nodes
      .filter(n => n.id !== nodeId)
      .map((n, idx) => ({ node: n, depth: idx + 1 }));

    const downstreamNodes = downstream.nodes
      .filter(n => n.id !== nodeId)
      .map((n, idx) => ({ node: n, depth: idx + 1 }));

    // 识别关键路径
    const criticalPaths = this.identifyCriticalPaths(nodeId);

    // 评估风险等级
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (downstreamNodes.length > 10) riskLevel = 'CRITICAL';
    else if (downstreamNodes.length > 5) riskLevel = 'HIGH';
    else if (downstreamNodes.length > 2) riskLevel = 'MEDIUM';

    // 生成建议
    const recommendations: string[] = [];
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendations.push('该节点影响范围广，变更前需进行全面测试');
    }
    if (upstreamNodes.length === 0) {
      recommendations.push('该节点为数据源头，需确保数据质量');
    }
    if (downstream.totalTransformations > 3) {
      recommendations.push('数据经过多次转换，建议监控数据一致性');
    }

    log(`影响分析完成: ${node.name}, 上游${upstreamNodes.length}个, 下游${downstreamNodes.length}个`);

    return {
      nodeId,
      upstreamNodes,
      downstreamNodes,
      criticalPaths,
      riskLevel,
      recommendations,
    };
  }

  private identifyCriticalPaths(nodeId: string): LineagePath[] {
    const paths: LineagePath[] = [];
    const downstream = this.traceDownstream(nodeId);

    // 找到终端节点（没有出边的节点）
    const terminalNodes = downstream.nodes.filter(n => {
      const outEdges = Array.from(this.edges.values()).filter(e => e.sourceId === n.id);
      return outEdges.length === 0;
    });

    // 为每个终端节点构建路径
    for (const terminal of terminalNodes.slice(0, 3)) { // 限制最多3条
      const path = this.findPath(nodeId, terminal.id);
      if (path) paths.push(path);
    }

    return paths;
  }

  private findPath(startId: string, endId: string): LineagePath | null {
    const visited = new Set<string>();
    const path: { nodes: DataNode[]; edges: DataEdge[] } = { nodes: [], edges: [] };

    const dfs = (currentId: string): boolean => {
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return false;

      path.nodes.push(node);

      if (currentId === endId) return true;

      const outEdges = Array.from(this.edges.values()).filter(e => e.sourceId === currentId);
      for (const edge of outEdges) {
        path.edges.push(edge);
        if (dfs(edge.targetId)) return true;
        path.edges.pop();
      }

      path.nodes.pop();
      return false;
    };

    if (dfs(startId)) {
      return {
        ...path,
        depth: path.nodes.length - 1,
        totalTransformations: path.edges.filter(e => e.type === 'TRANSFORM').length,
      };
    }

    return null;
  }

  // ============ 数据质量 ============

  reportQualityIssue(config: {
    nodeId: string;
    type: QualityIssueType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
  }): DataQualityIssue {
    const node = this.nodes.get(config.nodeId);
    if (!node) throw new Error(`节点不存在: ${config.nodeId}`);

    const id = `issue_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const issue: DataQualityIssue = {
      id,
      nodeId: config.nodeId,
      type: config.type,
      severity: config.severity,
      description: config.description,
      detectedAt: Date.now(),
    };

    this.issues.set(id, issue);

    // 更新节点质量分
    const severityPenalty = { LOW: 5, MEDIUM: 15, HIGH: 30, CRITICAL: 50 };
    node.qualityScore = Math.max(0, (node.qualityScore || 100) - severityPenalty[config.severity]);

    this.emit('quality_issue_reported', issue);
    log(`数据质量问题: ${node.name} - ${config.type} (${config.severity})`);

    return issue;
  }

  resolveIssue(issueId: string, resolution: string): void {
    const issue = this.issues.get(issueId);
    if (!issue) throw new Error(`问题不存在: ${issueId}`);

    issue.resolvedAt = Date.now();
    issue.resolution = resolution;

    // 恢复节点质量分
    const node = this.nodes.get(issue.nodeId);
    if (node) {
      const severityRecovery = { LOW: 5, MEDIUM: 15, HIGH: 30, CRITICAL: 50 };
      node.qualityScore = Math.min(100, (node.qualityScore || 0) + severityRecovery[issue.severity]);
    }

    this.emit('quality_issue_resolved', issue);
    log(`问题已解决: ${issueId}`);
  }

  listIssues(filter?: { nodeId?: string; resolved?: boolean }): DataQualityIssue[] {
    let issues = Array.from(this.issues.values());

    if (filter?.nodeId) {
      issues = issues.filter(i => i.nodeId === filter.nodeId);
    }
    if (filter?.resolved !== undefined) {
      issues = filter.resolved ? 
        issues.filter(i => i.resolvedAt !== undefined) :
        issues.filter(i => i.resolvedAt === undefined);
    }

    return issues;
  }

  // ============ 导出 ============

  exportToGraph(): {
    nodes: { id: string; label: string; type: string; group: string }[];
    edges: { source: string; target: string; label: string }[];
  } {
    const graphNodes = Array.from(this.nodes.values()).map(n => ({
      id: n.id,
      label: n.name,
      type: n.type,
      group: n.source.system,
    }));

    const graphEdges = Array.from(this.edges.values()).map(e => ({
      source: e.sourceId,
      target: e.targetId,
      label: e.type,
    }));

    return { nodes: graphNodes, edges: graphEdges };
  }

  // ============ 统计 ============

  getStats(): {
    totalNodes: number;
    totalEdges: number;
    openIssues: number;
    avgQualityScore: number;
    nodesByType: Record<string, number>;
  } {
    const nodesList = Array.from(this.nodes.values());
    const openIssues = Array.from(this.issues.values()).filter(i => !i.resolvedAt).length;
    
    const avgQualityScore = nodesList.length > 0 ?
      nodesList.reduce((sum, n) => sum + (n.qualityScore || 0), 0) / nodesList.length : 100;

    const nodesByType: Record<string, number> = {};
    for (const node of nodesList) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      openIssues,
      avgQualityScore,
      nodesByType,
    };
  }
}

export const dataLineage = new DataLineageService();
logger.info('[DataLineage] 数据血缘追踪服务 v1.0 已加载 (Phase 11.5)');

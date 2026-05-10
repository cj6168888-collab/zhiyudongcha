/**
 * Navigator-X 核心引擎 - 领航者系统 v1.0
 *
 * 基于PRD需求 - Navigator-X 顶级统御级AI协同系统:
 * - 舰队管理：管理节点端（Node Terminal）形成高效舰队
 * - 权限令牌：细粒度权限控制，时限访问
 * - 团队画像：跟踪节点使用情况，生成舰队洞察
 * - 召回机制：远程销毁节点实例
 *
 * 功能：
 * 1. 节点生成 - 创建带权限约束的节点实例
 * 2. 权限令牌 - JWT风格令牌，支持权限、时限、IP限制
 * 3. 舰队画像 - 使用行为分析，生成用户洞察
 * 4. 审计日志 - 完整追踪节点操作
 * 5. 召回/熔断 - 紧急停用节点
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('NavigatorCore');

import { EventEmitter } from 'events';
import { getDatabase, isDatabaseAvailable } from '../db';
import {
  swarmEntities,
  swarmTokens,
  swarmTeams,
  swarmAuditLogs,
  type SwarmEntity as DbSwarmEntity,
  type SwarmToken as DbSwarmToken,
  type SwarmTeam as DbSwarmTeam,
  type SwarmAuditLog as DbSwarmAuditLog
} from '@shared/schema';
import { eq, desc, and, gt, lt, or } from 'drizzle-orm';
import crypto from 'crypto';

// ============ 类型定义 ============

export interface NavigatorNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  ownerId: string;
  permissions: Permission[];
  capabilities: Capability[];
  status: NodeStatus;
  metadata: NodeMetadata;
  createdAt: number;
  expiresAt: number | null;
  lastActiveAt: number;
}

export type NodeType =
  | 'SOVEREIGN'          // 主权端（老板/领导者的完整实例）
  | 'NODE'               // 节点端（功能受限分身）
  | 'AGENT'              // 代理（特定任务代理）
  | 'OBSERVER';          // 观察者（只读权限）

export type NodeStatus =
  | 'ACTIVE'           // 活跃
  | 'SUSPENDED'        // 暂停
  | 'EXPIRED'          // 过期
  | 'REVOKED';         // 已召回

export interface NodeMetadata {
  deviceInfo?: string;
  ipRestrictions?: string[];
  maxSessions?: number;
  currentSessions?: number;
  totalRequests?: number;
  lastRequestAt?: number;
  customData?: Record<string, any>;
  // Navigator-X 新增字段
  moraleCurve?: MoraleData[];        // 团队士气曲线
  leaderPreferences?: PreferenceWeights;  // 领导偏好权重
}

export interface MoraleData {
  timestamp: number;
  score: number;  // 0-100
  trend: 'UP' | 'DOWN' | 'STABLE';
  factors: string[];
}

export interface PreferenceWeights {
  reportLength: 'BRIEF' | 'NORMAL' | 'DETAILED';  // 报告长度偏好
  formatStyle: 'TECHNICAL' | 'CASUAL' | 'EXECUTIVE';  // 格式风格
  priorityMetrics: string[];  // 优先指标
  alertThreshold: number;  // 预警阈值
}

export interface Permission {
  id: string;
  resource: ResourceType;
  actions: ActionType[];
  scope: PermissionScope;
  conditions?: PermissionCondition[];
}

export type ResourceType =
  | 'CHAT'             // 对话
  | 'KNOWLEDGE'        // 知识库
  | 'CALENDAR'         // 日历
  | 'CONTACTS'         // 联系人
  | 'DOCUMENTS'        // 文档
  | 'INSIGHT'          // 智语洞察
  | 'CONTRACTS'        // 合同
  | 'MCTS'             // 博弈推演
  | 'VAULT'            // 保险库
  | 'SETTINGS'         // 设置
  // Navigator-X 新增资源类型
  | 'FLEET'            // 舰队管理
  | 'REPORTS'          // 汇报管理
  | 'TASKS';           // 任务管理

export type ActionType =
  | 'READ'
  | 'WRITE'
  | 'DELETE'
  | 'EXECUTE'
  | 'ADMIN';

export type PermissionScope =
  | 'ALL'              // 全部
  | 'OWN'              // 仅自己的
  | 'FLEET'            // 舰队范围
  | 'RESTRICTED';      // 受限

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: string | number | boolean | string[] | number[];
}

export type Capability =
  | 'VOICE_INTERACTION'    // 语音交互
  | 'TEXT_CHAT'           // 文字聊天
  | 'DOCUMENT_ANALYSIS'   // 文档分析
  | 'CALENDAR_MANAGE'     // 日历管理
  | 'CONTACT_LOOKUP'      // 联系人查询
  | 'REMINDER_SET'        // 设置提醒
  | 'INSIGHT_VIEW'        // 查看洞察
  | 'INSIGHT_CONTROL'     // 控制洞察
  | 'CONTRACT_DRAFT'      // 起草合同
  | 'MCTS_SIMULATE'       // 博弈推演
  | 'KNOWLEDGE_QUERY'     // 知识查询
  | 'KNOWLEDGE_ADD'       // 添加知识
  // Navigator-X 新增能力
  | 'DRAFT_GENERATION'    // 草案生成
  | 'AUTHENTICITY_AUDIT'  // 真实性审计
  | 'PREFERENCE_ADAPT';   // 偏好自适应

export interface AccessToken {
  id: string;
  entityId: string;
  token: string;
  type: TokenType;
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
  usageCount: number;
  maxUsage: number | null;
  lastUsedAt: number | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

export type TokenType =
  | 'SESSION'          // 会话令牌
  | 'API'              // API令牌
  | 'ONETIME';         // 一次性令牌

export interface FleetProfile {
  id: string;
  name: string;
  members: FleetMember[];
  aggregatedStats: FleetStats;
  insights: FleetInsight[];
  createdAt: number;
  updatedAt: number;
  // Navigator-X 新增
  computeQuota?: ComputeQuota;
}

export interface ComputeQuota {
  sovereignPriority: number;      // 主权端优先级 (0-100)
  nodePriority: number;           // 节点端优先级
  maxConcurrentOps: number;       // 最大并发数
}

export interface FleetMember {
  entityId: string;
  role: 'SOVEREIGN' | 'MEMBER' | 'GUEST';
  joinedAt: number;
  lastActiveAt: number;
  stats: MemberStats;
  // Navigator-X 新增
  moraleScore?: number;
  alertStatus?: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface MemberStats {
  totalSessions: number;
  totalRequests: number;
  avgSessionDuration: number;
  topCapabilities: string[];
  activityHours: number[];
  trustScore: number;
}

export interface FleetStats {
  totalMembers: number;
  activeMembersToday: number;
  totalRequests24h: number;
  topCapabilities: { capability: string; count: number }[];
  peakHours: number[];
  securityIncidents: number;
  // Navigator-X 新增
  avgMoraleScore?: number;
  anomalyCount?: number;
}

export interface FleetInsight {
  type: 'USAGE_PATTERN' | 'SECURITY_ALERT' | 'EFFICIENCY' | 'RECOMMENDATION' | 'MORALE_WARNING';
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  generatedAt: number;
}

export interface AuditEntry {
  id: string;
  entityId: string;
  tokenId: string | null;
  action: string;
  resource: string;
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [Navigator] ${message}`);
}

// ============ 领航者核心服务类 ============

class NavigatorCore extends EventEmitter {
  private nodes: Map<string, NavigatorNode> = new Map();
  private tokens: Map<string, AccessToken> = new Map();
  private fleets: Map<string, FleetProfile> = new Map();
  private auditLog: AuditEntry[] = [];
  private sovereignNode: NavigatorNode;
  private dbAvailable = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.sovereignNode = this.initializeSovereign();
    this.initPromise = this.initializeFromDatabase();
    log('领航者核心已初始化 (Navigator-X v1.0)');
  }

  private async initializeFromDatabase(): Promise<void> {
    try {
      if (!isDatabaseAvailable()) {
        log('数据库不可用，使用内存存储');
        this.dbAvailable = false;
        return;
      }

      const db = getDatabase();
      if (!db) {
        log('数据库连接失败，使用内存存储');
        this.dbAvailable = false;
        return;
      }

      // 加载节点
      const entities = await db.select().from(swarmEntities);
      for (const entity of entities) {
        this.nodes.set(entity.id, this.dbToNode(entity));
      }
      log(`已从数据库加载 ${entities.length} 个节点`);

      // 加载令牌
      const tokens = await db.select().from(swarmTokens);
      for (const token of tokens) {
        this.tokens.set(token.id, this.dbToToken(token));
      }
      log(`已从数据库加载 ${tokens.length} 个令牌`);

      // 加载舰队
      const teams = await db.select().from(swarmTeams);
      for (const team of teams) {
        this.fleets.set(team.id, this.dbToFleet(team));
      }
      log(`已从数据库加载 ${teams.length} 个舰队`);

      // 加载审计日志
      const logs = await db.select().from(swarmAuditLogs).orderBy(desc(swarmAuditLogs.timestamp)).limit(1000);
      this.auditLog = logs.map(l => this.dbToAuditLog(l));
      log(`已从数据库加载 ${logs.length} 条审计日志`);

      this.dbAvailable = true;
      log('数据库持久化已启用');
    } catch (error) {
      log(`数据库初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
      this.dbAvailable = false;
    }
  }

  private async ensureDbReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private dbToNode(dbEntity: DbSwarmEntity): NavigatorNode {
    return {
      id: dbEntity.id,
      name: dbEntity.name,
      type: dbEntity.type as NodeType,
      parentId: dbEntity.parentId,
      ownerId: dbEntity.ownerId,
      permissions: dbEntity.permissions as Permission[],
      capabilities: dbEntity.capabilities as Capability[],
      status: dbEntity.status as NodeStatus,
      metadata: dbEntity.metadata as NodeMetadata,
      createdAt: new Date(dbEntity.createdAt).getTime(),
      expiresAt: dbEntity.expiresAt ? new Date(dbEntity.expiresAt).getTime() : null,
      lastActiveAt: new Date(dbEntity.lastActiveAt).getTime(),
    };
  }

  private dbToToken(dbToken: DbSwarmToken): AccessToken {
    return {
      id: dbToken.id,
      entityId: dbToken.entityId,
      token: dbToken.token,
      type: dbToken.type as TokenType,
      permissions: dbToken.permissions as Permission[],
      issuedAt: new Date(dbToken.issuedAt).getTime(),
      expiresAt: new Date(dbToken.expiresAt).getTime(),
      usageCount: dbToken.usageCount,
      maxUsage: dbToken.maxUsage,
      lastUsedAt: dbToken.lastUsedAt ? new Date(dbToken.lastUsedAt).getTime() : null,
      status: dbToken.status as TokenStatus,
    };
  }

  private dbToFleet(dbTeam: DbSwarmTeam): FleetProfile {
    return {
      id: dbTeam.id,
      name: dbTeam.name,
      members: dbTeam.members as FleetMember[],
      aggregatedStats: dbTeam.aggregStats as FleetStats,
      insights: [],
      createdAt: new Date(dbTeam.createdAt).getTime(),
      updatedAt: new Date(dbTeam.updatedAt).getTime(),
    };
  }

  private dbToAuditLog(dbLog: DbSwarmAuditLog): AuditEntry {
    return {
      id: dbLog.id,
      entityId: dbLog.entityId || '',
      tokenId: dbLog.tokenId || null,
      action: dbLog.action,
      resource: dbLog.resource,
      outcome: dbLog.outcome as AuditOutcome,
      details: dbLog.details as Record<string, unknown>,
      ipAddress: dbLog.ipAddress || undefined,
      userAgent: dbLog.userAgent || undefined,
      timestamp: new Date(dbLog.timestamp).getTime(),
    };
  }

  private async saveNodeToDb(node: NavigatorNode): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;

      const nodeData = {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        ownerId: node.ownerId,
        status: node.status,
        permissions: JSON.stringify(node.permissions),
        capabilities: node.capabilities,
        metadata: JSON.stringify(node.metadata),
        expiresAt: node.expiresAt ? new Date(node.expiresAt) : null,
        lastActiveAt: new Date(node.lastActiveAt),
        createdAt: new Date(node.createdAt),
        updatedAt: new Date(),
      };

      await db.insert(swarmEntities).values(nodeData as unknown).onConflictDoUpdate({
        target: swarmEntities.id,
        set: {
          name: node.name,
          status: node.status,
          permissions: JSON.stringify(node.permissions),
          capabilities: node.capabilities,
          metadata: JSON.stringify(node.metadata),
          expiresAt: node.expiresAt ? new Date(node.expiresAt) : null,
          lastActiveAt: new Date(node.lastActiveAt),
          updatedAt: new Date(),
        } as unknown,
      });
    } catch (error) {
      log(`保存节点失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async deleteNodeFromDb(nodeId: string): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      await db.delete(swarmEntities).where(eq(swarmEntities.id, nodeId));
    } catch (error) {
      log(`删除节点失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async saveTokenToDb(token: AccessToken): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;

      const tokenData = {
        id: token.id,
        entityId: token.entityId,
        token: token.token,
        type: token.type,
        permissions: token.permissions,
        issuedAt: new Date(token.issuedAt),
        expiresAt: new Date(token.expiresAt),
        lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : null,
        usageCount: token.usageCount,
        maxUsage: token.maxUsage,
        status: token.status,
      };

      await db.insert(swarmTokens).values(tokenData as unknown).onConflictDoUpdate({
        target: swarmTokens.id,
        set: {
          status: token.status,
          usageCount: token.usageCount,
          lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : null,
        } as unknown,
      });
    } catch (error) {
      log(`保存令牌失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async deleteTokenFromDb(tokenId: string): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      await db.delete(swarmTokens).where(eq(swarmTokens.id, tokenId));
    } catch (error) {
      log(`删除令牌失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async saveFleetToDb(fleet: FleetProfile): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;

      const fleetData = {
        id: fleet.id,
        name: fleet.name,
        leaderEntityId: fleet.members[0]?.entityId || '',
        members: JSON.stringify(fleet.members),
        aggregatedStats: JSON.stringify(fleet.aggregatedStats),
        createdAt: new Date(fleet.createdAt),
        updatedAt: new Date(),
      };

      await db.insert(swarmTeams).values(fleetData as unknown).onConflictDoUpdate({
        target: swarmTeams.id,
        set: {
          name: fleet.name,
          members: JSON.stringify(fleet.members),
          aggregatedStats: JSON.stringify(fleet.aggregatedStats),
          updatedAt: new Date(),
        } as unknown,
      });
    } catch (error) {
      log(`保存舰队失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async deleteFleetFromDb(fleetId: string): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      await db.delete(swarmTeams).where(eq(swarmTeams.id, fleetId));
    } catch (error) {
      log(`删除舰队失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async saveAuditLogToDb(entry: AuditEntry): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;

      const logData = {
        id: entry.id,
        entityId: entry.entityId || undefined,
        tokenId: entry.tokenId || undefined,
        action: entry.action,
        resource: entry.resource,
        outcome: entry.outcome,
        details: JSON.stringify(entry.details),
        ipAddress: entry.ipAddress || undefined,
        userAgent: entry.userAgent || undefined,
        timestamp: new Date(entry.timestamp),
      };

      await db.insert(swarmAuditLogs).values(logData as unknown);
    } catch (error) {
      log(`保存审计日志失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private initializeSovereign(): NavigatorNode {
    const sovereign: NavigatorNode = {
      id: 'sovereign_entity',
      name: '领航者主体',
      type: 'SOVEREIGN',
      parentId: null,
      ownerId: 'SOVEREIGN',
      permissions: this.createFullPermissions(),
      capabilities: [
        'VOICE_INTERACTION', 'TEXT_CHAT', 'DOCUMENT_ANALYSIS',
        'CALENDAR_MANAGE', 'CONTACT_LOOKUP', 'REMINDER_SET',
        'INSIGHT_VIEW', 'INSIGHT_CONTROL', 'CONTRACT_DRAFT',
        'MCTS_SIMULATE', 'KNOWLEDGE_QUERY', 'KNOWLEDGE_ADD',
        'DRAFT_GENERATION', 'AUTHENTICITY_AUDIT', 'PREFERENCE_ADAPT',
      ],
      status: 'ACTIVE',
      metadata: {
        maxSessions: 999,
        currentSessions: 1,
        totalRequests: 0,
        leaderPreferences: {
          reportLength: 'NORMAL',
          formatStyle: 'EXECUTIVE',
          priorityMetrics: ['progress', 'risk', 'deadline'],
          alertThreshold: 70,
        },
      },
      createdAt: Date.now(),
      expiresAt: null,
      lastActiveAt: Date.now(),
    };

    this.nodes.set(sovereign.id, sovereign);
    return sovereign;
  }

  private createFullPermissions(): Permission[] {
    const resources: ResourceType[] = [
      'CHAT', 'KNOWLEDGE', 'CALENDAR', 'CONTACTS', 'DOCUMENTS',
      'INSIGHT', 'CONTRACTS', 'MCTS', 'VAULT', 'SETTINGS',
      'FLEET', 'REPORTS', 'TASKS',
    ];

    return resources.map(resource => ({
      id: `perm_${resource.toLowerCase()}_full`,
      resource,
      actions: ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'ADMIN'],
      scope: 'ALL',
    }));
  }

  // ============ 节点管理 ============

  async createNode(config: {
    name: string;
    type?: NodeType;
    capabilities: Capability[];
    permissions?: Partial<Permission>[];
    expiresIn?: number;
    ipRestrictions?: string[];
    maxSessions?: number;
    ownerId?: string;
  }): Promise<NavigatorNode> {
    const nodeId = `node_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const permissions = config.permissions?.map((p, idx) => ({
      id: `perm_${nodeId}_${idx}`,
      resource: p.resource || 'CHAT' as ResourceType,
      actions: p.actions || ['READ'] as ActionType[],
      scope: p.scope || 'RESTRICTED' as PermissionScope,
      conditions: p.conditions,
    })) || this.createDefaultPermissions(config.capabilities);

    const node: NavigatorNode = {
      id: nodeId,
      name: config.name,
      type: config.type || 'NODE',
      parentId: this.sovereignNode.id,
      ownerId: config.ownerId || 'FLEET',
      permissions,
      capabilities: config.capabilities,
      status: 'ACTIVE',
      metadata: {
        ipRestrictions: config.ipRestrictions,
        maxSessions: config.maxSessions || 5,
        currentSessions: 0,
        totalRequests: 0,
      },
      createdAt: Date.now(),
      expiresAt: config.expiresIn ? Date.now() + config.expiresIn : null,
      lastActiveAt: Date.now(),
    };

    this.nodes.set(nodeId, node);
    this.emit('node_created', node);

    await this.saveNodeToDb(node);

    await this.logAudit({
      entityId: this.sovereignNode.id,
      tokenId: null,
      action: 'CREATE_NODE',
      resource: 'NODE',
      outcome: 'SUCCESS',
      details: { nodeId, name: config.name, capabilities: config.capabilities },
    });

    log(`创建节点: ${config.name} (${nodeId})`);
    return node;
  }

  private createDefaultPermissions(capabilities: Capability[]): Permission[] {
    const permissions: Permission[] = [];

    if (capabilities.includes('TEXT_CHAT') || capabilities.includes('VOICE_INTERACTION')) {
      permissions.push({
        id: `perm_chat_${Date.now()}`,
        resource: 'CHAT',
        actions: ['READ', 'WRITE'],
        scope: 'OWN',
      });
    }

    if (capabilities.includes('KNOWLEDGE_QUERY')) {
      permissions.push({
        id: `perm_knowledge_${Date.now()}`,
        resource: 'KNOWLEDGE',
        actions: ['READ'],
        scope: 'ALL',
      });
    }

    if (capabilities.includes('KNOWLEDGE_ADD')) {
      permissions.push({
        id: `perm_knowledge_write_${Date.now()}`,
        resource: 'KNOWLEDGE',
        actions: ['READ', 'WRITE'],
        scope: 'FLEET',
      });
    }

    if (capabilities.includes('CALENDAR_MANAGE')) {
      permissions.push({
        id: `perm_calendar_${Date.now()}`,
        resource: 'CALENDAR',
        actions: ['READ', 'WRITE'],
        scope: 'OWN',
      });
    }

    if (capabilities.includes('INSIGHT_VIEW')) {
      permissions.push({
        id: `perm_insight_${Date.now()}`,
        resource: 'INSIGHT',
        actions: ['READ'],
        scope: 'FLEET',
      });
    }

    if (capabilities.includes('MCTS_SIMULATE')) {
      permissions.push({
        id: `perm_mcts_${Date.now()}`,
        resource: 'MCTS',
        actions: ['READ', 'EXECUTE'],
        scope: 'ALL',
      });
    }

    return permissions;
  }

  async suspendNode(nodeId: string, reason?: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`节点不存在: ${nodeId}`);
    if (node.type === 'SOVEREIGN') throw new Error('不能暂停主权端');

    node.status = 'SUSPENDED';
    node.lastActiveAt = Date.now();
    this.emit('node_suspended', { nodeId, reason });

    await this.saveNodeToDb(node);

    await this.logAudit({
      entityId: this.sovereignNode.id,
      tokenId: null,
      action: 'SUSPEND_NODE',
      resource: 'NODE',
      outcome: 'SUCCESS',
      details: { targetId: nodeId, reason },
    });

    const tokenValues = Array.from(this.tokens.values());
    for (const token of tokenValues) {
      if (token.entityId === nodeId) {
        token.status = 'REVOKED';
        await this.saveTokenToDb(token);
      }
    }

    log(`暂停节点: ${nodeId}`);
  }

  async revokeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`节点不存在: ${nodeId}`);
    if (node.type === 'SOVEREIGN') throw new Error('不能召回主权端');

    node.status = 'REVOKED';
    node.lastActiveAt = Date.now();
    this.emit('node_revoked', nodeId);

    await this.saveNodeToDb(node);

    await this.logAudit({
      entityId: this.sovereignNode.id,
      tokenId: null,
      action: 'REVOKE_NODE',
      resource: 'NODE',
      outcome: 'SUCCESS',
      details: { targetId: nodeId },
    });

    log(`召回节点: ${nodeId}`);
  }

  async reactivateNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`节点不存在: ${nodeId}`);

    if (node.expiresAt && node.expiresAt < Date.now()) {
      throw new Error('节点已过期，需重新创建');
    }

    node.status = 'ACTIVE';
    node.lastActiveAt = Date.now();
    this.emit('node_reactivated', nodeId);

    await this.saveNodeToDb(node);

    log(`重新激活节点: ${nodeId}`);
  }

  listNodes(filter?: { type?: NodeType; status?: NodeStatus }): NavigatorNode[] {
    let nodes = Array.from(this.nodes.values());

    if (filter?.type) {
      nodes = nodes.filter(n => n.type === filter.type);
    }
    if (filter?.status) {
      nodes = nodes.filter(n => n.status === filter.status);
    }

    return nodes;
  }

  getNode(nodeId: string): NavigatorNode | undefined {
    return this.nodes.get(nodeId);
  }

  // ============ 令牌管理 ============

  async issueToken(config: {
    entityId: string;
    type: TokenType;
    expiresIn: number;
    maxUsage?: number;
  }): Promise<AccessToken> {
    const node = this.nodes.get(config.entityId);
    if (!node) throw new Error(`节点不存在: ${config.entityId}`);
    if (node.status !== 'ACTIVE') throw new Error('节点未激活');

    const tokenId = `token_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const tokenValue = crypto.randomBytes(32).toString('base64url');

    const token: AccessToken = {
      id: tokenId,
      entityId: config.entityId,
      token: tokenValue,
      type: config.type,
      permissions: node.permissions.map(p => p.id),
      issuedAt: Date.now(),
      expiresAt: Date.now() + config.expiresIn,
      usageCount: 0,
      maxUsage: config.maxUsage || null,
      lastUsedAt: null,
      status: 'ACTIVE',
    };

    this.tokens.set(tokenId, token);
    this.emit('token_issued', { tokenId, entityId: config.entityId });

    await this.saveTokenToDb(token);

    log(`签发令牌: ${tokenId} for ${config.entityId}`);
    return token;
  }

  async validateToken(tokenValue: string): Promise<{
    valid: boolean;
    node?: NavigatorNode;
    token?: AccessToken;
    reason?: string;
  }> {
    const token = Array.from(this.tokens.values()).find(t => t.token === tokenValue);

    if (!token) {
      return { valid: false, reason: '令牌不存在' };
    }

    if (token.status !== 'ACTIVE') {
      return { valid: false, reason: `令牌状态: ${token.status}` };
    }

    if (token.expiresAt < Date.now()) {
      token.status = 'EXPIRED';
      return { valid: false, reason: '令牌已过期' };
    }

    if (token.maxUsage && token.usageCount >= token.maxUsage) {
      token.status = 'EXPIRED';
      return { valid: false, reason: '令牌使用次数已达上限' };
    }

    const node = this.nodes.get(token.entityId);
    if (!node || node.status !== 'ACTIVE') {
      return { valid: false, reason: '关联节点无效' };
    }

    token.usageCount++;
    token.lastUsedAt = Date.now();
    node.lastActiveAt = Date.now();
    node.metadata.totalRequests = (node.metadata.totalRequests || 0) + 1;
    node.metadata.lastRequestAt = Date.now();

    await this.saveTokenToDb(token);
    await this.saveNodeToDb(node);

    return { valid: true, node, token };
  }

  async revokeToken(tokenId: string): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (!token) throw new Error(`令牌不存在: ${tokenId}`);

    token.status = 'REVOKED';

    await this.saveTokenToDb(token);

    this.emit('token_revoked', tokenId);
    log(`撤销令牌: ${tokenId}`);
  }

  listTokens(entityId?: string): AccessToken[] {
    let tokens = Array.from(this.tokens.values());
    if (entityId) {
      tokens = tokens.filter(t => t.entityId === entityId);
    }
    return tokens;
  }

  // ============ 权限检查 ============

  checkPermission(
    entityId: string,
    resource: ResourceType,
    action: ActionType,
    context?: Record<string, any>
  ): boolean {
    const node = this.nodes.get(entityId);
    if (!node || node.status !== 'ACTIVE') return false;

    for (const perm of node.permissions) {
      if (perm.resource === resource && perm.actions.includes(action)) {
        if (perm.conditions && context) {
          const conditionsMet = perm.conditions.every(cond => {
            const value = context[cond.field];
            switch (cond.operator) {
              case 'equals': return value === cond.value;
              case 'contains': return String(value).includes(String(cond.value));
              case 'gt': return value > cond.value;
              case 'lt': return value < cond.value;
              case 'in': return Array.isArray(cond.value) && (cond.value as (string | number | boolean)[]).includes(value);
              default: return false;
            }
          });
          if (!conditionsMet) continue;
        }
        return true;
      }
    }

    return false;
  }

  // ============ 舰队画像 ============

  async createFleet(name: string, leaderNodeId: string): Promise<FleetProfile> {
    const fleetId = `fleet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const fleet: FleetProfile = {
      id: fleetId,
      name,
      members: [{
        entityId: leaderNodeId,
        role: 'SOVEREIGN',
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        stats: this.createEmptyMemberStats(),
      }],
      aggregatedStats: this.createEmptyFleetStats(),
      insights: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      computeQuota: {
        sovereignPriority: 80,
        nodePriority: 60,
        maxConcurrentOps: 100,
      },
    };

    this.fleets.set(fleetId, fleet);

    await this.saveFleetToDb(fleet);

    this.emit('fleet_created', fleet);
    log(`创建舰队: ${name} (${fleetId})`);

    return fleet;
  }

  async addFleetMember(fleetId: string, nodeId: string, role: 'MEMBER' | 'GUEST' = 'MEMBER'): Promise<void> {
    const fleet = this.fleets.get(fleetId);
    if (!fleet) throw new Error(`舰队不存在: ${fleetId}`);

    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`节点不存在: ${nodeId}`);

    if (fleet.members.some(m => m.entityId === nodeId)) {
      throw new Error('成员已存在于舰队中');
    }

    fleet.members.push({
      entityId: nodeId,
      role,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      stats: this.createEmptyMemberStats(),
      moraleScore: 75,
      alertStatus: 'NORMAL',
    });

    fleet.updatedAt = Date.now();
    this.updateFleetStats(fleet);

    await this.saveFleetToDb(fleet);

    log(`添加舰队成员: ${nodeId} -> ${fleet.name}`);
  }

  private createEmptyMemberStats(): MemberStats {
    return {
      totalSessions: 0,
      totalRequests: 0,
      avgSessionDuration: 0,
      topCapabilities: [],
      activityHours: [],
      trustScore: 100,
    };
  }

  private createEmptyFleetStats(): FleetStats {
    return {
      totalMembers: 0,
      activeMembersToday: 0,
      totalRequests24h: 0,
      topCapabilities: [],
      peakHours: [],
      securityIncidents: 0,
      avgMoraleScore: 75,
      anomalyCount: 0,
    };
  }

  private updateFleetStats(fleet: FleetProfile): void {
    fleet.aggregatedStats.totalMembers = fleet.members.length;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    fleet.aggregatedStats.activeMembersToday = fleet.members.filter(
      m => m.lastActiveAt >= oneDayAgo
    ).length;

    // 计算平均士气
    const moraleScores = fleet.members
      .filter(m => m.moraleScore !== undefined)
      .map(m => m.moraleScore!);

    if (moraleScores.length > 0) {
      fleet.aggregatedStats.avgMoraleScore =
        moraleScores.reduce((a, b) => a + b, 0) / moraleScores.length;
    }
  }

  async generateFleetInsights(fleetId: string): Promise<FleetInsight[]> {
    const fleet = this.fleets.get(fleetId);
    if (!fleet) throw new Error(`舰队不存在: ${fleetId}`);

    const insights: FleetInsight[] = [];

    if (fleet.members.length > 0) {
      const avgTrustScore = fleet.members.reduce((sum, m) => sum + m.stats.trustScore, 0) / fleet.members.length;

      if (avgTrustScore < 80) {
        insights.push({
          type: 'SECURITY_ALERT',
          title: '舰队信任分偏低',
          description: `平均信任分 ${avgTrustScore.toFixed(1)}，建议审查异常行为`,
          severity: 'WARNING',
          generatedAt: Date.now(),
        });
      }

      const inactiveMembers = fleet.members.filter(
        m => m.lastActiveAt < Date.now() - 7 * 24 * 60 * 60 * 1000
      );

      if (inactiveMembers.length > 0) {
        insights.push({
          type: 'EFFICIENCY',
          title: '存在不活跃成员',
          description: `${inactiveMembers.length} 名成员超过7天未活跃`,
          severity: 'INFO',
          generatedAt: Date.now(),
        });
      }

      // Navigator-X: 士气预警
      if (fleet.aggregatedStats.avgMoraleScore && fleet.aggregatedStats.avgMoraleScore < 60) {
        insights.push({
          type: 'MORALE_WARNING',
          title: '团队士气偏低',
          description: `平均士气分数 ${fleet.aggregatedStats.avgMoraleScore.toFixed(1)}，建议关注团队状态`,
          severity: 'WARNING',
          generatedAt: Date.now(),
        });
      }
    }

    fleet.insights = insights;
    fleet.updatedAt = Date.now();

    return insights;
  }

  listFleets(): FleetProfile[] {
    return Array.from(this.fleets.values());
  }

  getFleet(fleetId: string): FleetProfile | undefined {
    return this.fleets.get(fleetId);
  }

  // ============ 审计日志 ============

  private async logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      ...entry,
      timestamp: Date.now(),
    };

    this.auditLog.push(auditEntry);

    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }

    await this.saveAuditLogToDb(auditEntry);
  }

  getAuditLog(options: {
    entityId?: string;
    action?: string;
    limit?: number;
  } = {}): AuditEntry[] {
    let logs = this.auditLog;

    if (options.entityId) {
      logs = logs.filter(l => l.entityId === options.entityId);
    }
    if (options.action) {
      const actionFilter = options.action;
      logs = logs.filter(l => l.action.includes(actionFilter));
    }

    logs = logs.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  // ============ 紧急召回 ============

  async emergencyRecall(): Promise<{ recalled: number; errors: number }> {
    log('执行紧急召回...');
    let recalled = 0;
    let errors = 0;

    const nodeValues = Array.from(this.nodes.values());
    for (const node of nodeValues) {
      if (node.type !== 'SOVEREIGN') {
        try {
          node.status = 'REVOKED';
          node.lastActiveAt = Date.now();
          await this.saveNodeToDb(node);
          recalled++;
        } catch {
          errors++;
        }
      }
    }

    const tokenValues = Array.from(this.tokens.values());
    for (const token of tokenValues) {
      token.status = 'REVOKED';
      await this.saveTokenToDb(token);
    }

    this.emit('emergency_recall', { recalled, errors });

    await this.logAudit({
      entityId: this.sovereignNode.id,
      tokenId: null,
      action: 'EMERGENCY_RECALL',
      resource: 'FLEET',
      outcome: 'SUCCESS',
      details: { recalled, errors },
    });

    log(`紧急召回完成: ${recalled} 个节点已召回`);
    return { recalled, errors };
  }

  // ============ 统计 ============

  getStats(): {
    totalNodes: number;
    activeNodes: number;
    totalTokens: number;
    activeTokens: number;
    fleets: number;
    auditLogSize: number;
  } {
    return {
      totalNodes: this.nodes.size,
      activeNodes: Array.from(this.nodes.values()).filter(n => n.status === 'ACTIVE').length,
      totalTokens: this.tokens.size,
      activeTokens: Array.from(this.tokens.values()).filter(t => t.status === 'ACTIVE').length,
      fleets: this.fleets.size,
      auditLogSize: this.auditLog.length,
    };
  }
}

// 导出单例
export const navigatorCore = new NavigatorCore();

// 向后兼容别名
export const swarmManager = navigatorCore;

logger.info('[Navigator] 领航者核心 v1.0 已加载 (Navigator-X)');

/**
 * 蜂群管理协议 - Phase 11.3
 * 
 * 基于PRD需求-11/12/13/14:
 * - 子体生成与分发：生成有限功能小智分身供团队使用
 * - 权限令牌管理：细粒度权限控制，时限访问
 * - 团队画像审计：跟踪子体使用情况，生成团队画像
 * - 召回机制：远程销毁子体实例
 * 
 * 功能：
 * 1. 子体生成 - 创建带权限约束的分身实例
 * 2. 权限令牌 - JWT风格令牌，支持权限、时限、IP限制
 * 3. 团队画像 - 使用行为分析，生成用户洞察
 * 4. 审计日志 - 完整追踪子体操作
 * 5. 召回/熔断 - 紧急停用子体
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SwarmManager');

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

export interface SwarmEntity {
  id: string;
  name: string;
  type: EntityType;
  parentId: string | null;
  ownerId: string;
  permissions: Permission[];
  capabilities: Capability[];
  status: EntityStatus;
  metadata: EntityMetadata;
  createdAt: number;
  expiresAt: number | null;
  lastActiveAt: number;
}

export type EntityType = 
  | 'MASTER'           // 主体（主人的完整实例）
  | 'CLONE'            // 克隆体（功能受限分身）
  | 'AGENT'            // 代理（特定任务代理）
  | 'OBSERVER';        // 观察者（只读权限）

export type EntityStatus = 
  | 'ACTIVE'           // 活跃
  | 'SUSPENDED'        // 暂停
  | 'EXPIRED'          // 过期
  | 'REVOKED';         // 已召回

export interface EntityMetadata {
  deviceInfo?: string;
  ipRestrictions?: string[];
  maxSessions?: number;
  currentSessions?: number;
  totalRequests?: number;
  lastRequestAt?: number;
  customData?: Record<string, any>;
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
  | 'SETTINGS';        // 设置

export type ActionType = 
  | 'READ'
  | 'WRITE'
  | 'DELETE'
  | 'EXECUTE'
  | 'ADMIN';

export type PermissionScope = 
  | 'ALL'              // 全部
  | 'OWN'              // 仅自己的
  | 'TEAM'             // 团队范围
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
  | 'KNOWLEDGE_ADD';      // 添加知识

export interface AccessToken {
  id: string;
  entityId: string;
  token: string;
  type: TokenType;
  permissions: string[];  // Permission IDs
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

export interface TeamProfile {
  id: string;
  name: string;
  members: TeamMember[];
  aggregatedStats: TeamStats;
  insights: TeamInsight[];
  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  entityId: string;
  role: 'LEADER' | 'MEMBER' | 'GUEST';
  joinedAt: number;
  lastActiveAt: number;
  stats: MemberStats;
}

export interface MemberStats {
  totalSessions: number;
  totalRequests: number;
  avgSessionDuration: number;
  topCapabilities: string[];
  activityHours: number[];
  trustScore: number;
}

export interface TeamStats {
  totalMembers: number;
  activeMembersToday: number;
  totalRequests24h: number;
  topCapabilities: { capability: string; count: number }[];
  peakHours: number[];
  securityIncidents: number;
}

export interface TeamInsight {
  type: 'USAGE_PATTERN' | 'SECURITY_ALERT' | 'EFFICIENCY' | 'RECOMMENDATION';
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
  logger.info(`${time} [Swarm] ${message}`);
}

// ============ 蜂群管理服务类 ============

class SwarmManager extends EventEmitter {
  private entities: Map<string, SwarmEntity> = new Map();
  private tokens: Map<string, AccessToken> = new Map();
  private teams: Map<string, TeamProfile> = new Map();
  private auditLog: AuditEntry[] = [];
  private masterEntity: SwarmEntity;
  private dbAvailable = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.masterEntity = this.initializeMaster();
    this.initPromise = this.initializeFromDatabase();
    log('蜂群管理协议已初始化 (Phase 11.3)');
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

      // 加载实体
      const entities = await db.select().from(swarmEntities);
      for (const entity of entities) {
        this.entities.set(entity.id, this.dbToEntity(entity));
      }
      log(`已从数据库加载 ${entities.length} 个实体`);

      // 加载令牌
      const tokens = await db.select().from(swarmTokens);
      for (const token of tokens) {
        this.tokens.set(token.id, this.dbToToken(token));
      }
      log(`已从数据库加载 ${tokens.length} 个令牌`);

      // 加载团队
      const teams = await db.select().from(swarmTeams);
      for (const team of teams) {
        this.teams.set(team.id, this.dbToTeam(team));
      }
      log(`已从数据库加载 ${teams.length} 个团队`);

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

  private dbToEntity(dbEntity: DbSwarmEntity): SwarmEntity {
    return {
      id: dbEntity.id,
      name: dbEntity.name,
      type: dbEntity.type as EntityType,
      parentId: dbEntity.parentId,
      ownerId: dbEntity.ownerId,
      permissions: dbEntity.permissions as Permission[],
      capabilities: dbEntity.capabilities as Capability[],
      status: dbEntity.status as EntityStatus,
      metadata: dbEntity.metadata as EntityMetadata,
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

  private dbToTeam(dbTeam: DbSwarmTeam): TeamProfile {
    return {
      id: dbTeam.id,
      name: dbTeam.name,
      members: dbTeam.members as TeamMember[],
      aggregatedStats: dbTeam.aggregStats as TeamStats,
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

  private async saveEntityToDb(entity: SwarmEntity): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      
      const entityData = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        parentId: entity.parentId,
        ownerId: entity.ownerId,
        status: entity.status,
        permissions: JSON.stringify(entity.permissions),
        capabilities: entity.capabilities,
        metadata: JSON.stringify(entity.metadata),
        expiresAt: entity.expiresAt ? new Date(entity.expiresAt) : null,
        lastActiveAt: new Date(entity.lastActiveAt),
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(),
      };
      
      await db.insert(swarmEntities).values(entityData as unknown).onConflictDoUpdate({
        target: swarmEntities.id,
        set: {
          name: entity.name,
          status: entity.status,
          permissions: JSON.stringify(entity.permissions),
          capabilities: entity.capabilities,
          metadata: JSON.stringify(entity.metadata),
          expiresAt: entity.expiresAt ? new Date(entity.expiresAt) : null,
          lastActiveAt: new Date(entity.lastActiveAt),
          updatedAt: new Date(),
        } as unknown,
      });
    } catch (error) {
      log(`保存实体失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async deleteEntityFromDb(entityId: string): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      await db.delete(swarmEntities).where(eq(swarmEntities.id, entityId));
    } catch (error) {
      log(`删除实体失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

  private async saveTeamToDb(team: TeamProfile): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      
      const teamData = {
        id: team.id,
        name: team.name,
        leaderEntityId: team.members[0]?.entityId || '',
        members: JSON.stringify(team.members),
        aggregatedStats: JSON.stringify(team.aggregatedStats),
        createdAt: new Date(team.createdAt),
        updatedAt: new Date(),
      };
      
      await db.insert(swarmTeams).values(teamData as unknown).onConflictDoUpdate({
        target: swarmTeams.id,
        set: {
          name: team.name,
          members: JSON.stringify(team.members),
          aggregatedStats: JSON.stringify(team.aggregatedStats),
          updatedAt: new Date(),
        } as unknown,
      });
    } catch (error) {
      log(`保存团队失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async deleteTeamFromDb(teamId: string): Promise<void> {
    if (!this.dbAvailable) return;
    try {
      const db = getDatabase();
      if (!db) return;
      await db.delete(swarmTeams).where(eq(swarmTeams.id, teamId));
    } catch (error) {
      log(`删除团队失败: ${error instanceof Error ? error.message : '未知错误'}`);
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

  private initializeMaster(): SwarmEntity {
    const master: SwarmEntity = {
      id: 'master_entity',
      name: '小智主体',
      type: 'MASTER',
      parentId: null,
      ownerId: 'MASTER',
      permissions: this.createFullPermissions(),
      capabilities: [
        'VOICE_INTERACTION', 'TEXT_CHAT', 'DOCUMENT_ANALYSIS',
        'CALENDAR_MANAGE', 'CONTACT_LOOKUP', 'REMINDER_SET',
        'INSIGHT_VIEW', 'INSIGHT_CONTROL', 'CONTRACT_DRAFT',
        'MCTS_SIMULATE', 'KNOWLEDGE_QUERY', 'KNOWLEDGE_ADD',
      ],
      status: 'ACTIVE',
      metadata: {
        maxSessions: 999,
        currentSessions: 1,
        totalRequests: 0,
      },
      createdAt: Date.now(),
      expiresAt: null,
      lastActiveAt: Date.now(),
    };

    this.entities.set(master.id, master);
    return master;
  }

  private createFullPermissions(): Permission[] {
    const resources: ResourceType[] = [
      'CHAT', 'KNOWLEDGE', 'CALENDAR', 'CONTACTS', 'DOCUMENTS',
      'INSIGHT', 'CONTRACTS', 'MCTS', 'VAULT', 'SETTINGS',
    ];

    return resources.map(resource => ({
      id: `perm_${resource.toLowerCase()}_full`,
      resource,
      actions: ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'ADMIN'],
      scope: 'ALL',
    }));
  }

  // ============ 子体管理 ============

  async createClone(config: {
    name: string;
    type?: EntityType;
    capabilities: Capability[];
    permissions?: Partial<Permission>[];
    expiresIn?: number;  // 毫秒
    ipRestrictions?: string[];
    maxSessions?: number;
    ownerId?: string;
  }): Promise<SwarmEntity> {
    const entityId = `entity_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const permissions = config.permissions?.map((p, idx) => ({
      id: `perm_${entityId}_${idx}`,
      resource: p.resource || 'CHAT' as ResourceType,
      actions: p.actions || ['READ'] as ActionType[],
      scope: p.scope || 'RESTRICTED' as PermissionScope,
      conditions: p.conditions,
    })) || this.createDefaultPermissions(config.capabilities);

    const entity: SwarmEntity = {
      id: entityId,
      name: config.name,
      type: config.type || 'CLONE',
      parentId: this.masterEntity.id,
      ownerId: config.ownerId || 'TEAM',
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

    this.entities.set(entityId, entity);
    this.emit('entity_created', entity);

    // 保存到数据库
    await this.saveEntityToDb(entity);

    // 审计日志
    await this.logAudit({
      entityId: this.masterEntity.id,
      tokenId: null,
      action: 'CREATE_CLONE',
      resource: 'ENTITY',
      outcome: 'SUCCESS',
      details: { cloneId: entityId, name: config.name, capabilities: config.capabilities },
    });

    log(`创建子体: ${config.name} (${entityId})`);
    return entity;
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
        scope: 'TEAM',
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
        scope: 'TEAM',
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

  async suspendEntity(entityId: string, reason?: string): Promise<void> {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`实体不存在: ${entityId}`);
    if (entity.type === 'MASTER') throw new Error('不能暂停主体');

    entity.status = 'SUSPENDED';
    entity.lastActiveAt = Date.now();
    this.emit('entity_suspended', { entityId, reason });

    // 保存到数据库
    await this.saveEntityToDb(entity);

    await this.logAudit({
      entityId: this.masterEntity.id,
      tokenId: null,
      action: 'SUSPEND_ENTITY',
      resource: 'ENTITY',
      outcome: 'SUCCESS',
      details: { targetId: entityId, reason },
    });

    // 撤销相关令牌
    const tokenValues = Array.from(this.tokens.values());
    for (const token of tokenValues) {
      if (token.entityId === entityId) {
        token.status = 'REVOKED';
        await this.saveTokenToDb(token);
      }
    }

    log(`暂停子体: ${entityId}`);
  }

  async revokeEntity(entityId: string): Promise<void> {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`实体不存在: ${entityId}`);
    if (entity.type === 'MASTER') throw new Error('不能召回主体');

    entity.status = 'REVOKED';
    entity.lastActiveAt = Date.now();
    this.emit('entity_revoked', entityId);

    // 保存到数据库
    await this.saveEntityToDb(entity);

    await this.logAudit({
      entityId: this.masterEntity.id,
      tokenId: null,
      action: 'REVOKE_ENTITY',
      resource: 'ENTITY',
      outcome: 'SUCCESS',
      details: { targetId: entityId },
    });

    log(`召回子体: ${entityId}`);
  }

  async reactivateEntity(entityId: string): Promise<void> {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`实体不存在: ${entityId}`);

    if (entity.expiresAt && entity.expiresAt < Date.now()) {
      throw new Error('实体已过期，需重新创建');
    }

    entity.status = 'ACTIVE';
    entity.lastActiveAt = Date.now();
    this.emit('entity_reactivated', entityId);

    // 保存到数据库
    await this.saveEntityToDb(entity);

    log(`重新激活子体: ${entityId}`);
  }

  listEntities(filter?: { type?: EntityType; status?: EntityStatus }): SwarmEntity[] {
    let entities = Array.from(this.entities.values());

    if (filter?.type) {
      entities = entities.filter(e => e.type === filter.type);
    }
    if (filter?.status) {
      entities = entities.filter(e => e.status === filter.status);
    }

    return entities;
  }

  getEntity(entityId: string): SwarmEntity | undefined {
    return this.entities.get(entityId);
  }

  // ============ 令牌管理 ============

  async issueToken(config: {
    entityId: string;
    type: TokenType;
    expiresIn: number;  // 毫秒
    maxUsage?: number;
  }): Promise<AccessToken> {
    const entity = this.entities.get(config.entityId);
    if (!entity) throw new Error(`实体不存在: ${config.entityId}`);
    if (entity.status !== 'ACTIVE') throw new Error('实体未激活');

    const tokenId = `token_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const tokenValue = crypto.randomBytes(32).toString('base64url');

    const token: AccessToken = {
      id: tokenId,
      entityId: config.entityId,
      token: tokenValue,
      type: config.type,
      permissions: entity.permissions.map(p => p.id),
      issuedAt: Date.now(),
      expiresAt: Date.now() + config.expiresIn,
      usageCount: 0,
      maxUsage: config.maxUsage || null,
      lastUsedAt: null,
      status: 'ACTIVE',
    };

    this.tokens.set(tokenId, token);
    this.emit('token_issued', { tokenId, entityId: config.entityId });

    // 保存到数据库
    await this.saveTokenToDb(token);

    log(`签发令牌: ${tokenId} for ${config.entityId}`);
    return token;
  }

  async validateToken(tokenValue: string): Promise<{
    valid: boolean;
    entity?: SwarmEntity;
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

    const entity = this.entities.get(token.entityId);
    if (!entity || entity.status !== 'ACTIVE') {
      return { valid: false, reason: '关联实体无效' };
    }

    // 更新使用统计
    token.usageCount++;
    token.lastUsedAt = Date.now();
    entity.lastActiveAt = Date.now();
    entity.metadata.totalRequests = (entity.metadata.totalRequests || 0) + 1;
    entity.metadata.lastRequestAt = Date.now();

    // 保存到数据库
    await this.saveTokenToDb(token);
    await this.saveEntityToDb(entity);

    return { valid: true, entity, token };
  }

  async revokeToken(tokenId: string): Promise<void> {
    const token = this.tokens.get(tokenId);
    if (!token) throw new Error(`令牌不存在: ${tokenId}`);

    token.status = 'REVOKED';

    // 保存到数据库
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
    const entity = this.entities.get(entityId);
    if (!entity || entity.status !== 'ACTIVE') return false;

    for (const perm of entity.permissions) {
      if (perm.resource === resource && perm.actions.includes(action)) {
        // 检查条件
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

  // ============ 团队画像 ============

  async createTeam(name: string, leaderEntityId: string): Promise<TeamProfile> {
    const teamId = `team_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const team: TeamProfile = {
      id: teamId,
      name,
      members: [{
        entityId: leaderEntityId,
        role: 'LEADER',
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        stats: this.createEmptyMemberStats(),
      }],
      aggregatedStats: this.createEmptyTeamStats(),
      insights: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.teams.set(teamId, team);

    // 保存到数据库
    await this.saveTeamToDb(team);

    this.emit('team_created', team);
    log(`创建团队: ${name} (${teamId})`);

    return team;
  }

  async addTeamMember(teamId: string, entityId: string, role: 'MEMBER' | 'GUEST' = 'MEMBER'): Promise<void> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error(`团队不存在: ${teamId}`);

    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`实体不存在: ${entityId}`);

    if (team.members.some(m => m.entityId === entityId)) {
      throw new Error('成员已存在于团队中');
    }

    team.members.push({
      entityId,
      role,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      stats: this.createEmptyMemberStats(),
    });

    team.updatedAt = Date.now();
    this.updateTeamStats(team);

    // 保存到数据库
    await this.saveTeamToDb(team);

    log(`添加团队成员: ${entityId} -> ${team.name}`);
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

  private createEmptyTeamStats(): TeamStats {
    return {
      totalMembers: 0,
      activeMembersToday: 0,
      totalRequests24h: 0,
      topCapabilities: [],
      peakHours: [],
      securityIncidents: 0,
    };
  }

  private updateTeamStats(team: TeamProfile): void {
    team.aggregatedStats.totalMembers = team.members.length;
    
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    team.aggregatedStats.activeMembersToday = team.members.filter(
      m => m.lastActiveAt >= oneDayAgo
    ).length;
  }

  async generateTeamInsights(teamId: string): Promise<TeamInsight[]> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error(`团队不存在: ${teamId}`);

    const insights: TeamInsight[] = [];

    // 使用模式分析
    if (team.members.length > 0) {
      const avgTrustScore = team.members.reduce((sum, m) => sum + m.stats.trustScore, 0) / team.members.length;
      
      if (avgTrustScore < 80) {
        insights.push({
          type: 'SECURITY_ALERT',
          title: '团队信任分偏低',
          description: `团队平均信任分 ${avgTrustScore.toFixed(1)}，建议审查异常行为`,
          severity: 'WARNING',
          generatedAt: Date.now(),
        });
      }

      const inactiveMembers = team.members.filter(
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
    }

    team.insights = insights;
    team.updatedAt = Date.now();

    return insights;
  }

  listTeams(): TeamProfile[] {
    return Array.from(this.teams.values());
  }

  getTeam(teamId: string): TeamProfile | undefined {
    return this.teams.get(teamId);
  }

  // ============ 审计日志 ============

  private async logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditEntry = {
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      ...entry,
      timestamp: Date.now(),
    };

    this.auditLog.push(auditEntry);

    // 限制内存中日志数量
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }

    // 同时写入数据库
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

    const entityValues = Array.from(this.entities.values());
    for (const entity of entityValues) {
      if (entity.type !== 'MASTER') {
        try {
          entity.status = 'REVOKED';
          entity.lastActiveAt = Date.now();
          await this.saveEntityToDb(entity);
          recalled++;
        } catch {
          errors++;
        }
      }
    }

    // 撤销所有令牌
    const tokenValues = Array.from(this.tokens.values());
    for (const token of tokenValues) {
      token.status = 'REVOKED';
      await this.saveTokenToDb(token);
    }

    this.emit('emergency_recall', { recalled, errors });

    await this.logAudit({
      entityId: this.masterEntity.id,
      tokenId: null,
      action: 'EMERGENCY_RECALL',
      resource: 'SWARM',
      outcome: 'SUCCESS',
      details: { recalled, errors },
    });

    log(`紧急召回完成: ${recalled} 个子体已召回`);
    return { recalled, errors };
  }

  // ============ 统计 ============

  getStats(): {
    totalEntities: number;
    activeEntities: number;
    totalTokens: number;
    activeTokens: number;
    teams: number;
    auditLogSize: number;
  } {
    return {
      totalEntities: this.entities.size,
      activeEntities: Array.from(this.entities.values()).filter(e => e.status === 'ACTIVE').length,
      totalTokens: this.tokens.size,
      activeTokens: Array.from(this.tokens.values()).filter(t => t.status === 'ACTIVE').length,
      teams: this.teams.size,
      auditLogSize: this.auditLog.length,
    };
  }
}

export const swarmManager = new SwarmManager();
logger.info('[Swarm] 蜂群管理协议 v1.0 已加载 (Phase 11.3)');

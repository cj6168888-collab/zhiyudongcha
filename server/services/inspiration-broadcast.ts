/**
 * Navigator-X 灵感广播服务 (Inspiration Broadcast Service)
 *
 * 核心功能：
 * 1. 捕捉灵感（支持语音）
 * 2. 语义血缘补全
 * 3. 毫秒级推送至所有节点
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('InspirationBroadcast');

import { EventEmitter } from 'events';
import { semanticBloodlineEngine, type EnrichedInspiration } from './semantic-bloodline';
import { commandCenter, type Inspiration } from './command-center';
import { navigatorCore } from './navigator-core';

// ============ 类型定义 ============

export interface BroadcastStatus {
  inspirationId: string;
  status: 'PENDING' | 'BROADCASTING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalNodes: number;
  deliveredNodes: string[];
  failedNodes: string[];
  startTime: number;
  endTime?: number;
  progress: number;  // 0-100
}

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [InspirationBroadcast] ${message}`);
}

// ============ 灵感广播服务类 ============

class InspirationBroadcastService extends EventEmitter {
  private broadcastHistory: BroadcastStatus[] = [];
  private activeBroadcasts: Map<string, BroadcastStatus> = new Map();

  constructor() {
    super();
    log('灵感广播服务已初始化');
  }

  /**
   * 捕捉灵感
   */
  async captureInspiration(voiceText: string): Promise<Inspiration> {
    const source: 'VOICE' | 'TEXT' = voiceText.includes('...') ? 'VOICE' : 'TEXT';
    const inspiration = await commandCenter.captureInspiration(voiceText, source);
    log(`捕捉灵感: ${inspiration.id}`);
    return inspiration;
  }

  /**
   * 语义血缘补全
   */
  async enrichWithBloodline(inspiration: Inspiration): Promise<EnrichedInspiration> {
    const enriched = await commandCenter.enrichWithBloodline(inspiration);
    log(`灵感已语义血缘补全: ${enriched.id}`);
    return enriched;
  }

  /**
   * 广播灵感至所有节点
   */
  async broadcast(enrichedInspiration: EnrichedInspiration): Promise<BroadcastStatus> {
    const status: BroadcastStatus = {
      inspirationId: enrichedInspiration.id,
      status: 'BROADCASTING',
      totalNodes: 0,
      deliveredNodes: [],
      failedNodes: [],
      startTime: Date.now(),
      progress: 0,
    };
    this.activeBroadcasts.set(enrichedInspiration.id, status);

    const nodes = navigatorCore.listNodes({ type: 'NODE', status: 'ACTIVE' });
    status.totalNodes = nodes.length;
    log(`开始广播灵感至 ${nodes.length} 个节点...`);

    for (const node of nodes) {
      try {
        await this.deliverToNode(node.id, enrichedInspiration);
        status.deliveredNodes.push(node.id);
        status.progress = Math.round((status.deliveredNodes.length / status.totalNodes) * 100);
        this.emit('node_delivered', { nodeId: node.id, inspirationId: enrichedInspiration.id });
      } catch (error) {
        status.failedNodes.push(node.id);
        log(`向节点 ${node.name} 广播失败: ${error}`);
      }
    }

    status.endTime = Date.now();
    if (status.failedNodes.length === 0) {
      status.status = 'COMPLETED';
    } else if (status.deliveredNodes.length > 0) {
      status.status = 'PARTIAL';
    } else {
      status.status = 'FAILED';
    }

    this.broadcastHistory.push(status);
    this.activeBroadcasts.delete(enrichedInspiration.id);
    this.emit('broadcast_completed', status);
    log(`灵感广播完成: ${status.deliveredNodes.length}/${status.totalNodes} 成功`);

    return status;
  }

  /**
   * 向单个节点投递
   */
  private async deliverToNode(nodeId: string, inspiration: EnrichedInspiration): Promise<void> {
    const node = navigatorCore.getNode(nodeId);
    if (!node || node.status !== 'ACTIVE') {
      throw new Error(`节点不可用: ${nodeId}`);
    }

    logger.info(`📡 投递灵感至节点 ${node.name} (${nodeId})`);

    // 模拟网络延迟（实际实现中会调用真实的推送服务）
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  /**
   * 获取广播状态
   */
  getBroadcastStatus(inspirationId: string): BroadcastStatus | undefined {
    return this.activeBroadcasts.get(inspirationId) ||
      this.broadcastHistory.find(b => b.inspirationId === inspirationId);
  }

  /**
   * 获取广播历史
   */
  getBroadcastHistory(limit: number = 20): BroadcastStatus[] {
    return this.broadcastHistory.slice(-limit);
  }

  /**
   * 获取活跃广播
   */
  getActiveBroadcasts(): BroadcastStatus[] {
    return Array.from(this.activeBroadcasts.values());
  }
}

// 导出单例
export const inspirationBroadcast = new InspirationBroadcastService();
logger.info('[InspirationBroadcast] 灵感广播服务已加载 (Navigator-X)');

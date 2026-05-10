/**
 * Navigator-X 算力配给服务 (Compute Allocator Service)
 *
 * 核心功能：
 * 1. 按需分配算力
 * 2. 优先级管理
 * 3. 资源调度
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ComputeAllocator');

import { navigatorCore, type ComputeQuota } from './navigator-core';

// ============ 日志函数 ============

function log(message: string) {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logger.info(`${time} [ComputeAllocator] ${message}`);
}

// ============ 类型定义 ============

export interface ComputeAllocation {
  nodeId: string;
  nodeName: string;
  priority: number;      // 0-100
  allocatedOps: number;   // 分配的并发操作数
  currentUsage: number;   // 当前使用量
  availableOps: number;  // 可用操作数
  lastUpdated: number;
}

export interface ComputeRequest {
  nodeId: string;
  requiredOps: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  duration?: number;  // 预计持续时间(ms)
}

// ============ 算力配给服务类 ============

class ComputeAllocatorService {
  private allocations: Map<string, ComputeAllocation> = new Map();
  private totalCapacity: number = 1000;  // 总算力容量
  private reservedCapacity: number = 200;  // 为主权端保留的算力

  constructor() {
    log('算力配给服务已初始化');
    this.initializeAllocations();
  }

  /**
   * 初始化分配
   */
  private initializeAllocations(): void {
    // 为所有活跃节点初始化分配
    const nodes = navigatorCore.listNodes({ status: 'ACTIVE' });

    for (const node of nodes) {
      this.allocations.set(node.id, {
        nodeId: node.id,
        nodeName: node.name,
        priority: node.type === 'SOVEREIGN' ? 80 : 60,
        allocatedOps: node.type === 'SOVEREIGN' ? 100 : 50,
        currentUsage: 0,
        availableOps: node.type === 'SOVEREIGN' ? 100 : 50,
        lastUpdated: Date.now(),
      });
    }

    log(`已为 ${nodes.length} 个节点初始化算力分配`);
  }

  /**
   * 分配算力
   */
  allocate(request: ComputeRequest): { success: boolean; allocatedOps?: number; message?: string } {
    const allocation = this.allocations.get(request.nodeId);

    if (!allocation) {
      return { success: false, message: '节点不存在' };
    }

    // 检查是否有足够的可用算力
    const availableForNode = this.getAvailableCapacity() + allocation.allocatedOps;

    if (availableForNode < request.requiredOps) {
      // 尝试从其他节点回收算力
      const freedOps = this.reclaimIdleCapacity();
      const totalAvailable = this.getAvailableCapacity() + allocation.allocatedOps;

      if (totalAvailable < request.requiredOps) {
        return {
          success: false,
          message: `算力不足，需要 ${request.requiredOps}，可用 ${totalAvailable}`
        };
      }
    }

    // 执行分配
    allocation.allocatedOps += request.requiredOps;
    allocation.lastUpdated = Date.now();

    log(`为节点 ${allocation.nodeName} 分配 ${request.requiredOps} 算力`);

    return { success: true, allocatedOps: request.requiredOps };
  }

  /**
   * 释放算力
   */
  release(nodeId: string, ops?: number): void {
    const allocation = this.allocations.get(nodeId);

    if (!allocation) return;

    const toRelease = ops || allocation.currentUsage;
    allocation.allocatedOps = Math.max(0, allocation.allocatedOps - toRelease);
    allocation.availableOps = allocation.allocatedOps - allocation.currentUsage;
    allocation.lastUpdated = Date.now();

    log(`从节点 ${allocation.nodeName} 释放 ${toRelease} 算力`);
  }

  /**
   * 调整优先级
   */
  adjustPriority(nodeId: string, newPriority: number): void {
    const allocation = this.allocations.get(nodeId);

    if (!allocation) return;

    allocation.priority = Math.min(100, Math.max(0, newPriority));
    allocation.lastUpdated = Date.now();

    // 如果提高了优先级，尝试从低优先级节点回收算力
    if (newPriority > 60) {
      this.rebalanceCapacity();
    }

    log(`节点 ${allocation.nodeName} 优先级调整为 ${newPriority}`);
  }

  /**
   * 获取可用算力
   */
  private getAvailableCapacity(): number {
    const used = Array.from(this.allocations.values())
      .reduce((sum, a) => sum + a.allocatedOps, 0);

    return Math.max(0, this.totalCapacity - this.reservedCapacity - used);
  }

  /**
   * 回收空闲算力
   */
  private reclaimIdleCapacity(): number {
    let reclaimed = 0;

    for (const allocation of this.allocations.values()) {
      if (allocation.currentUsage === 0 && allocation.priority < 60) {
        reclaimed += allocation.allocatedOps;
        allocation.allocatedOps = 0;
        allocation.availableOps = 0;
      }
    }

    if (reclaimed > 0) {
      log(`回收空闲算力: ${reclaimed}`);
    }

    return reclaimed;
  }

  /**
   * 重新平衡算力
   */
  private rebalanceCapacity(): void {
    const allocations = Array.from(this.allocations.values())
      .sort((a, b) => b.priority - a.priority);

    const available = this.getAvailableCapacity();
    const highPriorityCount = allocations.filter(a => a.priority >= 70).length;

    // 为高优先级节点分配更多算力
    if (highPriorityCount > 0 && available > 0) {
      const bonusPerNode = Math.floor(available / highPriorityCount / 2);

      for (const allocation of allocations) {
        if (allocation.priority >= 70 && bonusPerNode > 0) {
          allocation.allocatedOps += bonusPerNode;
          allocation.availableOps = allocation.allocatedOps - allocation.currentUsage;
        }
      }
    }

    log('算力已重新平衡');
  }

  /**
   * 获取节点分配信息
   */
  getAllocation(nodeId: string): ComputeAllocation | undefined {
    return this.allocations.get(nodeId);
  }

  /**
   * 获取所有分配
   */
  getAllAllocations(): ComputeAllocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * 获取总览统计
   */
  getStats(): {
    totalCapacity: number;
    reservedCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    activeNodes: number;
    utilizationRate: number;
  } {
    const allocations = Array.from(this.allocations.values());
    const usedCapacity = allocations.reduce((sum, a) => sum + a.allocatedOps, 0);
    const effectiveCapacity = this.totalCapacity - this.reservedCapacity;

    return {
      totalCapacity: this.totalCapacity,
      reservedCapacity: this.reservedCapacity,
      usedCapacity,
      availableCapacity: this.getAvailableCapacity(),
      activeNodes: allocations.filter(a => a.currentUsage > 0).length,
      utilizationRate: effectiveCapacity > 0 ? (usedCapacity / effectiveCapacity) * 100 : 0,
    };
  }

  /**
   * 设置总容量
   */
  setTotalCapacity(capacity: number): void {
    this.totalCapacity = capacity;
    log(`总算力容量调整为 ${capacity}`);
  }

  /**
   * 设置保留容量
   */
  setReservedCapacity(capacity: number): void {
    this.reservedCapacity = Math.min(capacity, this.totalCapacity * 0.5);  // 最多保留50%
    log(`保留算力调整为 ${this.reservedCapacity}`);
  }
}

// 导出单例
export const computeAllocator = new ComputeAllocatorService();
logger.info('[ComputeAllocator] 算力配给服务已加载 (Navigator-X)');

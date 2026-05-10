/**
 * 人员管理服务
 * 封装人员相关的业务逻辑，包括创建、更新、删除和关系分析
 * 使用PersonStorage进行数据访问，处理记忆创建和广播通知
 */

import { createServiceLogger } from '../lib/logger';
import { personStorage } from '../storage/domains';
import { shadowMemoryRepository } from '../repositories/memory.repository';
import type { Person, InsertPerson, RelationshipInsight } from '@shared/schema';

const logger = createServiceLogger('PersonService');

export class PersonService {
  /**
   * 获取所有人员
   */
  async getAllPersons(accessLevel?: string): Promise<Person[]> {
    return await personStorage.getAllPersons(accessLevel);
  }

  /**
   * 获取指定ID的人员
   */
  async getPerson(id: string): Promise<Person | undefined> {
    return await personStorage.getPerson(id);
  }

  /**
   * 创建新人员
   */
  async createPerson(
    personData: InsertPerson,
    options?: {
      createMemory?: boolean;
      broadcastDataChange?: (entity: string, action: 'CREATE' | 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<Person> {
    const person = await personStorage.createPerson(personData);

    if (options?.createMemory !== false) {
      await shadowMemoryRepository.create({
        context: `添加新联系人：${person.name}，角色：${person.role || '未知'}，组织：${person.organization || '未知'}`,
        choiceMade: 'CREATE_PERSON',
        field: 'relationship_management',
        expPoints: 5,
        mimicryWeight: 0.6,
      });
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('person', 'CREATE', { id: person.id, name: person.name });
    }

    logger.info({ personId: person.id, personName: person.name }, '人员创建成功');
    return person;
  }

  /**
   * 更新人员信息
   */
  async updatePerson(
    id: string,
    updates: Partial<InsertPerson>,
    options?: {
      broadcastDataChange?: (entity: string, action: 'UPDATE' | 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<Person | undefined> {
    const person = await personStorage.updatePerson(id, updates);
    if (!person) {
      return undefined;
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('person', 'UPDATE', { id: person.id, name: person.name });
    }

    logger.debug({ personId: id }, '人员更新成功');
    return person;
  }

  /**
   * 删除人员
   */
  async deletePerson(
    id: string,
    options?: {
      broadcastDataChange?: (entity: string, action: 'DELETE', data: Record<string, unknown>) => void;
    }
  ): Promise<boolean> {
    const success = await personStorage.deletePerson(id);
    if (success && options?.broadcastDataChange) {
      options.broadcastDataChange('person', 'DELETE', { id });
    }
    logger.debug({ personId: id }, success ? '人员删除成功' : '人员删除失败');
    return success;
  }

  /**
   * 根据弱点关键词搜索人员
   */
  async searchPersonsByWeakness(keyword: string): Promise<Person[]> {
    return await personStorage.searchPersonsByWeakness(keyword);
  }

  /**
   * 查找冲突关系
   */
  async findConflictingRelationships(personId: string): Promise<Person[]> {
    return await personStorage.findConflictingRelationships(personId);
  }

  /**
   * 获取关系洞察
   */
  async getRelationshipInsight(personName: string): Promise<RelationshipInsight | null> {
    return await personStorage.getRelationshipInsight(personName);
  }

  /**
   * 根据审批状态获取人员
   */
  async getPersonsByApprovalStatus(status: string): Promise<Person[]> {
    return await personStorage.getPersonsByApprovalStatus(status);
  }

  /**
   * 更新人员审批状态
   */
  async updatePersonApproval(
    id: string,
    approvalStatus: string,
    options?: {
      createMemory?: boolean;
      broadcastDataChange?: (entity: string, action: 'UPDATE', data: Record<string, unknown>) => void;
      auditAction?: (action: string, role: string, entity: string, entityId: string, details: Record<string, unknown>, result: string, req?: unknown) => Promise<void>;
      userRole?: string;
      request?: unknown;
    }
  ): Promise<Person | undefined> {
    const person = await personStorage.updatePerson(id, { approvalStatus });
    if (!person) {
      return undefined;
    }

    if (options?.createMemory !== false) {
      await shadowMemoryRepository.create({
        context: `审批联系人${person.name}：${approvalStatus}`,
        choiceMade: `APPROVE_${approvalStatus}`,
        rejectedOptions: ['CONFIRMED', 'ON_HOLD', 'DELETED', 'PENDING'].filter(s => s !== approvalStatus),
        field: 'approval_decision',
        expPoints: 10,
        mimicryWeight: 0.8,
      });
    }

    if (options?.auditAction) {
      await options.auditAction(
        'anchor_approval',
        options.userRole || 'MASTER',
        'person',
        id,
        { newStatus: approvalStatus },
        'SUCCESS',
        options.request
      );
    }

    if (options?.broadcastDataChange) {
      options.broadcastDataChange('persons', 'UPDATE', { id: person.id, approvalStatus });
    }

    logger.info({ personId: id, approvalStatus }, '人员审批状态更新成功');
    return person;
  }

  /**
   * 根据组织获取人员
   */
  async getPersonsByOrganization(organization: string): Promise<Person[]> {
    return await personStorage.getPersonsByOrganization(organization);
  }

  /**
   * 更新绑定强度
   */
  async updateBondStrength(id: string, strength: number): Promise<Person | undefined> {
    return await personStorage.updatePerson(id, { bondStrength: strength });
  }

  /**
   * 更新最后互动时间
   */
  async updateLastInteraction(id: string): Promise<Person | undefined> {
    return await personStorage.updatePerson(id, { lastInteraction: new Date() });
  }
}

// 创建并导出全局实例
export const personService = new PersonService();

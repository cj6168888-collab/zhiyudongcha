import { createServiceLogger } from '../lib/logger';
import type { IStorage } from '../storage';
import type { Email, Project, Person } from '@shared/schema';

const logger = createServiceLogger('ContextGatherer');

export interface AvatarContext {
  emailSummary: string;
  projectSummary: string;
  personSummary: string;
  recentActivity: string;
  emotionalContext: string;
  fullContext: string;
}

/**
 * Gather comprehensive context from various data sources for the avatar
 */
export async function gatherAvatarContext(
  storage: IStorage,
  _currentMessage?: string
): Promise<AvatarContext> {
  const context: AvatarContext = {
    emailSummary: '',
    projectSummary: '',
    personSummary: '',
    recentActivity: '',
    emotionalContext: '',
    fullContext: '',
  };

  // Get email summary
  context.emailSummary = await getEmailSummary(storage);

  // Get project summary
  context.projectSummary = await getProjectSummary(storage);

  // Get person summary
  context.personSummary = await getPersonSummary(storage);

  // Get recent activity
  context.recentActivity = await getRecentActivity(storage);

  // Build full context
  context.fullContext = buildFullContext(context);

  return context;
}

async function getEmailSummary(storage: IStorage): Promise<string> {
  try {
    const emailStats = await storage.getEmailStats?.();
    if (!emailStats) {
      return '暂无';
    }

    const parts: string[] = [];
    if (emailStats.unreadCount > 0) {
      parts.push(`${emailStats.unreadCount}封未读邮件`);
    }
    if (emailStats.invoiceCount > 0) {
      parts.push(`${emailStats.invoiceCount}封发票邮件待处理`);
    }
    if (emailStats.totalEmails > 0) {
      parts.push(`共${emailStats.totalEmails}封邮件`);
    }

    return parts.length > 0 ? parts.join('，') : '暂无邮件';
  } catch (error) {
    logger.error({ err: error }, 'Failed to get email summary');
    return '邮件系统暂不可用';
  }
}

async function getProjectSummary(storage: IStorage): Promise<string> {
  try {
    const projects = await storage.getProjects?.();
    if (!projects || projects.length === 0) {
      return '暂无项目';
    }

    const activeProjects = projects.filter(
      (p: Project) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
    );

    if (activeProjects.length === 0) {
      return '暂无进行中的项目';
    }

    const topProjects = activeProjects.slice(0, 3);
    const projectList = topProjects
      .map((p: Project) => `- ${p.title} [${p.status}]`)
      .join('\n');

    return `${activeProjects.length}个进行中的项目:\n${projectList}`;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get project summary');
    return '项目系统暂不可用';
  }
}

async function getPersonSummary(storage: IStorage): Promise<string> {
  try {
    const persons = await storage.getAllPersons?.();
    if (!persons || persons.length === 0) {
      return '人脉网络为空';
    }

    const vipPersons = persons.filter(
      (p: Person) => p.accessLevel === 'zone_red' || p.accessLevel === 'zone_blue'
    );

    if (vipPersons.length > 0) {
      const details = vipPersons
        .slice(0, 3)
        .map((p: Person) => `${p.name} (${p.role || '未知'}) - ${p.organization || '未知组织'}`)
        .join('\n');

      return `人脉网络: ${persons.length}人, ${vipPersons.length}位核心人物\n${details}`;
    }

    return `人脉网络: ${persons.length}人`;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get person summary');
    return '人脉系统暂不可用';
  }
}

async function getRecentActivity(storage: IStorage): Promise<string> {
  try {
    const inspirations = await storage.getActiveInspirations?.();
    if (!inspirations || inspirations.length === 0) {
      return '';
    }

    return `${inspirations.length}条待处理的灵感/任务`;
  } catch {
    return '';
  }
}

function buildFullContext(context: AvatarContext): string {
  const lines: string[] = ['【当前态势 - 实时数据】'];

  lines.push(`📧 邮件: ${context.emailSummary}`);
  lines.push(`📋 项目: ${context.projectSummary}`);
  lines.push(`👥 人脉: ${context.personSummary}`);

  if (context.recentActivity) {
    lines.push(`💡 待办: ${context.recentActivity}`);
  }

  if (context.emotionalContext) {
    lines.push(`💗 情感记忆: ${context.emotionalContext}`);
  }

  lines.push('');
  lines.push('基于以上真实数据回答主人的问题。');

  return lines.join('\n');
}

/**
 * Get detailed email context
 */
export async function getEmailContext(
  storage: IStorage,
  limit: number = 10
): Promise<string> {
  try {
    const emails = await storage.getAllEmails?.({ limit });
    if (!emails || emails.length === 0) {
      return '当前没有邮件记录。';
    }

    const emailList = emails
      .map((e: Email, i: number) => {
        const dateStr = e.receivedAt
          ? new Date(e.receivedAt).toLocaleDateString('zh-CN')
          : '未知时间';
        return `${i + 1}. [${e.isRead ? '已读' : '未读'}] ${e.fromName || e.fromEmail}: ${e.subject || '(无主题)'} - ${e.category || '未分类'} - ${dateStr}`;
      })
      .join('\n');

    return `邮件列表 (共${emails.length}封):\n${emailList}`;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get email context');
    return '无法获取邮件数据。';
  }
}

/**
 * Get detailed person context
 */
export async function getPersonContext(
  storage: IStorage,
  personName?: string
): Promise<string> {
  try {
    const persons = await storage.getAllPersons?.();
    if (!persons || persons.length === 0) {
      return '人脉网络为空。';
    }

    if (personName) {
      const matched = persons.filter(
        (p: Person) =>
          p.name?.includes(personName) || p.organization?.includes(personName)
      );

      if (matched.length > 0) {
        return matched
          .map((p: Person) => {
            const interestChain = Array.isArray(p.interestChain)
              ? p.interestChain.join(', ')
              : '未记录';
            return `【${p.name}】\n组织: ${p.organization || '未知'}\n角色: ${p.role || '未知'}\n关系层级: ${p.accessLevel}\n弱点: ${p.weakness || '未记录'}\n利益链: ${interestChain}`;
          })
          .join('\n\n');
      }

      return `未找到名为"${personName}"的联系人。`;
    }

    const summary = persons
      .slice(0, 5)
      .map((p: Person) => `- ${p.name} (${p.organization || '未知组织'}) [${p.accessLevel}]`)
      .join('\n');

    const moreText = persons.length > 5 ? `\n...还有${persons.length - 5}人` : '';
    return `人脉网络 (共${persons.length}人):\n${summary}${moreText}`;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get person context');
    return '无法获取人脉数据。';
  }
}

/**
 * Get detailed project context
 */
export async function getProjectContext(storage: IStorage): Promise<string> {
  try {
    const projects = await storage.getProjects?.();
    if (!projects || projects.length === 0) {
      return '暂无项目记录。';
    }

    const projectList = projects
      .map((p: Project, i: number) => `${i + 1}. ${p.title} [${p.status}] - ${p.description || '无描述'}`)
      .join('\n');

    return `项目列表 (共${projects.length}个):\n${projectList}`;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get project context');
    return '无法获取项目数据。';
  }
}

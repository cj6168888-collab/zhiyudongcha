import type { IStorage } from '../storage';

export interface AvatarContext {
  emailSummary: string;
  projectSummary: string;
  personSummary: string;
  recentActivity: string;
  fullContext: string;
}

export async function gatherAvatarContext(storage: IStorage): Promise<AvatarContext> {
  const context: AvatarContext = {
    emailSummary: '',
    projectSummary: '',
    personSummary: '',
    recentActivity: '',
    fullContext: '',
  };

  try {
    const emailStats = await storage.getEmailStats?.();
    if (emailStats) {
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
      context.emailSummary = parts.length > 0 ? parts.join('，') : '暂无邮件';
    }

    const recentEmails = await storage.getAllEmails?.({ limit: 5, isRead: false });
    let emailDetails = '';
    if (recentEmails && recentEmails.length > 0) {
      emailDetails = recentEmails.map((e: any) => 
        `- ${e.fromName || e.fromEmail}: ${e.subject || '(无主题)'} [${e.category || '未分类'}]`
      ).join('\n');
    }
  } catch (e) {
    context.emailSummary = '邮件系统暂不可用';
  }

  try {
    const projects = await storage.getProjects?.();
    if (projects && projects.length > 0) {
      const activeProjects = projects.filter((p: any) => 
        p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
      );
      if (activeProjects.length > 0) {
        context.projectSummary = `${activeProjects.length}个进行中的项目`;
        const topProjects = activeProjects.slice(0, 3).map((p: any) => 
          `- ${p.title} [${p.status}]`
        ).join('\n');
        context.projectSummary += `:\n${topProjects}`;
      } else {
        context.projectSummary = '暂无进行中的项目';
      }
    } else {
      context.projectSummary = '暂无项目';
    }
  } catch (e) {
    context.projectSummary = '项目系统暂不可用';
  }

  try {
    const persons = await storage.getAllPersons?.();
    if (persons && persons.length > 0) {
      const vipPersons = persons.filter((p: any) => 
        p.accessLevel === 'ZONE_RED' || p.accessLevel === 'ZONE_BLUE'
      );
      context.personSummary = `人脉网络: ${persons.length}人`;
      if (vipPersons.length > 0) {
        context.personSummary += `，其中${vipPersons.length}位核心人物`;
      }
    } else {
      context.personSummary = '人脉网络为空';
    }
  } catch (e) {
    context.personSummary = '人脉系统暂不可用';
  }

  try {
    const inspirations = await storage.getActiveInspirations?.();
    if (inspirations && inspirations.length > 0) {
      context.recentActivity = `${inspirations.length}条待处理的灵感/任务`;
    }
  } catch (e) {
  }

  context.fullContext = `【当前态势 - 实时数据】
📧 邮件: ${context.emailSummary}
📋 项目: ${context.projectSummary}
👥 人脉: ${context.personSummary}
${context.recentActivity ? `💡 待办: ${context.recentActivity}` : ''}

基于以上真实数据回答主人的问题。如果主人询问具体数据，请引用上述信息。`;

  return context;
}

export async function getEmailContext(storage: IStorage, limit: number = 10): Promise<string> {
  try {
    const emails = await storage.getAllEmails?.({ limit });
    if (!emails || emails.length === 0) {
      return '当前没有邮件记录。';
    }

    const emailList = emails.map((e: any, i: number) => 
      `${i + 1}. [${e.isRead ? '已读' : '未读'}] ${e.fromName || e.fromEmail}: ${e.subject || '(无主题)'} - ${e.category || '未分类'} - ${e.receivedAt ? new Date(e.receivedAt).toLocaleDateString('zh-CN') : '未知时间'}`
    ).join('\n');

    return `邮件列表 (共${emails.length}封):\n${emailList}`;
  } catch (e) {
    return '无法获取邮件数据。';
  }
}

export async function getPersonContext(storage: IStorage, personName?: string): Promise<string> {
  try {
    const persons = await storage.getAllPersons?.();
    if (!persons || persons.length === 0) {
      return '人脉网络为空。';
    }

    if (personName) {
      const matched = persons.filter((p: any) => 
        p.name?.includes(personName) || p.company?.includes(personName)
      );
      if (matched.length > 0) {
        return matched.map((p: any) => 
          `【${p.name}】\n公司: ${p.company || '未知'}\n职位: ${p.title || '未知'}\n关系层级: ${p.accessLevel}\n弱点: ${p.weakness || '未记录'}\n利益链: ${p.interestChains?.join(', ') || '未记录'}`
        ).join('\n\n');
      }
      return `未找到名为"${personName}"的联系人。`;
    }

    const summary = persons.slice(0, 5).map((p: any) => 
      `- ${p.name} (${p.company || '未知公司'}) [${p.accessLevel}]`
    ).join('\n');

    return `人脉网络 (共${persons.length}人):\n${summary}${persons.length > 5 ? `\n...还有${persons.length - 5}人` : ''}`;
  } catch (e) {
    return '无法获取人脉数据。';
  }
}

export async function getProjectContext(storage: IStorage): Promise<string> {
  try {
    const projects = await storage.getProjects?.();
    if (!projects || projects.length === 0) {
      return '暂无项目记录。';
    }

    const projectList = projects.map((p: any, i: number) => 
      `${i + 1}. ${p.title} [${p.status}] - ${p.description || '无描述'}`
    ).join('\n');

    return `项目列表 (共${projects.length}个):\n${projectList}`;
  } catch (e) {
    return '无法获取项目数据。';
  }
}

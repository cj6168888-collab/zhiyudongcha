import { describe, expect, it } from 'vitest';
import { hybridAssistant, type UserMessage } from '../../../services/assistant/HybridAssistant';

function message(content: string): UserMessage {
  return {
    id: `msg-${Math.random()}`,
    content,
    type: 'text',
    source: 'app',
    timestamp: new Date(),
  };
}

describe('HybridAssistant core action parsing', () => {
  it('parses project creation before generic intent matching', async () => {
    const response = await hybridAssistant.processMessage(
      message('帮我创建一个名为R1验收项目的项目，描述是第一产品闭环真实环境验收。'),
    );

    expect(response.type).toBe('execute');
    expect(response.action).toBe('create_project');
    expect(response.actionParams).toMatchObject({
      title: 'R1验收项目',
      description: '第一产品闭环真实环境验收',
    });
  });

  it('parses task creation even when the description contains navigation-like words', async () => {
    const response = await hybridAssistant.processMessage(
      message('帮我创建一个任务，名字叫R1验收任务，描述是验证聊天到任务写入。'),
    );

    expect(response.type).toBe('execute');
    expect(response.action).toBe('create_task');
    expect(response.actionParams).toMatchObject({
      name: 'R1验收任务',
      description: '验证聊天到任务写入',
      triggerType: 'MANUAL',
    });
  });

  it('parses memory saves as an executable action', async () => {
    const response = await hybridAssistant.processMessage(
      message('请记住，R1闭环已经进入真实验收。'),
    );

    expect(response.type).toBe('execute');
    expect(response.action).toBe('save_memory');
    expect(response.actionParams).toMatchObject({
      content: 'R1闭环已经进入真实验收',
    });
  });

  it('routes phone-to-PC execution requests before mobile navigation intent', async () => {
    const response = await hybridAssistant.processMessage(
      message('让PC端执行一次连通性测试，并把结果回传到手机端'),
    );

    expect(response.type).toBe('confirm');
    expect(response.action).toBe('pc_execute');
    expect(response.actionParams).toMatchObject({
      type: 'system_optimize',
      description: '执行一次连通性测试，并把结果回传到手机端',
    });
    expect(response.authorization?.operation).toBe('pc_execute');
  });

  it.each([
    {
      text: '新增项目：客户成功系统，说明是把回访和续费统一管理。',
      action: 'create_project',
      params: { title: '客户成功系统', description: '把回访和续费统一管理' },
    },
    {
      text: '建立一个项目 供应链预警，备注是先做最小预警看板。',
      action: 'create_project',
      params: { title: '供应链预警', description: '先做最小预警看板' },
    },
    {
      text: '添加任务：整理R1发布清单，说明是发布前逐项核对。',
      action: 'create_task',
      params: { name: '整理R1发布清单', description: '发布前逐项核对', triggerType: 'MANUAL' },
    },
    {
      text: '新建任务 跟进合同盖章，备注是明天下午前确认。',
      action: 'create_task',
      params: { name: '跟进合同盖章', description: '明天下午前确认', triggerType: 'MANUAL' },
    },
    {
      text: '帮我记下：客户更关注交付确定性，不只是功能数量。',
      action: 'save_memory',
      params: { content: '客户更关注交付确定性，不只是功能数量' },
    },
  ])('keeps Chinese business command stable: $text', async ({ text, action, params }) => {
    const response = await hybridAssistant.processMessage(message(text));

    expect(response.type).toBe('execute');
    expect(response.action).toBe(action);
    expect(response.actionParams).toMatchObject(params);
  });

  it.each([
    {
      text: '导航到机场',
      category: 'navigation',
    },
    {
      text: '帮我搜一下高企认定条件',
      category: 'search',
    },
  ])('does not turn unrelated direct intents into persistence actions: $text', async ({ text, category }) => {
    const response = await hybridAssistant.processMessage(message(text));

    expect(response.type).toBe('execute');
    expect(response.category).toBe(category);
    expect(response.action).toBeUndefined();
    expect(response.actionParams).toBeUndefined();
  });

  // ── CRON 循环任务 ──────────────────────────────────────────────────────────

  it.each([
    {
      text: '每周一提醒我整理项目战报',
      expectName: '整理项目战报',
      expectExpression: '0 9 * * 1',
    },
    {
      text: '每天早上9点发送日报',
      expectName: '发送日报',
      expectExpression: '0 9 * * *',
    },
    {
      text: '每月1号生成月度总结',
      expectName: '月度总结',
      expectExpression: '0 9 1 * *',
    },
    {
      text: '工作日早上9点检查邮件',
      expectName: '检查邮件',
      expectExpression: '0 9 * * 1-5',
    },
  ])('identifies recurring task and generates CRON trigger: $text', async ({ text, expectName, expectExpression }) => {
    const response = await hybridAssistant.processMessage(message(text));

    expect(response.type).toBe('execute');
    expect(response.action).toBe('create_task');
    expect(response.actionParams?.triggerType).toBe('CRON');
    expect(response.actionParams?.cronExpression).toBe(expectExpression);
    expect(String(response.actionParams?.name)).toContain(expectName);
  });

  it('does not misidentify one-time tasks as CRON', async () => {
    const response = await hybridAssistant.processMessage(
      message('帮我创建一个任务，明天完成R1验收报告'),
    );

    expect(response.action).toBe('create_task');
    expect(response.actionParams?.triggerType).toBe('MANUAL');
    expect(response.actionParams?.cronExpression).toBeUndefined();
  });

  // ── 保险库语义搜索 (阶段四) ────────────────────────────────────────────────

  it.each([
    { text: '找上次那个合同照片', expectQuery: /合同/ },
    { text: '帮我搜一下预算文件', expectQuery: /预算/ },
    { text: '查找之前存的合同资料', expectQuery: /合同/ },
  ])('parses vault search intent: $text', async ({ text, expectQuery }) => {
    const response = await hybridAssistant.processMessage(message(text));

    expect(response.action).toBe('search_vault');
    expect(response.actionParams?.query).toMatch(expectQuery);
    expect(response.category).toBe('知识库');
  });

  it('does not misidentify plain search as vault search', async () => {
    const response = await hybridAssistant.processMessage(
      message('帮我搜一下高企认定条件'),
    );

    // 普通搜索不应触发 search_vault（无文件相关词）
    expect(response.action).not.toBe('search_vault');
  });

  // ── 联系人创建 (阶段二) ────────────────────────────────────────────────────

  it.each([
    { text: '添加联系人张三，职位是产品经理', expectName: '张三', expectRole: /产品经理/ },
    { text: '新增联系人李四，在ABC公司', expectName: '李四', expectOrg: /ABC/ },
    { text: '记录联系人王五', expectName: '王五' },
  ])('parses person creation intent: $text', async ({ text, expectName, expectRole, expectOrg }) => {
    const response = await hybridAssistant.processMessage(message(text));

    expect(response.action).toBe('create_person');
    expect(response.actionParams?.name).toBe(expectName);
    expect(response.category).toBe('联系人');
    if (expectRole) expect(String(response.actionParams?.role ?? '')).toMatch(expectRole);
    if (expectOrg) expect(String(response.actionParams?.organization ?? '')).toMatch(expectOrg);
  });
});

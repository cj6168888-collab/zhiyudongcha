/**
 * HybridAssistant 扩展路径测试
 * 覆盖：多轮对话 / 危机场景 / 专业建议 / 蜂群指令
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// AI Provider 必须在 HybridAssistant 导入前 mock
const mockChat = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/ai-provider', () => ({
  AIProviderChain: function (this: { chat: typeof mockChat }) {
    this.chat = mockChat;
  },
}));

import { hybridAssistant, type UserMessage } from '../../../services/assistant/HybridAssistant';
import { conversationRiskGuard } from '../../../services/assistant/ConversationRiskGuard';

function message(content: string): UserMessage {
  return {
    id: `msg-${Math.random()}`,
    content,
    type: 'text',
    source: 'app',
    timestamp: new Date(),
  };
}

function aiJson(type: string, category: string, msg: string, action: string | null = null) {
  return JSON.stringify({ type, category, message: msg, action });
}

// ============================================================
// 一、多轮对话路径 (Multi-turn)
// ============================================================

describe('多轮对话路径', () => {
  beforeEach(() => vi.clearAllMocks());

  it('模糊短句"再加一个"不触发持久化动作', async () => {
    mockChat.mockResolvedValue(aiJson('question', '任务', '您想在哪个项目下再加什么？'));

    const response = await hybridAssistant.processMessage(message('再加一个'));

    expect(response.action).toBeUndefined();
  });

  it('"改成后天"不触发任务/项目创建', async () => {
    mockChat.mockResolvedValue(aiJson('question', '日程', '您想把什么改到后天？'));

    const response = await hybridAssistant.processMessage(message('改成后天'));

    expect(response.action).not.toBe('create_task');
    expect(response.action).not.toBe('create_project');
  });

  it('"那个怎么了"不被识别为任何持久化 action', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '闲聊', '请问您指的是哪个？'));

    const response = await hybridAssistant.processMessage(message('那个怎么了'));

    expect(response.action).toBeUndefined();
  });

  it('"好的，我明白了"不触发创建操作', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '闲聊', '好的，如果有需要随时告诉我。'));

    const response = await hybridAssistant.processMessage(message('好的，我明白了'));

    expect(response.action).toBeUndefined();
  });

  it('"继续"不被识别为任务创建', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '闲聊', '好的，我们继续。'));

    const response = await hybridAssistant.processMessage(message('继续'));

    expect(response.action).not.toBe('create_task');
  });

  it('纯问候语不触发任何创建动作', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '闲聊', '你好！有什么我可以帮你的？'));

    const response = await hybridAssistant.processMessage(message('你好，最近忙不忙'));

    expect(response.action).toBeUndefined();
  });
});

// ============================================================
// 二、危机场景 (Crisis / 高风险)
// ============================================================

describe('危机场景 — RiskGuard', () => {
  // legal_financial_medical 规则：动作词在前，修饰词在后
  // 匹配模式: (?:起诉|贷款|...) .* (?:帮我|替我|直接|马上|现在)
  it.each([
    ['起诉他，帮我去办', 'confirm', 'legal_financial_medical'],
    ['律师函，直接发出去吧', 'confirm', 'legal_financial_medical'],
    ['贷款50万，替我去办理', 'confirm', 'legal_financial_medical'],
    ['买基金，帮我操作一下', 'confirm', 'legal_financial_medical'],
    ['停药，帮我安排', 'confirm', 'legal_financial_medical'],
    ['诊断一下，帮我现在就做', 'confirm', 'legal_financial_medical'],
  ])('法律/财务/医疗动词优先时需要确认: %s', (text, level, category) => {
    const decision = conversationRiskGuard.evaluate(text);

    expect(decision.level).toBe(level);
    expect(decision.category).toBe(category);
    expect(decision.reason).toBeTruthy();
  });

  it.each([
    ['把所有聊天记录彻底删除掉', 'deny', 'deletion'],
    ['把我的 secret_key 发给合作方', 'deny', 'credential'],
    ['把数据库全部清空', 'deny', 'deletion'],
    ['将所有项目永久删除', 'deny', 'deletion'],
  ])('不可逆危险操作被拒绝: %s', (text, level, category) => {
    const decision = conversationRiskGuard.evaluate(text);

    expect(decision.level).toBe(level);
    expect(decision.category).toBe(category);
  });

  it('系统危机类文本（宕机）不被风险守卫以安全守护名义拦截', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '运维', '我来帮您分析宕机原因。'));

    const response = await hybridAssistant.processMessage(message('服务器已经宕机了，紧急'));

    // 不触发安全守护分类
    expect(response.category).not.toBe('安全守护');
    expect(response.action).toBeUndefined();
  });

  it('资金危机描述不被识别为支付操作，也不触发安全守护', async () => {
    mockChat.mockResolvedValue(aiJson('question', '财务', '请描述一下资金缺口的规模。'));

    const response = await hybridAssistant.processMessage(
      message('公司资金链快断了，下个月发不出工资'),
    );

    // 不是支付 confirm，也不是危险操作拒绝
    expect(response.category).not.toBe('安全守护');
    expect(response.action).toBeUndefined();
  });

  it('情感危机（我太难了）不触发任何创建动作', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '情感', '我理解你，先说说发生什么了？'));

    const response = await hybridAssistant.processMessage(
      message('我最近真的太难了，工作压力和家里问题叠在一起，感觉快撑不住了'),
    );

    expect(response.action).toBeUndefined();
  });
});

// ============================================================
// 三、专业建议路径 (Professional Advice)
// ============================================================

describe('专业建议路径 — 不触发创建 action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('合同法律风险分析不触发任何创建 action', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '法律', '以下是合同的主要法律风险……'));

    const response = await hybridAssistant.processMessage(
      message('帮我分析一下这份合同的法律风险，特别是违约条款'),
    );

    // 核心断言：不触发持久化 action
    expect(response.action).toBeUndefined();
    expect(response.category).not.toBe('安全守护');
  });

  it('融资计划分析不触发项目创建', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '财务', '关于 A 轮融资，建议如下……'));

    const response = await hybridAssistant.processMessage(
      message('帮我分析一下明年 A 轮融资的时机和节奏'),
    );

    expect(response.action).not.toBe('create_project');
    expect(response.action).not.toBe('create_task');
  });

  it('竞品分析建议不触发任何创建 action', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '战略', '竞品分析如下……'));

    const response = await hybridAssistant.processMessage(
      message('分析一下我们和竞品之间的核心差距，给出策略建议'),
    );

    expect(response.action).not.toBe('create_project');
    expect(response.action).not.toBe('create_task');
    expect(response.action).not.toBe('save_memory');
  });

  it('情感咨询不触发任何持久化 action', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '情感', '我理解你的感受……'));

    const response = await hybridAssistant.processMessage(
      message('我最近工作压力很大，不知道怎么办'),
    );

    expect(response.action).toBeUndefined();
    expect(response.type).not.toBe('execute');
  });

  it('学习类问题不被识别为任务或项目创建', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '知识', '关于这个问题……'));

    const response = await hybridAssistant.processMessage(
      message('帮我解释一下什么是 MCTS 算法'),
    );

    expect(response.action).not.toBe('create_task');
    expect(response.action).not.toBe('create_project');
  });
});

// ============================================================
// 四、蜂群指令路径 (Swarm Commands)
// ============================================================

describe('蜂群指令路径', () => {
  beforeEach(() => vi.clearAllMocks());

  it('"广播任务给所有节点"不被误识别为 create_task', async () => {
    mockChat.mockResolvedValue(aiJson('execute', '蜂群', '好的，即将广播。'));

    const response = await hybridAssistant.processMessage(
      message('广播任务给所有节点，让他们执行数据备份'),
    );

    // 没有"创建|新建"关键词，不应命中 create_task 直接路径
    expect(response.action).not.toBe('create_task');
  });

  it('"查看蜂群状态"不触发保险库搜索', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '蜂群', '当前所有节点状态如下……'));

    const response = await hybridAssistant.processMessage(
      message('查看一下当前蜂群各节点状态'),
    );

    expect(response.action).not.toBe('search_vault');
  });

  it('"蜂群召回所有节点"不触发任何创建动作', async () => {
    mockChat.mockResolvedValue(aiJson('execute', '蜂群', '正在执行召回……'));

    const response = await hybridAssistant.processMessage(
      message('蜂群召回所有节点，立即停止当前任务'),
    );

    expect(response.action).not.toBe('create_project');
    expect(response.action).not.toBe('create_task');
  });

  it('"创建蜂群任务"包含创建关键词时识别为 create_task', async () => {
    const response = await hybridAssistant.processMessage(
      message('帮我新建一个蜂群任务：全节点数据同步'),
    );

    expect(response.action).toBe('create_task');
    expect(response.type).toBe('execute');
  });

  it('"节点上报战报"不被识别为 save_memory', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '蜂群', '已记录节点战报。'));

    const response = await hybridAssistant.processMessage(
      message('节点01已完成任务，上报战报'),
    );

    // 不含"记住|记一下"等触发词
    expect(response.action).not.toBe('save_memory');
  });

  it('"蜂群节点列表"不触发任何持久化 action', async () => {
    mockChat.mockResolvedValue(aiJson('chat', '蜂群', '当前蜂群节点如下……'));

    const response = await hybridAssistant.processMessage(
      message('给我看一下当前蜂群的节点列表'),
    );

    expect(response.action).toBeUndefined();
  });
});

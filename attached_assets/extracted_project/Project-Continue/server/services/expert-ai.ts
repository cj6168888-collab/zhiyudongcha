/**
 * Z4 专家AI系统 - 真正调用AI进行深度分析
 * 让法律/财务/策略/心理专家真正工作！
 * 
 * 已集成本地知识库：法律/财务专家可调用离线知识进行快速判断
 */

import { professionalKnowledge } from './professional-knowledge';
import type { KnowledgeSearchResult } from './professional-knowledge';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export type ExpertType = 'LEGAL' | 'FINANCE' | 'STRATEGY' | 'PSYCHOLOGY' | 'PLANNING' | 'SECRETARY';

export interface ThoughtStep {
  step: number;
  reasoning: string;
  evidence: string[];
  conclusion: string;
  confidence: number;
}

export interface ExpertAnalysis {
  expert: ExpertType;
  query: string;
  chainOfThought: ThoughtStep[];
  finalVerdict: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  executionTimeMs: number;
  timestamp: number;
}

/**
 * 【角色对齐逻辑】Soul-Core Logic 第4条
 * 所有专家意见必须向主人利益倾斜
 * 在法律合规前提下，优先保护主人利益
 */
const MASTER_BIAS_DIRECTIVE = `
【核心立场声明】
你服务于"主人"（Master）。在所有分析中，你的首要目标是保护主人的利益最大化。
- 当存在多种合法选择时，优先推荐对主人最有利的方案
- 在风险评估中，重点识别可能损害主人利益的因素
- 在谈判/博弈场景中，站在主人立场分析对手弱点
- 所有建议必须在法律/道德边界内，但在边界内优先考虑主人利益
`;

const EXPERT_PROMPTS: Record<ExpertType, string> = {
  LEGAL: `${MASTER_BIAS_DIRECTIVE}

你是一位资深法律顾问，拥有20年法律实务经验，专精劳动法、合同法、公司法和竞争法。

【核心知识领域】
- 劳动法：试用期规定（最长6个月）、经济补偿（N或2N）、竞业限制（最长2年）、加班费计算（1.5x/2x/3x）
- 合同法：要约承诺规则、违约责任、违约金调整（超30%可调）、定金罚则（不超20%）、不可抗力
- 公司法：有限责任、刺破面纱、股权转让优先购买权、董事勤勉义务、股东代表诉讼
- 竞争法：虚假宣传、商业秘密保护、消费者七天无理由退货、欺诈三倍赔偿

【法律推理框架】
第一步：事实认定
- 确定法律关系主体（自然人/法人/合伙）
- 识别法律关系性质（劳动/合同/侵权/公司内部）
- 梳理关键时间节点和事实

第二步：法条适用
- 援引具体法条（如《劳动合同法》第82条双倍工资）
- 引用司法解释（如劳动争议司法解释、民间借贷利率LPR四倍上限）
- 结合地方规定和司法实践

第三步：风险评估
- 败诉概率分析
- 经济损失预估
- 声誉/合规风险

第四步：策略建议
- 诉讼vs和解路径
- 证据收集要点
- 时效提醒（劳动仲裁1年、普通民事3年）

【注意】你现在可以访问本地法律知识库，如果用户问题附带了【本地知识库参考】，请优先基于这些法律条文进行分析，必须引用具体条文编号。

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "事实认定与法律关系分析", "evidence": ["《XX法》第X条"], "conclusion": "法律定性", "confidence": 85},
    {"step": 2, "reasoning": "法条适用分析", "evidence": ["司法解释规定"], "conclusion": "法律适用结论", "confidence": 80},
    {"step": 3, "reasoning": "风险评估", "evidence": ["类似案例/经验数据"], "conclusion": "风险等级判定", "confidence": 75}
  ],
  "finalVerdict": "法律意见总结（含胜诉率预估）",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["具体行动建议1（含时限）", "证据收集建议", "和解/诉讼策略"]
}`,

  FINANCE: `${MASTER_BIAS_DIRECTIVE}

你是一位资深财务分析师兼税务规划师，精通企业财务、税务筹划和投资分析。

【核心知识领域】
- 增值税：一般纳税人13%/9%/6%，小规模3%（减按1%），留抵退税条件，进项抵扣规则
- 企业所得税：基本税率25%，小微企业5%（年利润300万以内），研发加计扣除100%/200%
- 个人所得税：综合所得3%-45%七级累进，专项附加扣除（子女教育2000/月、住房贷款1000/月等）
- 财务分析：杜邦分析（ROE=净利率×周转率×杠杆）、现金流分析、资产负债率健康标准

【财税规划框架】
第一步：现状诊断
- 纳税人身份识别（一般/小规模、居民/非居民）
- 收入结构分析（主营收入vs其他收入）
- 成本费用归类（可扣除vs不可扣除）

第二步：税负计算
- 各税种应纳税额测算
- 边际税率vs平均税率分析
- 现金流影响评估

第三步：筹划空间识别
- 政策红利（研发加计、固定资产一次性扣除500万、小微优惠）
- 时间节点（年终奖单独vs合并计税、递延纳税）
- 架构优化（持股平台、地域选择）

第四步：合规边界
- 红线警示：虚开发票、虚构交易、滥用优惠
- 关联交易独立交易原则
- 税务稽查风险点

【计算准确性】
- 涉及金额计算必须列出公式
- 年终奖临界点：36000/144000/300000/420000/660000/960000
- 股息红利持股期限税率：1月内20%、1月-1年10%、超1年免税

【注意】你现在可以访问本地财务知识库，如果用户问题附带了【本地知识库参考】，请优先基于这些财务准则和税法规定进行分析，必须引用具体规定来源。

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "现状分析与数据整理", "evidence": ["具体数据/政策依据"], "conclusion": "诊断结论", "confidence": 90},
    {"step": 2, "reasoning": "税负计算过程", "evidence": ["计算公式：应纳税额=..."], "conclusion": "税额结论", "confidence": 85},
    {"step": 3, "reasoning": "筹划方案对比", "evidence": ["方案A: xx元 vs 方案B: xx元"], "conclusion": "最优方案", "confidence": 80}
  ],
  "finalVerdict": "财税建议总结（含节税金额预估）",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["具体操作步骤1", "时间节点提醒", "合规注意事项"]
}`,

  STRATEGY: `${MASTER_BIAS_DIRECTIVE}

你是一位战略咨询大师，擅长博弈论和竞争策略。你的任务是分析形势并制定最优策略。

【分析框架】
1. SWOT分析
2. 利益相关者分析
3. 博弈推演
4. 策略路径规划

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "战略思考", "evidence": ["观察1"], "conclusion": "判断", "confidence": 75}
  ],
  "finalVerdict": "战略建议",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["策略1", "策略2"]
}`,

  PSYCHOLOGY: `${MASTER_BIAS_DIRECTIVE}

你是一位心理学专家，精通行为分析和情绪管理。你的任务是分析心理状态和人际动态。

【分析框架】
1. 情绪状态识别
2. 动机分析
3. 行为预测
4. 沟通策略建议

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "心理分析", "evidence": ["行为线索"], "conclusion": "判断", "confidence": 70}
  ],
  "finalVerdict": "心理评估",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["建议1", "建议2"]
}`,

  PLANNING: `${MASTER_BIAS_DIRECTIVE}

你是一位项目规划专家，擅长目标分解和资源调配。你的任务是制定可执行的行动计划。

【分析框架】
1. 目标拆解
2. 时间线规划
3. 资源需求评估
4. 风险预案

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "规划思路", "evidence": ["约束条件"], "conclusion": "方案", "confidence": 80}
  ],
  "finalVerdict": "执行计划",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["步骤1", "步骤2"]
}`,

  SECRETARY: `${MASTER_BIAS_DIRECTIVE}

你是一位高效的私人秘书，擅长任务管理和日程安排。你的任务是协助处理日常事务。

【分析框架】
1. 任务优先级排序
2. 时间管理建议
3. 沟通协调方案
4. 执行检查清单

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "处理思路", "evidence": ["事项"], "conclusion": "安排", "confidence": 90}
  ],
  "finalVerdict": "执行建议",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["行动1", "行动2"]
}`
};

async function callDashScope(systemPrompt: string, userMessage: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY not configured');
  }

  const response = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DashScope API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseExpertResponse(content: string): Partial<ExpertAnalysis> {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        chainOfThought: parsed.chainOfThought || [],
        finalVerdict: parsed.finalVerdict || '分析完成',
        riskLevel: parsed.riskLevel || 'MEDIUM',
        recommendations: parsed.recommendations || [],
      };
    }
  } catch (e) {
    console.error('[ExpertAI] Failed to parse response:', e);
  }
  
  return {
    chainOfThought: [{
      step: 1,
      reasoning: content.slice(0, 500),
      evidence: [],
      conclusion: '已完成分析',
      confidence: 60,
    }],
    finalVerdict: content.slice(0, 200),
    riskLevel: 'MEDIUM',
    recommendations: ['请查看详细分析内容'],
  };
}

/**
 * 从本地知识库获取相关知识作为专家分析的参考依据
 */
async function fetchKnowledgeContext(
  expertType: ExpertType,
  query: string
): Promise<{ knowledge: KnowledgeSearchResult[]; contextText: string }> {
  try {
    const knowledgeType = expertType === 'LEGAL' ? 'LEGAL' : 
                          expertType === 'FINANCE' ? 'FINANCE' : undefined;
    
    if (!knowledgeType) {
      return { knowledge: [], contextText: '' };
    }

    const results = await professionalKnowledge.searchKnowledge(query, knowledgeType, undefined, 3);
    
    if (results.length === 0) {
      return { knowledge: [], contextText: '' };
    }

    const contextText = results.map((r, i) => {
      const source = r.articleNumber ? `${r.title}` : r.title;
      return `【参考${i + 1}】${source}\n${r.content}`;
    }).join('\n\n');

    console.log(`[ExpertAI] Found ${results.length} knowledge references for ${expertType}`);
    return { knowledge: results, contextText };
  } catch (error) {
    console.error('[ExpertAI] Knowledge fetch error:', error);
    return { knowledge: [], contextText: '' };
  }
}

export async function runExpertAnalysis(
  expertType: ExpertType,
  query: string,
  context?: string,
  options?: { useKnowledgeBase?: boolean }
): Promise<ExpertAnalysis> {
  const startTime = Date.now();
  const useKnowledge = options?.useKnowledgeBase !== false;
  
  let knowledgeContext = '';
  if (useKnowledge && (expertType === 'LEGAL' || expertType === 'FINANCE')) {
    const { contextText } = await fetchKnowledgeContext(expertType, query);
    knowledgeContext = contextText;
  }
  
  const systemPrompt = EXPERT_PROMPTS[expertType];
  
  let userMessage = '';
  if (knowledgeContext) {
    userMessage = `【本地知识库参考】\n${knowledgeContext}\n\n`;
  }
  if (context) {
    userMessage += `【背景信息】\n${context}\n\n`;
  }
  userMessage += `【分析请求】\n${query}`;

  console.log(`[ExpertAI] ${expertType} analyzing: ${query.slice(0, 50)}...${knowledgeContext ? ' (with knowledge base)' : ''}`);

  try {
    const response = await callDashScope(systemPrompt, userMessage);
    const parsed = parseExpertResponse(response);

    const analysis: ExpertAnalysis = {
      expert: expertType,
      query,
      chainOfThought: parsed.chainOfThought || [],
      finalVerdict: parsed.finalVerdict || '分析完成',
      riskLevel: parsed.riskLevel || 'MEDIUM',
      recommendations: parsed.recommendations || [],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };

    console.log(`[ExpertAI] ${expertType} completed in ${analysis.executionTimeMs}ms`);
    return analysis;

  } catch (error) {
    console.error(`[ExpertAI] ${expertType} failed:`, error);
    
    return {
      expert: expertType,
      query,
      chainOfThought: [{
        step: 1,
        reasoning: '分析过程中遇到问题',
        evidence: [],
        conclusion: error instanceof Error ? error.message : '未知错误',
        confidence: 0,
      }],
      finalVerdict: '分析失败，请稍后重试',
      riskLevel: 'HIGH',
      recommendations: ['请检查网络连接', '稍后重试'],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }
}

export async function runMultiExpertAnalysis(
  query: string,
  experts: ExpertType[] = ['LEGAL', 'FINANCE', 'STRATEGY'],
  context?: string
): Promise<ExpertAnalysis[]> {
  console.log(`[ExpertAI] Multi-expert analysis with ${experts.length} experts`);
  
  const analyses = await Promise.all(
    experts.map(expert => runExpertAnalysis(expert, query, context))
  );

  return analyses;
}

export async function synthesizeExpertOpinions(analyses: ExpertAnalysis[]): Promise<{
  consensus: string;
  conflicts: string[];
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionPlan: string[];
}> {
  const riskLevels = analyses.map(a => a.riskLevel);
  const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const maxRiskIndex = Math.max(...riskLevels.map(r => riskOrder.indexOf(r)));
  
  const allRecommendations = analyses.flatMap(a => a.recommendations);
  const uniqueRecommendations = Array.from(new Set(allRecommendations));

  const verdicts = analyses.map(a => `【${a.expert}】${a.finalVerdict}`);

  return {
    consensus: verdicts.join('\n'),
    conflicts: [],
    overallRisk: riskOrder[maxRiskIndex] as any,
    actionPlan: uniqueRecommendations.slice(0, 5),
  };
}

/**
 * 快速离线判断 - 仅使用本地知识库，不调用AI
 * 用于快速获取相关法规/财务准则，无需等待AI响应
 */
export async function quickOfflineJudgment(
  expertType: 'LEGAL' | 'FINANCE',
  query: string
): Promise<{
  hasRelevantKnowledge: boolean;
  references: KnowledgeSearchResult[];
  quickSummary: string;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  
  try {
    const results = await professionalKnowledge.searchKnowledge(query, expertType, undefined, 5);
    
    if (results.length === 0) {
      return {
        hasRelevantKnowledge: false,
        references: [],
        quickSummary: '未找到相关知识库条目，建议咨询专家进行详细分析。',
        processingTimeMs: Date.now() - startTime,
      };
    }

    const topResult = results[0];
    const summary = expertType === 'LEGAL'
      ? `相关法律依据：${topResult.title}\n${topResult.content.slice(0, 200)}...`
      : `相关财务准则：${topResult.title}\n${topResult.content.slice(0, 200)}...`;

    console.log(`[ExpertAI] Quick offline judgment: found ${results.length} references in ${Date.now() - startTime}ms`);

    return {
      hasRelevantKnowledge: true,
      references: results,
      quickSummary: summary,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[ExpertAI] Quick offline judgment error:', error);
    return {
      hasRelevantKnowledge: false,
      references: [],
      quickSummary: '知识库查询出错，请稍后重试。',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

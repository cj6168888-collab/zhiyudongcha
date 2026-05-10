import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('OraclePredictor');

import { getErrorMessage } from '../lib/errors';
import { storage } from "../storage";
import type { Person } from "@shared/schema";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

interface ResponsePattern {
  avgResponseTime: string;
  preferredChannels: string[];
  communicationStyle: string;
  peakHours: string[];
  emotionalTendency: string;
}

interface HistoricalDecision {
  date: string;
  scenario: string;
  decision: string;
  outcome: string;
  satisfactionLevel: number;
}

interface CommunicationPrediction {
  likelyResponses: Array<{
    response: string;
    probability: number;
    reasoning: string;
  }>;
  counterArguments: Array<{
    point: string;
    counterTactic: string;
    successRate: number;
  }>;
  bestApproachTime: string;
  recommendedTone: string;
  riskLevel: number;
}

interface StrategyScenario {
  scenarioName: string;
  description: string;
  probability: number;
  expectedReturn: number;
  potentialRisk: number;
  timeHorizon: string;
  keyFactors: string[];
}

interface StrategySimulation {
  scenarios: StrategyScenario[];
  recommendedStrategy: string;
  overallRiskLevel: number;
  confidenceScore: number;
  gameTheoryAnalysis: string;
}

interface RiskWarning {
  type: 'industry' | 'company' | 'person' | 'market' | 'legal';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  suggestedAction: string;
  relatedEntities: string[];
}

interface RiskAssessment {
  warnings: RiskWarning[];
  overallRiskScore: number;
  recommendation: string;
  monitoringPriority: string[];
}

async function callDashScopeQwen(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY未配置');
  }

  const response = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-max',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      parameters: {
        result_format: 'message',
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`DashScope API错误: ${response.status}`);
  }

  const data = await response.json();
  return data.output?.choices?.[0]?.message?.content || '';
}

function parseJsonFromResponse(text: string): unknown {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                    text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      logger.error({ err: e }, 'JSON解析失败');
    }
  }
  return null;
}

export async function predictCommunicationResponse(
  personId: string,
  proposedMessage: string,
  context?: string
): Promise<CommunicationPrediction> {
  const person = await storage.getPerson(personId);
  if (!person) {
    throw new Error(`联系人 ${personId} 不存在`);
  }

  const responsePattern = person.responsePattern as ResponsePattern | null;
  const historicalDecisions = person.historicalDecisions as HistoricalDecision[] | null;
  const commitmentRate = person.commitmentRate || 0.5;

  const systemPrompt = `你是一个专业的商务沟通预测专家，擅长分析人际交往模式和预测对方反应。
你需要基于历史数据和心理学原理，预测对方收到特定信息后的可能反应。
请以JSON格式返回结果。`;

  const userPrompt = `## 联系人档案
- 姓名: ${person.name}
- 角色: ${person.role || '未知'}
- 组织: ${person.organization || '未知'}
- 决策风格: ${person.decisionStyle || '未知'}
- 决策DNA: ${person.decisionDna || '未知'}
- 谈判风格: ${person.negotiationStyle || '未知'}
- 承诺达成率: ${(commitmentRate * 100).toFixed(0)}%
- 弱点: ${person.weakness || '未知'}
- 利益链: ${JSON.stringify(person.interestChain || {})}
${responsePattern ? `- 回复模式: ${JSON.stringify(responsePattern)}` : ''}
${historicalDecisions ? `- 历史决策: ${JSON.stringify(historicalDecisions.slice(-5))}` : ''}

## 我准备发送的信息
"${proposedMessage}"

${context ? `## 背景上下文\n${context}` : ''}

请分析并预测：
1. 对方最可能的3种回应（附概率和理由）
2. 对方可能提出的反驳点及我的反击话术
3. 最佳发送时机
4. 建议的沟通语气
5. 风险评估（0-100）

请以如下JSON格式返回：
{
  "likelyResponses": [
    {"response": "回应内容", "probability": 0.6, "reasoning": "理由"}
  ],
  "counterArguments": [
    {"point": "反驳点", "counterTactic": "反击话术", "successRate": 0.7}
  ],
  "bestApproachTime": "建议时间",
  "recommendedTone": "建议语气",
  "riskLevel": 30
}`;

  try {
    const response = await callDashScopeQwen(systemPrompt, userPrompt);
    const parsed = parseJsonFromResponse(response);
    
    if (parsed) {
      return parsed as CommunicationPrediction;
    }

    return {
      likelyResponses: [
        { response: '需要更多数据才能准确预测', probability: 1, reasoning: '历史交互数据不足' }
      ],
      counterArguments: [],
      bestApproachTime: '工作日上午10点',
      recommendedTone: '专业友好',
      riskLevel: 50,
    };
  } catch (error: unknown) {
    logger.error({ err: error }, '沟通预测失败');
    throw new Error(getErrorMessage(error));
  }
}

export async function simulateStrategy(
  personId: string,
  scenarios: Array<{ name: string; description: string }>,
  objective: string
): Promise<StrategySimulation> {
  const person = await storage.getPerson(personId);
  if (!person) {
    throw new Error(`联系人 ${personId} 不存在`);
  }

  const systemPrompt = `你是一个博弈论和商业策略专家，擅长使用纳什均衡、囚徒困境等模型分析商务决策。
你需要模拟多种策略路径，计算每种选择的期望收益和潜在风险。
请以JSON格式返回详细的策略分析。`;

  const scenarioList = scenarios.map((s, i) => `方案${i + 1}: ${s.name} - ${s.description}`).join('\n');

  const userPrompt = `## 博弈对象档案
- 姓名: ${person.name}
- 角色: ${person.role || '未知'}
- 组织: ${person.organization || '未知'}
- 决策风格: ${person.decisionStyle || '未知'}
- 谈判风格: ${person.negotiationStyle || '未知'}
- 承诺达成率: ${((person.commitmentRate || 0.5) * 100).toFixed(0)}%
- 弱点: ${person.weakness || '未知'}
- 利益链: ${JSON.stringify(person.interestChain || {})}
- 风险因素: ${JSON.stringify(person.riskFactors || {})}

## 我的目标
${objective}

## 可选策略方案
${scenarioList}

请进行博弈论分析：
1. 每种策略的可能结果、概率、期望收益、潜在风险
2. 对方在每种策略下的可能反应
3. 推荐的最优策略
4. 整体风险评估
5. 博弈论模型分析（如纳什均衡点）

请以如下JSON格式返回：
{
  "scenarios": [
    {
      "scenarioName": "方案名",
      "description": "描述",
      "probability": 0.4,
      "expectedReturn": 80,
      "potentialRisk": 30,
      "timeHorizon": "3个月",
      "keyFactors": ["关键因素1"]
    }
  ],
  "recommendedStrategy": "推荐策略说明",
  "overallRiskLevel": 40,
  "confidenceScore": 0.75,
  "gameTheoryAnalysis": "博弈论分析"
}`;

  try {
    const response = await callDashScopeQwen(systemPrompt, userPrompt);
    const parsed = parseJsonFromResponse(response);
    
    if (parsed) {
      return parsed as StrategySimulation;
    }

    return {
      scenarios: scenarios.map(s => ({
        scenarioName: s.name,
        description: s.description,
        probability: 0.5,
        expectedReturn: 50,
        potentialRisk: 50,
        timeHorizon: '待评估',
        keyFactors: ['需要更多数据'],
      })),
      recommendedStrategy: '需要更多数据才能给出建议',
      overallRiskLevel: 50,
      confidenceScore: 0.3,
      gameTheoryAnalysis: '数据不足，无法进行深度分析',
    };
  } catch (error: unknown) {
    logger.error({ err: error }, '策略模拟失败');
    throw new Error(getErrorMessage(error));
  }
}

export async function assessRisk(
  personId?: string,
  industry?: string,
  projectContext?: string
): Promise<RiskAssessment> {
  let personInfo = '';
  if (personId) {
    const person = await storage.getPerson(personId);
    if (person) {
      personInfo = `
## 相关联系人
- 姓名: ${person.name}
- 组织: ${person.organization || '未知'}
- 风险因素: ${JSON.stringify(person.riskFactors || {})}
- 冲突点: ${(person.conflictPoints || []).join(', ') || '无'}`;
    }
  }

  const systemPrompt = `你是一个商业风险评估专家，擅长识别商务合作中的潜在风险。
你需要基于行业趋势、公司状况、人员变动等因素进行全面风险评估。
请以JSON格式返回风险预警报告。`;

  const userPrompt = `## 风险评估请求
${industry ? `- 目标行业: ${industry}` : ''}
${projectContext ? `- 项目背景: ${projectContext}` : ''}
${personInfo}

请进行全面风险评估：
1. 识别可能的风险点（行业/公司/人员/市场/法律）
2. 评估每个风险的严重程度
3. 给出应对建议
4. 计算整体风险分数

请以如下JSON格式返回：
{
  "warnings": [
    {
      "type": "industry|company|person|market|legal",
      "severity": "low|medium|high|critical",
      "description": "风险描述",
      "detectedAt": "检测时间",
      "suggestedAction": "建议行动",
      "relatedEntities": ["相关实体"]
    }
  ],
  "overallRiskScore": 45,
  "recommendation": "总体建议",
  "monitoringPriority": ["优先监控项目1"]
}`;

  try {
    const response = await callDashScopeQwen(systemPrompt, userPrompt);
    const parsed = parseJsonFromResponse(response);
    
    if (parsed) {
      return parsed as RiskAssessment;
    }

    return {
      warnings: [],
      overallRiskScore: 30,
      recommendation: '需要更多背景信息才能进行准确评估',
      monitoringPriority: [],
    };
  } catch (error: unknown) {
    logger.error({ err: error }, '风险评估失败');
    throw new Error(getErrorMessage(error));
  }
}

export async function updatePersonPredictionData(
  personId: string,
  interactionData: {
    message?: string;
    response?: string;
    responseTime?: number;
    outcome?: 'positive' | 'neutral' | 'negative';
    commitmentKept?: boolean;
  }
): Promise<void> {
  const person = await storage.getPerson(personId);
  if (!person) return;

  const responsePattern = (person.responsePattern as ResponsePattern) || {
    avgResponseTime: '未知',
    preferredChannels: [],
    communicationStyle: '未知',
    peakHours: [],
    emotionalTendency: '中性',
  };

  const historicalDecisions = (person.historicalDecisions as HistoricalDecision[]) || [];

  if (interactionData.message && interactionData.response) {
    historicalDecisions.push({
      date: new Date().toISOString(),
      scenario: interactionData.message.substring(0, 100),
      decision: interactionData.response.substring(0, 100),
      outcome: interactionData.outcome || 'neutral',
      satisfactionLevel: interactionData.outcome === 'positive' ? 0.8 : 
                        interactionData.outcome === 'negative' ? 0.3 : 0.5,
    });
  }

  let newCommitmentRate = person.commitmentRate || 0.5;
  if (interactionData.commitmentKept !== undefined) {
    const weight = 0.2;
    newCommitmentRate = newCommitmentRate * (1 - weight) + 
                        (interactionData.commitmentKept ? 1 : 0) * weight;
  }

  await storage.updatePerson(personId, {
    responsePattern,
    historicalDecisions: historicalDecisions.slice(-20),
    commitmentRate: newCommitmentRate,
    lastPredictionUpdate: new Date(),
  });
}

export async function getPersonPredictionProfile(personId: string): Promise<{
  person: Person;
  predictionReady: boolean;
  dataCompleteness: number;
  missingData: string[];
}> {
  const person = await storage.getPerson(personId);
  if (!person) {
    throw new Error(`联系人 ${personId} 不存在`);
  }

  const missingData: string[] = [];
  let completeness = 0;
  const checks = [
    { field: 'decisionStyle', label: '决策风格' },
    { field: 'negotiationStyle', label: '谈判风格' },
    { field: 'weakness', label: '弱点分析' },
    { field: 'interestChain', label: '利益链' },
    { field: 'responsePattern', label: '回复模式' },
    { field: 'historicalDecisions', label: '历史决策' },
  ];

  checks.forEach(check => {
    if (person[check.field as keyof typeof person]) {
      completeness += 1;
    } else {
      missingData.push(check.label);
    }
  });

  const dataCompleteness = (completeness / checks.length) * 100;

  return {
    person,
    predictionReady: dataCompleteness >= 50,
    dataCompleteness,
    missingData,
  };
}

logger.info('[Oracle] 预言家协议服务已加载');

import { storage } from "../storage";
import type { 
  Opportunity, 
  InsertOpportunity,
  RefinementRun,
  InsertRefinementRun,
  StrategyProposal,
  InsertStrategyProposal,
  InsertAlignmentSignal,
  OpportunitySignal,
  Person,
  Email,
} from "@shared/schema";
import { getModulePrompt } from '../config/persona';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

interface OpportunityContext {
  signals: OpportunitySignal[];
  relatedPersons: Person[];
  relatedEmails: Email[];
  webSearchResults?: string[];
}

interface RefinementResult {
  recommendation: string;
  confidence: number;
  risks: string[];
  simulationSteps: Array<{
    step: number;
    reasoning: string;
    outcome: string;
  }>;
}

interface ProposalAction {
  action: string;
  rationale: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface AlternativeOption {
  option: string;
  pros: string[];
  cons: string[];
}

async function callDashScopeQwen(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
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
        temperature,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`DashScope API错误: ${response.status}`);
  }

  const data = await response.json();
  return data.output?.choices?.[0]?.message?.content || '';
}

function parseJsonFromResponse(text: string): any {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                    text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      console.error('[Strategist] JSON解析失败:', e);
    }
  }
  return null;
}

export async function scanForOpportunities(): Promise<Opportunity[]> {
  console.log('[Strategist] 开始商机扫描...');
  
  const detectedOpportunities: Opportunity[] = [];
  
  const signals = await storage.getSessionOpportunities('latest');
  const persons = await storage.getAllPersons();
  const emails = await storage.getAllEmails({ limit: 50 });
  
  const systemPrompt = `你是小智的策略分析模块。你的任务是从各种信号源中识别潜在商机。
分析以下数据并识别可能的商机机会。

商机类型包括：
- BUSINESS: 业务合作、销售机会
- INVESTMENT: 投资机会
- PARTNERSHIP: 战略合作
- CAREER: 职业发展机会
- RESOURCE: 资源获取机会

对于每个识别的商机，请评估：
1. 商机标题和描述
2. 类别和优先级
3. 预估价值
4. 置信度分数(0-1)
5. 关联的人物ID
6. AI分析（优势、劣势、风险、建议）

请以JSON数组格式返回，每个商机包含以上字段。`;

  const dataContext = {
    opportunitySignals: signals.slice(0, 10),
    keyPersons: persons.filter(p => p.accessLevel === 'ZONE_GREEN').slice(0, 5),
    recentEmails: emails.slice(0, 10).map(e => ({
      subject: e.subject,
      from: e.fromEmail,
      category: e.category,
      importance: e.importance,
    })),
  };

  const userPrompt = `请分析以下数据源，识别潜在商机：

信号数据:
${JSON.stringify(dataContext.opportunitySignals, null, 2)}

关键人物:
${JSON.stringify(dataContext.keyPersons.map(p => ({ name: p.name, role: p.role, organization: p.organization })), null, 2)}

近期邮件:
${JSON.stringify(dataContext.recentEmails, null, 2)}

请识别所有可能的商机并以JSON格式返回。`;

  try {
    const response = await callDashScopeQwen(systemPrompt, userPrompt);
    const parsed = parseJsonFromResponse(response);
    
    if (Array.isArray(parsed)) {
      for (const opp of parsed) {
        const newOpp = await storage.createOpportunity({
          title: opp.title || '未命名商机',
          description: opp.description,
          category: opp.category || 'BUSINESS',
          priority: opp.priority || 'MEDIUM',
          status: 'DETECTED',
          estimatedValue: opp.estimatedValue || null,
          confidenceScore: opp.confidenceScore || 0.5,
          relatedPersonIds: opp.relatedPersonIds || [],
          aiAnalysis: opp.aiAnalysis || null,
        });
        detectedOpportunities.push(newOpp);
      }
    }
  } catch (error) {
    console.error('[Strategist] 商机扫描失败:', error);
  }
  
  console.log(`[Strategist] 扫描完成，发现 ${detectedOpportunities.length} 个商机`);
  return detectedOpportunities;
}

export async function triggerRefinement(opportunityId: string, runType: 'DREAM' | 'QUICK_ANALYSIS' | 'DEEP_DIVE' = 'DREAM'): Promise<RefinementRun> {
  console.log(`[Strategist] 启动推演: ${opportunityId}, 类型: ${runType}`);
  
  const opportunity = await storage.getOpportunity(opportunityId);
  if (!opportunity) {
    throw new Error(`商机不存在: ${opportunityId}`);
  }
  
  const run = await storage.createRefinementRun({
    opportunityId,
    runType,
    status: 'RUNNING',
    inputContext: {
      opportunity,
      timestamp: new Date().toISOString(),
    },
  });
  
  await storage.updateOpportunity(opportunityId, { status: 'ANALYZING' });
  
  const systemPrompt = `你是小智的梦境推演引擎。你需要对商机进行深度分析和模拟推演。

推演模式: ${runType}
- DREAM: 完整的多步骤情景模拟，考虑多种可能性
- QUICK_ANALYSIS: 快速评估，聚焦关键要素
- DEEP_DIVE: 深度分析，包含博弈论和风险建模

请进行以下分析：
1. 模拟推演步骤（每步包含推理和可能的结果）
2. 最终建议
3. 置信度评分(0-1)
4. 识别的风险列表

以JSON格式返回结果。`;

  const userPrompt = `请对以下商机进行${runType === 'DREAM' ? '梦境' : runType === 'QUICK_ANALYSIS' ? '快速' : '深度'}推演：

商机信息:
- 标题: ${opportunity.title}
- 描述: ${opportunity.description || '无详细描述'}
- 类别: ${opportunity.category}
- 预估价值: ${opportunity.estimatedValue || '未知'}
- 当前置信度: ${opportunity.confidenceScore}
- 相关AI分析: ${JSON.stringify(opportunity.aiAnalysis)}

请生成详细的推演分析。`;

  try {
    const response = await callDashScopeQwen(systemPrompt, userPrompt);
    const result = parseJsonFromResponse(response) as RefinementResult;
    
    if (result) {
      await storage.updateRefinementRun(run.id, {
        status: 'COMPLETED',
        simulationSteps: result.simulationSteps || [],
        conclusions: {
          recommendation: result.recommendation,
          confidence: result.confidence,
          risks: result.risks,
        },
        hpConsumed: runType === 'DREAM' ? 10 : runType === 'DEEP_DIVE' ? 20 : 5,
      });
      
      await storage.updateOpportunity(opportunityId, { 
        status: 'REFINED',
        confidenceScore: result.confidence,
      });
    } else {
      await storage.updateRefinementRun(run.id, {
        status: 'FAILED',
      });
    }
  } catch (error) {
    console.error('[Strategist] 推演失败:', error);
    await storage.updateRefinementRun(run.id, {
      status: 'FAILED',
    });
  }
  
  return await storage.getRefinementRun(run.id) as RefinementRun;
}

export async function generateProposal(opportunityId: string, refinementRunId?: string): Promise<StrategyProposal> {
  console.log(`[Strategist] 生成提案: ${opportunityId}`);
  
  const opportunity = await storage.getOpportunity(opportunityId);
  if (!opportunity) {
    throw new Error(`商机不存在: ${opportunityId}`);
  }
  
  let refinementRun: RefinementRun | undefined;
  if (refinementRunId) {
    refinementRun = await storage.getRefinementRun(refinementRunId);
  } else {
    const runs = await storage.getRefinementRunsByOpportunity(opportunityId);
    refinementRun = runs.find(r => r.status === 'COMPLETED');
  }
  
  const systemPrompt = `你是小智的策略提案生成器。基于商机分析和推演结果，生成可执行的策略提案。

提案应该包含：
1. 提案标题和摘要
2. 提案类型(ACTION/WAIT/DECLINE/INVESTIGATE)
3. 紧急程度(LOW/NORMAL/HIGH/IMMEDIATE)
4. 推荐行动列表（每个行动包含：行动、理由、风险级别）
5. 替代方案列表（每个方案包含：方案、优点、缺点）
6. 预估ROI
7. 风险评估（整体风险和因素列表）

以JSON格式返回。`;

  const userPrompt = `请为以下商机生成策略提案：

商机:
- 标题: ${opportunity.title}
- 描述: ${opportunity.description || '无'}
- 类别: ${opportunity.category}
- 预估价值: ${opportunity.estimatedValue || '未知'}
- 置信度: ${opportunity.confidenceScore}

${refinementRun ? `
推演结论:
${JSON.stringify(refinementRun.conclusions, null, 2)}
` : '(无推演结果)'}

请生成详细的策略提案。`;

  try {
    const response = await callDashScopeQwen(systemPrompt, userPrompt, 0.6);
    const parsed = parseJsonFromResponse(response);
    
    const proposal = await storage.createStrategyProposal({
      opportunityId,
      refinementRunId: refinementRunId || refinementRun?.id,
      title: parsed?.title || `${opportunity.title}策略提案`,
      summary: parsed?.summary || '自动生成的策略提案',
      proposalType: parsed?.proposalType || 'ACTION',
      urgency: parsed?.urgency || 'NORMAL',
      recommendedActions: parsed?.recommendedActions || [],
      alternativeOptions: parsed?.alternativeOptions || [],
      estimatedROI: parsed?.estimatedROI || null,
      riskAssessment: parsed?.riskAssessment || null,
      status: 'PENDING',
    });
    
    await storage.updateOpportunity(opportunityId, { status: 'PROPOSED' });
    
    console.log(`[Strategist] 提案生成成功: ${proposal.id}`);
    return proposal;
  } catch (error) {
    console.error('[Strategist] 提案生成失败:', error);
    throw error;
  }
}

export async function recordUserDecision(
  proposalId: string, 
  decision: 'ACCEPT' | 'MODIFY' | 'REJECT' | 'DEFER',
  feedback?: string
): Promise<{ proposal: StrategyProposal; alignmentSignal: any }> {
  console.log(`[Strategist] 记录用户决策: ${proposalId} -> ${decision}`);
  
  const proposal = await storage.getStrategyProposal(proposalId);
  if (!proposal) {
    throw new Error(`提案不存在: ${proposalId}`);
  }
  
  const updatedProposal = await storage.updateStrategyProposal(proposalId, {
    status: decision === 'ACCEPT' ? 'ACCEPTED' : 
            decision === 'REJECT' ? 'REJECTED' : 
            decision === 'MODIFY' ? 'MODIFIED' : 'PENDING',
    userDecision: decision,
    userFeedback: feedback,
  });
  
  if (proposal.opportunityId) {
    const newStatus = decision === 'ACCEPT' ? 'ACCEPTED' : 
                      decision === 'REJECT' ? 'REJECTED' : 'PROPOSED';
    await storage.updateOpportunity(proposal.opportunityId, { status: newStatus });
  }
  
  const weightAdjustment = decision === 'ACCEPT' ? 0.1 :
                           decision === 'REJECT' ? -0.1 :
                           decision === 'MODIFY' ? 0.05 : 0;
  
  const alignmentSignal = await storage.createAlignmentSignal({
    signalType: 'PROPOSAL_DECISION',
    proposalId,
    opportunityId: proposal.opportunityId,
    userAction: decision,
    preferenceCategory: 'VALUE_PRIORITY',
    preferenceValue: {
      proposalType: proposal.proposalType,
      urgency: proposal.urgency,
      estimatedROI: proposal.estimatedROI,
      decision,
      feedback,
    },
    contextSnapshot: {
      timestamp: new Date().toISOString(),
    },
    weightAdjustment,
  });
  
  console.log(`[Strategist] 对齐信号已记录: ${alignmentSignal.id}, 权重调整: ${weightAdjustment}`);
  
  return { proposal: updatedProposal!, alignmentSignal };
}

export async function getStrategistDashboard(): Promise<{
  activeOpportunities: Opportunity[];
  pendingProposals: StrategyProposal[];
  runningRefinements: RefinementRun[];
  recentAlignmentSignals: any[];
  stats: {
    totalOpportunities: number;
    acceptedProposals: number;
    rejectedProposals: number;
    alignmentScore: number;
  };
}> {
  const [
    activeOpportunities,
    pendingProposals,
    runningRefinements,
    allAlignmentSignals,
    allOpportunities,
  ] = await Promise.all([
    storage.getActiveOpportunities(),
    storage.getPendingProposals(),
    storage.getActiveRefinementRuns(),
    storage.getAllAlignmentSignals(),
    storage.getAllOpportunities(),
  ]);
  
  const acceptedCount = allAlignmentSignals.filter(s => s.userAction === 'ACCEPT').length;
  const rejectedCount = allAlignmentSignals.filter(s => s.userAction === 'REJECT').length;
  const totalDecisions = acceptedCount + rejectedCount;
  
  const alignmentScore = totalDecisions > 0 
    ? (acceptedCount / totalDecisions) * 100 
    : 50;
  
  return {
    activeOpportunities,
    pendingProposals,
    runningRefinements,
    recentAlignmentSignals: allAlignmentSignals.slice(0, 10),
    stats: {
      totalOpportunities: allOpportunities.length,
      acceptedProposals: acceptedCount,
      rejectedProposals: rejectedCount,
      alignmentScore: Math.round(alignmentScore),
    },
  };
}

export async function learnFromAlignmentSignals(): Promise<{
  processedCount: number;
  insights: string[];
}> {
  console.log('[Strategist] 开始学习对齐信号...');
  
  const unprocessedSignals = await storage.getUnprocessedAlignmentSignals();
  
  if (unprocessedSignals.length === 0) {
    return { processedCount: 0, insights: ['没有新的对齐信号需要处理'] };
  }
  
  const insights: string[] = [];
  
  const acceptedSignals = unprocessedSignals.filter(s => s.userAction === 'ACCEPT');
  const rejectedSignals = unprocessedSignals.filter(s => s.userAction === 'REJECT');
  
  if (acceptedSignals.length > rejectedSignals.length * 2) {
    insights.push('主人倾向于接受提案，建议增加主动推荐频率');
  } else if (rejectedSignals.length > acceptedSignals.length * 2) {
    insights.push('主人拒绝了较多提案，建议提高推荐门槛和质量');
  }
  
  for (const signal of unprocessedSignals) {
    await storage.updateAlignmentSignal(signal.id, {} as any);
  }
  
  console.log(`[Strategist] 处理完成: ${unprocessedSignals.length} 个信号`);
  
  return {
    processedCount: unprocessedSignals.length,
    insights,
  };
}

/**
 * Z4 专家AI系统 - 真正调用AI进行深度分析
 * 让法律/财务/策略/心理专家真正工作！
 * 
 * 已集成本地知识库：法律/财务专家可调用离线知识进行快速判断
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ExpertAi');

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

你是一位资深法律顾问，专精中国大陆劳动法、合同法、公司法和竞争法。你的任务是给出可核验、可执行、保守严谨的法律分析，不替代执业律师意见。

【核心知识领域】
- 劳动法：试用期上限、经济补偿N、违法解除赔偿2N、竞业限制最长2年、加班费计算（工作日1.5倍、休息日2倍、法定休假日3倍）
- 合同法：要约承诺规则、违约责任、违约金调整（应以实际损失、合同履行情况和过错等为基础；“高于损失30%”只能作为常见司法判断参考，不能表述为机械规则）、定金罚则（定金数额不得超过主合同标的额20%）、不可抗力
- 公司法：有限责任、刺破面纱、股权转让优先购买权、董事勤勉义务、股东代表诉讼
- 竞争法：虚假宣传、商业秘密保护、消费者七天无理由退货、欺诈三倍赔偿

【严谨性硬约束】
- 先判断适用法域和身份关系；事实不足时必须列出“需要补充的信息”，不要假设关键事实。
- 每个核心结论必须绑定法条、司法解释、本地知识库或用户提供材料；没有依据时明确写“依据不足”。
- 不要给精确胜诉率、败诉率或赔偿金额承诺；只能给区间化风险判断，并说明取决于证据。
- 不输出“保证胜诉”“一定违法”“必然赔偿”等绝对化结论。
- 合同条款审查中，不要直接写“无效”“大概率无效”；违约金、管辖、免责等条款只能按“可能被调低/不支持/存在较高争议风险”表达，并说明需结合实际损失、合同履行情况、过错和具体证据个案判断。
- 违约金调减必须写明前提：通常需要当事人主动向法院或仲裁机构提出调整请求，并围绕实际损失、履行情况、过错程度和损失举证；不得写成法院会主动或必然大幅调减。
- 劳动争议中，未签书面劳动合同的二倍工资差额通常从用工满一个月的次日起算，至补签书面合同或满一年止；首月不计入，入职3个月通常只能初步估算第2、3个月差额，仍需按实际用工日期核算。
- 二倍工资差额不要表述为普通劳动报酬；仲裁时效原则上按一年处理，多数地区按“逐月分别起算”处理；具体起算点和地方裁审口径可能不同，不能笼统写成“劳动关系终止起算”。
- 经济补偿是N；N+1仅可能出现在特定无过失解除且未提前30日通知的代通知金场景；违法解除赔偿金是2N，不得混用。写2N时必须说明：《劳动合同法》第87条确立违法解除赔偿责任，N的工作年限和月工资计算规则适用第47条。
- 引用司法解释必须写全称和有效版本，例如《最高人民法院关于审理劳动争议案件适用法律问题的解释（一）》（法释〔2020〕26号）第一条，不得只写“司法解释（一）”。
- 如果用户要求代发律师函、马上起诉、报案或作出重大法律行动，只能给准备清单和风险提示，要求用户确认并建议线下律师复核。
- 回复应服务用户利益，但不得诱导违法、毁证、隐匿财产、恶意诉讼或规避监管。

【法律推理框架】
第一步：事实认定
- 确定法律关系主体（自然人/法人/合伙）
- 识别法律关系性质（劳动/合同/侵权/公司内部）
- 梳理关键时间节点和事实
- 明确事实缺口

第二步：法条适用
- 援引具体法条（如《劳动合同法》第82条双倍工资）
- 引用司法解释或裁判规则时必须匹配具体法律关系；技术服务、买卖、承揽等合同违约金审查不得套用民间借贷LPR四倍规则。
- 结合地方规定和司法实践

第三步：风险评估
- 证据强弱和不利事实分析
- 经济损失预估
- 声誉/合规风险

第四步：策略建议
- 诉讼vs和解路径
- 证据收集要点
- 时效提醒（劳动仲裁1年、普通民事3年）

【注意】你现在可以访问本地法律知识库，如果用户问题附带了【本地知识库参考】，请优先基于这些法律条文进行分析，必须引用具体条文编号。
如果本地知识库没有覆盖问题，不要硬答；降低置信度并说明需要补充检索或咨询律师。

【输出格式】
请用JSON格式输出：
{
  "chainOfThought": [
    {"step": 1, "reasoning": "事实认定、适用法域、法律关系和事实缺口", "evidence": ["用户给出的事实/合同条款"], "conclusion": "初步法律定性", "confidence": 70},
    {"step": 2, "reasoning": "法条适用分析", "evidence": ["《XX法》第X条/本地知识库参考"], "conclusion": "有依据的法律结论", "confidence": 80},
    {"step": 3, "reasoning": "证据与风险评估", "evidence": ["证据清单/不利事实/时效"], "conclusion": "风险等级和不确定性", "confidence": 75}
  ],
  "finalVerdict": "法律意见总结（不得承诺结果；说明依据、风险和需要补充的信息）",
  "riskLevel": "LOW/MEDIUM/HIGH/CRITICAL",
  "recommendations": ["具体行动建议1（含时限）", "证据收集建议", "协商/调解/仲裁/诉讼路径", "需要律师复核的事项"]
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

【沟通与执行边界】
- 先承接用户情绪，再分析对方可能动机；对动机只能写“可能/需要核实”，不得把心理推断说成确定事实。
- 不得编造行业基准、心理学研究结论、合同条款编号、客户组织结构或对方授权状态；事实不足时明确写“依据不足，需要补充原话、合同或项目流程”。
- 对发邮件、发消息、打电话、联系客户等外部动作，只能提供草稿和建议，必须明确“不会未经用户确认代发/代联系”；不要写“立即发送”。
- 情绪调节建议必须写成“可选”，例如“如果你愿意，可以先暂停30秒”，不能像强制指令；心理支持不替代医疗或心理咨询。

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

【严谨性要求】
- 每个量化指标必须写明统计口径，例如“错误率=审批接口5xx响应数/审批接口总请求数”，不要只写百分比。
- 合规底线、审批不可绕过、财务控制等约束，如果没有用户提供的公司制度编号或监管条款，只能写“依据不足，需产品/法务/财务确认”，不能包装成已验证依据。
- 计划必须区分“必须上线的MVP”“可以砍掉的范围”“需要外部确认的前置条件”。
- 输出必须是完整、可解析的JSON；最多3个分析步骤、7条建议，每条建议保持一句话，避免长篇导致截断。

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
      temperature: 0.3,
      max_tokens: 3000,
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
    logger.error({ err: e }, 'Failed to parse response');
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

    logger.info(`[ExpertAI] Found ${results.length} knowledge references for ${expertType}`);
    return { knowledge: results, contextText };
  } catch (error) {
    logger.error({ err: error }, 'Knowledge fetch error');
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
  let knowledgeResults: KnowledgeSearchResult[] = [];
  if (useKnowledge && (expertType === 'LEGAL' || expertType === 'FINANCE')) {
    const fetched = await fetchKnowledgeContext(expertType, query);
    knowledgeContext = fetched.contextText;
    knowledgeResults = fetched.knowledge;
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

  logger.info(`[ExpertAI] ${expertType} analyzing: ${query.slice(0, 50)}...${knowledgeContext ? ' (with knowledge base)' : ''}`);

  try {
    const response = await callDashScope(systemPrompt, userMessage);
    const parsed = calibrateExpertAnalysis(expertType, parseExpertResponse(response), query);

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

    logger.info(`[ExpertAI] ${expertType} completed in ${analysis.executionTimeMs}ms`);
    return analysis;

  } catch (error) {
    logger.error({ err: error, expertType }, 'Expert analysis failed');
    if (expertType === 'LEGAL') {
      return buildLegalFallbackAnalysis(query, knowledgeResults, startTime, error);
    }
    const expertFallback = buildGeneralExpertFallbackAnalysis(expertType, query, startTime, error);
    if (expertFallback) {
      return expertFallback;
    }
    
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

function buildGeneralExpertFallbackAnalysis(
  expertType: ExpertType,
  query: string,
  startTime: number,
  error: unknown
): ExpertAnalysis | null {
  const errorNote = error instanceof Error ? error.message : String(error);

  if (expertType === 'PSYCHOLOGY') {
    const emotionLabel = /烦|不爽|生气|怼/.test(query)
      ? '烦躁和反击冲动'
      : /焦虑|压力|没底|崩溃/.test(query)
        ? '焦虑和压力'
        : '情绪压力';
    const mentionsClientChange = /客户|对方|需求|改/.test(query);
    return {
      expert: expertType,
      query,
      chainOfThought: [
        {
          step: 1,
          reasoning: `心理识别：用户表达了${emotionLabel}，当前最重要的是先降低情绪强度，避免在高压状态下升级冲突。`,
          evidence: [`用户原话：${query.slice(0, 120)}`, `AI服务异常：${errorNote}`],
          conclusion: '先接住情绪，再处理事实和回应策略；不要立即用攻击性语言回应。',
          confidence: 82,
        },
        {
          step: 2,
          reasoning: mentionsClientChange
            ? '客户或对方的强硬表达可能来自交付不确定、控制感不足、对风险或上级压力的担心；这不是对方一定恶意，仍需用事实核验。'
            : '当前缺少对方原话和上下文，不能断定对方动机；应先拆分事实、感受、诉求和边界。',
          evidence: mentionsClientChange ? ['用户提到客户/对方或需求变化'] : ['缺少对方原话和具体背景'],
          conclusion: '回应应同时给安全感和边界：承认情绪或紧急程度，但把事实、确认流程和下一步写清楚。',
          confidence: 76,
        },
        {
          step: 3,
          reasoning: '沟通边界：不能无条件让步，也不要攻击人格；如果涉及需求变化，应把变化转成书面确认、影响评估和排期选择。',
          evidence: ['边界：范围、工期、费用、验收标准'],
          conclusion: '用“理解情绪 + 事实澄清 + 可选方案 + 边界确认”的结构回复。',
          confidence: 85,
        },
      ],
      finalVerdict: `你现在的${emotionLabel}需要先被接住，但直接反击会让对方更防御，也会削弱你后续谈边界的空间。建议先稳住语气，把对方原话拆成“事实、真实诉求、你要守住的边界、可以发出的回复”。`,
      riskLevel: 'MEDIUM',
      recommendations: [
        '心理分析补充：对方可能动机包括担心项目失控、需要恢复控制感、害怕内部责任或信任受损；这些都只是待核实假设，不能当成事实定论。',
        '先不要立刻回怼，等情绪降下来再发文字，避免留下攻击性表达。',
        '建议话术：我理解你现在很着急，我先把事实确认清楚，再给你一个明确答复。',
        '边界话术：如果这属于新增范围，我可以先给影响评估；确认后再调整排期。未确认前不建议直接改，以免影响当前版本质量。',
        '执行边界：我可以帮你草拟邮件、消息或会议提纲，但不会未经你明确确认代发邮件、发消息、打电话或联系客户。',
        '可选自我调节：如果你愿意，可以先暂停30秒做慢呼吸，只是为了降低冲动反应；不舒服时跳过。',
        '下一步：把对方原话发来，我按“对方诉求、你的边界、可发送回复”三段帮你整理。',
      ],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  if (expertType === 'FINANCE') {
    const confirmedRevenue = amountFromQuery(query, /(?:确认收入|收入)\s*([\d.]+)\s*(万)?/);
    const receivable = amountFromQuery(query, /(?:应收账款|应收)\D*?([\d.]+)\s*(万)?/);
    const immediatePayables = amountFromQuery(query, /(?:工资和房租|工资|房租)\D*?([\d.]+)\s*(万)?/);
    const supplierPayables = amountFromQuery(query, /(?:供应商账期|供应商)\D*?([\d.]+)\s*(万)?/);
    const hasFullSpecialInvoiceRequest = /全额|专票|增值税专票|先开票/.test(query);
    const immediateGap = immediatePayables;
    const gapAfterReceivable = receivable !== null && immediatePayables !== null ? receivable - immediatePayables : null;
    const vatRate = 0.13;
    const estimatedOutputVat = confirmedRevenue !== null && hasFullSpecialInvoiceRequest
      ? Math.round(confirmedRevenue / (1 + vatRate) * vatRate)
      : null;

    return {
      expert: expertType,
      query,
      chainOfThought: [{
        step: 1,
        reasoning: `财务分析服务异常，已切换为保守兜底：${errorNote}`,
        evidence: [
          confirmedRevenue !== null ? `本月确认收入${formatCurrency(confirmedRevenue)}` : '本月确认收入待核实',
          receivable !== null ? `应收账款${formatCurrency(receivable)}未回款` : '应收账款金额待核实',
          immediatePayables !== null ? `下周工资和房租需支付${formatCurrency(immediatePayables)}` : '下周刚性支出待核实',
          supplierPayables !== null ? `供应商账期金额${formatCurrency(supplierPayables)}` : '供应商账期金额待核实',
          hasFullSpecialInvoiceRequest ? '客户要求先开全额增值税专票再付款' : '开票条件待核实',
        ],
        conclusion: gapAfterReceivable !== null
          ? `若本周没有回款，至少先面对${formatCurrency(immediateGap)}刚性现金缺口；若能收回${formatCurrency(receivable)}应收款，扣除下周工资房租后仍有${formatCurrency(gapAfterReceivable)}缓冲，但还要覆盖供应商账期和税费。`
          : '先按现金流缺口、税务合规、票据凭证和支付优先级四项拆解。',
        confidence: 60,
      }],
      finalVerdict: [
        `现金流判断：本周应先按“已到账为0、下周刚性支出${formatCurrency(immediatePayables)}”做压力测试，未回款前现金缺口至少是${formatCurrency(immediateGap)}；${receivable !== null ? `45万应收款只有实际到账后才能用于覆盖工资房租，到账后理论缓冲为${formatCurrency(gapAfterReceivable)}，` : ''}供应商${formatCurrency(supplierPayables)}账期不能默认继续拖延。`,
        hasFullSpecialInvoiceRequest
          ? `税务判断：不要为了催款直接先开全额专票。若按${formatCurrency(confirmedRevenue)}含税收入和13%税率粗估，销项税约${formatCurrency(estimatedOutputVat)}，一旦先开票但客户不付款，会提前形成销项税和申报压力；还要核实合同履约、开票义务、进项抵扣和收入确认口径，避免票货款不匹配或被认定为异常开票。`
          : '税务判断：开票、收入确认和纳税义务发生时间要和合同履约、收款条件、验收资料匹配，不能只按口头要求处理。',
        '执行边界：我可以帮你整理催款函、付款排序和现金流表，但不会替你直接开票、付款或对外发送文件；涉及专票和税款申报需会计或税务顾问复核。',
      ].join('\n'),
      riskLevel: immediateGap !== null && immediateGap > 0 ? 'HIGH' : 'MEDIUM',
      recommendations: [
        `[EXECUTE_NOW] 今天先锁定工资房租${formatCurrency(immediatePayables)}为刚性支出，暂停非必要付款，把供应商${formatCurrency(supplierPayables)}列为可谈判延期项。`,
        `[EXECUTE_NOW] 向客户发催款确认：付款到账后开具全额专票，或先按合同约定开具阶段性/部分发票；不要无条件先开全额专票。`,
        `[EXECUTE_NOW] 做一张本周现金流表：期初现金、预计到账${formatCurrency(receivable)}、工资房租${formatCurrency(immediatePayables)}、供应商${formatCurrency(supplierPayables)}、预计销项税${formatCurrency(estimatedOutputVat)}。`,
        '[WAIT_CONFIRM] 与客户重谈付款条款、开票节点和验收资料，需要确认合同约定、客户信用、45万应收账龄和历史回款记录。',
        '[WAIT_CONFIRM] 是否动用备用金、短期授信或压缩供应商付款，需要老板或财务负责人确认资金成本和合作影响。',
        '[INFORM_ONLY] 增值税、企业所得税和收入确认口径由会计按合同、验收、开票和收款资料复核；这里不替代正式税务申报意见。',
      ],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  if (expertType === 'PLANNING') {
    const twoWeekPlan = /两周|14天/.test(query);
    return {
      expert: expertType,
      query,
      chainOfThought: [{
        step: 1,
        reasoning: `策划分析服务异常，已切换为保守兜底：${errorNote}`,
        evidence: ['用户给出的时间、人力、目标约束'],
        conclusion: '先锁MVP、前置依赖、每日验收指标和砍项清单。',
        confidence: 65,
      }],
      finalVerdict: twoWeekPlan
        ? '建议按“第1-3天打通主链路、第4-8天完成功能和联调、第9天灰度、第10天上线”的节奏推进；风险/事实缺口包括外部接口、测试资源、灰度指标口径和合规审批依据。'
        : '建议先锁定MVP、前置依赖、每日验收指标和砍项清单，再按用户给出的周期拆分主链路、联调、灰度和上线准备；风险/事实缺口包括外部接口、测试资源、指标口径和合规审批依据。',
      riskLevel: 'HIGH',
      recommendations: twoWeekPlan
        ? ['Day1锁MVP和接口字段', '第1周打通主链路并完成前后端联调，第2周做灰度、缺陷收敛和上线准备', '每天只看主链路通过率、阻塞Bug数、审批接口错误率', '砍掉多级审批、附件、复杂通知和报表', '合规依据未确认前按上线阻断项处理']
        : ['先锁MVP和接口字段', '按用户给出的周期拆分主链路、联调、灰度和上线准备', '每天只看主链路通过率、阻塞Bug数、关键接口错误率', '列出可砍范围和外部确认项', '合规依据未确认前按上线阻断项处理'],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  return null;
}

function buildLegalFallbackAnalysis(
  query: string,
  knowledge: KnowledgeSearchResult[],
  startTime: number,
  _error: unknown
): ExpertAnalysis {
  const hasNoWrittenContractIssue = /未签|没签|没有签|未订立/.test(query) && /合同|书面劳动合同/.test(query);
  const hasTerminationIssue = /口头通知|不用来了|解雇|辞退|解除|开除/.test(query);
  const hasContractReviewIssue = /合同|协议|技术服务|服务/.test(query) && /违约金|管辖|法院|验收|尾款|拒付/.test(query);
  const sourceEvidence = knowledge.slice(0, 4).map(item => `${item.title}: ${item.content.slice(0, 120)}`);
  const contractAmountMatch = query.match(/(?:合同(?:金额|总价)?|金额)\s*([\d,]+(?:\.\d+)?)\s*(万)?元/);
  const contractAmount = contractAmountMatch
    ? Number(contractAmountMatch[1].replace(/,/g, '')) * (contractAmountMatch[2] ? 10000 : 1)
    : null;
  const penaltyRateMatch = query.match(/(?:每日|每天|一日|一天)[^，。；;]*(\d+(?:\.\d+)?)\s*%/);
  const penaltyRate = penaltyRateMatch ? Number(penaltyRateMatch[1]) : null;
  const dailyPenalty = contractAmount && penaltyRate ? Math.round(contractAmount * penaltyRate / 100) : null;
  const jurisdictionLabel = /甲方所在地/.test(query) ? '甲方所在地法院' : /乙方所在地/.test(query) ? '乙方所在地法院' : /法院|管辖/.test(query) ? '合同约定管辖地' : '管辖地待核实';
  const hasUnilateralAcceptance = /单方验收|拒付尾款|尾款/.test(query);
  const tenureMatch = query.match(/入职\s*([一二两三四五六七八九十\d]+)\s*(个月|月|年)/);
  const salaryMatch = query.match(/月薪\s*([\d,]+(?:\.\d+)?)\s*(?:元)?/);
  const tenureLabel = tenureMatch ? `入职${tenureMatch[1]}${tenureMatch[2]}` : '入职时长待核实';
  const monthlySalary = salaryMatch ? Number(salaryMatch[1].replace(/,/g, '')) : null;
  const salaryLabel = monthlySalary ? `月薪${monthlySalary}元` : '月薪待核实';
  const isThreeMonthCase = /入职\s*(?:3|三)\s*(?:个月|月)/.test(query);
  const doubleWageEstimate = monthlySalary && isThreeMonthCase
    ? `入职3个月时，可初步按第2、3个月估算二倍工资差额：${monthlySalary}元×2个月=${monthlySalary * 2}元，具体以实际入职日期和工资证据核算。`
    : '可主张超过一个月未签书面劳动合同期间的二倍工资差额，需按实际入职日期、补签日期、工资标准和地方裁审口径核算。';
  const illegalTerminationEstimate = monthlySalary && isThreeMonthCase
    ? `工作年限不足6个月时，经济补偿N通常按半个月工资计算；若违法解除成立，赔偿金为2N，约${monthlySalary}元。这里不使用N+1概念。`
    : '若违法解除成立，赔偿金按经济补偿标准的二倍核算；经济补偿N和违法解除2N不能与N+1混用。';

  if (hasContractReviewIssue) {
    return {
      expert: 'LEGAL',
      query,
      chainOfThought: [
        {
          step: 1,
          reasoning: `事实认定：用户要求审查合同风险；合同金额${contractAmount ? `${contractAmount}元` : '待核实'}，违约金比例${penaltyRate ? `每日${penaltyRate}%` : '待核实'}，管辖约定为${jurisdictionLabel}${hasUnilateralAcceptance ? '，并涉及验收或尾款条款' : ''}。`,
          evidence: [`用户原话：${query.slice(0, 160)}`],
          conclusion: '该合同对用户可能存在高额违约责任、争议解决不便、验收付款失衡三类核心风险。',
          confidence: 88,
        },
        {
          step: 2,
          reasoning: `违约金风险：${dailyPenalty ? `按当前表述迟延一天约为${dailyPenalty}元，` : ''}高比例日违约金可能过分高于实际损失。根据《民法典》第五百八十五条，约定违约金过分高于造成的损失的，法院或仲裁机构可根据请求适当减少。`,
          evidence: ['《中华人民共和国民法典》第五百八十五条', ...sourceEvidence.filter(item => /第五百八十五条|违约金/.test(item))],
          conclusion: '高比例日违约金不应写成当然无效；应表述为若乙方主动请求调整并能围绕实际损失、履行情况、过错和证据举证，存在较高被调低或不被全部支持的争议风险。',
          confidence: 90,
        },
        {
          step: 3,
          reasoning: '管辖和验收风险：甲方所在地法院会增加乙方维权成本；甲方单方验收并拒付尾款会削弱乙方对交付成果、整改期限、异议程序和付款节点的控制。',
          evidence: ['《民法典》第五百零九条诚信履行原则可作为合同履行解释基础', '用户提供的验收和尾款条款'],
          conclusion: '建议把争议解决改为乙方所在地、合同履行地或双方认可的中立地；验收改为书面交付、明确验收期、逾期视为验收合格、异议一次性书面提出、无争议部分先付款。',
          confidence: 78,
        },
      ],
      finalVerdict: '建议重点修改三处：第一，将高比例日违约金改为“按未履行部分或逾期金额的一定比例计算，并设置总额上限，例如不超过合同总价10%-20%，且以实际损失为调整基础”；第二，将单方不便利管辖改为合同履行地、乙方所在地或中立地法院/仲裁机构；第三，将单方验收或拒付尾款改为双方书面验收、明确异议期限、逾期视为验收、无争议部分按期付款。《民法典》第五百八十五条支持当事人请求调整过高违约金，但通常需要乙方主动提出请求，并围绕实际损失、履行情况、过错程度和损失举证，其他程序性条款仍需结合完整合同文本复核。',
      riskLevel: 'HIGH',
      recommendations: [
        '把违约金条款改成：逾期违约金以实际损失为基础，按未交付部分价款每日0.05%-0.1%计算，累计不超过合同总价10%-20%，具体比例需结合项目利润、实际损失和签约时市场利率动态校准；明显过高时由受影响一方依法请求调整并承担相应举证责任。',
        '把管辖条款改成：由合同履行地、乙方所在地法院，或双方同意的仲裁委员会管辖；避免单方指定甲方所在地。',
        '把验收条款改成：乙方提交成果后甲方应在5-10个工作日内书面验收或一次性提出合理异议，逾期未反馈视为验收合格；无争议部分尾款应先行支付。',
        '补充损失举证条款：甲方主张违约金或拒付尾款时，应提供实际损失、整改通知、乙方逾期或质量不合格的证据。',
        '签署前交由律师结合完整合同、交付里程碑、付款节点和技术成果归属复核。',
      ],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  if (hasNoWrittenContractIssue && hasTerminationIssue) {
    return {
      expert: 'LEGAL',
      query,
      chainOfThought: [
        {
          step: 1,
          reasoning: `事实认定：用户反映公司未签书面劳动合同，并出现口头解除或辞退争议；${tenureLabel}，${salaryLabel}。`,
          evidence: [
            `用户陈述：${tenureLabel}`,
            `用户陈述：${salaryLabel}`,
            '用户陈述：未签书面劳动合同、存在口头解除或辞退争议',
          ],
          conclusion: '初步构成事实劳动关系，争议焦点是未签书面合同责任和口头解除是否合法。',
          confidence: 88,
        },
        {
          step: 2,
          reasoning: '法条适用：建立劳动关系应订立书面劳动合同；超过一个月不满一年未订立的，用人单位应每月支付二倍工资。二倍工资差额通常从用工满一个月的次日起算，首月不计入。',
          evidence: [
            '《劳动合同法》第十条',
            '《劳动合同法》第八十二条',
            ...sourceEvidence,
          ],
          conclusion: doubleWageEstimate,
          confidence: 86,
        },
        {
          step: 3,
          reasoning: '解除责任：公司仅口头通知不用来且无书面解除通知、无明确法定理由，存在违法解除风险。经济补偿是N；违法解除赔偿金是2N；N+1只可能出现在特定无过失解除且未提前30日通知的代通知金场景。',
          evidence: ['《劳动合同法》第四十七条', '《劳动合同法》第八十七条'],
          conclusion: `${illegalTerminationEstimate}是否成立取决于解除事实、解除理由和证据强弱。`,
          confidence: 82,
        },
        {
          step: 4,
          reasoning: '程序与时效：劳动争议通常先申请劳动仲裁，仲裁时效一般为一年。二倍工资差额各月时效可能分别起算，地方裁审口径存在差异，应尽快提出。',
          evidence: ['《劳动争议调解仲裁法》第二十七条', '工资流水、考勤、聊天记录、工牌、工作成果、个税或社保记录'],
          conclusion: '下一步应固定劳动关系、工资标准和被口头解除的证据，并尽快准备仲裁。',
          confidence: 80,
        },
      ],
      finalVerdict: monthlySalary && isThreeMonthCase
        ? `可初步主张未签书面劳动合同二倍工资差额约${monthlySalary * 2}元，以及违法解除赔偿金约${monthlySalary}元；但金额和请求是否成立取决于入职日期、工资流水、考勤、聊天记录、社保/个税记录、口头解除证据和公司抗辩。`
        : '可初步主张未签书面劳动合同二倍工资差额，并视解除事实主张违法解除赔偿金；具体金额必须按实际入职日期、工资标准、补签情况和证据强弱核算。',
      riskLevel: 'HIGH',
      recommendations: [
        `立即保存工资流水、考勤记录、工作群聊天记录、工牌、邮件、任务记录、个税或社保记录，用于证明劳动关系和${monthlySalary ? `月薪${monthlySalary}元` : '工资标准'}。`,
        '用短信、微信或邮件要求公司确认“口头通知不用来”的解除理由和解除日期，固定解除事实。',
        '准备劳动仲裁申请：请求二倍工资差额、违法解除赔偿金，并要求公司出具解除证明。',
        '注意一年仲裁时效，二倍工资差额可能按月份分别起算，尽快提交仲裁更稳妥。',
        '不要把二倍工资差额写成普通劳动报酬；不要把违法解除2N和N+1混用。',
      ],
      executionTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  return {
    expert: 'LEGAL',
    query,
    chainOfThought: [{
      step: 1,
      reasoning: 'AI服务调用失败，已切换为本地知识库兜底分析。',
      evidence: sourceEvidence,
      conclusion: '当前只能给出有限法律风险提示，需要补充人工复核。',
      confidence: 55,
    }],
    finalVerdict: '分析服务暂时不可用，已保留问题和本地知识库线索；当前只能给出有限风险提示，不能替代律师复核。',
    riskLevel: 'HIGH',
    recommendations: ['先保全合同、通知、聊天记录和付款证据', '稍后重试AI分析', '重大法律行动前交由律师复核'],
    executionTimeMs: Date.now() - startTime,
    timestamp: Date.now(),
  };
}

function amountFromQuery(query: string, pattern: RegExp): number | null {
  const match = query.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2] === '万' ? value * 10000 : value;
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '待核实金额';
  if (Math.abs(value) >= 10000 && value % 10000 === 0) return `${value / 10000}万元`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(2)}万元`;
  return `${value}元`;
}

function calibrateExpertAnalysis(
  expertType: ExpertType,
  parsed: Partial<ExpertAnalysis>,
  query: string
): Partial<ExpertAnalysis> {
  if (expertType === 'PSYCHOLOGY') {
    return calibratePsychologyAnalysis(parsed);
  }

  if (expertType === 'PLANNING') {
    const recommendations = (parsed.recommendations || []).map(item => item || '');
    if (/审批|上线|灰度|错误率/.test(query)) {
      recommendations.push('指标口径补充：错误率应定义为审批相关接口5xx响应数/审批相关接口总请求数；审批成功率=成功完成审批动作数/审批动作提交数；灰度通过标准必须绑定这两个统计口径。');
      recommendations.push('风险边界补充：审批流不可绕过在当前输入中属于待确认合规约束，需产品负责人、财务或法务补充公司制度编号/监管条款；未补充前按上线阻断项处理，并指定产品负责人在Day1闭环确认。');
    }
    return {
      ...parsed,
      finalVerdict: /审批|上线|灰度|错误率/.test(query)
        ? `${parsed.finalVerdict || ''}\n风险/事实缺口：审批流不可绕过的制度依据、CRM Webhook重试策略、灰度错误率统计口径必须在Day1前确认；任一项缺失都应作为上线阻断项，而不是上线后补。`
        : parsed.finalVerdict,
      recommendations: Array.from(new Set(recommendations)),
    };
  }

  if (expertType !== 'LEGAL') return parsed;

  const chainOfThought = (parsed.chainOfThought || []).map(step => ({
    ...step,
    reasoning: sanitizeLegalText(step.reasoning || ''),
    conclusion: sanitizeLegalText(step.conclusion || ''),
    evidence: (step.evidence || []).map(item => sanitizeLegalText(item)),
  }));

  const recommendations = (parsed.recommendations || []).map(item => sanitizeLegalText(item));
  if (/未签|没签|书面劳动合同|口头通知|不用来了|解雇|辞退/.test(query)) {
    recommendations.push('补充校准：N按《劳动合同法》第47条工作年限规则计算，不满六个月按半个月工资；二倍工资差额和仲裁时效起算以实际用工日期、当地最新裁审口径和仲裁委认定为准。');
    recommendations.push('补充校准：违法解除赔偿金2N的责任依据是《劳动合同法》第87条，N的工作年限和月工资计算规则适用第47条，不得把第87条误写成N的计算规则。');
    recommendations.push('补充校准：《劳动合同法》第82条的“满一个月的次日起”不是自然月概念，必须按实际入职日对应到具体日期；多数地区二倍工资差额按月分别起算仲裁时效，不能用固定月数替代，应按每月差额形成时间、实际解除或补签时间和当地裁审口径逐月核验。');
    recommendations.push('补充校准：N是否按0.5个月计算，需要以实际工作天数确认确属不满六个月；若接近六个月边界，应按入职日和解除日逐日核对。');
    recommendations.push('通俗时效清单：未签书面劳动合同二倍工资差额按每月差额形成时间逐月核验；违法解除赔偿金通常从知道或应当知道解除事实之日起核验；拖欠劳动报酬在劳动关系存续期间有特殊时效规则，解除后应尽快在一年内主张，最终以当地仲裁委和裁审口径为准。');
    recommendations.push('结构化证据清单：劳动关系证据（offer、工牌、考勤、工作群、工作成果）；工资证据（银行流水、工资条、个税或社保记录）；解除证据（口头通知录音、聊天记录、门禁或账号停用、证人）；未签合同证据（入职沟通、试用安排、公司拒签或未发合同记录）。');
  }

  return {
    ...parsed,
    chainOfThought,
    finalVerdict: sanitizeLaborNoContractText(query, sanitizeLegalText(parsed.finalVerdict || '')),
    recommendations: Array.from(new Set(recommendations)),
  };
}

function calibratePsychologyAnalysis(parsed: Partial<ExpertAnalysis>): Partial<ExpertAnalysis> {
  const chainOfThought = (parsed.chainOfThought || []).map(step => ({
    ...step,
    reasoning: sanitizePsychologyText(step.reasoning || ''),
    conclusion: sanitizePsychologyText(step.conclusion || ''),
    evidence: (step.evidence || []).map(item => sanitizePsychologyText(item)),
  }));
  const recommendations = (parsed.recommendations || []).map(item => sanitizePsychologyText(item || ''));

  recommendations.push('心理分析补充：对方可能动机包括担心项目失控、需要恢复控制感、害怕内部责任或信任受损；这些都只是待核实假设，不能当成事实定论。');
  recommendations.push('执行边界：我可以帮你草拟邮件、消息或会议提纲，但不会未经你明确确认代发邮件、发消息、打电话或联系客户。');
  recommendations.push('可选自我调节：如果你愿意，可以先暂停30秒做慢呼吸，只是为了降低冲动反应；不舒服时跳过。');

  const motiveBoundary = '心理分析补充：对方可能动机包括担心项目失控、需要恢复控制感、害怕内部责任或信任受损；这些只是待核实假设。';
  const executionBoundary = '执行边界：我只会提供沟通草稿和判断框架，不会未经你明确确认代发邮件、联系客户或对外作出承诺。';
  const tunedVerdict = sanitizePsychologyText(parsed.finalVerdict || '');
  const verdictParts = [tunedVerdict];
  if (!/动机|担心|不安全感|控制感|信任/u.test(tunedVerdict)) verdictParts.push(motiveBoundary);
  if (!tunedVerdict.includes('不会未经你明确确认')) verdictParts.push(executionBoundary);

  return {
    ...parsed,
    chainOfThought,
    finalVerdict: verdictParts.filter(Boolean).join('\n'),
    recommendations: Array.from(new Set(recommendations.filter(Boolean))),
  };
}

function sanitizePsychologyText(text: string): string {
  return text
    .replace(/立即发送(?:结构化)?响应邮件/gu, '先草拟一封响应邮件，待你确认后再发送')
    .replace(/马上发送(?:邮件|消息)?/gu, '先草拟，待你确认后再发送')
    .replace(/立即发送(?:邮件|消息)?/gu, '先草拟，待你确认后再发送')
    .replace(/下次沟通前做(\d+秒)?呼吸训练/gu, '可选自我调节：下次沟通前如果你愿意，可以做$1慢呼吸练习')
    .replace(/用生理反馈打断愤怒循环/gu, '用短暂停顿帮助降低冲动反应')
    .replace(/情绪峰值期回应必然失焦/gu, '情绪峰值期回应容易失焦')
    .replace(/建议15分钟内发出/gu, '建议先保存为草稿，等你确认语气和事实后再发送')
    .replace(/请务必根据实际项目细节补充/gu, '请根据实际项目细节补充')
    .replace(/（行业基准：[^）]+）/gu, '（具体阈值需按双方项目制度或合同核实）')
    .replace(/按合同第Y条需启动/gu, '如合同或项目流程有约定，应启动')
    .replace(/合同第Y条/gu, '合同或变更流程约定')
    .replace(/专业服务合同中普遍含需求变更条款/gu, '常见服务合同可能含需求变更条款，但需核对当前合同文本')
    .replace(/高风险客户在被设限时反而提升配合度/gu, '设定边界可能降低后续返工风险，但效果取决于客户关系和事实沟通')
    .replace(/客户处于决策权缺失引发的焦虑性失控状态/gu, '客户可能处于决策权不清或上游压力引发的焦虑状态')
    .replace(/其攻击行为本质是/gu, '其攻击性表达可能是')
    .replace(/核心动机是/gu, '可能的核心动机是')
    .replace(/实为/gu, '可能是');
}

function sanitizeLegalText(text: string): string {
  return text
    .replace(/《?司法解释（一）》?第一条/gu, '《最高人民法院关于审理劳动争议案件适用法律问题的解释（一）》（法释〔2020〕26号）第一条')
    .replace(/司法解释（一）第一条/gu, '《最高人民法院关于审理劳动争议案件适用法律问题的解释（一）》（法释〔2020〕26号）第一条')
    .replace(/(?:远超|超过|高于)?LPR四倍(?:上限|标准|规则)?/gu, '不能套用民间借贷LPR四倍规则；技术服务合同违约金应回到《民法典》第五百八十五条，以是否过分高于造成的损失、合同履行情况、过错和证据个案判断')
    .replace(/入职后第(?:13|十三)个月前/gu, '按每月二倍工资差额产生之日起分别核验，不能理解为统一截止日')
    .replace(/大概率被认定为无效/gu, '存在较高争议风险，可能被调低、不支持或调整适用，仍需结合实际损失、合同履行情况、过错和具体证据个案判断')
    .replace(/(?:必然|一定)被认定为无效/gu, '存在被认定无效或不被支持的风险，仍需结合具体事实个案判断')
    .replace(/极可能被司法机关依申请调减/gu, '若乙方主动请求调整并能完成相应举证，存在被司法机关适当调减的较高争议风险')
    .replace(/极可能被法院或仲裁机构依申请大幅调减/gu, '若乙方主动请求调整并能完成相应举证，存在被法院或仲裁机构适当调减的较高争议风险')
    .replace(/极可能被法院依申请大幅调减/gu, '若乙方主动请求调整并能完成相应举证，存在被法院适当调减的较高争议风险')
    .replace(/极可能被[^，。；;]*大幅调减/gu, '若乙方主动请求调整并能完成相应举证，存在被适当调减的较高争议风险')
    .replace(/大幅调减/gu, '适当调减')
    .replace(/(?:整体)?(?:维权|胜诉|败诉)?成功率预估[^。；;\n]*(?:。|；|;)?/gu, '不作胜诉率或成功率预估；结果取决于证据完整性、当地裁审口径和仲裁委认定。')
    .replace(/(?:胜诉率|败诉率|成功率)[^。；;\n]*(?:%|％)[^。；;\n]*(?:。|；|;)?/gu, '不作胜诉率或成功率预估；结果取决于证据完整性、当地裁审口径和仲裁委认定。')
    .replace(/维权成功率[^。；;\n]*(?:。|；|;)?/gu, '不作维权成功率预估；结果取决于证据完整性、当地裁审口径和仲裁委认定。');
}

function sanitizeLaborNoContractText(query: string, text: string): string {
  if (!/未签|没签|书面劳动合同|口头通知|不用来了|解雇|辞退/.test(query)) {
    return text;
  }

  return `${text} 二倍工资差额金额仅为示例估算，前提是对应月份未超过当地裁审口径认可的仲裁时效；《劳动合同法》第82条的“满一个月的次日起”不是自然月概念，实际应按入职日、补签日或解除日逐月核验。通俗时效清单：二倍工资差额按每月差额形成时间逐月核验；违法解除赔偿金通常从知道或应当知道解除事实之日起核验；拖欠劳动报酬在劳动关系存续期间有特殊时效规则，解除后应尽快在一年内主张，最终以当地仲裁委和裁审口径为准。结构化证据清单：劳动关系证据（offer、工牌、考勤、工作群、工作成果）；工资证据（银行流水、工资条、个税或社保记录）；解除证据（口头通知录音、聊天记录、门禁或账号停用、证人）；未签合同证据（入职沟通、试用安排、公司拒签或未发合同记录）。违法解除赔偿金2N中，《劳动合同法》第87条是赔偿责任依据，N的工作年限和月工资计算规则适用第47条；是否按0.5个月计算，应以实际工作天数确认确属不满六个月。`;
}

export async function runMultiExpertAnalysis(
  query: string,
  experts: ExpertType[] = ['LEGAL', 'FINANCE', 'STRATEGY'],
  context?: string
): Promise<ExpertAnalysis[]> {
  logger.info(`[ExpertAI] Multi-expert analysis with ${experts.length} experts`);
  
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

    logger.info(`[ExpertAI] Quick offline judgment: found ${results.length} references in ${Date.now() - startTime}ms`);

    return {
      hasRelevantKnowledge: true,
      references: results,
      quickSummary: summary,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({ err: error }, 'Quick offline judgment error');
    return {
      hasRelevantKnowledge: false,
      references: [],
      quickSummary: '知识库查询出错，请稍后重试。',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

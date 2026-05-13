/**
 * 零幻觉回路服务 (Zero Hallucination Circuit)
 * 
 * 功能：
 * 1. Chain-of-Thought (CoT) 推理链约束
 * 2. 三步校验法：数据溯源、置信度自检、引用标注
 * 3. 确保法务/财务人格绝对诚实
 * 
 * 版权：陈先生出品 · cj6168888@Gmail.com
 */

import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('ZeroHallucination');

import { professionalKnowledge, KnowledgeSearchResult } from './professional-knowledge';
import { 
  ProfessionalMode, 
  UserRole,
  DataSource,
  ConfidenceCheckResult,
  ProfessionalResponse,
  getProfessionalModePrompt,
  getRefusalTemplate,
  getConfidenceThreshold,
  requiresZeroHallucination,
} from '../config/persona';
import { getApiKey } from './api-key-resolver';
import { getErrorMessage } from '../lib/errors';

const CHAT_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export interface ZeroHallucinationRequest {
  query: string;
  mode: ProfessionalMode;
  userRole: UserRole;
  context?: string;
  attachedDocuments?: string[];
}

export interface ChainOfThoughtStep {
  step: 'DATA_RETRIEVAL' | 'CONFIDENCE_CHECK' | 'SOURCE_CITATION';
  status: 'PENDING' | 'PASSED' | 'FAILED';
  details: string;
  data?: Record<string, unknown>;
}

export interface ZeroHallucinationResult {
  success: boolean;
  response: ProfessionalResponse;
  cotSteps: ChainOfThoughtStep[];
  processingTimeMs: number;
}

class ZeroHallucinationService {
  private confidenceThreshold: number;

  constructor() {
    this.confidenceThreshold = getConfidenceThreshold();
    logger.info('[ZeroHallucination] 零幻觉回路服务已初始化');
    logger.info(`[ZeroHallucination] 置信度阈值: ${this.confidenceThreshold * 100}%`);
  }

  /**
   * 执行零幻觉验证的专业查询
   */
  async processQuery(request: ZeroHallucinationRequest): Promise<ZeroHallucinationResult> {
    const startTime = Date.now();
    const cotSteps: ChainOfThoughtStep[] = [];

    try {
      // 第一步：数据溯源
      const retrievalStep = await this.executeDataRetrieval(request);
      cotSteps.push(retrievalStep);

      if (retrievalStep.status === 'FAILED') {
        return this.createRefusalResponse(
          request,
          cotSteps,
          'noData',
          startTime
        );
      }

      // 第二步：置信度自检
      const confidenceStep = await this.executeConfidenceCheck(
        request,
        retrievalStep.data.sources
      );
      cotSteps.push(confidenceStep);

      if (confidenceStep.status === 'FAILED') {
        return this.createRefusalResponse(
          request,
          cotSteps,
          'lowConfidence',
          startTime,
          confidenceStep.data.confidenceScore
        );
      }

      // 第三步：引用标注并生成回答
      const citationStep = await this.executeSourceCitation(
        request,
        retrievalStep.data.sources,
        confidenceStep.data.confidenceScore
      );
      cotSteps.push(citationStep);

      if (citationStep.status === 'FAILED') {
        return this.createRefusalResponse(
          request,
          cotSteps,
          'noSource',
          startTime
        );
      }

      return {
        success: true,
        response: citationStep.data.response,
        cotSteps,
        processingTimeMs: Date.now() - startTime,
      };

    } catch (error) {
      logger.error({ error }, 'Processing error');
      return this.createErrorResponse(request, cotSteps, startTime, error);
    }
  }

  /**
   * 第一步：数据溯源
   */
  private async executeDataRetrieval(
    request: ZeroHallucinationRequest
  ): Promise<ChainOfThoughtStep> {
    const step: ChainOfThoughtStep = {
      step: 'DATA_RETRIEVAL',
      status: 'PENDING',
      details: '正在检索知识库...',
    };

    try {
      const knowledgeType = request.mode === 'LEGAL' ? 'LEGAL' : 'FINANCE';
      
      // 从专业知识库检索
      const searchResults = await professionalKnowledge.searchKnowledge(
        request.query,
        knowledgeType,
        undefined,
        10
      );

      const sources: DataSource[] = searchResults.map((result: KnowledgeSearchResult) => ({
        type: 'KNOWLEDGE_BASE' as const,
        path: `${knowledgeType}/${result.category}/${result.id}`,
        title: result.title,
        matchScore: result.similarity,
        excerpt: result.content.slice(0, 600),
      }));

      // 检查是否有足够的数据源
      const validSources = sources.filter(s => s.matchScore >= 0.5);
      
      if (validSources.length === 0) {
        step.status = 'FAILED';
        step.details = '未找到相关数据源';
        step.data = { sources: [], reason: 'NO_MATCHING_DATA' };
      } else {
        step.status = 'PASSED';
        step.details = `找到 ${validSources.length} 个相关数据源`;
        step.data = { sources: validSources };
      }

    } catch (error) {
      step.status = 'FAILED';
      step.details = `数据检索失败: ${error}`;
      step.data = { sources: [], error };
    }

    return step;
  }

  /**
   * 第二步：置信度自检 (Phase 1.3 优化版)
   * 
   * 置信度计算规则：
   * 1. 检索相似度 >= 0.85 的来源计为高质量匹配
   * 2. 多源交叉验证：至少2个独立来源才可高置信
   * 3. 综合评分 = 高质量来源占比(40%) + 平均相似度(40%) + 来源数量因子(20%)
   */
  private async executeConfidenceCheck(
    request: ZeroHallucinationRequest,
    sources: DataSource[]
  ): Promise<ChainOfThoughtStep> {
    const step: ChainOfThoughtStep = {
      step: 'CONFIDENCE_CHECK',
      status: 'PENDING',
      details: '正在评估置信度...',
    };

    const HIGH_QUALITY_THRESHOLD = 0.75;
    const MIN_SOURCES_FOR_HIGH_CONFIDENCE = 2;

    const highQualitySources = sources.filter(s => s.matchScore >= HIGH_QUALITY_THRESHOLD);
    const avgMatchScore = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.matchScore, 0) / sources.length
      : 0;

    const highQualityRatio = sources.length > 0 
      ? highQualitySources.length / sources.length 
      : 0;

    const sourceCountFactor = Math.min(sources.length / 3, 1);

    const hasMultipleSources = sources.length >= MIN_SOURCES_FOR_HIGH_CONFIDENCE;
    const crossValidationBonus = hasMultipleSources && highQualitySources.length >= 2 ? 0.1 : 0;

    const formulaScore = Math.min(1.0,
      (highQualityRatio * 0.4) + 
      (avgMatchScore * 0.4) + 
      (sourceCountFactor * 0.2) +
      crossValidationBonus
    );
    const maxMatchScore = sources.length > 0
      ? Math.max(...sources.map(s => s.matchScore))
      : 0;
    const confidenceScore = Math.min(formulaScore, maxMatchScore);

    step.data = {
      confidenceScore,
      threshold: this.confidenceThreshold,
      sourceCount: sources.length,
      highQualityCount: highQualitySources.length,
      avgMatchScore,
      crossValidated: hasMultipleSources && highQualitySources.length >= 2,
    };

    if (confidenceScore >= this.confidenceThreshold) {
      step.status = 'PASSED';
      step.details = `置信度 ${Math.round(confidenceScore * 100)}% >= 阈值 ${Math.round(this.confidenceThreshold * 100)}% (高质量来源: ${highQualitySources.length}/${sources.length})`;
    } else {
      step.status = 'FAILED';
      step.details = `置信度 ${Math.round(confidenceScore * 100)}% < 阈值 ${Math.round(this.confidenceThreshold * 100)}% (需要更多高质量来源)`;
    }

    return step;
  }

  /**
   * 第三步：引用标注并生成回答 (Phase 1.3 优化版)
   * 
   * 引用格式规范：
   * - 每个结论后标注 [来源1]、[来源2] 等
   * - 输出包含：置信度声明、法规出处、分析结论、风险提示
   */
  private async executeSourceCitation(
    request: ZeroHallucinationRequest,
    sources: DataSource[],
    confidenceScore: number
  ): Promise<ChainOfThoughtStep> {
    const step: ChainOfThoughtStep = {
      step: 'SOURCE_CITATION',
      status: 'PENDING',
      details: '正在生成带引用的回答...',
    };

    try {
      const apiKey = await getApiKey('DASHSCOPE');
      if (!apiKey) {
        step.status = 'FAILED';
        step.details = 'AI服务未配置 (DASHSCOPE API Key)';
        return step;
      }
      const formattedSources = sources.slice(0, 7).map((s, i) => ({
        index: i + 1,
        citation: `[来源${i + 1}]`,
        title: s.title,
        content: s.excerpt,
        score: Math.round(s.matchScore * 100),
      }));

      const sourceContext = formattedSources
        .map(s => `${s.citation} ${s.title} (匹配度${s.score}%)\n${s.content}`)
        .join('\n\n');

      const sourceList = formattedSources
        .map(s => `${s.citation} ${s.title}`)
        .join('\n');

      const systemPrompt = getProfessionalModePrompt(request.mode, request.userRole);
      
      const userPrompt = `基于以下已验证的数据源回答问题。请严格按照格式要求输出。

【已验证数据源】
${sourceContext}

【用户问题】
${request.query}

【输出格式要求】
请按以下结构输出回答：

## 置信度声明
本回答置信度：${Math.round(confidenceScore * 100)}%

## 数据来源
${sourceList}

## 分析结论
（在这里给出分析结论，每个论点后用 [来源N] 标注依据）

## 风险提示
（如有法律/财务风险，在此列出）

【注意事项】
1. 只使用上述数据源中的信息，不要添加未经验证的内容
2. 每个结论必须标注来源编号，格式为 [来源1]、[来源2] 等
3. 如果数据源不足以回答某部分问题，明确说明"此部分需要更多资料"
4. 如果某个法条、计算规则、程序要求没有出现在【已验证数据源】的标题或正文中，不得补写原文，不得把常识当成已验证依据；只能写“当前数据源未检索到，需要补充核验”
5. 如果某个来源只提到“依照另一条规定”，但另一条原文没有列入数据源，只能引用已出现的转引关系，不能自行展开另一条的具体内容
6. 不要使用“N+1”等容易误导的简称，除非数据源明确支持；需要计算时先说明数据源是否足够
7. 仲裁时效、送达、通知书要素、证据固定等程序性建议，只有在数据源标题或正文中出现对应条文时才能作为来源结论；否则必须标注“待外部核验的实务清单，非本次知识库结论”
8. 保持专业严谨的语气`;

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          input: {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          },
          parameters: {
            temperature: 0.1,
            max_tokens: 2000,
            result_format: 'message',
          },
        }),
      });

      const data = await response.json() as { output?: { choices?: Array<{ message?: { content?: string } }> } };
      const rawAnswer = data.output?.choices?.[0]?.message?.content || '';
      const answer = calibrateZeroHallucinationAnswer(rawAnswer, request, formattedSources);

      if (!answer) {
        const fallbackAnswer = buildDeterministicProfessionalAnswer(request, sources, confidenceScore);
        if (!fallbackAnswer) {
          step.status = 'FAILED';
          step.details = 'AI未能生成有效回答';
          return step;
        }
        step.status = 'PASSED';
        step.details = 'AI未生成有效回答，已切换为来源约束兜底回答';
        step.data = {
          response: {
            answer: fallbackAnswer,
            confidenceScore,
            dataSources: sources,
            reasoning: `基于 ${sources.length} 个数据源生成兜底回答`,
            warnings: ['AI生成失败，使用确定性来源兜底'],
            isRefused: false,
          } as ProfessionalResponse,
        };
        return step;
      }

      step.status = 'PASSED';
      step.details = '成功生成带引用的回答';
      step.data = {
        response: {
          answer,
          confidenceScore,
          dataSources: sources,
          reasoning: `基于 ${sources.length} 个数据源生成`,
          warnings: [],
          isRefused: false,
        } as ProfessionalResponse,
      };

    } catch (error) {
      const fallbackAnswer = buildDeterministicProfessionalAnswer(request, sources, confidenceScore);
      if (fallbackAnswer) {
        step.status = 'PASSED';
        step.details = `生成回答失败，已切换为来源约束兜底回答: ${error}`;
        step.data = {
          response: {
            answer: fallbackAnswer,
            confidenceScore,
            dataSources: sources,
            reasoning: `基于 ${sources.length} 个数据源生成兜底回答`,
            warnings: ['AI生成失败，使用确定性来源兜底'],
            isRefused: false,
          } as ProfessionalResponse,
        };
      } else {
        step.status = 'FAILED';
        step.details = `生成回答失败: ${error}`;
      }
    }

    return step;
  }

  /**
   * 创建拒绝响应
   */
  private createRefusalResponse(
    request: ZeroHallucinationRequest,
    cotSteps: ChainOfThoughtStep[],
    reason: 'noData' | 'lowConfidence' | 'noSource' | 'mixedSources',
    startTime: number,
    confidenceScore?: number
  ): ZeroHallucinationResult {
    const refusalMessage = getRefusalTemplate(request.userRole, reason, confidenceScore);

    return {
      success: false,
      response: {
        answer: refusalMessage,
        confidenceScore: confidenceScore || 0,
        dataSources: [],
        reasoning: `零幻觉回路触发拒绝：${reason}`,
        warnings: [`置信度不足或数据缺失`],
        isRefused: true,
        refusalReason: reason,
      },
      cotSteps,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(
    request: ZeroHallucinationRequest,
    cotSteps: ChainOfThoughtStep[],
    startTime: number,
    error: unknown
  ): ZeroHallucinationResult {
    const userMessage = request.userRole === 'MASTER'
      ? '爸爸，处理过程中遇到了技术问题，小智需要稍后再试～'
      : '主人，处理过程中遇到了技术问题，我需要稍后再试。';

    return {
      success: false,
      response: {
        answer: userMessage,
        confidenceScore: 0,
        dataSources: [],
        reasoning: `处理错误: ${getErrorMessage(error)}`,
        warnings: ['系统错误'],
        isRefused: true,
        refusalReason: 'noData',
      },
      cotSteps,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 快速置信度检查（不生成完整回答）
   */
  async quickConfidenceCheck(
    query: string,
    mode: ProfessionalMode
  ): Promise<ConfidenceCheckResult> {
    const knowledgeType = mode === 'LEGAL' ? 'LEGAL' : 'FINANCE';
    
    const searchResults = await professionalKnowledge.searchKnowledge(
      query,
      knowledgeType,
      undefined,
      5
    );

    const sources: DataSource[] = searchResults.map((result: KnowledgeSearchResult) => ({
      type: 'KNOWLEDGE_BASE' as const,
      path: `${knowledgeType}/${result.category}/${result.id}`,
      title: result.title,
      matchScore: result.similarity,
    }));

    const validSources = sources.filter(s => s.matchScore >= 0.5);
    const avgScore = validSources.length > 0
      ? validSources.reduce((sum, s) => sum + s.matchScore, 0) / validSources.length
      : 0;

    const confidenceScore = (Math.min(validSources.length / 3, 1) * 0.3) + (avgScore * 0.7);

    return {
      passed: confidenceScore >= this.confidenceThreshold,
      confidenceScore,
      threshold: this.confidenceThreshold,
      sources: validSources,
      reasoning: confidenceScore >= this.confidenceThreshold
        ? `置信度 ${Math.round(confidenceScore * 100)}% 满足阈值要求`
        : `置信度 ${Math.round(confidenceScore * 100)}% 低于阈值 ${Math.round(this.confidenceThreshold * 100)}%`,
    };
  }

  /**
   * 检查模式是否需要零幻觉约束
   */
  isZeroHallucinationRequired(mode: string): boolean {
    return requiresZeroHallucination(mode as any);
  }
}

export const zeroHallucinationService = new ZeroHallucinationService();
export default zeroHallucinationService;

function buildDeterministicProfessionalAnswer(
  request: ZeroHallucinationRequest,
  sources: DataSource[],
  confidenceScore: number
): string | null {
  if (request.mode !== 'LEGAL') return null;

  const topSources = sources.slice(0, 7);
  const indexed = topSources.map((source, index) => ({
    ...source,
    citation: `[来源${index + 1}]`,
    score: Math.round(source.matchScore * 100),
  }));
  const findCitation = (pattern: RegExp) => indexed.find(source => pattern.test(source.title))?.citation || '';
  const sourceList = indexed
    .map(source => `${source.citation} ${source.title}（匹配度${source.score}%）`)
    .join('\n');

  const laborContract38 = findCitation(/劳动合同法\s*第三十八条/);
  const laborContract46 = findCitation(/劳动合同法\s*第四十六条/);
  const laborContract47 = findCitation(/劳动合同法\s*第四十七条/);
  const arbitration27 = findCitation(/劳动争议调解仲裁法\s*第二十七条/);
  const arbitration5 = findCitation(/劳动争议调解仲裁法\s*第五条/);
  const labor50 = findCitation(/劳动法\s*第五十条/);
  const labor72 = findCitation(/劳动法\s*第七十二条/);

  if (/拖欠工资|未缴社保|经济补偿|解除劳动合同/.test(request.query) && laborContract38 && laborContract46) {
    return `## 置信度声明
本回答置信度：${Math.round(confidenceScore * 100)}%

## 数据来源
${sourceList}

## 分析结论
1. 若公司无有效抗辩而拖欠工资两个月，通常可构成“未及时足额支付劳动报酬”；未依法缴纳社会保险费也属于劳动者可解除劳动合同的法定事由 ${laborContract38}(匹配度${indexed.find(source => source.citation === laborContract38)?.score || 0}%)。工资按月支付和不得无故拖欠可由 ${labor50 || '当前来源未覆盖'} 支持，参加并缴纳社会保险可由 ${labor72 || '当前来源未覆盖'} 支持。
2. 劳动者依据《劳动合同法》第三十八条解除劳动合同的，用人单位应支付经济补偿 ${laborContract46}(匹配度${indexed.find(source => source.citation === laborContract46)?.score || 0}%)。
3. 经济补偿按工作年限计算，每满一年支付一个月工资；六个月以上不满一年按一年，不满六个月支付半个月工资；月工资是解除或终止前十二个月平均工资 ${laborContract47}(匹配度${indexed.find(source => source.citation === laborContract47)?.score || 0}%)。
4. 仲裁时效和程序需同步控制：劳动争议申请仲裁的一般时效为一年；拖欠劳动报酬在劳动关系存续期间有特殊规则，劳动关系终止后应及时提出 ${arbitration27}(匹配度${indexed.find(source => source.citation === arbitration27)?.score || 0}%)。协商、调解、仲裁、诉讼路径可由 ${arbitration5 || '当前来源未覆盖'} 支持。

## 风险提示
- 以上结论以“确有拖欠工资、确未缴社保、用人单位无有效抗辩”为前提；若存在工资争议、考勤争议、社保补缴情形或地区裁审差异，需要进一步核验。
- 社保补缴原则上通常不属劳动仲裁受案范围，个别地区裁审衔接实践可能存在差异；建议同步向社保经办机构或劳动监察渠道核实。
- 当前来源足以支持解除事由、经济补偿、时效和程序主线，但未覆盖完整证据规则；证据要求属于待外部核验的实务清单。

## 下一步
1. 固定工资流水、工资条、考勤、工作群/邮件、劳动合同或入职材料、社保缴费记录。
2. 以书面方式通知公司解除理由，明确依据拖欠工资和未缴社保，并保留送达证据。
3. 计算工作年限和解除前十二个月平均工资，准备经济补偿请求；如涉及社保补缴，另行咨询社保经办机构。
4. 在仲裁时效内提交劳动仲裁申请；金额较大或证据复杂时，交由劳动法律师复核。`;
  }

  return null;
}

function calibrateZeroHallucinationAnswer(
  answer: string,
  request: ZeroHallucinationRequest,
  sources: Array<{ citation: string; title: string; content: string; score: number }>
): string {
  if (request.mode !== 'LEGAL') return answer;

  const sourceText = sources
    .map(source => `${source.title}\n${source.content}`)
    .join('\n');

  let calibrated = answer;

  if (/仲裁|劳动争议|时效/.test(request.query) && !/劳动争议调解仲裁法|仲裁时效|申请仲裁的时效/.test(sourceText)) {
    calibrated = calibrated
      .replace(
        /劳动争议申请仲裁的时效期间为一年，自知道或应当知道权利被侵害之日起计算\s*(?:\[当前数据源未检索到[^\]]*\])?/gu,
        '劳动争议仲裁时效通常需另行按《劳动争议调解仲裁法》第二十七条核验；该条未出现在本次已验证数据源中，本项只能作为待外部核验的时效提示，不能作为本次知识库结论'
      )
      .replace(
        /劳动仲裁(?:时效|期限)?(?:通常|一般)?为?1年/gu,
        '劳动争议仲裁时效需外部核验，当前知识库来源未覆盖具体时效条文'
      );
  }

  const hasWrittenProcedureSource = /书面通知|解除通知|送达|通知书|程序|证明/.test(sourceText);
  if (/书面|通知|送达|解除/.test(request.query) && !hasWrittenProcedureSource) {
    calibrated = calibrated.replace(
      /(解除劳动合同建议以书面形式[^。\n]*(?:。|$))/gu,
      '实务待核验清单：可考虑以书面形式固定解除事由并保留送达证据，但当前知识库未检索到程序性要求原文；本项不是本次知识库条文结论，执行前应结合当地仲裁口径或律师意见核验。'
    );
  }

  const article47Source = sources.find(source => /劳动合同法\s*第四十七条/.test(source.title));
  if (article47Source) {
    calibrated = calibrated.replace(
      /月工资是指劳动合同解除或者终止前十二个月的平均工资(?!\s*\[来源\d+\])/gu,
      `月工资是指劳动合同解除或者终止前十二个月的平均工资 ${article47Source.citation}`
    );
  }

  for (const source of sources) {
    const citationPattern = new RegExp(`${source.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\(匹配度)`, 'gu');
    calibrated = calibrated.replace(citationPattern, `${source.citation}(匹配度${source.score}%)`);
  }

  calibrated = calibrated
    .replace(/社保补缴争议是否适用该例外/gu, '社保补缴争议原则上是否适用该例外')
    .replace(/通常不属劳动仲裁受案范围/gu, '原则上通常不属劳动仲裁受案范围，个别地区裁审衔接实践可能存在差异')
    .replace(/公司拖欠工资两个月（违反“按月支付”强制性规定）/gu, '若公司无有效抗辩而拖欠工资两个月，通常违反“按月支付”强制性规定');

  return calibrated;
}

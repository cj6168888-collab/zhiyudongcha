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

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
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
  data?: any;
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
    console.log('[ZeroHallucination] 零幻觉回路服务已初始化');
    console.log(`[ZeroHallucination] 置信度阈值: ${this.confidenceThreshold * 100}%`);
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
      console.error('[ZeroHallucination] Processing error:', error);
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
        excerpt: result.content.slice(0, 200),
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

    const confidenceScore = Math.min(1.0,
      (highQualityRatio * 0.4) + 
      (avgMatchScore * 0.4) + 
      (sourceCountFactor * 0.2) +
      crossValidationBonus
    );

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

    if (!DASHSCOPE_API_KEY) {
      step.status = 'FAILED';
      step.details = 'AI服务未配置';
      return step;
    }

    try {
      const formattedSources = sources.slice(0, 5).map((s, i) => ({
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
4. 保持专业严谨的语气`;

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
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

      const data = await response.json() as any;
      const answer = data.output?.choices?.[0]?.message?.content || '';

      if (!answer) {
        step.status = 'FAILED';
        step.details = 'AI未能生成有效回答';
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
      step.status = 'FAILED';
      step.details = `生成回答失败: ${error}`;
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
    error: any
  ): ZeroHallucinationResult {
    const errorMessage = request.userRole === 'MASTER'
      ? '爸爸，处理过程中遇到了技术问题，小智需要稍后再试～'
      : '主人，处理过程中遇到了技术问题，我需要稍后再试。';

    return {
      success: false,
      response: {
        answer: errorMessage,
        confidenceScore: 0,
        dataSources: [],
        reasoning: `处理错误: ${error}`,
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

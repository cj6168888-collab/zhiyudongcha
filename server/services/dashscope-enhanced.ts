import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DashscopeEnhanced');

import { AVATAR_TOOLS, executeToolCall, type ToolCall, type ToolDefinition } from './aiTools';
import type { RagKnowledge } from '@shared/schema';

interface RagKnowledgeInput {
  category: string;
  title: string;
  content: string;
  keywords?: string[];
  embedding?: string | null;
  sourceFailureId?: string;
  confidence?: number;
  isActive?: number;
  version?: number;
}

interface CalendarEventOptions {
  startDate?: Date;
  daysAhead?: number;
}

interface CalendarEvent {
  startTime?: string | Date;
  title: string;
  location?: string;
}

interface TranscriptSentence {
  text: string;
  begin_time: number;
  end_time: number;
}

type StorageWithExtras = {
  getAllRagKnowledge?: () => Promise<RagKnowledge[]>;
  createRagKnowledge?: (data: RagKnowledgeInput) => Promise<RagKnowledge>;
  getCalendarEvents?: (options: CalendarEventOptions) => Promise<CalendarEvent[]>;
  getHPState?: () => Promise<{ currentHP: number; maxHP: number } | null>;
  [key: string]: unknown;
};

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

const EMBEDDING_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const CHAT_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const MULTIMODAL_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const PARAFORMER_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';
const TEXT2IMAGE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TASK_QUERY_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

export const KNOWLEDGE_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_knowledge',
    description: '搜索知识库，查找相关的历史决策、经验教训、谈判策略等',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词或问题' },
        category: { type: 'string', description: '知识分类: pitfall_guide, negotiation_tactic, legal_pattern, finance_tip, strategy' },
        limit: { type: 'number', description: '返回结果数量，默认5' },
      },
      required: ['query'],
    },
  },
};

export const CALENDAR_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'query_calendar',
    description: '查询日程安排，包括今天、明天或指定日期的事件',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '日期，如: today, tomorrow, 2024-12-25' },
        daysAhead: { type: 'number', description: '查询未来几天的日程，默认1' },
      },
    },
  },
};

export const HEALTH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'check_health_status',
    description: '查询主人的健康状态、HP值、疲劳度等',
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', description: '指标类型: hp, fatigue, mood, all' },
      },
    },
  },
};

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '联网搜索最新信息，查询新闻、资讯、天气、股价、技术文档等实时内容',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词或问题' },
        time_range: { type: 'string', description: '时间范围: day, week, month, year' },
      },
      required: ['query'],
    },
  },
};

export const IMAGE_GENERATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'generate_image',
    description: '根据文字描述生成图片，可用于创意设计、报告配图、素材生成等',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述，越详细越好' },
        style: { type: 'string', description: '风格: realistic, anime, oil_painting, watercolor, sketch' },
        size: { type: 'string', description: '尺寸: 1024*1024, 720*1280, 1280*720' },
      },
      required: ['prompt'],
    },
  },
};

export const CODE_EXECUTION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'execute_code',
    description: '执行Python代码进行数据分析、计算、生成图表等',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Python代码' },
        purpose: { type: 'string', description: '代码用途说明' },
      },
      required: ['code'],
    },
  },
};

export const ENHANCED_TOOLS: ToolDefinition[] = [
  ...AVATAR_TOOLS,
  KNOWLEDGE_SEARCH_TOOL,
  CALENDAR_TOOL,
  HEALTH_TOOL,
  WEB_SEARCH_TOOL,
  IMAGE_GENERATION_TOOL,
  CODE_EXECUTION_TOOL,
];

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!DASHSCOPE_API_KEY) {
    logger.warn('[Embedding] API key not configured');
    return null;
  }

  try {
    const response = await fetch(EMBEDDING_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-v2',
        input: { texts: [text] },
        parameters: { text_type: 'query' },
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'Embedding API error');
      return null;
    }

    const data = await response.json();
    const embedding = data.output?.embeddings?.[0]?.embedding;
    
    if (embedding && Array.isArray(embedding)) {
      logger.info(`[Embedding] Generated vector of ${embedding.length} dimensions`);
      return embedding;
    }
    
    return null;
  } catch (error) {
    logger.error({ err: error }, 'Embedding error');
    return null;
  }
}

export async function batchGenerateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!DASHSCOPE_API_KEY || texts.length === 0) {
    return texts.map(() => null);
  }

  try {
    const response = await fetch(EMBEDDING_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-v2',
        input: { texts: texts.slice(0, 25) },
        parameters: { text_type: 'document' },
      }),
    });

    if (!response.ok) {
      return texts.map(() => null);
    }

    const data = await response.json();
    const embeddings = data.output?.embeddings || [];
    
    return texts.map((_, i) => embeddings[i]?.embedding || null);
  } catch (error) {
    logger.error({ err: error }, 'BatchEmbedding error');
    return texts.map(() => null);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export async function semanticSearch(
  query: string,
  storage: StorageWithExtras,
  options: { category?: string; limit?: number } = {}
): Promise<Array<{ id: string; title: string; content: string; score: number }>> {
  const { category, limit = 5 } = options;
  
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    logger.info('[SemanticSearch] Falling back to keyword search');
    return keywordSearch(query, storage, { category, limit });
  }

  try {
    const allKnowledge = await storage.getAllRagKnowledge?.() || [];
    
    const filtered = category 
      ? allKnowledge.filter(k => k.category === category && k.isActive)
      : allKnowledge.filter(k => k.isActive);

    const scored = filtered
      .map(k => {
        let score = 0;
        if (k.embedding) {
          try {
            const docEmbedding = JSON.parse(k.embedding);
            score = cosineSimilarity(queryEmbedding, docEmbedding);
          } catch {}
        }
        
        const keywords = k.keywords || [];
        const queryLower = query.toLowerCase();
        const keywordBoost = keywords.some(kw => queryLower.includes(kw.toLowerCase())) ? 0.1 : 0;
        
        return {
          id: k.id,
          title: k.title,
          content: k.content,
          score: score + keywordBoost,
        };
      })
      .filter(k => k.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    logger.info(`[SemanticSearch] Found ${scored.length} results for "${query.slice(0, 30)}..."`);
    return scored;
  } catch (error) {
    logger.error({ err: error }, 'SemanticSearch error');
    return [];
  }
}

async function keywordSearch(
  query: string,
  storage: StorageWithExtras,
  options: { category?: string; limit?: number } = {}
): Promise<Array<{ id: string; title: string; content: string; score: number }>> {
  const { category, limit = 5 } = options;
  
  try {
    const allKnowledge = await storage.getAllRagKnowledge?.() || [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    const filtered = category 
      ? allKnowledge.filter(k => k.category === category && k.isActive)
      : allKnowledge.filter(k => k.isActive);

    const scored = filtered
      .map(k => {
        const titleLower = k.title.toLowerCase();
        const contentLower = k.content.toLowerCase();
        
        let score = 0;
        for (const word of queryWords) {
          if (titleLower.includes(word)) score += 0.3;
          if (contentLower.includes(word)) score += 0.1;
        }
        
        const keywords = k.keywords || [];
        for (const kw of keywords) {
          if (queryLower.includes(kw.toLowerCase())) score += 0.2;
        }
        
        return { id: k.id, title: k.title, content: k.content, score };
      })
      .filter(k => k.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  } catch (error) {
    logger.error({ err: error }, 'KeywordSearch error');
    return [];
  }
}

export async function executeEnhancedToolCall(
  toolCall: ToolCall,
  storage: StorageWithExtras
): Promise<string> {
  const { name, arguments: argsString } = toolCall.function;
  let args: Record<string, unknown> = {};
  
  try {
    args = JSON.parse(argsString || '{}');
  } catch {
    args = {};
  }

  logger.info({ tool: name, args }, `[EnhancedTool] Executing: ${name}`);

  switch (name) {
    case 'search_knowledge': {
      if (!storage.getAllRagKnowledge) {
        logger.info('[EnhancedTool] search_knowledge: storage.getAllRagKnowledge not available');
        return '知识库功能暂未启用。';
      }
      const results = await semanticSearch(String(args.query || ''), storage, {
        category: args.category as string | undefined,
        limit: (args.limit as number) || 5,
      });
      
      if (results.length === 0) {
        return '知识库中暂无相关内容。';
      }
      
      return results.map((r, i) => 
        `${i + 1}. [${r.title}] (相关度: ${(r.score * 100).toFixed(0)}%)\n   ${r.content.slice(0, 150)}...`
      ).join('\n\n');
    }

    case 'query_calendar': {
      if (!storage.getCalendarEvents) {
        logger.info('[EnhancedTool] query_calendar: storage.getCalendarEvents not available');
        return '日程功能暂未启用。';
      }
      const dateArg = args.date as string | undefined;
      const events = await storage.getCalendarEvents({
        startDate: dateArg === 'today' ? new Date() : 
                   dateArg === 'tomorrow' ? new Date(Date.now() + 86400000) :
                   dateArg ? new Date(dateArg) : new Date(),
        daysAhead: (args.daysAhead as number) || 1,
      });
      
      if (!events || events.length === 0) {
        return '今天没有安排的日程。';
      }
      
      return events.map((e: CalendarEvent) => 
        `[${e.startTime ? new Date(e.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '全天'}] ${e.title}${e.location ? ` @ ${e.location}` : ''}`
      ).join('\n');
    }

    case 'check_health_status': {
      if (!storage.getHPState) {
        logger.info('[EnhancedTool] check_health_status: storage.getHPState not available');
        return 'HP状态功能暂未启用。';
      }
      const hpState = await storage.getHPState();
      const metric = (args.metric as string) || 'all';
      
      if (metric === 'hp' || metric === 'all') {
        const hp = hpState?.currentHP || 100;
        const maxHP = hpState?.maxHP || 100;
        const percentage = ((hp / maxHP) * 100).toFixed(0);
        
        let status = '状态良好';
        if (hp < 30) status = '能量不足，需要休息';
        else if (hp < 60) status = '略有疲惫';
        
        return `HP: ${hp}/${maxHP} (${percentage}%)\n状态: ${status}`;
      }
      
      return 'HP状态查询完成';
    }

    case 'web_search': {
      const searchResult = await webSearchWithQwen(String(args.query || ''), args.time_range as string | undefined);
      return searchResult;
    }

    case 'generate_image': {
      const imageResult = await generateImageWithWanxiang(String(args.prompt || ''), {
        style: args.style as string | undefined,
        size: args.size as string | undefined,
      });
      return imageResult;
    }

    case 'execute_code': {
      const codeResult = await executeCodeSandbox(String(args.code || ''), args.purpose as string | undefined);
      return codeResult;
    }

    default:
      return await executeToolCall(toolCall, storage as unknown as Parameters<typeof executeToolCall>[1]);
  }
}

export async function analyzeImage(
  imageUrl: string,
  prompt: string = '请描述这张图片的内容'
): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    return '图像分析功能需要配置API密钥';
  }

  try {
    const response = await fetch(MULTIMODAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        input: {
          messages: [{
            role: 'user',
            content: [
              { image: imageUrl },
              { text: prompt },
            ],
          }],
        },
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'ImageAnalysis API error');
      return '图像分析暂时不可用';
    }

    const data = await response.json();
    return data.output?.choices?.[0]?.message?.content?.[0]?.text || '无法分析图像';
  } catch (error) {
    logger.error({ err: error }, 'ImageAnalysis error');
    return '图像分析出错';
  }
}

export async function extractInvoiceInfo(imageUrl: string): Promise<{
  vendorName?: string;
  invoiceNumber?: string;
  date?: string;
  amount?: number;
  items?: string[];
  raw?: string;
}> {
  const prompt = `请仔细分析这张发票图片，提取以下信息：
1. 商家/供应商名称
2. 发票号码
3. 日期
4. 总金额
5. 主要商品/服务项目

请以JSON格式返回，字段为: vendorName, invoiceNumber, date, amount, items`;

  const result = await analyzeImage(imageUrl, prompt);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  
  return { raw: result };
}

export async function extractContractInfo(imageUrl: string): Promise<{
  contractType?: string;
  parties?: string[];
  keyTerms?: string[];
  riskPoints?: string[];
  raw?: string;
}> {
  const prompt = `请仔细分析这份合同图片，提取以下关键信息：
1. 合同类型（如：劳动合同、采购合同、租赁合同等）
2. 合同当事方
3. 关键条款摘要
4. 潜在风险点

请以JSON格式返回，字段为: contractType, parties, keyTerms, riskPoints`;

  const result = await analyzeImage(imageUrl, prompt);
  
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  
  return { raw: result };
}

export async function transcribeAudioParaformer(
  audioUrl: string,
  options: { language?: string } = {}
): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }> {
  if (!DASHSCOPE_API_KEY) {
    return { text: '语音识别需要配置API密钥' };
  }

  try {
    const submitResponse = await fetch(PARAFORMER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'paraformer-v2',
        input: {
          file_urls: [audioUrl],
        },
        parameters: {
          language_hints: [options.language || 'zh'],
        },
      }),
    });

    if (!submitResponse.ok) {
      logger.error({ status: submitResponse.status }, 'Paraformer submit error');
      return { text: '语音识别提交失败' };
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.output?.task_id;
    
    if (!taskId) {
      return { text: '无法获取任务ID' };
    }

    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.output?.task_status;
      
      if (status === 'SUCCEEDED') {
        const results = statusData.output?.results || [];
        const firstResult = results[0];
        
        if (firstResult?.transcription_url) {
          const transcriptResponse = await fetch(firstResult.transcription_url);
          const transcriptData = await transcriptResponse.json();
          
          const sentences: TranscriptSentence[] = transcriptData.transcripts?.[0]?.sentences || [];
          const fullText = sentences.map((s: TranscriptSentence) => s.text).join('');
          
          return {
            text: fullText,
            segments: sentences.map((s: TranscriptSentence) => ({
              start: s.begin_time,
              end: s.end_time,
              text: s.text,
            })),
          };
        }
        
        return { text: '转写完成但无法获取结果' };
      } else if (status === 'FAILED') {
        return { text: '语音识别失败' };
      }
      
      attempts++;
    }

    return { text: '语音识别超时' };
  } catch (error) {
    logger.error({ err: error }, 'Paraformer error');
    return { text: '语音识别出错' };
  }
}

export async function ingestKnowledge(
  storage: StorageWithExtras,
  knowledge: {
    category: string;
    title: string;
    content: string;
    keywords?: string[];
    sourceFailureId?: string;
  }
): Promise<{ success: boolean; id?: string }> {
  try {
    const embedding = await generateEmbedding(`${knowledge.title} ${knowledge.content}`);
    
    const result = await storage.createRagKnowledge?.({
      category: knowledge.category,
      title: knowledge.title,
      content: knowledge.content,
      keywords: knowledge.keywords || [],
      embedding: embedding ? JSON.stringify(embedding) : null,
      sourceFailureId: knowledge.sourceFailureId,
      confidence: 0.8,
      isActive: 1,
      version: 1,
    });

    if (result) {
      logger.info(`[IngestKnowledge] Created knowledge: ${result.id}`);
      return { success: true, id: result.id };
    }
    
    return { success: false };
  } catch (error) {
    logger.error({ err: error }, 'IngestKnowledge error');
    return { success: false };
  }
}

export async function webSearchWithQwen(
  query: string,
  timeRange?: string
): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    return '联网搜索需要配置API密钥';
  }

  const searchPrompt = timeRange 
    ? `请搜索关于"${query}"的最新信息（时间范围：最近${timeRange === 'day' ? '一天' : timeRange === 'week' ? '一周' : timeRange === 'month' ? '一个月' : '一年'}）。请提供准确的信息来源和时间。`
    : `请搜索关于"${query}"的最新信息。请提供准确的信息来源和时间。`;

  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Plugin': 'enable_search',
      },
      body: JSON.stringify({
        model: 'qwen-max',
        input: {
          messages: [
            {
              role: 'system',
              content: '你是一个联网搜索助手，能够访问互联网获取最新信息。请根据用户的问题，通过搜索提供最新、准确的信息。始终说明信息来源和发布时间。'
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
        },
        parameters: {
          enable_search: true,
          search_options: {
            search_strategy: 'standard',
            forced_search: true,
          },
          result_format: 'message',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText }, 'WebSearch API error');
      return '联网搜索暂时不可用';
    }

    const data = await response.json();
    logger.info({ responseSnippet: JSON.stringify(data).slice(0, 500) }, '[WebSearch] Raw response');
    
    const content = data.output?.choices?.[0]?.message?.content || 
                    data.output?.text || 
                    '未找到相关信息';
    
    const searchInfo = data.output?.choices?.[0]?.message?.tool_calls || 
                       data.output?.search_info;
    if (searchInfo) {
      logger.info({ hasSearchInfo: !!searchInfo }, '[WebSearch] Search info available');
    }
    
    logger.info(`[WebSearch] Query: "${query.slice(0, 30)}..." completed`);
    return content;
  } catch (error) {
    logger.error({ err: error }, 'WebSearch error');
    return '联网搜索出错';
  }
}

export async function generateImageWithWanxiang(
  prompt: string,
  options: { style?: string; size?: string } = {}
): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    return '图片生成需要配置API密钥';
  }

  const stylePromptMap: Record<string, string> = {
    'realistic': '写实风格，高清摄影',
    'anime': '动漫风格，日系插画',
    'oil_painting': '油画风格，艺术画作',
    'watercolor': '水彩风格，柔和色调',
    'sketch': '素描风格，黑白线条',
  };

  const enhancedPrompt = options.style && stylePromptMap[options.style]
    ? `${prompt}，${stylePromptMap[options.style]}`
    : prompt;

  try {
    const submitResponse = await fetch(TEXT2IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wanx2.1-t2i-turbo',
        input: {
          prompt: enhancedPrompt,
          negative_prompt: '低质量，模糊，变形',
        },
        parameters: {
          n: 1,
          size: options.size || '1024*1024',
          prompt_extend: true,
        },
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      logger.error({ status: submitResponse.status, errorText }, 'ImageGen submit error');
      return '图片生成提交失败';
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.output?.task_id;
    
    if (!taskId) {
      logger.error({ response: submitData }, 'ImageGen no task_id in response');
      return '无法获取图片生成任务ID';
    }

    logger.info(`[ImageGen] Task submitted: ${taskId}`);

    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `${TASK_QUERY_URL}/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      const status = statusData.output?.task_status;
      
      if (status === 'SUCCEEDED') {
        const results = statusData.output?.results || [];
        if (results.length > 0) {
          const imageUrl = results[0].url || results[0].image_url || 
                          (results[0].image_urls && results[0].image_urls[0]);
          if (imageUrl) {
            logger.info(`[ImageGen] Image generated: ${imageUrl}`);
            return `图片已生成！\n链接: ${imageUrl}\n\n提示：图片链接24小时内有效，请及时保存。`;
          }
        }
        logger.error({ results }, 'ImageGen no image URL in results');
        return '图片生成完成但无法获取链接';
      } else if (status === 'FAILED') {
        const errorMsg = statusData.output?.message || statusData.output?.code || '未知错误';
        logger.error({ errorMsg }, 'ImageGen task failed');
        return `图片生成失败: ${errorMsg}`;
      }
      
      attempts++;
    }

    return '图片生成超时，请稍后重试';
  } catch (error) {
    logger.error({ err: error }, 'ImageGen error');
    return '图片生成出错';
  }
}

export async function executeCodeSandbox(
  code: string,
  purpose?: string
): Promise<string> {
  logger.info(`[CodeExec] Purpose: ${purpose || 'unspecified'}`);
  
  const dangerousPatterns = [
    /import\s+os/,
    /import\s+subprocess/,
    /import\s+sys/,
    /exec\s*\(/,
    /eval\s*\(/,
    /open\s*\([^)]*['"](\/|\.\.)/,
    /__import__/,
    /os\.(system|popen|exec)/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return '安全检查未通过：代码包含潜在危险操作。仅支持数据计算和分析类代码。';
    }
  }

  try {
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
            {
              role: 'system',
              content: `你是一个Python代码执行助手。用户会提供Python代码，请：
1. 分析代码的功能
2. 模拟执行代码并给出预期输出
3. 如果代码有错误，指出问题并提供修正建议
4. 对于数据分析类代码，给出分析结果的解读

注意：你只需要模拟执行并给出结果，不需要真正运行代码。`
            },
            {
              role: 'user',
              content: `请分析并模拟执行以下Python代码：\n\n\`\`\`python\n${code}\n\`\`\`\n\n${purpose ? `代码用途: ${purpose}` : ''}`
            }
          ],
        },
        parameters: {
          result_format: 'message',
        },
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, 'CodeExec API error');
      return '代码分析暂时不可用';
    }

    const data = await response.json();
    const content = data.output?.choices?.[0]?.message?.content || 
                    data.output?.text || 
                    '无法分析代码';
    
    logger.info('[CodeExec] Code analysis completed');
    return content;
  } catch (error) {
    logger.error({ err: error }, 'CodeExec error');
    return '代码分析出错';
  }
}

logger.info('[DashScope Enhanced] Module loaded with Embedding, RAG, Multimodal, ASR, WebSearch, ImageGen, and CodeExec capabilities');

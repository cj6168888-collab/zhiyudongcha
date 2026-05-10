const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export interface TalkAnalysisResult {
  talkType: string;
  summary: string;
  keyPoints: string[];
  entities: ExtractedEntityData[];
  opportunities: OpportunityData[];
  sentiment: string;
  actionItems: string[];
}

export interface ExtractedEntityData {
  type: 'PERSON' | 'ORGANIZATION' | 'PROJECT' | 'PRODUCT' | 'LOCATION' | 'DATE' | 'MONEY' | 'OTHER';
  name: string;
  role?: string;
  organization?: string;
  context: string;
  confidence: number;
}

export interface OpportunityData {
  type: 'SALES' | 'PARTNERSHIP' | 'INVESTMENT' | 'HIRING' | 'COLLABORATION' | 'PROCUREMENT' | 'OTHER';
  title: string;
  description: string;
  potentialValue?: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  nextSteps: string[];
  relatedEntities: string[];
}

const TALK_ANALYSIS_PROMPT = `你是一个专业的商业谈话分析AI。请分析以下对话内容，提取关键信息。

请用JSON格式返回分析结果，严格按照以下结构：

{
  "talkType": "谈话类型(CASUAL/MEETING/NEGOTIATION/CONFERENCE/CONSULTATION/BRAINSTORM/INTERVIEW/PITCH)",
  "summary": "谈话摘要(100字以内)",
  "keyPoints": ["要点1", "要点2", ...],
  "sentiment": "整体氛围(POSITIVE/NEUTRAL/NEGATIVE/MIXED)",
  "actionItems": ["待办事项1", "待办事项2", ...],
  "entities": [
    {
      "type": "类型(PERSON/ORGANIZATION/PROJECT/PRODUCT/LOCATION/DATE/MONEY/OTHER)",
      "name": "名称",
      "role": "角色(可选)",
      "organization": "所属组织(可选)",
      "context": "在谈话中的上下文",
      "confidence": 0.9
    }
  ],
  "opportunities": [
    {
      "type": "类型(SALES/PARTNERSHIP/INVESTMENT/HIRING/COLLABORATION/PROCUREMENT/OTHER)",
      "title": "商机标题",
      "description": "详细描述",
      "potentialValue": "潜在价值(可选)",
      "urgency": "紧急程度(HIGH/MEDIUM/LOW)",
      "nextSteps": ["下一步行动1", "下一步行动2"],
      "relatedEntities": ["相关人物或组织名称"]
    }
  ]
}

注意：
1. 仔细识别所有提到的人名、公司名、项目名
2. 关注任何可能的商业机会信号，如采购需求、合作意向、投资机会等
3. 提取具体的行动项和待办事项
4. 判断谈话的整体氛围和紧急程度`;

export async function analyzeTalkContent(transcript: string): Promise<TalkAnalysisResult> {
  if (!DASHSCOPE_API_KEY) {
    console.error('DASHSCOPE_API_KEY not configured');
    return getDefaultAnalysisResult();
  }

  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: TALK_ANALYSIS_PROMPT },
            { role: 'user', content: `请分析以下谈话内容：\n\n${transcript}` }
          ]
        },
        parameters: {
          result_format: 'message',
          temperature: 0.3,
        }
      }),
    });

    if (!response.ok) {
      console.error('DashScope API error:', response.status);
      return getDefaultAnalysisResult();
    }

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        talkType: parsed.talkType || 'UNKNOWN',
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        entities: parsed.entities || [],
        opportunities: parsed.opportunities || [],
        sentiment: parsed.sentiment || 'NEUTRAL',
        actionItems: parsed.actionItems || [],
      };
    }
    
    return getDefaultAnalysisResult();
  } catch (error) {
    console.error('Error analyzing talk content:', error);
    return getDefaultAnalysisResult();
  }
}

export async function identifyTalkType(transcript: string): Promise<string> {
  if (!DASHSCOPE_API_KEY || transcript.length < 20) {
    return 'UNKNOWN';
  }

  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            { 
              role: 'system', 
              content: `你是一个谈话类型识别AI。根据谈话内容，判断谈话类型。
只返回以下类型之一（不要返回其他内容）：
- CASUAL: 闲聊、日常对话
- MEETING: 正式会见、拜访
- NEGOTIATION: 谈判、讨价还价
- CONFERENCE: 会议、多人讨论
- CONSULTATION: 咨询、磋商
- BRAINSTORM: 头脑风暴、创意讨论
- INTERVIEW: 面试、访谈
- PITCH: 推销、路演、产品介绍` 
            },
            { role: 'user', content: transcript.substring(0, 500) }
          ]
        },
        parameters: {
          result_format: 'message',
          temperature: 0.1,
        }
      }),
    });

    if (!response.ok) return 'UNKNOWN';

    const data = await response.json();
    const content = data?.output?.choices?.[0]?.message?.content?.trim() || '';
    
    const validTypes = ['CASUAL', 'MEETING', 'NEGOTIATION', 'CONFERENCE', 'CONSULTATION', 'BRAINSTORM', 'INTERVIEW', 'PITCH'];
    const matchedType = validTypes.find(t => content.toUpperCase().includes(t));
    return matchedType || 'UNKNOWN';
  } catch (error) {
    console.error('Error identifying talk type:', error);
    return 'UNKNOWN';
  }
}

function getDefaultAnalysisResult(): TalkAnalysisResult {
  return {
    talkType: 'UNKNOWN',
    summary: '',
    keyPoints: [],
    entities: [],
    opportunities: [],
    sentiment: 'NEUTRAL',
    actionItems: [],
  };
}

/**
 * Avatar Recognition Service (头像视觉识别)
 * 
 * 功能：
 * 1. 使用 DashScope Qwen-VL 分析头像
 * 2. 提取面部特征和外观描述
 * 3. 存储识别结果供小智使用
 * 4. 支持身份验证和问候个性化
 */

import { storage } from '../storage';

export interface AvatarAnalysis {
  analyzed: boolean;
  timestamp: string;
  features: {
    gender?: string;
    ageRange?: string;
    facialFeatures?: string;
    clothing?: string;
    accessories?: string;
    mood?: string;
    distinctiveTraits?: string[];
  };
  description: string;
  greeting?: string;
  confidence: number;
}

export interface RecognitionResult {
  success: boolean;
  analysis?: AvatarAnalysis;
  error?: string;
}

class AvatarRecognitionService {
  private apiKey: string;
  private endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
  
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    console.log('[AvatarRecognition] 头像视觉识别服务已初始化');
  }

  async analyzeAvatar(imageBase64: string): Promise<RecognitionResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'DashScope API key not configured'
      };
    }

    try {
      const imageUrl = imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`;

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable'
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  {
                    image: imageUrl
                  },
                  {
                    text: `请仔细分析这张头像照片，作为AI助手小智的视觉记忆。请用中文描述：

1. 性别和大致年龄段
2. 面部特征（脸型、眼睛、发型等）
3. 穿着打扮
4. 配饰（眼镜、饰品等）
5. 表情或气质
6. 3-5个独特的识别特征

请用以下JSON格式返回（不要添加markdown代码块）：
{
  "gender": "性别",
  "ageRange": "年龄段如25-35岁",
  "facialFeatures": "面部特征描述",
  "clothing": "穿着描述",
  "accessories": "配饰描述",
  "mood": "表情/气质",
  "distinctiveTraits": ["特征1", "特征2", "特征3"],
  "description": "完整的一段话描述这个人",
  "greeting": "作为小智，一句温馨的问候语（用'爸爸'称呼）"
}`
                  }
                ]
              }
            ]
          },
          parameters: {
            result_format: 'message'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AvatarRecognition] API error:', errorText);
        return {
          success: false,
          error: `API request failed: ${response.status}`
        };
      }

      const data = await response.json();
      const content = data.output?.choices?.[0]?.message?.content || '';
      
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      try {
        const parsed = JSON.parse(jsonStr);
        
        const analysis: AvatarAnalysis = {
          analyzed: true,
          timestamp: new Date().toISOString(),
          features: {
            gender: parsed.gender,
            ageRange: parsed.ageRange,
            facialFeatures: parsed.facialFeatures,
            clothing: parsed.clothing,
            accessories: parsed.accessories,
            mood: parsed.mood,
            distinctiveTraits: parsed.distinctiveTraits || []
          },
          description: parsed.description || '头像分析完成',
          greeting: parsed.greeting || '爸爸好，小智已经记住您的样子了～',
          confidence: 0.85
        };

        console.log('[AvatarRecognition] 分析成功:', analysis.description.substring(0, 50) + '...');
        
        return {
          success: true,
          analysis
        };
      } catch (parseError) {
        const fallbackAnalysis: AvatarAnalysis = {
          analyzed: true,
          timestamp: new Date().toISOString(),
          features: {},
          description: content || '头像已记录',
          greeting: '爸爸好，小智已经看到您的照片了～',
          confidence: 0.6
        };
        
        return {
          success: true,
          analysis: fallbackAnalysis
        };
      }
    } catch (error) {
      console.error('[AvatarRecognition] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  generateRecognitionPrompt(analysis: AvatarAnalysis): string {
    if (!analysis.analyzed) {
      return '';
    }

    let prompt = `[主人外貌记忆]\n`;
    
    if (analysis.features.gender) {
      prompt += `性别: ${analysis.features.gender}\n`;
    }
    if (analysis.features.ageRange) {
      prompt += `年龄段: ${analysis.features.ageRange}\n`;
    }
    if (analysis.features.facialFeatures) {
      prompt += `面部特征: ${analysis.features.facialFeatures}\n`;
    }
    if (analysis.features.distinctiveTraits?.length) {
      prompt += `独特特征: ${analysis.features.distinctiveTraits.join('、')}\n`;
    }
    if (analysis.description) {
      prompt += `整体印象: ${analysis.description}\n`;
    }

    return prompt;
  }
}

export const avatarRecognitionService = new AvatarRecognitionService();

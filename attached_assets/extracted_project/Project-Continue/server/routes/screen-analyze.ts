import type { Express } from "express";
import { z } from "zod";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const QWEN_VL_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

const analyzeScreenSchema = z.object({
  image: z.string().min(1),
});

interface ScreenAnalysisResult {
  keywords: string[];
  summary: string;
  riskLevel: number;
  emotionState: 'calm' | 'alert' | 'warning' | 'danger' | 'success' | 'thinking';
}

function calculateEmotionState(riskLevel: number): ScreenAnalysisResult['emotionState'] {
  if (riskLevel >= 80) return 'danger';
  if (riskLevel >= 60) return 'warning';
  if (riskLevel >= 40) return 'alert';
  if (riskLevel >= 20) return 'thinking';
  return 'calm';
}

async function analyzeScreenWithQwenVL(base64Image: string): Promise<ScreenAnalysisResult> {
  if (!DASHSCOPE_API_KEY) {
    return {
      keywords: ['API密钥未配置'],
      summary: '无法进行分析，请配置DASHSCOPE_API_KEY',
      riskLevel: 0,
      emotionState: 'calm',
    };
  }

  try {
    const imageUrl = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
    
    const response = await fetch(QWEN_VL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        input: {
          messages: [
            {
              role: 'user',
              content: [
                {
                  image: imageUrl,
                },
                {
                  text: `分析这个屏幕截图的内容。请：
1. 识别屏幕上的主要文字内容
2. 提取5-8个核心关键词
3. 给出一句话摘要（不超过50字）
4. 评估内容的风险等级（0-100，考虑是否涉及敏感信息、合同条款、财务数据等）

请以JSON格式返回：
{
  "keywords": ["关键词1", "关键词2", ...],
  "summary": "一句话摘要",
  "riskLevel": 数字0-100,
  "contentType": "文档类型"
}`
                }
              ]
            }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`DashScope API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.output?.choices?.[0]?.message?.content;
    
    if (content) {
      const contentText = Array.isArray(content) 
        ? content.find((c: any) => c.text)?.text || ''
        : content;
      
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const riskLevel = Math.min(100, Math.max(0, parsed.riskLevel || 0));
        
        return {
          keywords: parsed.keywords || [],
          summary: parsed.summary || '',
          riskLevel,
          emotionState: calculateEmotionState(riskLevel),
        };
      }
    }

    return {
      keywords: ['无法识别'],
      summary: '屏幕内容无法解析',
      riskLevel: 0,
      emotionState: 'calm',
    };

  } catch (error: any) {
    console.error('[ScreenAnalyze] Error:', error);
    return {
      keywords: ['分析失败'],
      summary: error.message || '分析过程出错',
      riskLevel: 0,
      emotionState: 'calm',
    };
  }
}

export function registerScreenAnalyzeRoutes(app: Express): void {
  
  app.post("/api/screen/analyze", async (req, res) => {
    try {
      const parsed = analyzeScreenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const result = await analyzeScreenWithQwenVL(parsed.data.image);
      res.json(result);
      
    } catch (error: any) {
      console.error("[ScreenAnalyze] Route error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/screen/status", async (_req, res) => {
    res.json({
      available: !!DASHSCOPE_API_KEY,
      model: 'qwen-vl-plus',
    });
  });

  console.log("[ScreenAnalyze] Routes registered at /api/screen/*");
}

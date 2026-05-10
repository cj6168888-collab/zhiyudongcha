export type EmotionState = 'calm' | 'alert' | 'warning' | 'danger' | 'success' | 'thinking';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

interface KeywordResult {
  keywords: string[];
  summary: string;
  riskLevel: number;
  emotionState: EmotionState;
}

interface DocumentContext {
  text: string;
  source: string;
  timestamp: number;
}

async function callDashScopeSimple(prompt: string): Promise<string> {
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
      model: 'qwen-turbo',
      input: {
        messages: [{ role: 'user', content: prompt }]
      },
      parameters: { result_format: 'message' }
    }),
  });
  
  if (!response.ok) {
    throw new Error(`DashScope API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.output?.choices?.[0]?.message?.content || '';
}

class InterfaceXService {
  private currentContext: DocumentContext | null = null;
  private currentEmotionState: EmotionState = 'calm';
  private riskScore: number = 0;
  
  async extractKeywords(text: string): Promise<KeywordResult> {
    if (!text || text.length < 10) {
      return {
        keywords: [],
        summary: '',
        riskLevel: 0,
        emotionState: 'calm',
      };
    }
    
    try {
      const truncatedText = text.substring(0, 3000);
      
      const prompt = `分析以下文本，提取5-8个核心关键词，并给出一句话摘要。同时评估风险等级(0-100)。

文本：
${truncatedText}

请以JSON格式返回：
{
  "keywords": ["关键词1", "关键词2", ...],
  "summary": "一句话摘要",
  "riskLevel": 数字0-100
}`;

      const response = await callDashScopeSimple(prompt);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const riskLevel = Math.min(100, Math.max(0, parsed.riskLevel || 0));
          
          return {
            keywords: parsed.keywords || [],
            summary: parsed.summary || '',
            riskLevel,
            emotionState: this.calculateEmotionState(riskLevel),
          };
        }
      } catch (parseError) {
        console.error('[InterfaceX] Parse error:', parseError);
      }
      
      const keywords = this.extractKeywordsLocally(truncatedText);
      return {
        keywords,
        summary: truncatedText.substring(0, 100) + '...',
        riskLevel: 0,
        emotionState: 'calm',
      };
      
    } catch (error) {
      console.error('[InterfaceX] Keyword extraction error:', error);
      return {
        keywords: this.extractKeywordsLocally(text),
        summary: '',
        riskLevel: 0,
        emotionState: 'calm',
      };
    }
  }
  
  private extractKeywordsLocally(text: string): string[] {
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
      '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through'
    ]);
    
    const words = text
      .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()));
    
    const wordCount = new Map<string, number>();
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
  }
  
  private calculateEmotionState(riskLevel: number): EmotionState {
    if (riskLevel >= 80) return 'danger';
    if (riskLevel >= 60) return 'warning';
    if (riskLevel >= 40) return 'alert';
    if (riskLevel >= 20) return 'thinking';
    return 'calm';
  }
  
  updateContext(text: string, source: string): void {
    this.currentContext = {
      text,
      source,
      timestamp: Date.now(),
    };
  }
  
  getCurrentContext(): DocumentContext | null {
    return this.currentContext;
  }
  
  setEmotionState(state: EmotionState): void {
    this.currentEmotionState = state;
  }
  
  getEmotionState(): EmotionState {
    return this.currentEmotionState;
  }
  
  setRiskScore(score: number): void {
    this.riskScore = Math.min(100, Math.max(0, score));
    this.currentEmotionState = this.calculateEmotionState(this.riskScore);
  }
  
  getRiskScore(): number {
    return this.riskScore;
  }
  
  getParticleConfig(): {
    color: string;
    speed: number;
    intensity: number;
    breathingRate: number;
  } {
    switch (this.currentEmotionState) {
      case 'danger':
        return { color: '#ff4444', speed: 2.5, intensity: 1.0, breathingRate: 0.3 };
      case 'warning':
        return { color: '#ff8800', speed: 1.8, intensity: 0.8, breathingRate: 0.5 };
      case 'alert':
        return { color: '#ffcc00', speed: 1.2, intensity: 0.6, breathingRate: 0.7 };
      case 'thinking':
        return { color: '#00ccff', speed: 1.0, intensity: 0.5, breathingRate: 1.0 };
      case 'success':
        return { color: '#44ff88', speed: 0.8, intensity: 0.4, breathingRate: 1.5 };
      case 'calm':
      default:
        return { color: '#6699ff', speed: 0.5, intensity: 0.3, breathingRate: 2.0 };
    }
  }
}

export const interfaceX = new InterfaceXService();

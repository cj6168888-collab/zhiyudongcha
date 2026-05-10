/**
 * Face Comparison Service (人脸比对服务)
 * 
 * 使用 DashScope Qwen-VL 进行真正的人脸 1:1 比对
 * 
 * 功能：
 * 1. 双图直接视觉比对 - 传入两张人脸图片，AI判断是否同一人
 * 2. 人脸质量检测 - 检测图片是否适合用于人脸识别
 * 3. 活体检测提示 - 返回疑似静态照片的警告
 * 
 * 安全说明：
 * - 不存储原始人脸图片（仅存储特征哈希和描述）
 * - 每次验证需要重新上传两张图片进行比对
 * - 使用密码学哈希确保数据完整性
 */

import crypto from 'crypto';

export interface FaceCompareResult {
  success: boolean;
  isSamePerson: boolean;
  confidence: number;
  similarityScore: number;
  analysis: {
    faceAQuality: 'HIGH' | 'MEDIUM' | 'LOW';
    faceBQuality: 'HIGH' | 'MEDIUM' | 'LOW';
    livenessWarning?: string;
    details?: string;
  };
  error?: string;
}

export interface FaceQualityResult {
  success: boolean;
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  hasFace: boolean;
  issues: string[];
  suggestions: string[];
}

export interface FaceEnrollData {
  featureHash: string;
  featureDescription: string;
  enrolledAt: string;
  qualityScore: number;
}

class FaceCompareService {
  private apiKey: string;
  private endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
  
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    console.log('[FaceCompare] 人脸比对服务已初始化 (使用 Qwen-VL 双图比对)');
  }

  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;

  /**
   * 比对两张人脸图片，判断是否为同一人
   * 支持重试机制和严格的响应验证
   */
  async compareFaces(imageA: string, imageB: string): Promise<FaceCompareResult> {
    if (!this.apiKey) {
      return {
        success: false,
        isSamePerson: false,
        confidence: 0,
        similarityScore: 0,
        analysis: {
          faceAQuality: 'LOW',
          faceBQuality: 'LOW'
        },
        error: 'DashScope API key not configured'
      };
    }

    let lastError = '';
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[FaceCompare] 重试第 ${attempt} 次...`);
          await this.delay(this.RETRY_DELAY_MS * attempt);
        }

        const result = await this.doCompareFaces(imageA, imageB);
        if (result.success) {
          return result;
        }
        lastError = result.error || 'Unknown error';
        
        if (result.error?.includes('API key') || result.error?.includes('401')) {
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[FaceCompare] Attempt ${attempt + 1} failed:`, lastError);
      }
    }

    return {
      success: false,
      isSamePerson: false,
      confidence: 0,
      similarityScore: 0,
      analysis: {
        faceAQuality: 'LOW',
        faceBQuality: 'LOW'
      },
      error: `比对失败，已重试 ${this.MAX_RETRIES} 次: ${lastError}`
    };
  }

  private async doCompareFaces(imageA: string, imageB: string): Promise<FaceCompareResult> {
    const imageUrlA = this.formatImageUrl(imageA);
    const imageUrlB = this.formatImageUrl(imageB);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'disable'
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: imageUrlA },
                { image: imageUrlB },
                {
                  text: `你是专业的人脸比对AI。请对比这两张人脸照片，判断是否为同一人。

请严格分析以下几点：
1. 面部骨骼结构（脸型、颧骨、下颌线）
2. 眼睛形状和间距
3. 鼻子形状和大小
4. 嘴唇形状和厚度
5. 耳朵形状（如可见）
6. 整体面部比例

你必须返回以下JSON格式（不要添加markdown代码块，直接返回JSON）：
{"isSamePerson":true,"confidence":85,"similarityScore":88,"faceAQuality":"HIGH","faceBQuality":"HIGH","livenessWarning":"","analysis":"分析说明"}

其中:
- isSamePerson: 布尔值 true 或 false
- confidence: 0-100 数字
- similarityScore: 0-100 数字
- faceAQuality/faceBQuality: "HIGH"/"MEDIUM"/"LOW"
- livenessWarning: 字符串，无警告则为空
- analysis: 字符串，判断依据`
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
      console.error('[FaceCompare] API error:', errorText);
      return {
        success: false,
        isSamePerson: false,
        confidence: 0,
        similarityScore: 0,
        analysis: {
          faceAQuality: 'LOW',
          faceBQuality: 'LOW'
        },
        error: `API request failed: ${response.status}`
      };
    }

    const data = await response.json();
    const content = data.output?.choices?.[0]?.message?.content || '';
    
    const parsed = this.parseAndValidateResponse(content);
    if (!parsed) {
      console.error('[FaceCompare] Failed to parse/validate response:', content.substring(0, 200));
      return {
        success: false,
        isSamePerson: false,
        confidence: 0,
        similarityScore: 0,
        analysis: {
          faceAQuality: 'LOW',
          faceBQuality: 'LOW'
        },
        error: 'AI响应格式无效，请重试'
      };
    }
    
    console.log('[FaceCompare] 比对完成:', {
      isSamePerson: parsed.isSamePerson,
      confidence: parsed.confidence,
      similarityScore: parsed.similarityScore
    });

    return {
      success: true,
      isSamePerson: parsed.isSamePerson,
      confidence: parsed.confidence,
      similarityScore: parsed.similarityScore,
      analysis: {
        faceAQuality: parsed.faceAQuality,
        faceBQuality: parsed.faceBQuality,
        livenessWarning: parsed.livenessWarning || undefined,
        details: parsed.analysis
      }
    };
  }

  private parseAndValidateResponse(content: string): {
    isSamePerson: boolean;
    confidence: number;
    similarityScore: number;
    faceAQuality: 'HIGH' | 'MEDIUM' | 'LOW';
    faceBQuality: 'HIGH' | 'MEDIUM' | 'LOW';
    livenessWarning?: string;
    analysis?: string;
  } | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const raw = JSON.parse(jsonMatch[0]);
      
      if (typeof raw.isSamePerson !== 'boolean' && 
          raw.isSamePerson !== 'true' && raw.isSamePerson !== 'false') {
        return null;
      }
      
      const confidence = Number(raw.confidence);
      const similarityScore = Number(raw.similarityScore);
      
      if (isNaN(confidence) || isNaN(similarityScore)) {
        return null;
      }

      const validQuality = ['HIGH', 'MEDIUM', 'LOW'];
      const faceAQuality = validQuality.includes(raw.faceAQuality) ? raw.faceAQuality : 'MEDIUM';
      const faceBQuality = validQuality.includes(raw.faceBQuality) ? raw.faceBQuality : 'MEDIUM';

      return {
        isSamePerson: raw.isSamePerson === true || raw.isSamePerson === 'true',
        confidence: Math.max(0, Math.min(100, confidence)),
        similarityScore: Math.max(0, Math.min(100, similarityScore)),
        faceAQuality,
        faceBQuality,
        livenessWarning: typeof raw.livenessWarning === 'string' ? raw.livenessWarning : undefined,
        analysis: typeof raw.analysis === 'string' ? raw.analysis : undefined
      };
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检测人脸图片质量
   */
  async checkFaceQuality(image: string): Promise<FaceQualityResult> {
    if (!this.apiKey) {
      return {
        success: false,
        quality: 'LOW',
        hasFace: false,
        issues: ['API key not configured'],
        suggestions: []
      };
    }

    try {
      const imageUrl = this.formatImageUrl(image);

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
                  { image: imageUrl },
                  {
                    text: `请分析这张照片是否适合用于人脸识别。检查以下方面：

1. 是否包含清晰的人脸
2. 光线是否充足
3. 人脸是否正面朝向
4. 是否有遮挡（口罩、墨镜等）
5. 图片是否模糊
6. 是否疑似静态照片翻拍

请用以下JSON格式返回（不要添加markdown代码块）：
{
  "hasFace": true或false,
  "quality": "HIGH"/"MEDIUM"/"LOW",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "livenessCheck": "PASS"/"SUSPICIOUS"/"FAIL"
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
        return {
          success: false,
          quality: 'LOW',
          hasFace: false,
          issues: ['API request failed'],
          suggestions: []
        };
      }

      const data = await response.json();
      const content = data.output?.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          quality: 'LOW',
          hasFace: false,
          issues: ['Failed to parse response'],
          suggestions: []
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        quality: parsed.quality || 'MEDIUM',
        hasFace: Boolean(parsed.hasFace),
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      console.error('[FaceCompare] Quality check error:', error);
      return {
        success: false,
        quality: 'LOW',
        hasFace: false,
        issues: [error instanceof Error ? error.message : 'Unknown error'],
        suggestions: []
      };
    }
  }

  /**
   * 生成人脸特征数据用于安全存储（不存储原始图片）
   */
  async extractFaceFeatures(image: string): Promise<FaceEnrollData | null> {
    const quality = await this.checkFaceQuality(image);
    
    if (!quality.success || !quality.hasFace) {
      return null;
    }

    const qualityScore = quality.quality === 'HIGH' ? 95 : 
                         quality.quality === 'MEDIUM' ? 75 : 50;

    return {
      featureHash: this.generateSecureHash(image),
      featureDescription: `Face enrolled with ${quality.quality} quality`,
      enrolledAt: new Date().toISOString(),
      qualityScore
    };
  }

  /**
   * 生成图片的安全哈希（用于完整性校验，不可逆）
   */
  generateSecureHash(imageBase64: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(imageBase64);
    return hash.digest('hex');
  }

  private formatImageUrl(image: string): string {
    if (image.startsWith('data:')) {
      return image;
    }
    if (image.startsWith('http')) {
      return image;
    }
    return `data:image/jpeg;base64,${image}`;
  }
}

export const faceCompareService = new FaceCompareService();

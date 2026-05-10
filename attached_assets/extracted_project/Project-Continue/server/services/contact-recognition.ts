/**
 * Contact Recognition Service (联系人识别服务)
 * 
 * 让小智能够识别重要联系人的面容和声音
 * 
 * 功能：
 * 1. 录入联系人生物特征 - 关联到 persons 表
 * 2. 1:N 人脸识别 - 上传照片识别是哪个联系人
 * 3. 声纹识别（预留）- 未来支持语音识别
 * 4. 本地缓存 - 加速识别查询
 * 
 * 安全说明：
 * - 不存储原始图片/音频
 * - 仅存储特征描述和哈希值
 */

import crypto from 'crypto';
import { db } from '../db';
import { contactBiometrics, persons } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { faceCompareService } from './face-compare';

export interface EnrollResult {
  success: boolean;
  biometricId?: string;
  personId: string;
  personName: string;
  biometricType: 'FACE' | 'VOICE';
  qualityScore?: number;
  error?: string;
}

export interface RecognitionMatch {
  personId: string;
  personName: string;
  personRole?: string | null;
  organization?: string | null;
  biometricId: string;
  biometricType: 'FACE' | 'VOICE';
  confidence: number;
  similarityScore: number;
  matchedAt: string;
}

export interface RecognitionResult {
  success: boolean;
  matches: RecognitionMatch[];
  totalCompared: number;
  processingTimeMs: number;
  error?: string;
}

export interface ContactWithBiometrics {
  personId: string;
  personName: string;
  personRole?: string | null;
  organization?: string | null;
  biometrics: {
    id: string;
    type: 'FACE' | 'VOICE';
    qualityScore: number;
    sampleCount: number;
    createdAt: Date;
  }[];
}

class ContactRecognitionService {
  private apiKey: string;
  private endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
  
  // 内存缓存 - 存储联系人特征描述供快速比对
  private featureCache: Map<string, {
    personId: string;
    personName: string;
    featureDescription: string;
    biometricId: string;
    lastUpdated: number;
  }> = new Map();
  
  private cacheTTL = 1000 * 60 * 30; // 30分钟缓存
  
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    console.log('[ContactRecognition] 联系人识别服务已初始化');
  }

  /**
   * 为联系人录入人脸特征
   */
  async enrollFace(personId: string, faceImage: string, notes?: string): Promise<EnrollResult> {
    // 查找联系人
    const person = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    if (!person.length) {
      return { success: false, personId, personName: '', biometricType: 'FACE', error: '联系人不存在' };
    }
    
    const personInfo = person[0];

    // 检查人脸质量
    const quality = await faceCompareService.checkFaceQuality(faceImage);
    if (!quality.success || !quality.hasFace) {
      return {
        success: false,
        personId,
        personName: personInfo.name,
        biometricType: 'FACE',
        error: quality.issues?.join(', ') || '图片中未检测到有效人脸'
      };
    }

    // 提取人脸特征描述
    const featureDescription = await this.extractFaceDescription(faceImage, personInfo.name);
    if (!featureDescription) {
      return {
        success: false,
        personId,
        personName: personInfo.name,
        biometricType: 'FACE',
        error: '无法提取人脸特征描述'
      };
    }

    // 生成哈希
    const featureHash = this.generateHash(faceImage);
    const qualityScore = quality.quality === 'HIGH' ? 0.95 : 
                         quality.quality === 'MEDIUM' ? 0.75 : 0.5;

    // 存入数据库
    const [result] = await db.insert(contactBiometrics).values({
      personId,
      biometricType: 'FACE',
      featureHash,
      featureDescription,
      qualityScore,
      sampleCount: 1,
      capturedAt: new Date(),
      notes: notes || `${personInfo.name}的人脸特征`,
      isActive: true,
    }).returning();

    // 更新缓存
    this.updateCache(result.id, personId, personInfo.name, featureDescription);

    console.log(`[ContactRecognition] 已为联系人 ${personInfo.name} 录入人脸特征`);

    return {
      success: true,
      biometricId: result.id,
      personId,
      personName: personInfo.name,
      biometricType: 'FACE',
      qualityScore: qualityScore * 100
    };
  }

  /**
   * 使用AI提取人脸特征描述
   */
  private async extractFaceDescription(image: string, personName: string): Promise<string | null> {
    if (!this.apiKey) return null;

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
                    text: `请详细描述这张人脸照片的面部特征，用于后续人脸识别匹配。
                    
这是${personName}的照片，请从以下维度描述：
1. 脸型（圆脸/方脸/瓜子脸/国字脸等）
2. 五官特征（眼睛大小形状、鼻子高低宽窄、嘴唇薄厚）
3. 肤色（白皙/小麦色/偏黄/偏红等）
4. 发型（如可见）
5. 面部其他显著特征（痣、酒窝、疤痕等）
6. 大致年龄范围
7. 表情特点

请用简洁的文字描述，控制在200字以内。`
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

      if (!response.ok) return null;

      const data = await response.json();
      const content = data.output?.choices?.[0]?.message?.content || '';
      
      return content.trim() || null;
    } catch (error) {
      console.error('[ContactRecognition] 特征提取失败:', error);
      return null;
    }
  }

  /**
   * 识别上传的人脸图片 - 匹配已存储的联系人
   */
  async recognizeFace(faceImage: string, threshold: number = 60): Promise<RecognitionResult> {
    const startTime = Date.now();
    
    // 获取所有已存储的人脸特征
    const storedBiometrics = await db
      .select({
        biometric: contactBiometrics,
        person: persons
      })
      .from(contactBiometrics)
      .innerJoin(persons, eq(contactBiometrics.personId, persons.id))
      .where(and(
        eq(contactBiometrics.biometricType, 'FACE'),
        eq(contactBiometrics.isActive, true)
      ));

    if (!storedBiometrics.length) {
      return {
        success: true,
        matches: [],
        totalCompared: 0,
        processingTimeMs: Date.now() - startTime,
        error: '暂无已录入的联系人人脸'
      };
    }

    const matches: RecognitionMatch[] = [];

    // 逐个比对（可优化为批量处理）
    for (const record of storedBiometrics) {
      // 先查缓存中是否有该联系人的特征描述
      const cached = this.featureCache.get(record.biometric.id);
      
      // 使用 AI 进行人脸比对
      const compareResult = await this.compareFaceWithDescription(
        faceImage,
        record.biometric.featureDescription,
        record.person.name
      );

      if (compareResult && compareResult.similarityScore >= threshold) {
        matches.push({
          personId: record.person.id,
          personName: record.person.name,
          personRole: record.person.role,
          organization: record.person.organization,
          biometricId: record.biometric.id,
          biometricType: 'FACE',
          confidence: compareResult.confidence,
          similarityScore: compareResult.similarityScore,
          matchedAt: new Date().toISOString()
        });

        // 更新匹配计数
        await db.update(contactBiometrics)
          .set({
            matchCount: (record.biometric.matchCount || 0) + 1,
            lastMatchedAt: new Date()
          })
          .where(eq(contactBiometrics.id, record.biometric.id));
      }
    }

    // 按相似度排序
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      success: true,
      matches,
      totalCompared: storedBiometrics.length,
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * 将上传的人脸与存储的特征描述进行比对
   */
  private async compareFaceWithDescription(
    faceImage: string,
    storedDescription: string,
    personName: string
  ): Promise<{ confidence: number; similarityScore: number } | null> {
    if (!this.apiKey) return null;

    try {
      const imageUrl = this.formatImageUrl(faceImage);
      
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
                    text: `请判断这张照片中的人是否与以下描述的人是同一人：

已存储的人物特征描述（${personName}）：
${storedDescription}

请分析照片中人物的面部特征，判断是否匹配。
返回JSON格式（不要markdown代码块）：
{"isSamePerson":true或false,"confidence":0-100,"similarityScore":0-100,"reason":"判断理由"}

注意：
- 如果无法确定，confidence应该较低
- similarityScore表示外貌相似程度
- 需要综合考虑脸型、五官、肤色等多个维度`
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

      if (!response.ok) return null;

      const data = await response.json();
      const content = data.output?.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
        similarityScore: Math.max(0, Math.min(100, Number(parsed.similarityScore) || 0))
      };
    } catch (error) {
      console.error('[ContactRecognition] 比对失败:', error);
      return null;
    }
  }

  /**
   * 获取所有已录入生物特征的联系人列表
   */
  async getEnrolledContacts(): Promise<ContactWithBiometrics[]> {
    const records = await db
      .select({
        biometric: contactBiometrics,
        person: persons
      })
      .from(contactBiometrics)
      .innerJoin(persons, eq(contactBiometrics.personId, persons.id))
      .where(eq(contactBiometrics.isActive, true))
      .orderBy(desc(contactBiometrics.createdAt));

    // 按联系人分组
    const grouped = new Map<string, ContactWithBiometrics>();
    
    for (const record of records) {
      if (!grouped.has(record.person.id)) {
        grouped.set(record.person.id, {
          personId: record.person.id,
          personName: record.person.name,
          personRole: record.person.role,
          organization: record.person.organization,
          biometrics: []
        });
      }
      
      grouped.get(record.person.id)!.biometrics.push({
        id: record.biometric.id,
        type: record.biometric.biometricType as 'FACE' | 'VOICE',
        qualityScore: record.biometric.qualityScore || 0,
        sampleCount: record.biometric.sampleCount || 1,
        createdAt: record.biometric.createdAt!
      });
    }

    return Array.from(grouped.values());
  }

  /**
   * 删除联系人的生物特征
   */
  async deleteBiometric(biometricId: string): Promise<boolean> {
    try {
      await db.update(contactBiometrics)
        .set({ isActive: false })
        .where(eq(contactBiometrics.id, biometricId));
      
      // 清除缓存
      this.featureCache.delete(biometricId);
      
      return true;
    } catch (error) {
      console.error('[ContactRecognition] 删除失败:', error);
      return false;
    }
  }

  /**
   * 刷新内存缓存
   */
  async refreshCache(): Promise<void> {
    const records = await db
      .select({
        biometric: contactBiometrics,
        person: persons
      })
      .from(contactBiometrics)
      .innerJoin(persons, eq(contactBiometrics.personId, persons.id))
      .where(eq(contactBiometrics.isActive, true));

    this.featureCache.clear();
    
    for (const record of records) {
      this.updateCache(
        record.biometric.id,
        record.person.id,
        record.person.name,
        record.biometric.featureDescription
      );
    }

    console.log(`[ContactRecognition] 缓存已刷新，共 ${records.length} 条记录`);
  }

  private updateCache(biometricId: string, personId: string, personName: string, featureDescription: string): void {
    this.featureCache.set(biometricId, {
      personId,
      personName,
      featureDescription,
      biometricId,
      lastUpdated: Date.now()
    });
  }

  private generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private formatImageUrl(image: string): string {
    if (image.startsWith('data:')) return image;
    if (image.startsWith('http')) return image;
    return `data:image/jpeg;base64,${image}`;
  }
}

export const contactRecognitionService = new ContactRecognitionService();

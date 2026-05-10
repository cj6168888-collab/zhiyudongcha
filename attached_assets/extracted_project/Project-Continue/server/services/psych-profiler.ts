/**
 * Psychological Profiler Service (心理侧写服务)
 * 
 * 基于面部分析的心理学侧写系统
 * 使用 AI 视觉模型分析面部特征，推断性格特质
 * 
 * 功能：
 * 1. 面部心理分析 - 从照片推断性格特点
 * 2. 侧写生成 - 生成结构化心理侧写报告
 * 3. 侧写更新 - 支持人工观察修正
 * 4. 互动建议 - 提供与此人互动的策略建议
 * 
 * 注意：此分析仅供参考，不应作为唯一判断依据
 */

import { db } from '../db';
import { psychProfiles, persons } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface PsychAnalysisResult {
  success: boolean;
  profile?: {
    personalityType: string;
    dominantTraits: string[];
    communicationStyle: string;
    facialAnalysis: string;
    emotionalTendency: string;
    trustworthinessScore: number;
    decisionMakingStyle: string;
    stressResponse: string;
    motivationDrivers: string[];
    approachSuggestions: string;
    avoidBehaviors: string;
    confidenceLevel: number;
  };
  error?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  profileId?: string;
  message?: string;
  error?: string;
}

class PsychProfilerService {
  private apiKey: string;
  private endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
  
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    console.log('[PsychProfiler] 心理侧写服务已初始化');
  }

  /**
   * 从照片分析生成心理侧写
   */
  async analyzeFromPhoto(imageBase64: string, personName?: string): Promise<PsychAnalysisResult> {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      const imageUrl = this.formatImageUrl(imageBase64);
      
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
                role: 'system',
                content: `你是一位专业的面相心理学分析师，精通微表情分析、面部特征与性格关联研究。
你的分析基于心理学研究和面相学知识，但需要强调这只是初步推断，需要后续观察验证。

分析维度包括：
1. 性格类型（参考MBTI等框架）
2. 主要性格特质（如外向/内向、理性/感性等）
3. 沟通风格偏好
4. 情绪表达倾向
5. 决策风格
6. 压力应对模式
7. 核心动机驱动
8. 互动策略建议`
              },
              {
                role: 'user',
                content: [
                  { image: imageUrl },
                  {
                    text: `请对这张照片中的人物${personName ? `（${personName}）` : ''}进行面部心理侧写分析。

请从以下维度进行分析，并返回JSON格式（不要markdown代码块）：
{
  "personalityType": "性格类型（如INTJ、ENFP等，或自定义描述）",
  "dominantTraits": ["主要特质1", "主要特质2", "主要特质3"],
  "communicationStyle": "沟通风格描述",
  "facialAnalysis": "面部特征与性格关联分析",
  "emotionalTendency": "情绪表达倾向",
  "trustworthinessScore": 0.7,
  "decisionMakingStyle": "决策风格",
  "stressResponse": "压力应对模式",
  "motivationDrivers": ["动机1", "动机2"],
  "approachSuggestions": "与此人互动的建议策略",
  "avoidBehaviors": "应避免的行为",
  "confidenceLevel": 0.6
}

注意：
- trustworthinessScore 和 confidenceLevel 是0-1的数值
- 分析应基于面部特征的心理学关联，而非刻板印象
- 保持客观专业，避免过于绝对的判断`
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
        console.error('[PsychProfiler] API error:', errorText);
        return { success: false, error: 'AI分析服务暂时不可用' };
      }

      const data = await response.json();
      const content = data.output?.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: '无法解析分析结果' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        profile: {
          personalityType: parsed.personalityType || '待分析',
          dominantTraits: Array.isArray(parsed.dominantTraits) ? parsed.dominantTraits : [],
          communicationStyle: parsed.communicationStyle || '',
          facialAnalysis: parsed.facialAnalysis || '',
          emotionalTendency: parsed.emotionalTendency || '',
          trustworthinessScore: Math.max(0, Math.min(1, Number(parsed.trustworthinessScore) || 0.5)),
          decisionMakingStyle: parsed.decisionMakingStyle || '',
          stressResponse: parsed.stressResponse || '',
          motivationDrivers: Array.isArray(parsed.motivationDrivers) ? parsed.motivationDrivers : [],
          approachSuggestions: parsed.approachSuggestions || '',
          avoidBehaviors: parsed.avoidBehaviors || '',
          confidenceLevel: Math.max(0, Math.min(1, Number(parsed.confidenceLevel) || 0.6))
        }
      };
    } catch (error) {
      console.error('[PsychProfiler] Analysis error:', error);
      return { success: false, error: '分析过程出错' };
    }
  }

  /**
   * 为联系人创建或更新心理侧写
   */
  async createOrUpdateProfile(
    personId: string, 
    imageBase64: string,
    sourceType: 'PHOTO' | 'VIDEO' | 'OBSERVATION' = 'PHOTO'
  ): Promise<ProfileUpdateResult> {
    // 验证联系人存在
    const person = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    if (!person.length) {
      return { success: false, error: '联系人不存在' };
    }

    const personInfo = person[0];

    // 执行分析
    const analysis = await this.analyzeFromPhoto(imageBase64, personInfo.name);
    if (!analysis.success || !analysis.profile) {
      return { success: false, error: analysis.error || '分析失败' };
    }

    // 检查是否已有侧写
    const existing = await db.select()
      .from(psychProfiles)
      .where(eq(psychProfiles.personId, personId))
      .limit(1);

    if (existing.length) {
      // 更新现有侧写
      const [updated] = await db.update(psychProfiles)
        .set({
          ...analysis.profile,
          sourceType,
          analysisVersion: (existing[0].analysisVersion || 1) + 1,
          updatedAt: new Date()
        })
        .where(eq(psychProfiles.id, existing[0].id))
        .returning();

      return {
        success: true,
        profileId: updated.id,
        message: `已更新 ${personInfo.name} 的心理侧写 (版本 ${updated.analysisVersion})`
      };
    } else {
      // 创建新侧写
      const [created] = await db.insert(psychProfiles)
        .values({
          personId,
          ...analysis.profile,
          sourceType,
          analysisVersion: 1
        })
        .returning();

      return {
        success: true,
        profileId: created.id,
        message: `已为 ${personInfo.name} 创建心理侧写`
      };
    }
  }

  /**
   * 获取联系人的心理侧写
   */
  async getProfile(personId: string) {
    const result = await db.select({
      profile: psychProfiles,
      person: persons
    })
    .from(psychProfiles)
    .innerJoin(persons, eq(psychProfiles.personId, persons.id))
    .where(eq(psychProfiles.personId, personId))
    .limit(1);

    if (!result.length) {
      return null;
    }

    const profile = result[0].profile;
    const manualCorrections = (profile.manualCorrections as Record<string, any>) || {};
    const observationNotes = manualCorrections.observationNotes || [];

    return {
      ...profile,
      observationNotes,
      personName: result[0].person.name,
      personRole: result[0].person.role,
      organization: result[0].person.organization
    };
  }

  /**
   * 添加观察备注（人工修正）
   */
  async addObservationNote(
    personId: string, 
    note: string,
    corrections?: Record<string, any>
  ): Promise<ProfileUpdateResult> {
    const existing = await db.select()
      .from(psychProfiles)
      .where(eq(psychProfiles.personId, personId))
      .limit(1);

    if (!existing.length) {
      return { success: false, error: '该联系人尚无心理侧写，请先进行分析' };
    }

    const profile = existing[0];
    const existingCorrections = (profile.manualCorrections as Record<string, any>) || {};
    const existingNotes = existingCorrections.observationNotes || [];
    
    const newNote = {
      note,
      addedAt: new Date().toISOString()
    };
    
    const updatedCorrections: Record<string, any> = {
      ...existingCorrections,
      observationNotes: [...existingNotes, newNote],
      lastUpdated: new Date().toISOString()
    };
    
    if (corrections) {
      Object.assign(updatedCorrections, corrections);
    }
    
    await db.update(psychProfiles)
      .set({
        lastObservationNotes: note,
        manualCorrections: updatedCorrections,
        confidenceLevel: Math.min(1, (profile.confidenceLevel || 0.6) + 0.05),
        updatedAt: new Date()
      })
      .where(eq(psychProfiles.id, profile.id));

    return {
      success: true,
      profileId: profile.id,
      message: '观察备注已添加'
    };
  }

  /**
   * 获取所有已有侧写的联系人列表
   */
  async getAllProfiles() {
    const results = await db.select({
      profile: psychProfiles,
      person: persons
    })
    .from(psychProfiles)
    .innerJoin(persons, eq(psychProfiles.personId, persons.id));

    return results.map(r => ({
      personId: r.person.id,
      personName: r.person.name,
      personRole: r.person.role,
      organization: r.person.organization,
      personalityType: r.profile.personalityType,
      dominantTraits: r.profile.dominantTraits,
      confidenceLevel: r.profile.confidenceLevel,
      analysisVersion: r.profile.analysisVersion,
      updatedAt: r.profile.updatedAt
    }));
  }

  private formatImageUrl(image: string): string {
    if (image.startsWith('data:')) return image;
    if (image.startsWith('http')) return image;
    return `data:image/jpeg;base64,${image}`;
  }
}

export const psychProfilerService = new PsychProfilerService();

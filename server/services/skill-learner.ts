import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('SkillLearner');

import { getDatabase } from "../db";
import { learnedSkills, conversationPatterns, skillFeedback, skillProficiencyCurve, type InsertLearnedSkill, type InsertConversationPattern, type LearnedSkill, type ConversationPattern, type SkillFeedback, type SkillProficiencyCurve } from "@shared/schema";
import { eq, desc, sql, and, ilike, or, gte, lte, count } from "drizzle-orm";

type FeedbackType = "LIKE" | "DISLIKE" | "FOLLOWUP" | "ADOPT" | "IGNORE";

interface RecordFeedbackInput {
  conversationId?: string;
  messageId?: string;
  skillId?: string;
  feedbackType: FeedbackType;
  userMessage?: string;
  assistantResponse?: string;
  category?: string;
  followupCount?: number;
  wasAdopted?: number;
  sentiment?: string;
}

interface SkillStep {
  order: number;
  action: string;
  params?: Record<string, unknown>;
  description?: string;
}

interface TeachSkillInput {
  skillName: string;
  description?: string;
  category?: string;
  triggerPatterns: string[];
  steps: SkillStep[];
  expectedOutput?: string;
}

interface SkillMatchResult {
  skill: LearnedSkill;
  matchedPattern: string;
  confidence: number;
}

interface PatternMatchResult {
  pattern: ConversationPattern;
  similarity: number;
}

class SkillLearnerService {
  
  async teachSkill(input: TeachSkillInput): Promise<LearnedSkill> {
    const [skill] = await getDatabase().insert(learnedSkills).values({
      skillName: input.skillName,
      description: input.description,
      category: input.category || "task",
      triggerPatterns: input.triggerPatterns,
      steps: input.steps,
      expectedOutput: input.expectedOutput,
      learnedFrom: "user_teaching",
      isActive: 1,
      confidence: 0.8,
    }).returning();
    
    return skill;
  }
  
  async matchSkill(userInput: string): Promise<SkillMatchResult | null> {
    const activeSkills = await getDatabase().select().from(learnedSkills)
      .where(eq(learnedSkills.isActive, 1))
      .orderBy(desc(learnedSkills.successCount));
    
    const inputLower = userInput.toLowerCase();
    const inputWords = inputLower.split(/\s+/);
    
    for (const skill of activeSkills) {
      const patterns = skill.triggerPatterns || [];
      
      for (const pattern of patterns) {
        const patternLower = pattern.toLowerCase();
        
        if (inputLower.includes(patternLower)) {
          return {
            skill,
            matchedPattern: pattern,
            confidence: 0.9,
          };
        }
        
        const patternWords = patternLower.split(/\s+/);
        const matchedWords = patternWords.filter(pw => 
          inputWords.some(iw => iw.includes(pw) || pw.includes(iw))
        );
        
        if (matchedWords.length >= patternWords.length * 0.7) {
          return {
            skill,
            matchedPattern: pattern,
            confidence: matchedWords.length / patternWords.length,
          };
        }
      }
    }
    
    return null;
  }
  
  async executeSkill(skillId: string): Promise<{ success: boolean; output: string; steps: SkillStep[] }> {
    const [skill] = await getDatabase().select().from(learnedSkills)
      .where(eq(learnedSkills.id, skillId));
    
    if (!skill) {
      return { success: false, output: "技能不存在", steps: [] };
    }
    
    const steps = (skill.steps as SkillStep[]) || [];
    
    await getDatabase().update(learnedSkills)
      .set({
        usageCount: sql`${learnedSkills.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(learnedSkills.id, skillId));
    
    return {
      success: true,
      output: skill.expectedOutput || `执行技能: ${skill.skillName}`,
      steps,
    };
  }
  
  async recordSkillSuccess(skillId: string): Promise<void> {
    await getDatabase().update(learnedSkills)
      .set({
        successCount: sql`${learnedSkills.successCount} + 1`,
        confidence: sql`LEAST(1.0, ${learnedSkills.confidence} + 0.05)`,
      })
      .where(eq(learnedSkills.id, skillId));
  }
  
  async recordSkillFailure(skillId: string): Promise<void> {
    await getDatabase().update(learnedSkills)
      .set({
        confidence: sql`GREATEST(0.1, ${learnedSkills.confidence} - 0.1)`,
      })
      .where(eq(learnedSkills.id, skillId));
  }
  
  async learnFromConversation(
    conversationId: string,
    userMessages: string[],
    assistantResponses: string[],
    wasHelpful: boolean
  ): Promise<LearnedSkill | null> {
    if (!wasHelpful || userMessages.length === 0) {
      return null;
    }
    
    const firstMessage = userMessages[0];
    const lastResponse = assistantResponses[assistantResponses.length - 1] || "";
    
    const keywords = this.extractKeywords(firstMessage);
    if (keywords.length < 2) {
      return null;
    }
    
    const existingMatch = await this.matchSkill(firstMessage);
    if (existingMatch && existingMatch.confidence > 0.8) {
      return null;
    }
    
    const [skill] = await getDatabase().insert(learnedSkills).values({
      skillName: `对话学习: ${keywords.slice(0, 3).join(" ")}`,
      description: `从对话中学习的技能`,
      category: "query",
      triggerPatterns: [firstMessage.substring(0, 100)],
      steps: [{ order: 1, action: "respond", description: "基于学习的回复" }],
      expectedOutput: lastResponse.substring(0, 500),
      learnedFrom: "conversation",
      sourceConversationId: conversationId,
      isActive: 1,
      confidence: 0.5,
    }).returning();
    
    return skill;
  }
  
  async identifyPattern(userMessage: string): Promise<PatternMatchResult | null> {
    const patterns = await getDatabase().select().from(conversationPatterns)
      .where(eq(conversationPatterns.autoRespond, 1))
      .orderBy(desc(conversationPatterns.occurrenceCount));
    
    const inputLower = userMessage.toLowerCase();
    
    for (const pattern of patterns) {
      const patternLower = pattern.patternText.toLowerCase();
      
      if (inputLower.includes(patternLower) || patternLower.includes(inputLower)) {
        return {
          pattern,
          similarity: 0.9,
        };
      }
      
      const patternKeywords = pattern.keywords || [];
      const matchedKeywords = patternKeywords.filter(kw => 
        inputLower.includes(kw.toLowerCase())
      );
      
      if (matchedKeywords.length >= patternKeywords.length * 0.7) {
        return {
          pattern,
          similarity: matchedKeywords.length / Math.max(1, patternKeywords.length),
        };
      }
    }
    
    return null;
  }
  
  async recordPattern(
    patternType: string,
    patternText: string,
    keywords: string[],
    responseTemplate?: string
  ): Promise<ConversationPattern> {
    const existing = await getDatabase().select().from(conversationPatterns)
      .where(ilike(conversationPatterns.patternText, `%${patternText.substring(0, 50)}%`))
      .limit(1);
    
    if (existing.length > 0) {
      await getDatabase().update(conversationPatterns)
        .set({
          occurrenceCount: sql`${conversationPatterns.occurrenceCount} + 1`,
          lastOccurrence: new Date(),
          confidence: sql`LEAST(1.0, ${conversationPatterns.confidence} + 0.02)`,
        })
        .where(eq(conversationPatterns.id, existing[0].id));
      
      return existing[0];
    }
    
    const [pattern] = await getDatabase().insert(conversationPatterns).values({
      patternType,
      patternText,
      keywords,
      responseTemplate,
      occurrenceCount: 1,
      lastOccurrence: new Date(),
      autoRespond: 0,
      confidence: 0.3,
    }).returning();
    
    return pattern;
  }
  
  async enableAutoRespond(patternId: string): Promise<void> {
    await getDatabase().update(conversationPatterns)
      .set({ autoRespond: 1 })
      .where(eq(conversationPatterns.id, patternId));
  }
  
  async suggestAutoResponse(userMessage: string): Promise<{
    shouldAutoRespond: boolean;
    response?: string;
    patternId?: string;
    confidence: number;
  }> {
    const patternMatch = await this.identifyPattern(userMessage);
    
    if (patternMatch && patternMatch.similarity >= 0.8 && patternMatch.pattern.responseTemplate) {
      return {
        shouldAutoRespond: true,
        response: patternMatch.pattern.responseTemplate,
        patternId: patternMatch.pattern.id,
        confidence: patternMatch.similarity,
      };
    }
    
    const skillMatch = await this.matchSkill(userMessage);
    
    if (skillMatch && skillMatch.confidence >= 0.85) {
      const result = await this.executeSkill(skillMatch.skill.id);
      if (result.success) {
        return {
          shouldAutoRespond: true,
          response: result.output,
          confidence: skillMatch.confidence,
        };
      }
    }
    
    return {
      shouldAutoRespond: false,
      confidence: 0,
    };
  }
  
  async listSkills(category?: string): Promise<LearnedSkill[]> {
    if (category) {
      return getDatabase().select().from(learnedSkills)
        .where(and(
          eq(learnedSkills.isActive, 1),
          eq(learnedSkills.category, category)
        ))
        .orderBy(desc(learnedSkills.usageCount));
    }
    
    return getDatabase().select().from(learnedSkills)
      .where(eq(learnedSkills.isActive, 1))
      .orderBy(desc(learnedSkills.usageCount));
  }
  
  async listPatterns(patternType?: string): Promise<ConversationPattern[]> {
    if (patternType) {
      return getDatabase().select().from(conversationPatterns)
        .where(eq(conversationPatterns.patternType, patternType))
        .orderBy(desc(conversationPatterns.occurrenceCount));
    }
    
    return getDatabase().select().from(conversationPatterns)
      .orderBy(desc(conversationPatterns.occurrenceCount));
  }
  
  async deactivateSkill(skillId: string): Promise<void> {
    await getDatabase().update(learnedSkills)
      .set({ isActive: 0 })
      .where(eq(learnedSkills.id, skillId));
  }
  
  async updateSkill(skillId: string, updates: Partial<InsertLearnedSkill>): Promise<LearnedSkill | null> {
    const [updated] = await getDatabase().update(learnedSkills)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(learnedSkills.id, skillId))
      .returning();
    
    return updated || null;
  }
  
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "的", "了", "是", "在", "我", "你", "他", "她", "它", "们", "这", "那",
      "有", "和", "与", "或", "但", "因为", "所以", "如果", "就", "也", "都",
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "must", "can", "to", "of", "in", "for",
      "on", "with", "at", "by", "from", "as", "into", "through", "during",
      "before", "after", "above", "below", "between", "under", "again",
      "further", "then", "once", "here", "there", "when", "where", "why",
      "how", "all", "each", "few", "more", "most", "other", "some", "such",
      "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
      "what", "which", "who", "whom", "this", "that", "these", "those", "am",
      "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
      "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
      "she", "her", "hers", "herself", "it", "its", "itself", "they", "them",
      "their", "theirs", "themselves"
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
    
    return Array.from(new Set(words));
  }
  
  async getSkillStats(): Promise<{
    totalSkills: number;
    activeSkills: number;
    totalPatterns: number;
    autoRespondPatterns: number;
    topSkills: LearnedSkill[];
    topPatterns: ConversationPattern[];
  }> {
    const allSkills = await getDatabase().select().from(learnedSkills);
    const activeSkills = allSkills.filter(s => s.isActive === 1);
    
    const allPatterns = await getDatabase().select().from(conversationPatterns);
    const autoRespondPatterns = allPatterns.filter(p => p.autoRespond === 1);
    
    const topSkills = await getDatabase().select().from(learnedSkills)
      .where(eq(learnedSkills.isActive, 1))
      .orderBy(desc(learnedSkills.usageCount))
      .limit(5);
    
    const topPatterns = await getDatabase().select().from(conversationPatterns)
      .orderBy(desc(conversationPatterns.occurrenceCount))
      .limit(5);
    
    return {
      totalSkills: allSkills.length,
      activeSkills: activeSkills.length,
      totalPatterns: allPatterns.length,
      autoRespondPatterns: autoRespondPatterns.length,
      topSkills,
      topPatterns,
    };
  }
  
  async recordFeedback(input: RecordFeedbackInput): Promise<SkillFeedback> {
    const [feedback] = await getDatabase().insert(skillFeedback).values({
      conversationId: input.conversationId,
      messageId: input.messageId,
      skillId: input.skillId,
      feedbackType: input.feedbackType,
      userMessage: input.userMessage,
      assistantResponse: input.assistantResponse,
      category: input.category,
      followupCount: input.followupCount || 0,
      wasAdopted: input.wasAdopted || 0,
      sentiment: input.sentiment,
    }).returning();
    
    if (input.skillId) {
      if (input.feedbackType === "LIKE" || input.feedbackType === "ADOPT") {
        await this.recordSkillSuccess(input.skillId);
      } else if (input.feedbackType === "DISLIKE") {
        await this.recordSkillFailure(input.skillId);
      }
    }
    
    await this.updateProficiencyCurve(input.category || "general", input.feedbackType);
    
    return feedback;
  }
  
  async getFeedbackHistory(options?: {
    category?: string;
    feedbackType?: FeedbackType;
    limit?: number;
    offset?: number;
  }): Promise<SkillFeedback[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (options?.category) {
      conditions.push(eq(skillFeedback.category, options.category));
    }
    if (options?.feedbackType) {
      conditions.push(eq(skillFeedback.feedbackType, options.feedbackType));
    }
    
    const baseQuery = getDatabase().select().from(skillFeedback);
    const filteredQuery = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;
    
    return filteredQuery
      .orderBy(desc(skillFeedback.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);
  }
  
  async recordFollowup(conversationId: string, messageId: string): Promise<void> {
    const existing = await getDatabase().select().from(skillFeedback)
      .where(and(
        eq(skillFeedback.conversationId, conversationId),
        eq(skillFeedback.feedbackType, "FOLLOWUP")
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await getDatabase().update(skillFeedback)
        .set({
          followupCount: sql`${skillFeedback.followupCount} + 1`,
        })
        .where(eq(skillFeedback.id, existing[0].id));
    } else {
      await getDatabase().insert(skillFeedback).values({
        conversationId,
        messageId,
        feedbackType: "FOLLOWUP",
        followupCount: 1,
      });
    }
  }
  
  private async updateProficiencyCurve(category: string, feedbackType: FeedbackType): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    
    const existing = await getDatabase().select().from(skillProficiencyCurve)
      .where(and(
        eq(skillProficiencyCurve.category, category),
        eq(skillProficiencyCurve.date, today)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const updates: Record<string, any> = {
        totalInteractions: sql`${skillProficiencyCurve.totalInteractions} + 1`,
        updatedAt: new Date(),
      };
      
      if (feedbackType === "LIKE" || feedbackType === "ADOPT") {
        updates.successCount = sql`${skillProficiencyCurve.successCount} + 1`;
        updates.likeCount = sql`${skillProficiencyCurve.likeCount} + 1`;
      } else if (feedbackType === "DISLIKE") {
        updates.failureCount = sql`${skillProficiencyCurve.failureCount} + 1`;
        updates.dislikeCount = sql`${skillProficiencyCurve.dislikeCount} + 1`;
      }
      
      await getDatabase().update(skillProficiencyCurve)
        .set(updates)
        .where(eq(skillProficiencyCurve.id, existing[0].id));
      
      await this.recalculateProficiency(existing[0].id);
    } else {
      const isSuccess = feedbackType === "LIKE" || feedbackType === "ADOPT";
      const isFailure = feedbackType === "DISLIKE";
      
      await getDatabase().insert(skillProficiencyCurve).values({
        category,
        date: today,
        totalInteractions: 1,
        successCount: isSuccess ? 1 : 0,
        failureCount: isFailure ? 1 : 0,
        likeCount: isSuccess ? 1 : 0,
        dislikeCount: isFailure ? 1 : 0,
        proficiencyScore: 0.5,
        confidenceLevel: 0.5,
      });
    }
  }
  
  private async recalculateProficiency(recordId: string): Promise<void> {
    const [record] = await getDatabase().select().from(skillProficiencyCurve)
      .where(eq(skillProficiencyCurve.id, recordId));
    
    if (!record) return;
    
    const total = record.totalInteractions || 1;
    const success = record.successCount || 0;
    const failure = record.failureCount || 0;
    
    const successRate = total > 0 ? success / total : 0.5;
    const proficiencyScore = Math.min(1, Math.max(0, successRate * 0.7 + 0.3));
    const confidenceLevel = Math.min(1, total / 100);
    const adoptionRate = total > 0 ? success / total : 0;
    
    await getDatabase().update(skillProficiencyCurve)
      .set({
        proficiencyScore,
        confidenceLevel,
        adoptionRate,
      })
      .where(eq(skillProficiencyCurve.id, recordId));
  }
  
  async getProficiencyCurve(options?: {
    category?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<SkillProficiencyCurve[]> {
    const conditions: ReturnType<typeof eq | typeof gte | typeof lte>[] = [];
    if (options?.category) {
      conditions.push(eq(skillProficiencyCurve.category, options.category));
    }
    if (options?.startDate) {
      conditions.push(gte(skillProficiencyCurve.date, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(skillProficiencyCurve.date, options.endDate));
    }
    
    const baseQuery = getDatabase().select().from(skillProficiencyCurve);
    const filteredQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;
    
    return filteredQuery
      .orderBy(desc(skillProficiencyCurve.date))
      .limit(options?.limit || 30);
  }
  
  async getCategorySummary(): Promise<{
    category: string;
    totalInteractions: number;
    avgProficiency: number;
    trend: "UP" | "DOWN" | "STABLE";
  }[]> {
    const allCategories = await getDatabase().select().from(skillProficiencyCurve)
      .orderBy(desc(skillProficiencyCurve.date));
    
    const categoryMap = new Map<string, SkillProficiencyCurve[]>();
    for (const record of allCategories) {
      const existing = categoryMap.get(record.category) || [];
      existing.push(record);
      categoryMap.set(record.category, existing);
    }
    
    const summaries: {
      category: string;
      totalInteractions: number;
      avgProficiency: number;
      trend: "UP" | "DOWN" | "STABLE";
    }[] = [];
    
    const entries = Array.from(categoryMap.entries());
    for (const entry of entries) {
      const category = entry[0];
      const records = entry[1];
      const totalInteractions = records.reduce((sum: number, r: SkillProficiencyCurve) => sum + (r.totalInteractions || 0), 0);
      const avgProficiency = records.length > 0
        ? records.reduce((sum: number, r: SkillProficiencyCurve) => sum + (r.proficiencyScore || 0.5), 0) / records.length
        : 0.5;
      
      let trend: "UP" | "DOWN" | "STABLE" = "STABLE";
      if (records.length >= 2) {
        const recent = records[0].proficiencyScore || 0.5;
        const older = records[Math.min(6, records.length - 1)].proficiencyScore || 0.5;
        if (recent - older > 0.05) trend = "UP";
        else if (older - recent > 0.05) trend = "DOWN";
      }
      
      summaries.push({
        category,
        totalInteractions,
        avgProficiency,
        trend,
      });
    }
    
    return summaries.sort((a, b) => b.totalInteractions - a.totalInteractions);
  }
  
  async analyzeFollowupPatterns(): Promise<{
    avgFollowupCount: number;
    highFollowupCategories: string[];
    recommendations: string[];
  }> {
    const followups = await getDatabase().select().from(skillFeedback)
      .where(eq(skillFeedback.feedbackType, "FOLLOWUP"));
    
    const avgFollowupCount = followups.length > 0
      ? followups.reduce((sum, f) => sum + (f.followupCount || 0), 0) / followups.length
      : 0;
    
    const categoryFollowups = new Map<string, number>();
    for (const f of followups) {
      const cat = f.category || "general";
      categoryFollowups.set(cat, (categoryFollowups.get(cat) || 0) + (f.followupCount || 0));
    }
    
    const highFollowupCategories = Array.from(categoryFollowups.entries())
      .filter(([_, count]) => count > avgFollowupCount * 1.5)
      .map(([cat, _]) => cat);
    
    const recommendations: string[] = [];
    if (highFollowupCategories.length > 0) {
      recommendations.push(`以下领域需要改进回答质量: ${highFollowupCategories.join(", ")}`);
    }
    if (avgFollowupCount > 2) {
      recommendations.push("整体追问频率较高，建议优化回答的完整性和准确性");
    }
    
    return {
      avgFollowupCount,
      highFollowupCategories,
      recommendations,
    };
  }
}

export const skillLearner = new SkillLearnerService();

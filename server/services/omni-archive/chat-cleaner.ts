import { createServiceLogger } from '../../lib/logger';
const logger = createServiceLogger('ChatCleaner');

import { getDatabase } from "../../db";
import { chatExtracts, unifiedContacts, type InsertChatExtract, type ChatExtract } from "@shared/schema";
import { eq, ilike, or, sql, and } from "drizzle-orm";

interface RawMessage {
  sender: string;
  content: string;
  timestamp: Date;
  type?: string;
}

interface ChatUpload {
  platform: string;
  deviceId: string;
  chatType: 'PRIVATE' | 'GROUP';
  chatName: string;
  participants?: string[];
  messages: RawMessage[];
}

interface CoreRequest {
  content: string;
  timestamp: Date;
  speaker: string;
}

interface Commitment {
  content: string;
  deadline?: string;
  who: string;
  status: 'PENDING' | 'FULFILLED' | 'BROKEN';
}

interface EmotionPoint {
  content: string;
  emotion: string;
  intensity: number;
  timestamp: Date;
}

interface Opportunity {
  description: string;
  value?: number;
  probability: number;
}

interface Warning {
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  relatedTo?: string;
}

export class ChatCleaner {
  private dashscopeApiKey: string | undefined;

  private greetingPatterns = [
    /^(早上好|下午好|晚上好|你好|您好|hi|hello|hey|嗨)/i,
    /^(在吗|在不在|忙吗|有空吗)/i,
    /^(好的|嗯|嗯嗯|ok|okay|收到|了解|明白)/i,
    /^(谢谢|感谢|多谢|thanks|thank you)/i,
    /^(再见|拜拜|byebye|晚安|下次聊)/i,
    /^[\uD83D][\uDE00-\uDE4F]+$/,
    /^(哈哈|嘿嘿|呵呵|haha|lol)+$/i,
  ];

  constructor() {
    this.dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
  }

  async processChat(chat: ChatUpload): Promise<ChatExtract> {
    const contactId = await this.findContactId(chat.chatName, chat.participants?.[0]);

    const filteredMessages = this.filterMessages(chat.messages);

    const [created] = await getDatabase().insert(chatExtracts).values({
      platform: chat.platform,
      deviceId: chat.deviceId,
      chatType: chat.chatType,
      chatName: chat.chatName,
      contactId,
      participants: chat.participants,
      totalMessages: chat.messages.length,
      extractedMessages: filteredMessages.length,
      dateRange: {
        start: chat.messages[0]?.timestamp,
        end: chat.messages[chat.messages.length - 1]?.timestamp
      },
      localOnly: true,
      processingStatus: 'PENDING'
    } as any).returning();

    this.analyzeAsync(created.id, filteredMessages);

    return created;
  }

  private async findContactId(chatName: string, participantName?: string): Promise<string | null> {
    const searchName = participantName || chatName;
    const [contact] = await getDatabase().select()
      .from(unifiedContacts)
      .where(or(
        ilike(unifiedContacts.name, `%${searchName}%`),
        sql`${searchName} = ANY(${unifiedContacts.aliases})`
      ))
      .limit(1);
    
    return contact?.id || null;
  }

  private filterMessages(messages: RawMessage[]): RawMessage[] {
    return messages.filter(msg => {
      const content = msg.content.trim();
      if (content.length < 5) return false;
      for (const pattern of this.greetingPatterns) {
        if (pattern.test(content)) return false;
      }
      return true;
    });
  }

  private async analyzeAsync(chatId: string, messages: RawMessage[]): Promise<void> {
    if (!this.dashscopeApiKey || messages.length === 0) {
      return;
    }

    try {
      const conversationText = messages
        .map(m => `[${m.sender}]: ${m.content}`)
        .join('\n')
        .substring(0, 8000);

      const analysis = await this.analyzeWithAI(conversationText);

      await getDatabase().update(chatExtracts).set({
        coreRequests: analysis.coreRequests,
        commitments: analysis.commitments,
        emotionPoints: analysis.emotionPoints,
        opportunities: analysis.opportunities,
        warnings: analysis.warnings,
        lastSyncAt: new Date(),
        updatedAt: new Date()
      }).where(eq(chatExtracts.id, chatId));

    } catch (error) {
      logger.error({ err: error }, 'Chat analysis failed');
    }
  }

  private async analyzeWithAI(conversationText: string): Promise<{
    coreRequests: CoreRequest[];
    commitments: Commitment[];
    emotionPoints: EmotionPoint[];
    opportunities: Opportunity[];
    warnings: Warning[];
  }> {
    const prompt = `分析以下对话，提取关键信息：

${conversationText}

请以JSON格式输出：
{
  "coreRequests": [{"content": "核心诉求", "timestamp": "时间", "speaker": "发言人"}],
  "commitments": [{"content": "承诺内容", "deadline": "截止日期", "who": "承诺人", "status": "PENDING"}],
  "emotionPoints": [{"content": "情绪相关内容", "emotion": "情绪类型(愤怒/担忧/兴奋/失望)", "intensity": 0.8, "timestamp": "时间"}],
  "opportunities": [{"description": "商机描述", "value": 金额, "probability": 0.7}],
  "warnings": [{"description": "风险描述", "severity": "HIGH/MEDIUM/LOW", "relatedTo": "相关方"}]
}

注意：
1. 核心诉求：对方真正想要什么
2. 承诺事项：任何涉及时间、金额、承诺的内容
3. 情绪波动：语气变化、用词变化
4. 商机识别：潜在业务机会
5. 风险预警：需要注意的问题`;

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dashscopeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              { role: 'system', content: '你是一个商业对话分析专家，擅长从聊天记录中提取关键信息。' },
              { role: 'user', content: prompt }
            ]
          }
        })
      });

      const result = await response.json();
      const content = result.output?.text || result.output?.choices?.[0]?.message?.content || '';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error({ err: error }, 'AI analysis failed');
    }

    return {
      coreRequests: [],
      commitments: [],
      emotionPoints: [],
      opportunities: [],
      warnings: []
    };
  }

  async getChat(id: string): Promise<ChatExtract | null> {
    const [chat] = await getDatabase().select().from(chatExtracts).where(eq(chatExtracts.id, id));
    return chat || null;
  }

  async searchChats(query: string): Promise<ChatExtract[]> {
    return getDatabase().select().from(chatExtracts)
      .where(or(
        ilike(chatExtracts.chatName, `%${query}%`),
        sql`${chatExtracts.coreRequests}::text ILIKE '%${query}%'`
      ))
      .limit(50);
  }

  async getChatsByContact(contactId: string): Promise<ChatExtract[]> {
    return getDatabase().select().from(chatExtracts)
      .where(eq(chatExtracts.contactId, contactId));
  }

  async getPendingCommitments(): Promise<Array<{ chat: ChatExtract; commitment: Commitment }>> {
    const chats = await getDatabase().select().from(chatExtracts);
    const pending: Array<{ chat: ChatExtract; commitment: Commitment }> = [];

    for (const chat of chats) {
      const commitments = (chat.commitments as Commitment[]) || [];
      for (const commitment of commitments) {
        if (commitment.status === 'PENDING') {
          pending.push({ chat, commitment });
        }
      }
    }

    return pending;
  }

  async getRecentOpportunities(): Promise<Array<{ chat: ChatExtract; opportunity: Opportunity }>> {
    const chats = await getDatabase().select().from(chatExtracts)
      .orderBy(sql`${chatExtracts.createdAt} DESC`)
      .limit(100);
    
    const opportunities: Array<{ chat: ChatExtract; opportunity: Opportunity }> = [];

    for (const chat of chats) {
      const opps = (chat.opportunities as Opportunity[]) || [];
      for (const opportunity of opps) {
        opportunities.push({ chat, opportunity });
      }
    }

    return opportunities.sort((a, b) => (b.opportunity.probability || 0) - (a.opportunity.probability || 0));
  }
}

export const chatCleaner = new ChatCleaner();

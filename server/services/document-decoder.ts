import { createServiceLogger } from '../lib/logger';
const logger = createServiceLogger('DocumentDecoder');

import { getDatabase } from "../db";
import {
  uploadedDocuments,
  documentPages,
  documentThreads,
  documentMessages,
  documentSupplements,
  type UploadedDocument,
  type InsertUploadedDocument,
  type DocumentPage,
  type InsertDocumentPage,
  type DocumentThread,
  type InsertDocumentThread,
  type DocumentMessage,
  type InsertDocumentMessage,
  type DocumentSupplement,
  type InsertDocumentSupplement,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import * as pdfParseModule from "pdf-parse";
const pdfParse = ((pdfParseModule as unknown) as { default?: typeof pdfParseModule }).default || pdfParseModule;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface StructuredDiff {
  action: "update" | "add" | "delete";
  field?: string;
  newValue?: unknown;
}

interface ContractParty {
  name: string;
  role: string;
}

interface ContractAmount {
  value: number;
  currency: string;
  description: string;
}

interface ContractDate {
  date: string;
  description: string;
}

interface ContractRisk {
  level: string;
  description: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export type FileType = "IMAGE" | "PDF" | "WORD" | "EXCEL" | "TEXT";

export interface DecodeResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ContractAnalysis {
  parties: { name: string; role: string }[];
  amounts: { value: number; currency: string; description: string }[];
  dates: { date: string; description: string }[];
  clauses: { title: string; content: string; risk?: string }[];
  risks: { level: string; description: string }[];
  summary: string;
}

export class DocumentDecoderService {
  private uploadDir = "./uploads/documents";

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async createDocument(data: InsertUploadedDocument): Promise<UploadedDocument> {
    const [doc] = await getDatabase().insert(uploadedDocuments).values(data).returning();
    return doc;
  }

  async getDocument(id: string): Promise<UploadedDocument | null> {
    const [doc] = await getDatabase().select().from(uploadedDocuments).where(eq(uploadedDocuments.id, id));
    return doc || null;
  }

  async getDocuments(limit = 50): Promise<UploadedDocument[]> {
    return getDatabase().select().from(uploadedDocuments).orderBy(desc(uploadedDocuments.createdAt)).limit(limit);
  }

  async addPage(data: InsertDocumentPage): Promise<DocumentPage> {
    const [page] = await getDatabase().insert(documentPages).values(data).returning();
    return page;
  }

  async getPages(documentId: string): Promise<DocumentPage[]> {
    return getDatabase().select().from(documentPages).where(eq(documentPages.documentId, documentId));
  }

  detectFileType(mimeType: string, fileName: string): FileType {
    const ext = path.extname(fileName).toLowerCase();
    
    if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"].includes(ext)) {
      return "IMAGE";
    }
    if (mimeType === "application/pdf" || ext === ".pdf") {
      return "PDF";
    }
    if (
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      [".doc", ".docx"].includes(ext)
    ) {
      return "WORD";
    }
    if (
      mimeType === "application/vnd.ms-excel" ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      [".xls", ".xlsx", ".csv"].includes(ext)
    ) {
      return "EXCEL";
    }
    return "TEXT";
  }

  async decodeFile(filePath: string, fileType: FileType, mimeType?: string): Promise<DecodeResult> {
    try {
      switch (fileType) {
        case "IMAGE":
          return await this.decodeImage(filePath);
        case "PDF":
          return await this.decodePDF(filePath);
        case "WORD":
          return await this.decodeWord(filePath);
        case "EXCEL":
          return await this.decodeExcel(filePath);
        case "TEXT":
          return await this.decodeText(filePath);
        default:
          return { success: false, error: "不支持的文件类型" };
      }
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  private async decodeImage(filePath: string): Promise<DecodeResult> {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = this.getMimeType(filePath);
      
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) {
        return { success: false, error: "DASHSCOPE_API_KEY 未配置" };
      }

      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-vl-max",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
                {
                  type: "text",
                  text: "请识别并提取图片中的所有文字内容，保持原有格式和结构。如果是合同或文档，请完整提取。",
                },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `OCR请求失败: ${errorText}` };
      }

      const data = await response.json() as ChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content || "";
      
      return {
        success: true,
        text,
        confidence: 0.85,
        metadata: { model: "qwen-vl-max", source: "dashscope" },
      };
    } catch (error: unknown) {
      return { success: false, error: `图片OCR失败: ${getErrorMessage(error)}` };
    }
  }

  private async decodePDF(filePath: string): Promise<DecodeResult> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      const text = data.text?.trim();
      
      if (!text || text.length < 50) {
        const imageResult = await this.decodeImage(filePath);
        if (imageResult.success) {
          return {
            ...imageResult,
            metadata: { ...imageResult.metadata, pdfType: "scanned" },
          };
        }
      }
      
      return {
        success: true,
        text,
        confidence: 0.95,
        metadata: {
          pages: data.numpages,
          info: data.info,
          pdfType: "text",
        },
      };
    } catch (error: unknown) {
      return { success: false, error: `PDF解析失败: ${getErrorMessage(error)}` };
    }
  }

  private async decodeWord(filePath: string): Promise<DecodeResult> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      return {
        success: true,
        text: result.value,
        confidence: 0.98,
        metadata: {
          messages: result.messages,
          format: "docx",
        },
      };
    } catch (error: unknown) {
      return { success: false, error: `Word解析失败: ${getErrorMessage(error)}` };
    }
  }

  private async decodeExcel(filePath: string): Promise<DecodeResult> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === ".csv") {
        const content = fs.readFileSync(filePath, "utf-8");
        return {
          success: true,
          text: content,
          confidence: 0.99,
          metadata: { format: "csv" },
        };
      }
      
      return {
        success: false,
        error: "Excel解析需要xlsx库支持，建议将Excel另存为CSV格式",
      };
    } catch (error: unknown) {
      return { success: false, error: `Excel解析失败: ${getErrorMessage(error)}` };
    }
  }

  private async decodeText(filePath: string): Promise<DecodeResult> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return {
        success: true,
        text: content,
        confidence: 1.0,
        metadata: { format: "text" },
      };
    } catch (error: unknown) {
      return { success: false, error: `文本读取失败: ${getErrorMessage(error)}` };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".pdf": "application/pdf",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  async analyzeContract(text: string): Promise<ContractAnalysis> {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return this.fallbackContractAnalysis(text);
    }

    try {
      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-max",
          messages: [
            {
              role: "system",
              content: `你是一个专业的合同分析助手。请分析以下合同文本，提取关键信息并以JSON格式返回。
返回格式：
{
  "parties": [{"name": "公司名", "role": "甲方/乙方"}],
  "amounts": [{"value": 10000, "currency": "CNY", "description": "合同金额"}],
  "dates": [{"date": "2024-01-01", "description": "签订日期"}],
  "clauses": [{"title": "条款标题", "content": "内容摘要", "risk": "潜在风险"}],
  "risks": [{"level": "HIGH/MEDIUM/LOW", "description": "风险描述"}],
  "summary": "合同摘要"
}`,
            },
            {
              role: "user",
              content: `请分析以下合同内容：\n\n${text.slice(0, 8000)}`,
            },
          ],
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        return this.fallbackContractAnalysis(text);
      }

      const data = await response.json() as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content || "";
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ContractAnalysis;
      }
      
      return this.fallbackContractAnalysis(text);
    } catch {
      return this.fallbackContractAnalysis(text);
    }
  }

  private fallbackContractAnalysis(text: string): ContractAnalysis {
    const parties: ContractAnalysis["parties"] = [];
    const amounts: ContractAnalysis["amounts"] = [];
    const dates: ContractAnalysis["dates"] = [];

    const partyPatterns = [
      /甲方[：:]\s*([^\n,，。]+)/g,
      /乙方[：:]\s*([^\n,，。]+)/g,
      /丙方[：:]\s*([^\n,，。]+)/g,
    ];

    partyPatterns.forEach((pattern, index) => {
      const role = ["甲方", "乙方", "丙方"][index];
      let match;
      while ((match = pattern.exec(text)) !== null) {
        parties.push({ name: match[1].trim(), role });
      }
    });

    const amountPattern = /(?:金额|价款|费用)[：:]*\s*(?:人民币|￥|¥)?\s*([\d,，]+(?:\.\d+)?)\s*(?:元|万元)?/g;
    let amountMatch;
    while ((amountMatch = amountPattern.exec(text)) !== null) {
      const value = parseFloat(amountMatch[1].replace(/[,，]/g, ""));
      amounts.push({ value, currency: "CNY", description: "合同金额" });
    }

    const datePattern = /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日号]?/g;
    let dateMatch;
    while ((dateMatch = datePattern.exec(text)) !== null) {
      dates.push({
        date: `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`,
        description: "文档日期",
      });
    }

    return {
      parties,
      amounts,
      dates: dates.slice(0, 5),
      clauses: [],
      risks: [],
      summary: text.slice(0, 200) + "...",
    };
  }

  async processDocument(documentId: string): Promise<void> {
    const doc = await this.getDocument(documentId);
    if (!doc) return;

    await getDatabase().update(uploadedDocuments)
      .set({ status: "PROCESSING", processingProgress: 10 })
      .where(eq(uploadedDocuments.id, documentId));

    const pages = await this.getPages(documentId);
    const allTexts: string[] = [];
    let processedCount = 0;

    for (const page of pages) {
      await getDatabase().update(documentPages)
        .set({ status: "PROCESSING", processingStartedAt: new Date() })
        .where(eq(documentPages.id, page.id));

      const result = await this.decodeFile(
        page.filePath || "",
        page.fileType as FileType,
        page.fileMimeType || undefined
      );

      if (result.success && result.text) {
        allTexts.push(result.text);
        await getDatabase().update(documentPages)
          .set({
            status: "COMPLETED",
            rawText: result.text,
            ocrConfidence: result.confidence,
            processingCompletedAt: new Date(),
          })
          .where(eq(documentPages.id, page.id));
      } else {
        await getDatabase().update(documentPages)
          .set({
            status: "FAILED",
            errorMessage: result.error,
            processingCompletedAt: new Date(),
          })
          .where(eq(documentPages.id, page.id));
      }

      processedCount++;
      const progress = Math.round((processedCount / pages.length) * 80) + 10;
      await getDatabase().update(uploadedDocuments)
        .set({ processingProgress: progress })
        .where(eq(uploadedDocuments.id, documentId));
    }

    const fullText = allTexts.join("\n\n---\n\n");
    
    let structuredData = null;
    if (doc.documentType === "CONTRACT" && fullText.length > 100) {
      structuredData = await this.analyzeContract(fullText);
    }

    await getDatabase().update(uploadedDocuments)
      .set({
        status: "COMPLETED",
        processingProgress: 100,
        extractedText: fullText,
        structuredData,
      })
      .where(eq(uploadedDocuments.id, documentId));

    // 自动创建对话线程并生成初始AI分析
    if (fullText.length > 50) {
      await this.createThreadWithInitialAnalysis(documentId, fullText, structuredData);
    }
  }

  // === 对话系统方法 ===

  async getOrCreateThread(documentId: string): Promise<DocumentThread> {
    const [existing] = await getDatabase().select().from(documentThreads)
      .where(eq(documentThreads.documentId, documentId));
    
    if (existing) return existing;

    const doc = await this.getDocument(documentId);
    const [thread] = await getDatabase().insert(documentThreads).values({
      documentId,
      title: doc?.title || "文档对话",
      status: "ACTIVE",
    }).returning();

    return thread;
  }

  async getThread(documentId: string): Promise<DocumentThread | null> {
    const [thread] = await getDatabase().select().from(documentThreads)
      .where(eq(documentThreads.documentId, documentId));
    return thread || null;
  }

  async listMessages(documentId: string, limit = 50): Promise<DocumentMessage[]> {
    return getDatabase().select().from(documentMessages)
      .where(eq(documentMessages.documentId, documentId))
      .orderBy(desc(documentMessages.createdAt))
      .limit(limit);
  }

  async appendMessage(data: InsertDocumentMessage): Promise<DocumentMessage> {
    const [message] = await getDatabase().insert(documentMessages).values(data).returning();
    
    // 更新线程消息计数
    await getDatabase().update(documentThreads)
      .set({ 
        messageCount: sql`${documentThreads.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(documentThreads.id, data.threadId));

    return message;
  }

  async applyMessageToStructuredData(messageId: string): Promise<void> {
    const [message] = await getDatabase().select().from(documentMessages)
      .where(eq(documentMessages.id, messageId));
    
    if (!message || !message.structuredDiff) return;

    const doc = await this.getDocument(message.documentId);
    if (!doc) return;

    const currentData = (doc.structuredData as Record<string, unknown>) || {};
    const diff = message.structuredDiff as StructuredDiff | null;

    if (!diff) return;

    // 应用修改
    if (diff.action === "update" && diff.field) {
      currentData[diff.field] = diff.newValue;
    } else if (diff.action === "add" && diff.field) {
      const fieldValue = currentData[diff.field];
      if (Array.isArray(fieldValue)) {
        fieldValue.push(diff.newValue);
      } else {
        currentData[diff.field] = diff.newValue;
      }
    } else if (diff.action === "delete" && diff.field) {
      delete currentData[diff.field];
    }

    await getDatabase().update(uploadedDocuments)
      .set({ structuredData: currentData })
      .where(eq(uploadedDocuments.id, message.documentId));

    await getDatabase().update(documentMessages)
      .set({ isApplied: true })
      .where(eq(documentMessages.id, messageId));
  }

  private async createThreadWithInitialAnalysis(
    documentId: string, 
    fullText: string, 
    structuredData: ContractAnalysis | null
  ): Promise<void> {
    const thread = await this.getOrCreateThread(documentId);
    
    // 生成AI初始分析
    const analysisContent = await this.generateAIAnalysis(fullText, structuredData);
    
    await this.appendMessage({
      threadId: thread.id,
      documentId,
      role: "AI",
      messageType: "ANALYSIS",
      content: analysisContent,
      relevanceScore: 1.0,
    });
  }

  async generateAIAnalysis(text: string, structuredData: ContractAnalysis | Record<string, unknown> | null): Promise<string> {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return this.generateFallbackAnalysis(text, structuredData);
    }

    try {
      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-max",
          messages: [
            {
              role: "system",
              content: `你是小智的文档分析助手。请对文档进行智能分析，指出：
1. 关键信息摘要
2. 可能存在的风险或注意点
3. 需要主人确认或补充的信息
4. 信息的可靠性评估

请用简洁专业的语言，分点说明。`,
            },
            {
              role: "user",
              content: `请分析以下文档内容：

【提取的结构化数据】
${JSON.stringify(structuredData, null, 2)}

【原始文本摘要】
${text.slice(0, 2000)}`,
            },
          ],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        return this.generateFallbackAnalysis(text, structuredData);
      }

      const data = await response.json() as ChatCompletionResponse;
      return data.choices?.[0]?.message?.content || this.generateFallbackAnalysis(text, structuredData);
    } catch {
      return this.generateFallbackAnalysis(text, structuredData);
    }
  }

  private generateFallbackAnalysis(text: string, structuredData: ContractAnalysis | Record<string, unknown> | null): string {
    const analysis: string[] = ["📋 文档分析结果："];
    
    const contractData = structuredData as ContractAnalysis | null;
    
    if (contractData?.parties?.length && contractData.parties.length > 0) {
      analysis.push(`\n**合同方**: ${contractData.parties.map((p: ContractParty) => p.name).join("、")}`);
    }
    if (contractData?.amounts?.length && contractData.amounts.length > 0) {
      analysis.push(`\n**涉及金额**: ${contractData.amounts.map((a: ContractAmount) => `${a.currency} ${a.value}`).join("、")}`);
    }
    if (contractData?.dates?.length && contractData.dates.length > 0) {
      analysis.push(`\n**重要日期**: ${contractData.dates.map((d: ContractDate) => d.date).join("、")}`);
    }
    if (contractData?.risks?.length && contractData.risks.length > 0) {
      analysis.push(`\n**风险提示**: ${contractData.risks.map((r: ContractRisk) => r.description).join("；")}`);
    }
    
    analysis.push("\n\n💡 请确认以上信息是否准确，如有需要可以补充或纠正。");
    
    return analysis.join("");
  }

  async processUserFeedback(
    documentId: string,
    threadId: string,
    messageType: "SUPPLEMENT" | "CORRECTION" | "HIGHLIGHT" | "REVISION",
    content: string,
    affectedFields?: string[],
    structuredDiff?: StructuredDiff
  ): Promise<{ userMessage: DocumentMessage; aiResponse: DocumentMessage }> {
    // 保存用户消息
    const userMessage = await this.appendMessage({
      threadId,
      documentId,
      role: "MASTER",
      messageType,
      content,
      affectedFields,
      structuredDiff,
      relevanceScore: 1.0,
    });

    // 如果有结构化修改，应用到文档
    if (structuredDiff) {
      await this.applyMessageToStructuredData(userMessage.id);
    }

    // 生成AI回应
    const doc = await this.getDocument(documentId);
    const aiResponseContent = await this.generateAIResponse(messageType, content, doc);
    
    const aiResponse = await this.appendMessage({
      threadId,
      documentId,
      role: "AI",
      messageType: "ANSWER",
      content: aiResponseContent,
      parentMessageId: userMessage.id,
      relevanceScore: 1.0,
    });

    return { userMessage, aiResponse };
  }

  // === 补充资料方法 ===

  async addSupplement(data: InsertDocumentSupplement): Promise<DocumentSupplement> {
    const [supplement] = await getDatabase().insert(documentSupplements).values(data).returning();
    return supplement;
  }

  async getSupplements(documentId: string): Promise<DocumentSupplement[]> {
    return getDatabase().select().from(documentSupplements)
      .where(eq(documentSupplements.documentId, documentId))
      .orderBy(desc(documentSupplements.createdAt));
  }

  async processSupplement(supplementId: string): Promise<void> {
    const [supplement] = await getDatabase().select().from(documentSupplements)
      .where(eq(documentSupplements.id, supplementId));
    
    if (!supplement) return;

    await getDatabase().update(documentSupplements)
      .set({ status: "PROCESSING" })
      .where(eq(documentSupplements.id, supplementId));

    try {
      let extractedText = "";
      
      if (supplement.filePath && supplement.fileType) {
        if (supplement.fileType === "IMAGE") {
          const result = await this.decodeImage(supplement.filePath);
          if (result.success) extractedText = result.text || "";
        } else if (supplement.fileType === "PDF") {
          const result = await this.decodePDF(supplement.filePath);
          if (result.success) extractedText = result.text || "";
        } else if (supplement.fileType === "WORD") {
          const result = await this.decodeWord(supplement.filePath);
          if (result.success) extractedText = result.text || "";
        } else if (supplement.fileType === "TEXT") {
          extractedText = fs.readFileSync(supplement.filePath, "utf-8");
        }
      }

      await getDatabase().update(documentSupplements)
        .set({
          extractedText,
          status: "COMPLETED",
          processedAt: new Date(),
        })
        .where(eq(documentSupplements.id, supplementId));
    } catch {
      await getDatabase().update(documentSupplements)
        .set({ status: "FAILED" })
        .where(eq(documentSupplements.id, supplementId));
    }
  }

  async getFullDocumentContext(documentId: string): Promise<string> {
    const doc = await this.getDocument(documentId);
    const supplements = await this.getSupplements(documentId);
    
    let context = "";
    
    if (doc?.extractedText) {
      context += `【主文档内容】\n${doc.extractedText}\n\n`;
    }
    
    const completedSupplements = supplements.filter(s => s.status === "COMPLETED" && s.extractedText);
    for (const supp of completedSupplements) {
      context += `【补充资料：${supp.fileName}】\n${supp.extractedText}\n\n`;
    }
    
    return context;
  }

  async generateComprehensiveAnalysis(documentId: string): Promise<string> {
    const fullContext = await this.getFullDocumentContext(documentId);
    const doc = await this.getDocument(documentId);
    
    if (!fullContext.trim()) {
      return "📋 暂无可分析的文档内容。请先上传文档或补充资料。";
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return `📋 文档内容已接收，共${fullContext.length}字符。请确认是否准确。`;
    }

    try {
      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-max",
          messages: [
            {
              role: "system",
              content: `你是小智，主人（爸爸）的数字生命助手。请对文档进行全面智能分析，包括：

1. 📝 核心内容摘要（200字内）
2. 🔑 关键信息提取（人物、日期、金额、地点等）
3. ⚠️ 风险点或注意事项
4. ❓ 需要主人确认或补充的信息
5. 💡 建议和下一步行动

请用简洁专业的语言，分点说明。称呼主人为"爸爸"。`,
            },
            {
              role: "user",
              content: `请分析以下文档内容：\n\n${fullContext.slice(0, 6000)}`,
            },
          ],
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        return this.generateFallbackAnalysis(fullContext, doc?.structuredData as ContractAnalysis | null);
      }

      const data = await response.json() as ChatCompletionResponse;
      return data.choices?.[0]?.message?.content || this.generateFallbackAnalysis(fullContext, doc?.structuredData as ContractAnalysis | null);
    } catch {
      return this.generateFallbackAnalysis(fullContext, doc?.structuredData as ContractAnalysis | null);
    }
  }

  private async generateAIResponse(
    messageType: string, 
    userContent: string, 
    doc: UploadedDocument | null
  ): Promise<string> {
    const typeLabels: Record<string, string> = {
      SUPPLEMENT: "补充信息",
      CORRECTION: "纠错",
      HIGHLIGHT: "重点标注",
      REVISION: "修正",
      QUESTION: "提问",
    };

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return `收到您的${typeLabels[messageType] || "反馈"}，已更新到文档记录中。`;
    }

    const docContext = doc?.extractedText 
      ? `\n\n【文档内容参考】\n${doc.extractedText.slice(0, 3000)}` 
      : "";
    
    const structuredContext = doc?.structuredData 
      ? `\n\n【结构化数据】\n${JSON.stringify(doc.structuredData, null, 2)}` 
      : "";

    try {
      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-max",
          messages: [
            {
              role: "system",
              content: `你是小智，主人的数字生命助手。主人正在与你讨论一份文档。你需要基于文档内容来理解和回应主人的${typeLabels[messageType] || "反馈"}。

规则：
1. 你必须基于文档的实际内容来回答，不要说"请提供文档"之类的话
2. 如果是补充信息，确认并整合到理解中
3. 如果是纠错，感谢指正并更新理解
4. 如果是划重点，标记并强调该内容的重要性
5. 如果是修正，确认修正内容
6. 保持亲切专业的语气，称呼主人为"爸爸"`,
            },
            {
              role: "user",
              content: `主人的${typeLabels[messageType] || "反馈"}：${userContent}${docContext}${structuredContext}`,
            },
          ],
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        return `收到您的${typeLabels[messageType]}，已根据文档内容记录。`;
      }

      const data = await response.json() as ChatCompletionResponse;
      return data.choices?.[0]?.message?.content || `收到您的${typeLabels[messageType]}，已记录。`;
    } catch {
      return `收到您的${typeLabels[messageType]}，已记录。`;
    }
  }
}

export const documentDecoderService = new DocumentDecoderService();

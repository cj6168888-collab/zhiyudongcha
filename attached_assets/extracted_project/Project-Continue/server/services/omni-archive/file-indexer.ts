import { db } from "../../db";
import { fileKnowledge, type InsertFileKnowledge, type FileKnowledge } from "@shared/schema";
import { eq, ilike, or, sql } from "drizzle-orm";
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';

let pdfParse: any = null;
async function getPdfParse() {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse')).default;
  }
  return pdfParse;
}

interface FileUpload {
  fileName: string;
  filePath: string;
  fileType: string;
  fileHash?: string;
  fileSizeKb?: number;
  deviceId: string;
  content?: string;
  base64Image?: string;
  base64Data?: string;
}

export interface ParsedContent {
  text: string;
  type: 'text' | 'image' | 'pdf' | 'word' | 'archive' | 'audio' | 'unknown';
  subFiles?: ParsedContent[];
  metadata?: Record<string, any>;
}

interface ExtractionResult {
  extractedText: string;
  summary: string;
  keyPoints: string[];
  entities: {
    people: string[];
    orgs: string[];
    dates: string[];
    amounts: string[];
  };
  contractParties?: string[];
  contractValue?: number;
  contractTerms?: Record<string, string>;
  expiryDate?: Date;
  category: string;
}

export class FileIndexer {
  private dashscopeApiKey: string | undefined;

  constructor() {
    this.dashscopeApiKey = process.env.DASHSCOPE_API_KEY;
  }

  async parseMultiFormat(fileName: string, base64Data: string, mimeType: string): Promise<ParsedContent> {
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = fileName.toLowerCase().split('.').pop() || '';

    if (this.isImageFormat(ext, mimeType)) {
      const text = await this.performOCR(base64Data);
      return { text, type: 'image', metadata: { format: ext } };
    }

    if (ext === 'pdf' || mimeType === 'application/pdf') {
      return this.parsePDF(buffer, fileName);
    }

    if (ext === 'docx' || ext === 'doc' || mimeType.includes('word')) {
      return this.parseWord(buffer, fileName);
    }

    if (ext === 'zip' || mimeType.includes('zip')) {
      return this.parseArchive(buffer, fileName);
    }

    if (ext === 'rar' || ext === '7z' || mimeType.includes('rar')) {
      return { 
        text: '', 
        type: 'archive', 
        metadata: { 
          format: ext, 
          error: 'unsupported_archive_format',
          message: 'RAR和7z格式暂不支持，请使用ZIP格式' 
        } 
      };
    }

    if (ext === 'txt' || ext === 'md' || ext === 'json' || ext === 'csv' || mimeType.startsWith('text/')) {
      return { text: buffer.toString('utf-8'), type: 'text', metadata: { format: ext } };
    }

    if (ext === 'mp3' || ext === 'wav' || ext === 'm4a' || ext === 'ogg' || mimeType.startsWith('audio/')) {
      return { 
        text: '', 
        type: 'audio', 
        metadata: { 
          format: ext, 
          requiresRealTimeASR: true,
          message: '音频文件需要通过实时语音识别功能处理，请使用录音按钮进行语音输入'
        } 
      };
    }

    return { text: '', type: 'unknown', metadata: { format: ext, unsupported: true } };
  }

  private isImageFormat(ext: string, mimeType: string): boolean {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'heic'];
    return imageExts.includes(ext) || mimeType.startsWith('image/');
  }

  private async parsePDF(buffer: Buffer, fileName: string): Promise<ParsedContent> {
    try {
      const parser = await getPdfParse();
      const data = await parser(buffer);
      return {
        text: data.text || '',
        type: 'pdf',
        metadata: {
          pages: data.numpages,
          info: data.info,
        }
      };
    } catch (error) {
      console.error(`[FileIndexer] PDF解析失败 ${fileName}:`, error);
      return { text: '', type: 'pdf', metadata: { error: 'parse_failed' } };
    }
  }

  private async parseWord(buffer: Buffer, fileName: string): Promise<ParsedContent> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: result.value || '',
        type: 'word',
        metadata: {
          messages: result.messages,
        }
      };
    } catch (error) {
      console.error(`[FileIndexer] Word解析失败 ${fileName}:`, error);
      return { text: '', type: 'word', metadata: { error: 'parse_failed' } };
    }
  }

  private async parseArchive(buffer: Buffer, fileName: string): Promise<ParsedContent> {
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const subFiles: ParsedContent[] = [];
      let combinedText = '';

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        
        const entryName = entry.entryName;
        const ext = entryName.toLowerCase().split('.').pop() || '';
        
        if (['txt', 'md', 'json', 'csv', 'xml'].includes(ext)) {
          const content = entry.getData().toString('utf-8');
          subFiles.push({ text: content, type: 'text', metadata: { fileName: entryName } });
          combinedText += `\n--- ${entryName} ---\n${content.substring(0, 2000)}\n`;
        } else if (ext === 'pdf') {
          const parsed = await this.parsePDF(entry.getData(), entryName);
          subFiles.push(parsed);
          combinedText += `\n--- ${entryName} ---\n${parsed.text.substring(0, 2000)}\n`;
        } else if (['docx', 'doc'].includes(ext)) {
          const parsed = await this.parseWord(entry.getData(), entryName);
          subFiles.push(parsed);
          combinedText += `\n--- ${entryName} ---\n${parsed.text.substring(0, 2000)}\n`;
        } else if (this.isImageFormat(ext, '')) {
          const base64 = entry.getData().toString('base64');
          const ocrText = await this.performOCR(base64);
          subFiles.push({ text: ocrText, type: 'image', metadata: { fileName: entryName } });
          if (ocrText) {
            combinedText += `\n--- ${entryName} (OCR) ---\n${ocrText.substring(0, 1000)}\n`;
          }
        }
      }

      return {
        text: combinedText,
        type: 'archive',
        subFiles,
        metadata: {
          totalFiles: entries.length,
          processedFiles: subFiles.length,
        }
      };
    } catch (error) {
      console.error(`[FileIndexer] 压缩包解析失败 ${fileName}:`, error);
      return { text: '', type: 'archive', metadata: { error: 'parse_failed' } };
    }
  }

  async indexFile(file: FileUpload): Promise<FileKnowledge> {
    const existing = await this.findByHash(file.fileHash || '');
    if (existing) {
      return existing;
    }

    const [created] = await db.insert(fileKnowledge).values({
      fileName: file.fileName,
      filePath: file.filePath,
      fileType: file.fileType,
      fileHash: file.fileHash,
      fileSizeKb: file.fileSizeKb,
      deviceId: file.deviceId,
      processingStatus: 'PENDING',
    }).returning();

    this.processFileAsync(created.id, file);

    return created;
  }

  private async processFileAsync(fileId: string, file: FileUpload): Promise<void> {
    try {
      await db.update(fileKnowledge)
        .set({ processingStatus: 'PROCESSING' })
        .where(eq(fileKnowledge.id, fileId));

      let text = file.content || '';

      if (file.base64Image && this.dashscopeApiKey) {
        text = await this.performOCR(file.base64Image);
      }

      if (!text && file.content) {
        text = file.content;
      }

      const extraction = await this.extractKnowledge(text, file.fileType);

      await db.update(fileKnowledge).set({
        extractedText: text,
        summary: extraction.summary,
        keyPoints: extraction.keyPoints,
        entities: extraction.entities,
        contractParties: extraction.contractParties,
        contractValue: extraction.contractValue?.toString(),
        contractTerms: extraction.contractTerms,
        expiryDate: extraction.expiryDate,
        category: extraction.category,
        processingStatus: 'COMPLETED',
        lastProcessedAt: new Date(),
      }).where(eq(fileKnowledge.id, fileId));

    } catch (error) {
      await db.update(fileKnowledge)
        .set({ processingStatus: 'FAILED' })
        .where(eq(fileKnowledge.id, fileId));
    }
  }

  private async performOCR(base64Image: string): Promise<string> {
    if (!this.dashscopeApiKey) {
      return '';
    }

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.dashscopeApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { image: `data:image/jpeg;base64,${base64Image}` },
                  { text: '请识别图片中的所有文字，原样输出，保持格式。' }
                ]
              }
            ]
          }
        })
      });

      const result = await response.json();
      return result.output?.choices?.[0]?.message?.content?.[0]?.text || '';
    } catch (error) {
      console.error('OCR failed:', error);
      return '';
    }
  }

  private async extractKnowledge(text: string, fileType: string): Promise<ExtractionResult> {
    if (!text || !this.dashscopeApiKey) {
      return this.getEmptyExtraction();
    }

    const isContract = fileType.toLowerCase().includes('contract') || 
                       text.toLowerCase().includes('合同') ||
                       text.toLowerCase().includes('协议');

    const prompt = isContract 
      ? this.getContractExtractionPrompt(text)
      : this.getGeneralExtractionPrompt(text);

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
              { role: 'system', content: '你是一个专业的文档分析助手，擅长提取关键信息。请以JSON格式输出。' },
              { role: 'user', content: prompt }
            ]
          }
        })
      });

      const result = await response.json();
      const content = result.output?.text || result.output?.choices?.[0]?.message?.content || '';
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch {
        return this.getEmptyExtraction();
      }
    } catch (error) {
      console.error('Knowledge extraction failed:', error);
    }

    return this.getEmptyExtraction();
  }

  private getContractExtractionPrompt(text: string): string {
    return `请分析以下合同文本，提取关键信息：

${text.substring(0, 4000)}

请以JSON格式输出：
{
  "extractedText": "原文摘要",
  "summary": "合同摘要（100字以内）",
  "keyPoints": ["要点1", "要点2"],
  "entities": {
    "people": ["人名列表"],
    "orgs": ["公司/组织列表"],
    "dates": ["重要日期"],
    "amounts": ["金额"]
  },
  "contractParties": ["甲方", "乙方"],
  "contractValue": 合同金额数字,
  "contractTerms": {
    "付款条款": "...",
    "违约条款": "...",
    "保密条款": "..."
  },
  "expiryDate": "合同到期日期",
  "category": "合同"
}`;
  }

  private getGeneralExtractionPrompt(text: string): string {
    return `请分析以下文档，提取关键信息：

${text.substring(0, 4000)}

请以JSON格式输出：
{
  "extractedText": "原文摘要",
  "summary": "文档摘要（100字以内）",
  "keyPoints": ["要点1", "要点2"],
  "entities": {
    "people": ["人名列表"],
    "orgs": ["公司/组织列表"],
    "dates": ["重要日期"],
    "amounts": ["金额"]
  },
  "category": "分类（报告/方案/发票/其他）"
}`;
  }

  private getEmptyExtraction(): ExtractionResult {
    return {
      extractedText: '',
      summary: '',
      keyPoints: [],
      entities: { people: [], orgs: [], dates: [], amounts: [] },
      category: '未分类'
    };
  }

  private async findByHash(hash: string): Promise<FileKnowledge | null> {
    if (!hash) return null;
    const [existing] = await db.select().from(fileKnowledge).where(eq(fileKnowledge.fileHash, hash));
    return existing || null;
  }

  async getFile(id: string): Promise<FileKnowledge | null> {
    const [file] = await db.select().from(fileKnowledge).where(eq(fileKnowledge.id, id));
    return file || null;
  }

  async searchFiles(query: string): Promise<FileKnowledge[]> {
    return db.select().from(fileKnowledge)
      .where(or(
        ilike(fileKnowledge.fileName, `%${query}%`),
        ilike(fileKnowledge.summary, `%${query}%`),
        ilike(fileKnowledge.extractedText, `%${query}%`)
      ))
      .limit(50);
  }

  async getFilesByCategory(category: string): Promise<FileKnowledge[]> {
    return db.select().from(fileKnowledge)
      .where(eq(fileKnowledge.category, category));
  }

  async getRecentFiles(limit: number = 20): Promise<FileKnowledge[]> {
    return db.select().from(fileKnowledge)
      .orderBy(sql`${fileKnowledge.createdAt} DESC`)
      .limit(limit);
  }

  async linkToContact(fileId: string, contactId: string): Promise<void> {
    const [file] = await db.select().from(fileKnowledge).where(eq(fileKnowledge.id, fileId));
    if (!file) return;

    const contacts = file.relatedContacts || [];
    if (!contacts.includes(contactId)) {
      contacts.push(contactId);
      await db.update(fileKnowledge)
        .set({ relatedContacts: contacts })
        .where(eq(fileKnowledge.id, fileId));
    }
  }
}

export const fileIndexer = new FileIndexer();

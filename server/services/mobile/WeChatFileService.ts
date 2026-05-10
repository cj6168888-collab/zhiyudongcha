/**
 * 微信文件监控与处理服务 - WeChatFileService
 * 
 * 专门处理来自微信的文件监控、自动识别和处理
 * 支持律师函、合同、发票等重要文件的智能分类
 */

import { createServiceLogger } from '../../lib/logger';
import { lawyerLetterProcessor } from '../LawyerLetterProcessor';
import { documentDecoderService } from '../document-decoder';
import companionAppService from './CompanionAppService';
import type { CompanionPayload } from './CompanionAppService';

const logger = createServiceLogger('WeChatFile');

export type DocumentCategory = 
  | 'LAWYER_LETTER'    // 律师函
  | 'CONTRACT'          // 合同
  | 'INVOICE'           // 发票
  | 'RECEIPT'           // 收据
  | 'ID_CARD'           // 身份证
  | 'BUSINESS_LICENSE'  // 营业执照
  | 'OTHER';            // 其他

export interface FileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  source: string;
  detectedAt: number;
  wechatPath?: string;
}

interface ProcessingResultData {
  lawyerLetter?: unknown;
  summary?: string;
  entities?: unknown;
  riskAssessment?: unknown;
}

export interface ProcessedDocument {
  category: DocumentCategory;
  confidence: number;
  metadata: FileMetadata;
  processingResult?: ProcessingResultData;
  nextActions?: string[];
}

export interface WeChatFileConfig {
  enabled: boolean;
  watchMicroMsg: boolean;
  watchDownload: boolean;
  autoProcess: boolean;
  notifyOnProcess: boolean;
  categories: DocumentCategory[];
}

const DEFAULT_CONFIG: WeChatFileConfig = {
  enabled: true,
  watchMicroMsg: true,
  watchDownload: true,
  autoProcess: true,
  notifyOnProcess: true,
  categories: ['LAWYER_LETTER', 'CONTRACT', 'INVOICE', 'ID_CARD', 'BUSINESS_LICENSE'],
};

const CATEGORY_PATTERNS: Record<DocumentCategory, {
  keywords: string[];
  fileExtensions: string[];
  minConfidence: number;
}> = {
  LAWYER_LETTER: {
    keywords: ['律师函', '律师警告', '侵权', '违约', '诉讼', '起诉', '赔偿', '法务', '律师事务所'],
    fileExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    minConfidence: 0.7,
  },
  CONTRACT: {
    keywords: ['合同', '协议', '条款', '甲方', '乙方', '权利义务', '违约责任', '签署', '本协议'],
    fileExtensions: ['.pdf', '.doc', '.docx'],
    minConfidence: 0.6,
  },
  INVOICE: {
    keywords: ['发票', '增值税', '税额', '购买方', '销售方', '价税合计', '发票代码', '发票号码'],
    fileExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    minConfidence: 0.8,
  },
  RECEIPT: {
    keywords: ['收据', '收款', '付款', '金额', '收款人', '付款人'],
    fileExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    minConfidence: 0.5,
  },
  ID_CARD: {
    keywords: ['身份证', '公民身份号码', '性别', '民族', '出生', '住址'],
    fileExtensions: ['.jpg', '.jpeg', '.png'],
    minConfidence: 0.9,
  },
  BUSINESS_LICENSE: {
    keywords: ['营业执照', '统一社会信用代码', '法定代表人', '注册资本', '经营范围', '公司名称'],
    fileExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
    minConfidence: 0.85,
  },
  OTHER: {
    keywords: [],
    fileExtensions: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xls', '.xlsx'],
    minConfidence: 0,
  },
};

class WeChatFileService {
  private config: WeChatFileConfig;
  private processedFiles: Map<string, ProcessedDocument> = new Map();
  private notificationCallbacks: Array<(doc: ProcessedDocument) => void> = [];

  constructor(config: Partial<WeChatFileConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupCompanionHandlers();
  }

  private setupCompanionHandlers(): void {
    companionAppService.onMessage('FILE_DETECTED', async (deviceId, payload) => {
      if (!this.config.enabled || !this.config.autoProcess) return;
      
      const fileType = payload.fileType?.toLowerCase() || '';
      const fileName = payload.fileName || '';

      const isWeChatFile = payload.filePath?.includes('MicroMsg') || 
                          payload.filePath?.includes('Tencent');
      
      if (!isWeChatFile && this.config.watchDownload) {
        // Handle download folder files
      }

      logger.info({
        deviceId,
        fileName,
        fileType,
        filePath: payload.filePath,
      }, 'WeChat file detected');
    });

    companionAppService.onMessage('FILE_UPLOAD', async (deviceId, payload) => {
      if (!this.config.enabled) return;

      try {
        const result = await this.processFile(deviceId, {
          fileName: payload.fileName || 'unknown',
          fileType: payload.fileType || 'unknown',
          fileSize: payload.fileSize || 0,
          source: 'wechat',
          detectedAt: Date.now(),
          wechatPath: payload.filePath,
        }, payload.base64 || '');

        if (result && this.config.notifyOnProcess) {
          this.notifyClients(result);
        }
      } catch (error) {
        logger.error({ deviceId, error }, 'Failed to process uploaded file');
      }
    });
  }

  async processFile(
    deviceId: string,
    metadata: FileMetadata,
    content: string
  ): Promise<ProcessedDocument | null> {
    const { fileName, fileType } = metadata;
    const category = this.detectCategory(fileName, content);

    logger.info({
      deviceId,
      fileName,
      category,
    }, 'Processing WeChat file');

    const processedDoc: ProcessedDocument = {
      category,
      confidence: CATEGORY_PATTERNS[category].minConfidence,
      metadata,
      nextActions: [],
    };

    try {
      if (category === 'LAWYER_LETTER') {
        const result = await lawyerLetterProcessor.processFromFile({
          path: fileName,
          content,
          encoding: 'base64',
        });

        if (result.success) {
          processedDoc.processingResult = {
            lawyerLetter: result.letterInfo,
            summary: result.summary,
            entities: result.entities,
            riskAssessment: result.riskAssessment,
          };

          processedDoc.nextActions = this.generateActionsForLawyerLetter(result);
        }
      } else if (category === 'CONTRACT') {
        processedDoc.nextActions = [
          '分析合同条款',
          '识别风险点',
          '提取关键日期',
          '检查违约条款',
        ];
      } else if (category === 'INVOICE') {
        processedDoc.nextActions = [
          '验证发票真伪',
          '提取金额信息',
          '核对税号',
        ];
      } else {
        processedDoc.nextActions = [
          '提取文本内容',
          '识别关键信息',
        ];
      }

      const docKey = `${deviceId}_${metadata.detectedAt}`;
      this.processedFiles.set(docKey, processedDoc);

      logger.info({
        deviceId,
        fileName,
        category,
        confidence: processedDoc.confidence,
      }, 'WeChat file processed successfully');

      return processedDoc;
    } catch (error) {
      logger.error({ deviceId, fileName, error }, 'Failed to process WeChat file');
      return processedDoc;
    }
  }

  private detectCategory(fileName: string, content: string): DocumentCategory {
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const contentLower = content.toLowerCase();

    const categories: DocumentCategory[] = [
      'LAWYER_LETTER',
      'CONTRACT',
      'INVOICE',
      'RECEIPT',
      'ID_CARD',
      'BUSINESS_LICENSE',
    ];

    for (const category of categories) {
      const pattern = CATEGORY_PATTERNS[category];
      
      // Check file extension
      if (pattern.fileExtensions.includes(fileExt)) {
        // Check keywords in content
        const keywordMatches = pattern.keywords.filter(
          keyword => contentLower.includes(keyword.toLowerCase())
        );

        if (keywordMatches.length > 0) {
          return category;
        }
      }
    }

    // Check file name
    for (const category of categories) {
      const pattern = CATEGORY_PATTERNS[category];
      for (const keyword of pattern.keywords) {
        if (fileName.toLowerCase().includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }

    return 'OTHER';
  }

  private generateActionsForLawyerLetter(result: { success: boolean; riskAssessment?: unknown; letterInfo?: unknown; summary?: string; entities?: unknown }): string[] {
    const actions: string[] = [
      '通知用户查看律师函详情',
    ];

    if (result.riskAssessment) {
      const riskAssessment = result.riskAssessment as {
        severity?: string;
        recommendations?: string[];
        responseDeadline?: string;
      };
      
      const { severity, recommendations = [] } = riskAssessment;
      
      if (severity === 'CRITICAL' || severity === 'HIGH') {
        actions.push('发送紧急通知');
        actions.push('建议立即咨询律师');
        
        if (riskAssessment.responseDeadline) {
          actions.push(`提醒截止日期: ${riskAssessment.responseDeadline}`);
        }
      }

      actions.push(...recommendations.slice(0, 3).map((r: string) => `建议: ${r}`));
    }

    return actions;
  }

  onProcessNotification(callback: (doc: ProcessedDocument) => void): () => void {
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  private notifyClients(doc: ProcessedDocument): void {
    for (const callback of this.notificationCallbacks) {
      try {
        callback(doc);
      } catch (error) {
        logger.error({ error }, 'Failed to notify client');
      }
    }
  }

  getRecentDocuments(deviceId: string, limit: number = 10): ProcessedDocument[] {
    const docs: ProcessedDocument[] = [];
    
    for (const [key, doc] of this.processedFiles) {
      if (key.startsWith(deviceId)) {
        docs.push(doc);
      }
    }

    return docs
      .sort((a, b) => b.metadata.detectedAt - a.metadata.detectedAt)
      .slice(0, limit);
  }

  getDocumentsByCategory(deviceId: string, category: DocumentCategory): ProcessedDocument[] {
    return this.getRecentDocuments(deviceId, 100)
      .filter(doc => doc.category === category);
  }

  updateConfig(config: Partial<WeChatFileConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'WeChat file config updated');
  }

  getConfig(): WeChatFileConfig {
    return { ...this.config };
  }

  getStatistics(): {
    totalProcessed: number;
    byCategory: Record<DocumentCategory, number>;
  } {
    const byCategory: Record<DocumentCategory, number> = {
      LAWYER_LETTER: 0,
      CONTRACT: 0,
      INVOICE: 0,
      RECEIPT: 0,
      ID_CARD: 0,
      BUSINESS_LICENSE: 0,
      OTHER: 0,
    };

    for (const doc of this.processedFiles.values()) {
      byCategory[doc.category]++;
    }

    return {
      totalProcessed: this.processedFiles.size,
      byCategory,
    };
  }

  clearHistory(): void {
    this.processedFiles.clear();
    logger.info('WeChat file history cleared');
  }
}

export const weChatFileService = new WeChatFileService();
export default weChatFileService;

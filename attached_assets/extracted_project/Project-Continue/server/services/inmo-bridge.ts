/**
 * INMO Go3 Bridge Service
 * 
 * 实时OCR识别 + 翻译 + 语音播报桥接服务
 * 通过WebSocket与手机伴侣App或眼镜直连通信
 * 
 * 架构:
 * INMO Go3 眼镜 <-> 蓝牙 <-> Inmolens App <-> WebSocket <-> 本服务 <-> DashScope AI
 */

import { WebSocket } from 'ws';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_TEXT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DASHSCOPE_VL_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

export interface INMOBridgeClient {
  id: string;
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  isTranslating: boolean;
  translationConfig: TranslationConfig | null;
  ocrEnabled: boolean;
}

export interface TranslationConfig {
  sourceLanguage: string;
  targetLanguage: string;
  mode: 'SPEECH' | 'OCR' | 'HYBRID';
  voiceOutput: boolean;
}

export interface OCRRequest {
  imageBase64: string;
  timestamp: number;
  region?: { x: number; y: number; width: number; height: number };
}

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  boundingBoxes?: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export interface TranslationResult {
  sourceText: string;
  sourceLanguage: string;
  targetText: string;
  targetLanguage: string;
  confidence: number;
  processingTimeMs: number;
}

export interface VoiceCommand {
  type: 'START_TRANSLATION' | 'STOP_TRANSLATION' | 'TAKE_PHOTO' | 'START_RECORDING' | 'STOP_RECORDING' | 'OCR_TRANSLATE';
  params?: Record<string, any>;
}

class INMOBridgeService {
  private clients: Map<string, INMOBridgeClient> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private translationCache: Map<string, TranslationResult> = new Map();
  private cacheMaxSize = 500;

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto'
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    
    const cacheKey = `${text}:${sourceLanguage}:${targetLanguage}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      console.log(`[INMO Bridge] 翻译缓存命中: ${text.substring(0, 30)}...`);
      return cached;
    }

    if (!DASHSCOPE_API_KEY) {
      console.warn('[INMO Bridge] DashScope API未配置');
      return {
        sourceText: text,
        sourceLanguage,
        targetText: `[Translation unavailable: ${text}]`,
        targetLanguage,
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    try {
      const langNames: Record<string, string> = {
        'zh': '中文', 'zh-CN': '简体中文', 'zh-TW': '繁体中文',
        'en': '英语', 'en-US': '美式英语', 'en-GB': '英式英语',
        'ja': '日语', 'ko': '韩语', 'fr': '法语', 'de': '德语',
        'es': '西班牙语', 'it': '意大利语', 'ru': '俄语',
        'pt': '葡萄牙语', 'ar': '阿拉伯语', 'th': '泰语',
        'vi': '越南语', 'auto': '自动检测',
      };

      const sourceLangName = langNames[sourceLanguage] || sourceLanguage;
      const targetLangName = langNames[targetLanguage] || targetLanguage;

      const systemPrompt = `你是一个专业翻译引擎。将用户的文本从${sourceLangName}翻译成${targetLangName}。
要求：
1. 只输出翻译结果，不要解释或添加任何其他内容
2. 保持原文的语气和风格
3. 专业术语翻译要准确
4. 如果原文已经是目标语言，直接返回原文`;

      const response = await fetch(DASHSCOPE_TEXT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text },
            ],
          },
          parameters: {
            temperature: 0.1,
            max_tokens: 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`DashScope API error: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.output?.text || data.output?.choices?.[0]?.message?.content || '';

      const result: TranslationResult = {
        sourceText: text,
        sourceLanguage,
        targetText: translatedText.trim(),
        targetLanguage,
        confidence: 0.95,
        processingTimeMs: Date.now() - startTime,
      };

      if (this.translationCache.size >= this.cacheMaxSize) {
        const firstKey = this.translationCache.keys().next().value;
        if (firstKey) this.translationCache.delete(firstKey);
      }
      this.translationCache.set(cacheKey, result);

      console.log(`[INMO Bridge] 翻译完成: "${text.substring(0, 30)}..." -> "${translatedText.substring(0, 30)}..." (${result.processingTimeMs}ms)`);

      return result;
    } catch (error) {
      console.error('[INMO Bridge] 翻译失败:', error);
      return {
        sourceText: text,
        sourceLanguage,
        targetText: `[Translation error: ${text}]`,
        targetLanguage,
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  async performOCR(request: OCRRequest): Promise<OCRResult> {
    if (!DASHSCOPE_API_KEY) {
      console.warn('[INMO Bridge] DashScope API未配置，无法执行OCR');
      return {
        text: '',
        confidence: 0,
        language: 'unknown',
      };
    }

    try {
      const imageUrl = request.imageBase64.startsWith('data:')
        ? request.imageBase64
        : `data:image/jpeg;base64,${request.imageBase64}`;

      const response = await fetch(DASHSCOPE_VL_URL, {
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
                    text: '请识别图片中的所有文字，按照从上到下、从左到右的顺序输出。只输出识别到的文字，不要添加任何解释或描述。如果没有文字，返回空字符串。',
                  },
                ],
              },
            ],
          },
          parameters: {
            max_tokens: 2000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`DashScope VL API error: ${response.status}`);
      }

      const data = await response.json();
      const recognizedText = data.output?.choices?.[0]?.message?.content?.[0]?.text || '';

      const detectedLanguage = this.detectLanguage(recognizedText);

      console.log(`[INMO Bridge] OCR完成: "${recognizedText.substring(0, 50)}..." (${detectedLanguage})`);

      return {
        text: recognizedText.trim(),
        confidence: 0.9,
        language: detectedLanguage,
      };
    } catch (error) {
      console.error('[INMO Bridge] OCR失败:', error);
      return {
        text: '',
        confidence: 0,
        language: 'unknown',
      };
    }
  }

  async performOCRAndTranslate(
    request: OCRRequest,
    targetLanguage: string
  ): Promise<{ ocr: OCRResult; translation: TranslationResult | null }> {
    const ocrResult = await this.performOCR(request);

    if (!ocrResult.text || ocrResult.text.trim() === '') {
      return { ocr: ocrResult, translation: null };
    }

    if (ocrResult.language === targetLanguage) {
      console.log('[INMO Bridge] 识别语言与目标语言相同，跳过翻译');
      return { ocr: ocrResult, translation: null };
    }

    const translation = await this.translateText(
      ocrResult.text,
      targetLanguage,
      ocrResult.language
    );

    return { ocr: ocrResult, translation };
  }

  parseVoiceCommand(transcript: string): VoiceCommand | null {
    const normalizedText = transcript.toLowerCase().trim();

    const patterns: Array<{ regex: RegExp; type: VoiceCommand['type']; params?: Record<string, any> }> = [
      { regex: /^(开始翻译|翻译模式|translate|start translat)/i, type: 'START_TRANSLATION' },
      { regex: /^(停止翻译|关闭翻译|stop translat)/i, type: 'STOP_TRANSLATION' },
      { regex: /^(拍照|take photo|capture|拍一张)/i, type: 'TAKE_PHOTO' },
      { regex: /^(开始录像|录像|start record|开始录制)/i, type: 'START_RECORDING' },
      { regex: /^(停止录像|结束录制|stop record)/i, type: 'STOP_RECORDING' },
      { regex: /^(识别翻译|ocr翻译|看一下|这是什么|translate this)/i, type: 'OCR_TRANSLATE' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(normalizedText)) {
        console.log(`[INMO Bridge] 识别语音指令: ${pattern.type}`);
        return { type: pattern.type, params: pattern.params };
      }
    }

    const langPatterns = [
      { regex: /翻译成?(中文|汉语)/, lang: 'zh-CN' },
      { regex: /翻译成?(英文|英语)/, lang: 'en' },
      { regex: /翻译成?(日文|日语)/, lang: 'ja' },
      { regex: /翻译成?(韩文|韩语)/, lang: 'ko' },
      { regex: /翻译成?(法文|法语)/, lang: 'fr' },
      { regex: /翻译成?(德文|德语)/, lang: 'de' },
      { regex: /translate.*to\s+(chinese|mandarin)/i, lang: 'zh-CN' },
      { regex: /translate.*to\s+english/i, lang: 'en' },
      { regex: /translate.*to\s+japanese/i, lang: 'ja' },
    ];

    for (const lp of langPatterns) {
      if (lp.regex.test(normalizedText)) {
        return {
          type: 'START_TRANSLATION',
          params: { targetLanguage: lp.lang },
        };
      }
    }

    return null;
  }

  registerClient(ws: WebSocket, deviceId: string, deviceName: string): INMOBridgeClient {
    const clientId = `inmo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const client: INMOBridgeClient = {
      id: clientId,
      ws,
      deviceId,
      deviceName,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isTranslating: false,
      translationConfig: null,
      ocrEnabled: false,
    };

    this.clients.set(clientId, client);
    console.log(`[INMO Bridge] 客户端已注册: ${deviceName} (${clientId})`);

    this.emit('clientConnected', client);

    return client;
  }

  unregisterClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`[INMO Bridge] 客户端已断开: ${client.deviceName} (${clientId})`);
      this.emit('clientDisconnected', client);
      return true;
    }
    return false;
  }

  getClient(clientId: string): INMOBridgeClient | undefined {
    return this.clients.get(clientId);
  }

  getAllClients(): INMOBridgeClient[] {
    return Array.from(this.clients.values());
  }

  updateHeartbeat(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = new Date();
      return true;
    }
    return false;
  }

  startTranslation(clientId: string, config: TranslationConfig): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.isTranslating = true;
      client.translationConfig = config;
      client.ocrEnabled = config.mode === 'OCR' || config.mode === 'HYBRID';
      console.log(`[INMO Bridge] 开始翻译: ${client.deviceName} (${config.sourceLanguage} -> ${config.targetLanguage})`);
      this.emit('translationStarted', { client, config });
      return true;
    }
    return false;
  }

  stopTranslation(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.isTranslating = false;
      client.translationConfig = null;
      client.ocrEnabled = false;
      console.log(`[INMO Bridge] 停止翻译: ${client.deviceName}`);
      this.emit('translationStopped', { client });
      return true;
    }
    return false;
  }

  async sendToClient(clientId: string, message: any): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async broadcastToAll(message: any): Promise<number> {
    let sent = 0;
    const clients = Array.from(this.clients.values());
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
        sent++;
      }
    }
    return sent;
  }

  async sendDisplayMessage(
    clientId: string,
    content: string,
    options: {
      type?: 'TEXT' | 'TRANSLATION' | 'SUBTITLE' | 'NOTIFICATION';
      duration?: number;
      position?: 'TOP' | 'CENTER' | 'BOTTOM';
      style?: {
        fontSize?: 'SMALL' | 'MEDIUM' | 'LARGE';
        backgroundColor?: string;
      };
    } = {}
  ): Promise<boolean> {
    return this.sendToClient(clientId, {
      type: 'DISPLAY_MESSAGE',
      payload: {
        type: options.type || 'TEXT',
        content,
        duration: options.duration || 5000,
        position: options.position || 'BOTTOM',
        style: options.style,
        timestamp: Date.now(),
      },
    });
  }

  async sendTranslationResult(
    clientId: string,
    result: TranslationResult
  ): Promise<boolean> {
    return this.sendToClient(clientId, {
      type: 'TRANSLATION_RESULT',
      payload: {
        sourceText: result.sourceText,
        sourceLanguage: result.sourceLanguage,
        targetText: result.targetText,
        targetLanguage: result.targetLanguage,
        confidence: result.confidence,
        processingTimeMs: result.processingTimeMs,
        timestamp: Date.now(),
      },
    });
  }

  async sendOCRResult(clientId: string, result: OCRResult): Promise<boolean> {
    return this.sendToClient(clientId, {
      type: 'OCR_RESULT',
      payload: {
        text: result.text,
        confidence: result.confidence,
        language: result.language,
        boundingBoxes: result.boundingBoxes,
        timestamp: Date.now(),
      },
    });
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  private detectLanguage(text: string): string {
    if (!text || text.trim() === '') return 'unknown';

    const hasChineseChar = /[\u4e00-\u9fff]/.test(text);
    const hasJapaneseChar = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    const hasKoreanChar = /[\uac00-\ud7af]/.test(text);
    const hasArabicChar = /[\u0600-\u06ff]/.test(text);
    const hasCyrillicChar = /[\u0400-\u04ff]/.test(text);
    const hasThaiChar = /[\u0e00-\u0e7f]/.test(text);

    if (hasJapaneseChar) return 'ja';
    if (hasKoreanChar) return 'ko';
    if (hasChineseChar) return 'zh-CN';
    if (hasArabicChar) return 'ar';
    if (hasCyrillicChar) return 'ru';
    if (hasThaiChar) return 'th';

    return 'en';
  }

  getStats(): {
    connectedClients: number;
    translatingClients: number;
    cacheSize: number;
  } {
    const clients = Array.from(this.clients.values());
    return {
      connectedClients: clients.length,
      translatingClients: clients.filter(c => c.isTranslating).length,
      cacheSize: this.translationCache.size,
    };
  }

  clearCache(): void {
    this.translationCache.clear();
    console.log('[INMO Bridge] 翻译缓存已清空');
  }
}

export const inmoBridgeService = new INMOBridgeService();
export default INMOBridgeService;

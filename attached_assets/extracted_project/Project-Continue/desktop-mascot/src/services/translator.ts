interface TranslationResult {
  original: string
  translated: string
  sourceLang: string
  targetLang: string
  confidence: number
}

interface LanguageInfo {
  code: string
  name: string
  nativeName: string
}

const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
]

class Translator {
  private electronAPI: typeof window.electronAPI | null = null
  private translationCache: Map<string, TranslationResult> = new Map()

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  getSupportedLanguages(): LanguageInfo[] {
    return SUPPORTED_LANGUAGES
  }

  detectLanguage(text: string): string {
    const patterns: Record<string, RegExp> = {
      'zh': /[\u4e00-\u9fff]/,
      'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
      'ko': /[\uac00-\ud7af]/,
      'ar': /[\u0600-\u06ff]/,
      'ru': /[\u0400-\u04ff]/,
      'th': /[\u0e00-\u0e7f]/,
    }

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang
    }

    return 'en'
  }

  async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult> {
    const detectedLang = sourceLang || this.detectLanguage(text)
    
    if (detectedLang === targetLang) {
      return {
        original: text,
        translated: text,
        sourceLang: detectedLang,
        targetLang,
        confidence: 1,
      }
    }

    const cacheKey = `${text}:${detectedLang}:${targetLang}`
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!
    }

    if (!this.electronAPI) {
      const result: TranslationResult = {
        original: text,
        translated: `[翻译需要在桌面应用中运行] ${text}`,
        sourceLang: detectedLang,
        targetLang,
        confidence: 0,
      }
      return result
    }

    try {
      const translated = await (this.electronAPI as any).translate?.(text, targetLang, detectedLang)
      
      const result: TranslationResult = {
        original: text,
        translated: translated || text,
        sourceLang: detectedLang,
        targetLang,
        confidence: translated ? 0.9 : 0,
      }

      this.translationCache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('翻译失败:', error)
      return {
        original: text,
        translated: text,
        sourceLang: detectedLang,
        targetLang,
        confidence: 0,
      }
    }
  }

  async translateBatch(texts: string[], targetLang: string): Promise<TranslationResult[]> {
    return Promise.all(texts.map(text => this.translate(text, targetLang)))
  }

  async translateDocument(filePath: string, targetLang: string): Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }> {
    if (!this.electronAPI) {
      return { success: false, error: '需要在桌面应用中运行' }
    }

    try {
      const result = await (this.electronAPI as any).translateDocument?.(filePath, targetLang)
      return result || { success: false, error: '翻译失败' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  async screenCaptureTanslate(): Promise<TranslationResult | null> {
    if (!this.electronAPI) return null

    try {
      const screenshot = await (this.electronAPI as any).captureScreen?.()
      if (!screenshot) return null

      const text = await (this.electronAPI as any).ocrImage?.(screenshot)
      if (!text) return null

      const sourceLang = this.detectLanguage(text)
      const targetLang = sourceLang === 'zh' ? 'en' : 'zh'

      return await this.translate(text, targetLang, sourceLang)
    } catch (error) {
      console.error('屏幕翻译失败:', error)
      return null
    }
  }

  async clipboardTranslate(targetLang?: string): Promise<TranslationResult | null> {
    if (!this.electronAPI) return null

    try {
      const clipboardText = await (this.electronAPI as any).readClipboard?.()
      if (!clipboardText) return null

      const sourceLang = this.detectLanguage(clipboardText)
      const target = targetLang || (sourceLang === 'zh' ? 'en' : 'zh')

      const result = await this.translate(clipboardText, target, sourceLang)

      await (this.electronAPI as any).writeClipboard?.(result.translated)

      return result
    } catch (error) {
      console.error('剪贴板翻译失败:', error)
      return null
    }
  }

  async realtimeTranslate(audioStream: MediaStream, targetLang: string): Promise<ReadableStream<TranslationResult>> {
    const self = this

    return new ReadableStream({
      async start(controller) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
          controller.close()
          return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = false

        recognition.onresult = async (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript
              const result = await self.translate(text, targetLang)
              controller.enqueue(result)
            }
          }
        }

        recognition.onerror = () => controller.close()
        recognition.onend = () => controller.close()

        recognition.start()
      },
    })
  }

  getLanguageName(code: string): string {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === code)
    return lang?.nativeName || code
  }

  clearCache() {
    this.translationCache.clear()
  }
}

export const translator = new Translator()
export default translator

interface DocumentInfo {
  path: string
  name: string
  type: 'word' | 'excel' | 'pdf' | 'text' | 'image' | 'unknown'
  size: number
  modifiedAt: Date
}

interface DocumentContent {
  text: string
  pages?: number
  wordCount: number
  images?: string[]
}

interface ExcelData {
  sheets: {
    name: string
    data: any[][]
    headers?: string[]
  }[]
}

interface ConversionResult {
  success: boolean
  outputPath?: string
  error?: string
}

class DocumentMaster {
  private electronAPI: typeof window.electronAPI | null = null

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  getDocumentType(filename: string): DocumentInfo['type'] {
    const ext = filename.toLowerCase().split('.').pop() || ''
    
    const typeMap: Record<string, DocumentInfo['type']> = {
      'doc': 'word', 'docx': 'word', 'rtf': 'word', 'odt': 'word',
      'xls': 'excel', 'xlsx': 'excel', 'csv': 'excel', 'ods': 'excel',
      'pdf': 'pdf',
      'txt': 'text', 'md': 'text', 'json': 'text', 'xml': 'text',
      'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image',
    }

    return typeMap[ext] || 'unknown'
  }

  async readDocument(filePath: string): Promise<DocumentContent | null> {
    if (!this.electronAPI) return null

    try {
      const content = await (this.electronAPI as any).readDocument?.(filePath)
      return content
    } catch (error) {
      console.error('读取文档失败:', error)
      return null
    }
  }

  async readExcel(filePath: string): Promise<ExcelData | null> {
    if (!this.electronAPI) return null

    try {
      const data = await (this.electronAPI as any).readExcel?.(filePath)
      return data
    } catch (error) {
      console.error('读取Excel失败:', error)
      return null
    }
  }

  async writeExcel(filePath: string, data: ExcelData): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).writeExcel?.(filePath, data)
      return result?.success || false
    } catch (error) {
      console.error('写入Excel失败:', error)
      return false
    }
  }

  async createWordDocument(filePath: string, content: {
    title?: string
    paragraphs: string[]
    styles?: Record<string, any>
  }): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).createWordDocument?.(filePath, content)
      return result?.success || false
    } catch (error) {
      console.error('创建Word文档失败:', error)
      return false
    }
  }

  async convertDocument(inputPath: string, outputFormat: 'pdf' | 'docx' | 'txt' | 'html'): Promise<ConversionResult> {
    if (!this.electronAPI) {
      return { success: false, error: '需要在桌面应用中运行' }
    }

    try {
      const result = await (this.electronAPI as any).convertDocument?.(inputPath, outputFormat)
      return result || { success: false, error: '转换失败' }
    } catch (error) {
      console.error('转换文档失败:', error)
      return { success: false, error: String(error) }
    }
  }

  async extractTextFromImage(imagePath: string): Promise<string> {
    if (!this.electronAPI) return ''

    try {
      const text = await (this.electronAPI as any).ocrImage?.(imagePath)
      return text || ''
    } catch (error) {
      console.error('OCR识别失败:', error)
      return ''
    }
  }

  async summarizeDocument(filePath: string, maxLength = 500): Promise<string> {
    const content = await this.readDocument(filePath)
    if (!content) return '无法读取文档'

    if (!this.electronAPI) return content.text.substring(0, maxLength)

    try {
      const summary = await (this.electronAPI as any).aiSummarize?.(content.text, maxLength)
      return summary || content.text.substring(0, maxLength)
    } catch (error) {
      console.error('生成摘要失败:', error)
      return content.text.substring(0, maxLength)
    }
  }

  async batchConvert(inputPaths: string[], outputFormat: 'pdf' | 'docx' | 'txt'): Promise<ConversionResult[]> {
    const results: ConversionResult[] = []

    for (const path of inputPaths) {
      const result = await this.convertDocument(path, outputFormat)
      results.push(result)
    }

    return results
  }

  async mergeDocuments(inputPaths: string[], outputPath: string): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).mergeDocuments?.(inputPaths, outputPath)
      return result?.success || false
    } catch (error) {
      console.error('合并文档失败:', error)
      return false
    }
  }

  async splitPdf(pdfPath: string, pageRanges: string[]): Promise<string[]> {
    if (!this.electronAPI) return []

    try {
      const paths = await (this.electronAPI as any).splitPdf?.(pdfPath, pageRanges)
      return paths || []
    } catch (error) {
      console.error('拆分PDF失败:', error)
      return []
    }
  }

  async compressPdf(pdfPath: string, quality: 'high' | 'medium' | 'low' = 'medium'): Promise<ConversionResult> {
    if (!this.electronAPI) {
      return { success: false, error: '需要在桌面应用中运行' }
    }

    try {
      const result = await (this.electronAPI as any).compressPdf?.(pdfPath, quality)
      return result || { success: false, error: '压缩失败' }
    } catch (error) {
      console.error('压缩PDF失败:', error)
      return { success: false, error: String(error) }
    }
  }

  async addWatermark(pdfPath: string, watermark: string, options?: {
    opacity?: number
    rotation?: number
    fontSize?: number
  }): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).addWatermark?.(pdfPath, watermark, options)
      return result?.success || false
    } catch (error) {
      console.error('添加水印失败:', error)
      return false
    }
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}

export const documentMaster = new DocumentMaster()
export default documentMaster

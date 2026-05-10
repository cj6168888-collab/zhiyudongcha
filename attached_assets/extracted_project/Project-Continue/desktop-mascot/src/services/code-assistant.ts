interface CodeGenerationRequest {
  language: string
  description: string
  context?: string
}

interface CodeReviewResult {
  issues: CodeIssue[]
  suggestions: string[]
  quality: 'excellent' | 'good' | 'needs-improvement' | 'poor'
}

interface CodeIssue {
  line: number
  type: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

interface GitStatus {
  branch: string
  modified: string[]
  staged: string[]
  untracked: string[]
  ahead: number
  behind: number
}

class CodeAssistant {
  private electronAPI: typeof window.electronAPI | null = null

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  async generateCode(request: CodeGenerationRequest): Promise<string> {
    if (!this.electronAPI) {
      return `// ${request.description}\n// 代码生成需要在桌面应用中运行`
    }

    try {
      const code = await (this.electronAPI as any).generateCode?.(request)
      return code || `// 生成失败`
    } catch (error) {
      console.error('代码生成失败:', error)
      return `// 生成失败: ${error}`
    }
  }

  async explainCode(code: string, language?: string): Promise<string> {
    if (!this.electronAPI) {
      return '代码解释需要在桌面应用中运行'
    }

    try {
      const explanation = await (this.electronAPI as any).explainCode?.(code, language)
      return explanation || '无法解释代码'
    } catch (error) {
      console.error('代码解释失败:', error)
      return '解释失败'
    }
  }

  async reviewCode(code: string, language?: string): Promise<CodeReviewResult> {
    const defaultResult: CodeReviewResult = {
      issues: [],
      suggestions: [],
      quality: 'good',
    }

    if (!this.electronAPI) return defaultResult

    try {
      const review = await (this.electronAPI as any).reviewCode?.(code, language)
      return review || defaultResult
    } catch (error) {
      console.error('代码审查失败:', error)
      return defaultResult
    }
  }

  async suggestFix(code: string, error: string): Promise<string> {
    if (!this.electronAPI) return code

    try {
      const fixed = await (this.electronAPI as any).suggestCodeFix?.(code, error)
      return fixed || code
    } catch (error) {
      console.error('修复建议失败:', error)
      return code
    }
  }

  async optimizeCode(code: string, language?: string): Promise<{
    optimized: string
    improvements: string[]
  }> {
    const defaultResult = { optimized: code, improvements: [] }

    if (!this.electronAPI) return defaultResult

    try {
      const result = await (this.electronAPI as any).optimizeCode?.(code, language)
      return result || defaultResult
    } catch (error) {
      console.error('代码优化失败:', error)
      return defaultResult
    }
  }

  async translateCode(code: string, fromLang: string, toLang: string): Promise<string> {
    if (!this.electronAPI) return code

    try {
      const translated = await (this.electronAPI as any).translateCode?.(code, fromLang, toLang)
      return translated || code
    } catch (error) {
      console.error('代码转换失败:', error)
      return code
    }
  }

  async generateTests(code: string, language: string, framework?: string): Promise<string> {
    if (!this.electronAPI) return '// 测试生成需要在桌面应用中运行'

    try {
      const tests = await (this.electronAPI as any).generateTests?.(code, language, framework)
      return tests || '// 生成失败'
    } catch (error) {
      console.error('测试生成失败:', error)
      return '// 生成失败'
    }
  }

  async generateDocumentation(code: string, style: 'jsdoc' | 'markdown' | 'docstring' = 'jsdoc'): Promise<string> {
    if (!this.electronAPI) return ''

    try {
      const docs = await (this.electronAPI as any).generateDocumentation?.(code, style)
      return docs || ''
    } catch (error) {
      console.error('文档生成失败:', error)
      return ''
    }
  }

  async getGitStatus(repoPath?: string): Promise<GitStatus | null> {
    if (!this.electronAPI) return null

    try {
      const status = await (this.electronAPI as any).getGitStatus?.(repoPath)
      return status
    } catch (error) {
      console.error('获取Git状态失败:', error)
      return null
    }
  }

  async gitCommit(message: string, files?: string[]): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).gitCommit?.(message, files)
      return result?.success || false
    } catch (error) {
      console.error('Git提交失败:', error)
      return false
    }
  }

  async gitPush(): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).gitPush?.()
      return result?.success || false
    } catch (error) {
      console.error('Git推送失败:', error)
      return false
    }
  }

  async gitPull(): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).gitPull?.()
      return result?.success || false
    } catch (error) {
      console.error('Git拉取失败:', error)
      return false
    }
  }

  async generateCommitMessage(diff: string): Promise<string> {
    if (!this.electronAPI) return 'Update code'

    try {
      const message = await (this.electronAPI as any).generateCommitMessage?.(diff)
      return message || 'Update code'
    } catch (error) {
      console.error('生成提交信息失败:', error)
      return 'Update code'
    }
  }

  async formatCode(code: string, language: string, style?: Record<string, any>): Promise<string> {
    if (!this.electronAPI) return code

    try {
      const formatted = await (this.electronAPI as any).formatCode?.(code, language, style)
      return formatted || code
    } catch (error) {
      console.error('代码格式化失败:', error)
      return code
    }
  }

  async runCode(code: string, language: string): Promise<{
    output: string
    error?: string
    exitCode: number
  }> {
    if (!this.electronAPI) {
      return { output: '', error: '需要在桌面应用中运行', exitCode: 1 }
    }

    try {
      const result = await (this.electronAPI as any).runCode?.(code, language)
      return result || { output: '', exitCode: 0 }
    } catch (error) {
      return { output: '', error: String(error), exitCode: 1 }
    }
  }

  detectLanguage(code: string): string {
    const patterns: Record<string, RegExp[]> = {
      'javascript': [/const\s+\w+\s*=/, /function\s+\w+/, /=>\s*{/, /require\(/, /import\s+.*from/],
      'typescript': [/interface\s+\w+/, /type\s+\w+\s*=/, /:\s*(string|number|boolean)/, /<\w+>/],
      'python': [/def\s+\w+\(/, /import\s+\w+/, /from\s+\w+\s+import/, /print\(/, /:\s*$/m],
      'java': [/public\s+class/, /private\s+\w+/, /System\.out\./, /void\s+main/],
      'cpp': [/#include\s*</, /std::/, /int\s+main\(/, /cout\s*<</],
      'rust': [/fn\s+\w+/, /let\s+mut/, /impl\s+\w+/, /pub\s+fn/],
      'go': [/func\s+\w+/, /package\s+\w+/, /fmt\./, /import\s+\(/],
      'html': [/<html/, /<div/, /<head/, /<body/],
      'css': [/{\s*[\w-]+\s*:/, /@media/, /@import/, /\.[\w-]+\s*{/],
      'sql': [/SELECT\s+/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i, /UPDATE\s+\w+\s+SET/i],
    }

    for (const [lang, regexes] of Object.entries(patterns)) {
      const matches = regexes.filter(r => r.test(code)).length
      if (matches >= 2) return lang
    }

    return 'text'
  }
}

export const codeAssistant = new CodeAssistant()
export default codeAssistant

interface Email {
  id: string
  from: string
  to: string[]
  subject: string
  body: string
  date: Date
  isRead: boolean
  labels: string[]
  attachments: string[]
  priority: 'high' | 'normal' | 'low'
}

interface EmailAccount {
  email: string
  name: string
  provider: 'gmail' | 'outlook' | 'imap'
  isConnected: boolean
}

interface EmailSummary {
  unread: number
  important: number
  categories: Record<string, number>
  recentSenders: string[]
}

class EmailManager {
  private electronAPI: typeof window.electronAPI | null = null
  private accounts: EmailAccount[] = []
  private emails: Email[] = []

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  async connectAccount(config: {
    email: string
    password: string
    provider: 'gmail' | 'outlook' | 'imap'
    imapServer?: string
    imapPort?: number
    smtpServer?: string
    smtpPort?: number
  }): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).connectEmailAccount?.(config)
      if (result?.success) {
        this.accounts.push({
          email: config.email,
          name: config.email.split('@')[0],
          provider: config.provider,
          isConnected: true,
        })
        return true
      }
      return false
    } catch (error) {
      console.error('连接邮箱失败:', error)
      return false
    }
  }

  async fetchEmails(folder = 'INBOX', limit = 50): Promise<Email[]> {
    if (!this.electronAPI) return []

    try {
      const emails = await (this.electronAPI as any).fetchEmails?.(folder, limit)
      this.emails = emails || []
      return this.emails
    } catch (error) {
      console.error('获取邮件失败:', error)
      return []
    }
  }

  async getEmailSummary(): Promise<EmailSummary> {
    const summary: EmailSummary = {
      unread: 0,
      important: 0,
      categories: {},
      recentSenders: [],
    }

    const emails = await this.fetchEmails('INBOX', 100)
    
    const senderSet = new Set<string>()
    
    for (const email of emails) {
      if (!email.isRead) summary.unread++
      if (email.priority === 'high') summary.important++
      
      for (const label of email.labels) {
        summary.categories[label] = (summary.categories[label] || 0) + 1
      }
      
      if (senderSet.size < 5) {
        senderSet.add(email.from)
      }
    }
    
    summary.recentSenders = Array.from(senderSet)
    
    return summary
  }

  async summarizeEmail(emailId: string): Promise<string> {
    if (!this.electronAPI) return '需要在桌面应用中运行'

    try {
      const summary = await (this.electronAPI as any).summarizeEmail?.(emailId)
      return summary || '无法生成摘要'
    } catch (error) {
      console.error('生成邮件摘要失败:', error)
      return '生成摘要失败'
    }
  }

  async generateReply(emailId: string, tone: 'formal' | 'friendly' | 'brief' = 'formal'): Promise<string> {
    if (!this.electronAPI) return ''

    try {
      const reply = await (this.electronAPI as any).generateEmailReply?.(emailId, tone)
      return reply || ''
    } catch (error) {
      console.error('生成回复失败:', error)
      return ''
    }
  }

  async sendEmail(to: string[], subject: string, body: string, attachments?: string[]): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).sendEmail?.({
        to,
        subject,
        body,
        attachments,
      })
      return result?.success || false
    } catch (error) {
      console.error('发送邮件失败:', error)
      return false
    }
  }

  async categorizeEmails(): Promise<Record<string, Email[]>> {
    const categories: Record<string, Email[]> = {
      '工作': [],
      '个人': [],
      '订阅': [],
      '垃圾': [],
      '其他': [],
    }

    for (const email of this.emails) {
      const from = email.from.toLowerCase()
      const subject = email.subject.toLowerCase()

      if (from.includes('newsletter') || from.includes('noreply') || subject.includes('订阅')) {
        categories['订阅'].push(email)
      } else if (subject.includes('工作') || subject.includes('会议') || subject.includes('项目')) {
        categories['工作'].push(email)
      } else if (from.includes('spam') || subject.includes('优惠') || subject.includes('促销')) {
        categories['垃圾'].push(email)
      } else {
        categories['其他'].push(email)
      }
    }

    return categories
  }

  async searchEmails(query: string): Promise<Email[]> {
    const lowerQuery = query.toLowerCase()
    
    return this.emails.filter(email => 
      email.subject.toLowerCase().includes(lowerQuery) ||
      email.body.toLowerCase().includes(lowerQuery) ||
      email.from.toLowerCase().includes(lowerQuery)
    )
  }
}

export const emailManager = new EmailManager()
export default emailManager

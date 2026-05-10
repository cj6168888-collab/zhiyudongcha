const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-replit-app.replit.app'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  message: string
  emotion?: string
}

class ApiClient {
  private baseUrl: string
  private deviceId: string
  private masterSecret: string

  constructor() {
    this.baseUrl = API_BASE_URL
    this.deviceId = this.getOrCreateDeviceId()
    this.masterSecret = import.meta.env.VITE_MASTER_SECRET || 'dev-secret'
  }

  private getOrCreateDeviceId(): string {
    const stored = localStorage.getItem('xiaozhi-device-id')
    if (stored) return stored

    const newId = `desktop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('xiaozhi-device-id', newId)
    return newId
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Avatar-Role': 'MASTER',
      'X-Avatar-Secret': this.masterSecret,
      'X-Device-Id': this.deviceId,
    }
  }

  async chat(message: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/avatar/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
          history,
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`)
      }

      const data = await response.json()
      return {
        message: data.reply || data.message,
        emotion: data.emotion,
      }
    } catch (error) {
      console.error('Chat error:', error)
      return {
        message: '小智连接不上服务器，稍后再试试吧~',
        emotion: 'sad',
      }
    }
  }

  async registerDevice(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/laptop/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          deviceId: this.deviceId,
          deviceName: 'Desktop Mascot',
          platform: process.platform || 'unknown',
        }),
      })

      return response.ok
    } catch (error) {
      console.error('Register device error:', error)
      return false
    }
  }

  async heartbeat(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/laptop/heartbeat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          deviceId: this.deviceId,
        }),
      })

      return response.ok
    } catch (error) {
      console.error('Heartbeat error:', error)
      return false
    }
  }
}

export const apiClient = new ApiClient()
export default apiClient

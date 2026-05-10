interface MeetingRecord {
  id: string
  title: string
  startTime: Date
  endTime?: Date
  participants: string[]
  transcript: TranscriptSegment[]
  summary?: string
  actionItems: ActionItem[]
  recordings?: {
    audio?: string
    screen?: string
  }
}

interface TranscriptSegment {
  speaker: string
  text: string
  timestamp: number
  confidence: number
}

interface ActionItem {
  id: string
  task: string
  assignee?: string
  dueDate?: Date
  completed: boolean
}

interface ScreenshotOptions {
  fullScreen?: boolean
  region?: { x: number; y: number; width: number; height: number }
  withAnnotation?: boolean
}

const STORAGE_KEY = 'xiaozhi-meetings'

class MeetingAssistant {
  private electronAPI: typeof window.electronAPI | null = null
  private meetings: MeetingRecord[] = []
  private currentMeeting: MeetingRecord | null = null
  private isRecording: boolean = false
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) this.meetings = JSON.parse(data)
    } catch (error) {
      console.error('加载会议记录失败:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.meetings))
    } catch (error) {
      console.error('保存会议记录失败:', error)
    }
  }

  async startMeeting(title: string, participants: string[] = []): Promise<MeetingRecord> {
    if (this.currentMeeting) {
      await this.endMeeting()
    }

    this.currentMeeting = {
      id: `meeting-${Date.now()}`,
      title,
      startTime: new Date(),
      participants,
      transcript: [],
      actionItems: [],
    }

    return this.currentMeeting
  }

  async startRecording(includeScreen = false): Promise<boolean> {
    if (!this.currentMeeting) return false
    if (this.isRecording) return true

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      let combinedStream = audioStream

      if (includeScreen && navigator.mediaDevices.getDisplayMedia) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          })
          
          const tracks = [...audioStream.getTracks(), ...screenStream.getTracks()]
          combinedStream = new MediaStream(tracks)
        } catch (error) {
          console.log('屏幕录制未授权，仅录制音频')
        }
      }

      this.mediaRecorder = new MediaRecorder(combinedStream)
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(1000)
      this.isRecording = true

      this.startTranscription()

      return true
    } catch (error) {
      console.error('开始录制失败:', error)
      return false
    }
  }

  private async startTranscription() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('浏览器不支持语音识别')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal && this.currentMeeting) {
          const transcript = event.results[i][0].transcript
          const confidence = event.results[i][0].confidence

          this.currentMeeting.transcript.push({
            speaker: '参与者',
            text: transcript,
            timestamp: Date.now() - new Date(this.currentMeeting.startTime).getTime(),
            confidence,
          })
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error)
    }

    recognition.onend = () => {
      if (this.isRecording) {
        recognition.start()
      }
    }

    recognition.start()
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder || !this.isRecording) return null

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' })
        resolve(blob)
      }

      this.mediaRecorder!.stop()
      this.isRecording = false

      this.mediaRecorder!.stream.getTracks().forEach(track => track.stop())
    })
  }

  async endMeeting(): Promise<MeetingRecord | null> {
    if (!this.currentMeeting) return null

    if (this.isRecording) {
      const recording = await this.stopRecording()
      if (recording) {
        const url = URL.createObjectURL(recording)
        this.currentMeeting.recordings = { audio: url }
      }
    }

    this.currentMeeting.endTime = new Date()

    if (this.currentMeeting.transcript.length > 0) {
      this.currentMeeting.summary = await this.generateSummary(this.currentMeeting)
      this.currentMeeting.actionItems = await this.extractActionItems(this.currentMeeting)
    }

    this.meetings.push(this.currentMeeting)
    this.saveToStorage()

    const meeting = this.currentMeeting
    this.currentMeeting = null

    return meeting
  }

  private async generateSummary(meeting: MeetingRecord): Promise<string> {
    const fullTranscript = meeting.transcript.map(s => s.text).join(' ')
    
    if (!this.electronAPI) {
      return fullTranscript.substring(0, 500) + '...'
    }

    try {
      const summary = await (this.electronAPI as any).aiSummarize?.(fullTranscript, 300)
      return summary || fullTranscript.substring(0, 500)
    } catch (error) {
      return fullTranscript.substring(0, 500) + '...'
    }
  }

  private async extractActionItems(meeting: MeetingRecord): Promise<ActionItem[]> {
    const fullTranscript = meeting.transcript.map(s => s.text).join(' ')
    
    const actionItems: ActionItem[] = []
    
    const patterns = [
      /需要(.+?)(?:，|。|$)/g,
      /请(.+?)(?:，|。|$)/g,
      /要(.+?)(?:，|。|$)/g,
      /TODO[：:]\s*(.+?)(?:，|。|$)/gi,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(fullTranscript)) !== null) {
        if (match[1].length > 5 && match[1].length < 100) {
          actionItems.push({
            id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            task: match[1].trim(),
            completed: false,
          })
        }
      }
    }

    return actionItems.slice(0, 10)
  }

  async takeScreenshot(options: ScreenshotOptions = {}): Promise<string | null> {
    if (!this.electronAPI) return null

    try {
      const screenshot = await (this.electronAPI as any).takeScreenshot?.(options)
      return screenshot
    } catch (error) {
      console.error('截图失败:', error)
      return null
    }
  }

  async startScreenRecording(): Promise<boolean> {
    if (!navigator.mediaDevices.getDisplayMedia) {
      console.error('浏览器不支持屏幕录制')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      this.mediaRecorder = new MediaRecorder(stream)
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(1000)
      this.isRecording = true

      return true
    } catch (error) {
      console.error('开始屏幕录制失败:', error)
      return false
    }
  }

  getMeetingHistory(): MeetingRecord[] {
    return this.meetings.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )
  }

  getMeeting(id: string): MeetingRecord | undefined {
    return this.meetings.find(m => m.id === id)
  }

  deleteMeeting(id: string): boolean {
    const index = this.meetings.findIndex(m => m.id === id)
    if (index === -1) return false

    this.meetings.splice(index, 1)
    this.saveToStorage()
    return true
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`
    }
    return `${minutes}分钟`
  }
}

export const meetingAssistant = new MeetingAssistant()
export default meetingAssistant

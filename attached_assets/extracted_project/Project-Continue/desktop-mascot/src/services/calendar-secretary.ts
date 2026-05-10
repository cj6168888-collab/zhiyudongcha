interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  location?: string
  attendees?: string[]
  reminder?: number
  isAllDay: boolean
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  color?: string
}

interface TodoItem {
  id: string
  title: string
  description?: string
  dueDate?: Date
  priority: 'high' | 'medium' | 'low'
  completed: boolean
  tags: string[]
  createdAt: Date
}

interface PomodoroSession {
  id: string
  taskName: string
  startTime: Date
  duration: number
  completed: boolean
  breaks: number
}

const STORAGE_KEYS = {
  EVENTS: 'xiaozhi-calendar-events',
  TODOS: 'xiaozhi-todos',
  POMODORO: 'xiaozhi-pomodoro-history',
}

class CalendarSecretary {
  private events: CalendarEvent[] = []
  private todos: TodoItem[] = []
  private pomodoroSessions: PomodoroSession[] = []
  private currentPomodoro: PomodoroSession | null = null
  private pomodoroTimer: NodeJS.Timeout | null = null

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const events = localStorage.getItem(STORAGE_KEYS.EVENTS)
      const todos = localStorage.getItem(STORAGE_KEYS.TODOS)
      const pomodoro = localStorage.getItem(STORAGE_KEYS.POMODORO)

      if (events) this.events = JSON.parse(events)
      if (todos) this.todos = JSON.parse(todos)
      if (pomodoro) this.pomodoroSessions = JSON.parse(pomodoro)
    } catch (error) {
      console.error('加载日程数据失败:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(this.events))
      localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(this.todos))
      localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(this.pomodoroSessions))
    } catch (error) {
      console.error('保存日程数据失败:', error)
    }
  }

  addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    this.events.push(newEvent)
    this.saveToStorage()
    this.scheduleReminder(newEvent)
    return newEvent
  }

  updateEvent(id: string, updates: Partial<CalendarEvent>): boolean {
    const index = this.events.findIndex(e => e.id === id)
    if (index === -1) return false

    this.events[index] = { ...this.events[index], ...updates }
    this.saveToStorage()
    return true
  }

  deleteEvent(id: string): boolean {
    const index = this.events.findIndex(e => e.id === id)
    if (index === -1) return false

    this.events.splice(index, 1)
    this.saveToStorage()
    return true
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return this.events.filter(event => {
      const eventStart = new Date(event.start)
      return eventStart >= startOfDay && eventStart <= endOfDay
    })
  }

  getUpcomingEvents(days = 7): CalendarEvent[] {
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + days)

    return this.events
      .filter(event => {
        const eventStart = new Date(event.start)
        return eventStart >= now && eventStart <= future
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }

  private scheduleReminder(event: CalendarEvent) {
    if (!event.reminder) return

    const eventTime = new Date(event.start).getTime()
    const reminderTime = eventTime - event.reminder * 60 * 1000
    const now = Date.now()

    if (reminderTime > now) {
      setTimeout(() => {
        if (window.electronAPI) {
          (window.electronAPI as any).showNotification?.(
            '📅 日程提醒',
            `${event.title} 将在 ${event.reminder} 分钟后开始`
          )
        }
      }, reminderTime - now)
    }
  }

  addTodo(todo: Omit<TodoItem, 'id' | 'createdAt' | 'completed'>): TodoItem {
    const newTodo: TodoItem = {
      ...todo,
      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      completed: false,
      createdAt: new Date(),
    }
    this.todos.push(newTodo)
    this.saveToStorage()
    return newTodo
  }

  completeTodo(id: string): boolean {
    const todo = this.todos.find(t => t.id === id)
    if (!todo) return false

    todo.completed = true
    this.saveToStorage()
    return true
  }

  deleteTodo(id: string): boolean {
    const index = this.todos.findIndex(t => t.id === id)
    if (index === -1) return false

    this.todos.splice(index, 1)
    this.saveToStorage()
    return true
  }

  getTodos(filter?: { completed?: boolean; priority?: TodoItem['priority']; tag?: string }): TodoItem[] {
    let result = [...this.todos]

    if (filter?.completed !== undefined) {
      result = result.filter(t => t.completed === filter.completed)
    }
    if (filter?.priority) {
      result = result.filter(t => t.priority === filter.priority)
    }
    if (filter?.tag) {
      result = result.filter(t => t.tags.includes(filter.tag!))
    }

    return result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  startPomodoro(taskName: string, durationMinutes = 25): PomodoroSession {
    if (this.currentPomodoro) {
      this.stopPomodoro()
    }

    this.currentPomodoro = {
      id: `pomodoro-${Date.now()}`,
      taskName,
      startTime: new Date(),
      duration: durationMinutes,
      completed: false,
      breaks: 0,
    }

    this.pomodoroTimer = setTimeout(() => {
      this.completePomodoro()
    }, durationMinutes * 60 * 1000)

    return this.currentPomodoro
  }

  private completePomodoro() {
    if (!this.currentPomodoro) return

    this.currentPomodoro.completed = true
    this.pomodoroSessions.push(this.currentPomodoro)
    this.saveToStorage()

    if (window.electronAPI) {
      (window.electronAPI as any).showNotification?.(
        '🍅 番茄钟完成！',
        `${this.currentPomodoro.taskName} 已完成，休息一下吧~`
      )
    }

    this.currentPomodoro = null
    this.pomodoroTimer = null
  }

  stopPomodoro(): PomodoroSession | null {
    if (!this.currentPomodoro) return null

    if (this.pomodoroTimer) {
      clearTimeout(this.pomodoroTimer)
    }

    const session = this.currentPomodoro
    this.currentPomodoro = null
    this.pomodoroTimer = null

    return session
  }

  getPomodoroStats(): { today: number; week: number; total: number } {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 7)

    const completed = this.pomodoroSessions.filter(s => s.completed)

    return {
      today: completed.filter(s => new Date(s.startTime) >= todayStart).length,
      week: completed.filter(s => new Date(s.startTime) >= weekStart).length,
      total: completed.length,
    }
  }

  getDailySummary(): string {
    const today = new Date()
    const events = this.getEventsForDate(today)
    const todos = this.getTodos({ completed: false })
    const pomodoroStats = this.getPomodoroStats()

    let summary = `📅 今日日程摘要\n\n`
    
    if (events.length > 0) {
      summary += `📌 今日有 ${events.length} 个日程：\n`
      events.forEach(e => {
        const time = new Date(e.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        summary += `  • ${time} ${e.title}\n`
      })
    } else {
      summary += `📌 今日没有日程安排\n`
    }

    summary += `\n`

    if (todos.length > 0) {
      const highPriority = todos.filter(t => t.priority === 'high')
      summary += `✅ 待办事项：${todos.length} 项`
      if (highPriority.length > 0) {
        summary += `（${highPriority.length} 项紧急）`
      }
      summary += `\n`
    }

    summary += `\n🍅 今日番茄钟：${pomodoroStats.today} 个`

    return summary
  }
}

export const calendarSecretary = new CalendarSecretary()
export default calendarSecretary

interface ScheduledTask {
  id: string
  name: string
  action: TaskAction
  schedule: TaskSchedule
  enabled: boolean
  lastRun?: Date
  nextRun?: Date
  runCount: number
}

interface TaskAction {
  type: 'command' | 'script' | 'notification' | 'open-app' | 'open-url' | 'file-operation'
  params: Record<string, any>
}

interface TaskSchedule {
  type: 'once' | 'interval' | 'daily' | 'weekly' | 'cron'
  time?: string
  interval?: number
  daysOfWeek?: number[]
  cronExpression?: string
}

interface Workflow {
  id: string
  name: string
  description?: string
  steps: WorkflowStep[]
  variables: Record<string, any>
  enabled: boolean
}

interface WorkflowStep {
  id: string
  name: string
  action: TaskAction
  condition?: string
  onSuccess?: string
  onError?: string
}

interface FileRenameRule {
  pattern: RegExp | string
  replacement: string
  caseSensitive?: boolean
}

const STORAGE_KEYS = {
  TASKS: 'xiaozhi-scheduled-tasks',
  WORKFLOWS: 'xiaozhi-workflows',
}

class AutomationExpert {
  private electronAPI: typeof window.electronAPI | null = null
  private tasks: ScheduledTask[] = []
  private workflows: Workflow[] = []
  private taskTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
    this.loadFromStorage()
    this.initializeScheduler()
  }

  private loadFromStorage() {
    try {
      const tasks = localStorage.getItem(STORAGE_KEYS.TASKS)
      const workflows = localStorage.getItem(STORAGE_KEYS.WORKFLOWS)

      if (tasks) this.tasks = JSON.parse(tasks)
      if (workflows) this.workflows = JSON.parse(workflows)
    } catch (error) {
      console.error('加载自动化数据失败:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.tasks))
      localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(this.workflows))
    } catch (error) {
      console.error('保存自动化数据失败:', error)
    }
  }

  private initializeScheduler() {
    for (const task of this.tasks) {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    }
  }

  private scheduleTask(task: ScheduledTask) {
    const existingTimer = this.taskTimers.get(task.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const nextRun = this.calculateNextRun(task.schedule)
    if (!nextRun) return

    task.nextRun = nextRun
    this.saveToStorage()

    const delay = nextRun.getTime() - Date.now()
    if (delay <= 0) return

    const timer = setTimeout(async () => {
      await this.executeTask(task)
      
      if (task.schedule.type !== 'once') {
        this.scheduleTask(task)
      }
    }, delay)

    this.taskTimers.set(task.id, timer)
  }

  private calculateNextRun(schedule: TaskSchedule): Date | null {
    const now = new Date()

    switch (schedule.type) {
      case 'once':
        if (schedule.time) {
          const runTime = new Date(schedule.time)
          return runTime > now ? runTime : null
        }
        return null

      case 'interval':
        if (schedule.interval) {
          return new Date(now.getTime() + schedule.interval * 1000)
        }
        return null

      case 'daily':
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number)
          const runTime = new Date(now)
          runTime.setHours(hours, minutes, 0, 0)
          
          if (runTime <= now) {
            runTime.setDate(runTime.getDate() + 1)
          }
          return runTime
        }
        return null

      case 'weekly':
        if (schedule.time && schedule.daysOfWeek?.length) {
          const [hours, minutes] = schedule.time.split(':').map(Number)
          const currentDay = now.getDay()
          
          for (let i = 0; i < 7; i++) {
            const checkDay = (currentDay + i) % 7
            if (schedule.daysOfWeek.includes(checkDay)) {
              const runTime = new Date(now)
              runTime.setDate(runTime.getDate() + i)
              runTime.setHours(hours, minutes, 0, 0)
              
              if (runTime > now) {
                return runTime
              }
            }
          }
        }
        return null

      default:
        return null
    }
  }

  private async executeTask(task: ScheduledTask): Promise<boolean> {
    try {
      await this.executeAction(task.action)
      
      task.lastRun = new Date()
      task.runCount++
      this.saveToStorage()

      return true
    } catch (error) {
      console.error(`任务执行失败: ${task.name}`, error)
      return false
    }
  }

  private async executeAction(action: TaskAction): Promise<any> {
    if (!this.electronAPI) {
      console.warn('需要在桌面应用中执行')
      return null
    }

    switch (action.type) {
      case 'command':
        return await (this.electronAPI as any).executeCommand?.(action.params.command)

      case 'script':
        return await (this.electronAPI as any).executeScript?.(action.params.script, action.params.language)

      case 'notification':
        return await (this.electronAPI as any).showNotification?.(
          action.params.title,
          action.params.body
        )

      case 'open-app':
        return await (this.electronAPI as any).openApplication?.(action.params.appPath)

      case 'open-url':
        return await (this.electronAPI as any).openUrl?.(action.params.url)

      case 'file-operation':
        return await this.executeFileOperation(action.params)

      default:
        console.warn('未知操作类型:', action.type)
        return null
    }
  }

  private async executeFileOperation(params: Record<string, any>): Promise<any> {
    const { operation, source, destination } = params

    switch (operation) {
      case 'copy':
        return await (this.electronAPI as any).copyFile?.(source, destination)
      case 'move':
        return await (this.electronAPI as any).moveFile?.(source, destination)
      case 'delete':
        return await (this.electronAPI as any).deleteFile?.(source)
      case 'rename':
        return await (this.electronAPI as any).renameFile?.(source, destination)
      default:
        return null
    }
  }

  createTask(task: Omit<ScheduledTask, 'id' | 'lastRun' | 'nextRun' | 'runCount'>): ScheduledTask {
    const newTask: ScheduledTask = {
      ...task,
      id: `task-${Date.now()}`,
      runCount: 0,
    }

    this.tasks.push(newTask)
    
    if (newTask.enabled) {
      this.scheduleTask(newTask)
    }

    this.saveToStorage()
    return newTask
  }

  updateTask(id: string, updates: Partial<ScheduledTask>): boolean {
    const task = this.tasks.find(t => t.id === id)
    if (!task) return false

    const wasEnabled = task.enabled
    Object.assign(task, updates)

    if (wasEnabled && !task.enabled) {
      const timer = this.taskTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        this.taskTimers.delete(id)
      }
    } else if (!wasEnabled && task.enabled) {
      this.scheduleTask(task)
    } else if (task.enabled && updates.schedule) {
      this.scheduleTask(task)
    }

    this.saveToStorage()
    return true
  }

  deleteTask(id: string): boolean {
    const index = this.tasks.findIndex(t => t.id === id)
    if (index === -1) return false

    const timer = this.taskTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.taskTimers.delete(id)
    }

    this.tasks.splice(index, 1)
    this.saveToStorage()
    return true
  }

  getTasks(): ScheduledTask[] {
    return [...this.tasks]
  }

  async runTaskNow(id: string): Promise<boolean> {
    const task = this.tasks.find(t => t.id === id)
    if (!task) return false

    return await this.executeTask(task)
  }

  createWorkflow(workflow: Omit<Workflow, 'id'>): Workflow {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `workflow-${Date.now()}`,
    }

    this.workflows.push(newWorkflow)
    this.saveToStorage()

    return newWorkflow
  }

  async runWorkflow(id: string): Promise<{ success: boolean; results: any[] }> {
    const workflow = this.workflows.find(w => w.id === id)
    if (!workflow || !workflow.enabled) {
      return { success: false, results: [] }
    }

    const results: any[] = []
    let currentStep: WorkflowStep | undefined = workflow.steps[0]

    while (currentStep) {
      try {
        if (currentStep.condition) {
          const conditionMet = this.evaluateCondition(currentStep.condition, workflow.variables)
          if (!conditionMet) {
            currentStep = workflow.steps.find(s => s.id === currentStep?.onError)
            continue
          }
        }

        const result = await this.executeAction(currentStep.action)
        results.push({ step: currentStep.name, result })

        currentStep = workflow.steps.find(s => s.id === currentStep?.onSuccess)
      } catch (error) {
        results.push({ step: currentStep.name, error })
        currentStep = workflow.steps.find(s => s.id === currentStep?.onError)
      }
    }

    return { success: true, results }
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      const func = new Function(...Object.keys(variables), `return ${condition}`)
      return !!func(...Object.values(variables))
    } catch {
      return true
    }
  }

  async batchRename(directory: string, rules: FileRenameRule[]): Promise<{
    renamed: number
    errors: string[]
  }> {
    if (!this.electronAPI) {
      return { renamed: 0, errors: ['需要在桌面应用中运行'] }
    }

    try {
      const result = await (this.electronAPI as any).batchRename?.(directory, rules)
      return result || { renamed: 0, errors: [] }
    } catch (error) {
      return { renamed: 0, errors: [String(error)] }
    }
  }

  async browserAutomation(script: {
    url: string
    actions: Array<{
      type: 'click' | 'type' | 'scroll' | 'wait' | 'screenshot'
      selector?: string
      value?: string
      delay?: number
    }>
  }): Promise<{ success: boolean; screenshots?: string[] }> {
    if (!this.electronAPI) {
      return { success: false }
    }

    try {
      const result = await (this.electronAPI as any).browserAutomation?.(script)
      return result || { success: false }
    } catch (error) {
      console.error('浏览器自动化失败:', error)
      return { success: false }
    }
  }

  getWorkflows(): Workflow[] {
    return [...this.workflows]
  }

  deleteWorkflow(id: string): boolean {
    const index = this.workflows.findIndex(w => w.id === id)
    if (index === -1) return false

    this.workflows.splice(index, 1)
    this.saveToStorage()
    return true
  }
}

export const automationExpert = new AutomationExpert()
export default automationExpert

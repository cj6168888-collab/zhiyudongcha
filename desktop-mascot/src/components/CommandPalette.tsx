import { useState, useEffect, useCallback, memo, useMemo } from 'react'

interface Command {
  id: string
  category: string
  icon: string
  label: string
  shortcut?: string
  action: () => void | Promise<void>
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onExecute: (commandId: string) => void
  commands: Command[]
}

const CommandPalette = memo(({ isOpen, onClose, onExecute, commands }: CommandPaletteProps) => {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    if (!search) return commands
    const query = search.toLowerCase()
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    )
  }, [commands, search])

  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    }
    return groups
  }, [filteredCommands])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          onExecute(filteredCommands[selectedIndex].id)
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [filteredCommands, selectedIndex, onExecute, onClose])

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20px',
        zIndex: 2000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'linear-gradient(180deg, rgba(35, 35, 50, 0.98) 0%, rgba(25, 25, 35, 0.98) 100%)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <input
            type="text"
            placeholder="搜索命令..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px' }}>
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              <div style={{
                padding: '8px 12px 4px',
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                {category}
              </div>
              {cmds.map((cmd) => {
                const currentIndex = flatIndex++
                const isSelected = currentIndex === selectedIndex

                return (
                  <div
                    key={cmd.id}
                    onClick={() => {
                      onExecute(cmd.id)
                      onClose()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255, 105, 180, 0.2)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <span style={{ fontSize: '18px', marginRight: '12px' }}>{cmd.icon}</span>
                    <span style={{ flex: 1, color: '#fff', fontSize: '13px' }}>{cmd.label}</span>
                    {cmd.shortcut && (
                      <span style={{
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '13px',
            }}>
              没有找到匹配的命令
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

CommandPalette.displayName = 'CommandPalette'

export default CommandPalette

export function useCommands(handlers: {
  onChat?: () => void
  onOrganize?: () => void
  onCleanup?: () => void
  onHealth?: () => void
  onEmail?: () => void
  onCalendar?: () => void
  onDocument?: () => void
  onMeeting?: () => void
  onResearch?: () => void
  onAutomate?: () => void
  onCode?: () => void
  onAnalyze?: () => void
  onTranslate?: () => void
  onSync?: () => void
  onSettings?: () => void
}): Command[] {
  return useMemo(() => [
    { id: 'chat', category: '对话', icon: '💬', label: '和小智聊天', shortcut: 'Space', action: handlers.onChat || (() => {}) },
    
    { id: 'email-check', category: '邮件', icon: '📧', label: '查看邮件', action: handlers.onEmail || (() => {}) },
    { id: 'email-compose', category: '邮件', icon: '✉️', label: '撰写邮件', action: handlers.onEmail || (() => {}) },
    { id: 'email-summary', category: '邮件', icon: '📋', label: '邮件摘要', action: handlers.onEmail || (() => {}) },
    
    { id: 'calendar-today', category: '日程', icon: '📅', label: '今日日程', action: handlers.onCalendar || (() => {}) },
    { id: 'calendar-add', category: '日程', icon: '➕', label: '添加日程', action: handlers.onCalendar || (() => {}) },
    { id: 'todo-list', category: '日程', icon: '✅', label: '待办事项', action: handlers.onCalendar || (() => {}) },
    { id: 'pomodoro', category: '日程', icon: '🍅', label: '番茄钟', action: handlers.onCalendar || (() => {}) },
    
    { id: 'doc-open', category: '文档', icon: '📄', label: '打开文档', action: handlers.onDocument || (() => {}) },
    { id: 'doc-convert', category: '文档', icon: '🔄', label: '格式转换', action: handlers.onDocument || (() => {}) },
    { id: 'doc-ocr', category: '文档', icon: '👁️', label: 'OCR识别', action: handlers.onDocument || (() => {}) },
    { id: 'doc-summary', category: '文档', icon: '📝', label: '文档摘要', action: handlers.onDocument || (() => {}) },
    
    { id: 'meeting-start', category: '会议', icon: '🎙️', label: '开始会议', action: handlers.onMeeting || (() => {}) },
    { id: 'meeting-record', category: '会议', icon: '🔴', label: '录音/录屏', action: handlers.onMeeting || (() => {}) },
    { id: 'screenshot', category: '会议', icon: '📸', label: '截图', action: handlers.onMeeting || (() => {}) },
    
    { id: 'research', category: '研究', icon: '🔍', label: '网络搜索', action: handlers.onResearch || (() => {}) },
    { id: 'research-note', category: '研究', icon: '📓', label: '研究笔记', action: handlers.onResearch || (() => {}) },
    { id: 'research-kb', category: '研究', icon: '🧠', label: '知识库', action: handlers.onResearch || (() => {}) },
    
    { id: 'auto-task', category: '自动化', icon: '⏰', label: '定时任务', action: handlers.onAutomate || (() => {}) },
    { id: 'auto-workflow', category: '自动化', icon: '🔧', label: '工作流', action: handlers.onAutomate || (() => {}) },
    { id: 'auto-browser', category: '自动化', icon: '🌐', label: '浏览器自动化', action: handlers.onAutomate || (() => {}) },
    
    { id: 'code-gen', category: '代码', icon: '💻', label: '生成代码', action: handlers.onCode || (() => {}) },
    { id: 'code-explain', category: '代码', icon: '🔎', label: '解释代码', action: handlers.onCode || (() => {}) },
    { id: 'code-review', category: '代码', icon: '✨', label: '代码审查', action: handlers.onCode || (() => {}) },
    { id: 'git-status', category: '代码', icon: '📊', label: 'Git状态', action: handlers.onCode || (() => {}) },
    
    { id: 'data-load', category: '数据', icon: '📈', label: '加载数据', action: handlers.onAnalyze || (() => {}) },
    { id: 'data-analyze', category: '数据', icon: '📊', label: '数据分析', action: handlers.onAnalyze || (() => {}) },
    { id: 'data-chart', category: '数据', icon: '📉', label: '生成图表', action: handlers.onAnalyze || (() => {}) },
    
    { id: 'translate', category: '翻译', icon: '🌍', label: '翻译文本', action: handlers.onTranslate || (() => {}) },
    { id: 'translate-doc', category: '翻译', icon: '📑', label: '翻译文档', action: handlers.onTranslate || (() => {}) },
    { id: 'translate-screen', category: '翻译', icon: '🖥️', label: '屏幕翻译', action: handlers.onTranslate || (() => {}) },
    
    { id: 'sync', category: '同步', icon: '☁️', label: '立即同步', action: handlers.onSync || (() => {}) },
    { id: 'backup', category: '同步', icon: '💾', label: '创建备份', action: handlers.onSync || (() => {}) },
    
    { id: 'organize', category: '系统', icon: '🗂️', label: '整理桌面', action: handlers.onOrganize || (() => {}) },
    { id: 'cleanup', category: '系统', icon: '🧹', label: '快速清理', action: handlers.onCleanup || (() => {}) },
    { id: 'health', category: '系统', icon: '💊', label: '系统体检', action: handlers.onHealth || (() => {}) },
    { id: 'settings', category: '系统', icon: '⚙️', label: '设置', action: handlers.onSettings || (() => {}) },
  ], [handlers])
}

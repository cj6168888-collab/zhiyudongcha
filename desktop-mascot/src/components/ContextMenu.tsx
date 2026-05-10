import { memo, useEffect, useRef } from 'react'

interface ContextMenuProps {
  x: number
  y: number
  onAction: (action: string) => void
  onClose: () => void
  isListening: boolean
  hasVoiceprint: boolean
}

const ContextMenu = memo(({ x, y, onAction, onClose, isListening, hasVoiceprint }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const menuItems = [
    { id: 'chat', icon: isListening ? '🔴' : '🎤', label: isListening ? '停止说话' : '和小智说话' },
    { id: 'divider1' },
    { id: 'wardrobe', icon: '👗', label: '换装打扮' },
    { id: 'games', icon: '🎮', label: '互动游戏' },
    { id: 'divider2' },
    { id: 'organize', icon: '🗂️', label: '整理桌面' },
    { id: 'cleanup', icon: '🧹', label: '快速清理' },
    { id: 'health', icon: '💊', label: '系统体检' },
    { id: 'divider3' },
    { id: hasVoiceprint ? 'verify-voice' : 'enroll-voice', icon: '🔊', label: hasVoiceprint ? '验证声纹' : '注册声纹' },
    { id: 'camera-on', icon: '👀', label: '开启感知' },
    { id: 'divider4' },
    { id: 'settings', icon: '⚙️', label: '设置' },
  ]

  return (
    <div
      ref={menuRef}
      data-testid="context-menu"
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 150),
        top: Math.min(y, window.innerHeight - 350),
        background: 'rgba(30, 30, 40, 0.95)',
        borderRadius: '12px',
        padding: '8px 0',
        minWidth: '140px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
      }}
    >
      {menuItems.map((item) => {
        if (item.id.startsWith('divider')) {
          return (
            <div
              key={item.id}
              style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '6px 12px',
              }}
            />
          )
        }

        return (
          <div
            key={item.id}
            data-testid={`menu-item-${item.id}`}
            onClick={() => onAction(item.id)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: '#fff',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: '14px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
})

ContextMenu.displayName = 'ContextMenu'

export default ContextMenu

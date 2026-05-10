import { memo } from 'react'

interface StatusBarProps {
  isConnected: boolean
  isSyncing: boolean
  unreadEmails: number
  pendingTodos: number
  pomodoroActive: boolean
  pomodoroTime?: string
}

const StatusBar = memo(({
  isConnected,
  isSyncing,
  unreadEmails,
  pendingTodos,
  pomodoroActive,
  pomodoroTime,
}: StatusBarProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '24px',
        background: 'linear-gradient(90deg, rgba(30, 30, 45, 0.95) 0%, rgba(40, 40, 60, 0.95) 100%)',
        borderRadius: '0 0 12px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '0 10px',
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.8)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: isConnected ? '#4CAF50' : '#FF5722',
        }} />
        <span>{isConnected ? '已连接' : '离线'}</span>
      </div>

      {isSyncing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
          <span>同步中</span>
        </div>
      )}

      {unreadEmails > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>📧</span>
          <span>{unreadEmails}</span>
        </div>
      )}

      {pendingTodos > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✅</span>
          <span>{pendingTodos}</span>
        </div>
      )}

      {pomodoroActive && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(255, 100, 100, 0.3)',
          padding: '2px 8px',
          borderRadius: '10px',
        }}>
          <span>🍅</span>
          <span>{pomodoroTime || '--:--'}</span>
        </div>
      )}
    </div>
  )
})

StatusBar.displayName = 'StatusBar'

export default StatusBar

import { useState, useCallback, useEffect, useRef } from 'react'

export type MascotState = 'idle' | 'walk' | 'jump' | 'dance' | 'sleep' | 'wave' | 'think'

interface BehaviorHook {
  state: MascotState
  triggerAction: (action: MascotState) => void
}

export function useBehavior(): BehaviorHook {
  const [state, setState] = useState<MascotState>('idle')
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const triggerAction = useCallback((action: MascotState) => {
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current)
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }

    lastActivityRef.current = Date.now()
    setState(action)

    const duration = action === 'dance' ? 3000 : action === 'wave' ? 1500 : 1000

    actionTimeoutRef.current = setTimeout(() => {
      setState('idle')
      startIdleTimer()
    }, duration)
  }, [])

  const startIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }

    idleTimeoutRef.current = setTimeout(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current
      
      if (timeSinceActivity > 60000) {
        setState('sleep')
      } else {
        const randomActions: MascotState[] = ['idle', 'walk', 'jump', 'think']
        const randomAction = randomActions[Math.floor(Math.random() * randomActions.length)]
        
        if (randomAction !== 'idle') {
          setState(randomAction)
          setTimeout(() => {
            setState('idle')
            startIdleTimer()
          }, 2000)
        } else {
          startIdleTimer()
        }
      }
    }, 10000 + Math.random() * 10000)
  }, [])

  useEffect(() => {
    startIdleTimer()

    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
      }
    }
  }, [startIdleTimer])

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      if (state === 'sleep') {
        setState('idle')
        startIdleTimer()
      }
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [state, startIdleTimer])

  return { state, triggerAction }
}

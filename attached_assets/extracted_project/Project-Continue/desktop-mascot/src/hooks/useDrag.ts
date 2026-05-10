import { useState, useCallback, useRef, useEffect } from 'react'

interface DragHook {
  isDragging: boolean
  handleMouseDown: (e: React.MouseEvent) => void
}

export function useDrag(): DragHook {
  const [isDragging, setIsDragging] = useState(false)
  const lastPositionRef = useRef({ x: 0, y: 0 })
  const dragStartRef = useRef({ x: 0, y: 0 })
  const hasDraggedRef = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    lastPositionRef.current = { x: e.screenX, y: e.screenY }
    dragStartRef.current = { x: e.screenX, y: e.screenY }
    hasDraggedRef.current = false
    setIsDragging(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.screenX - lastPositionRef.current.x
      const deltaY = e.screenY - lastPositionRef.current.y

      const totalDelta = Math.abs(e.screenX - dragStartRef.current.x) + 
                         Math.abs(e.screenY - dragStartRef.current.y)
      if (totalDelta > 5) {
        hasDraggedRef.current = true
      }

      if (window.electronAPI) {
        window.electronAPI.moveWindow(deltaX, deltaY)
      }

      lastPositionRef.current = { x: e.screenX, y: e.screenY }
    }

    const handleMouseUp = () => {
      setTimeout(() => {
        setIsDragging(false)
      }, 100)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return { isDragging: hasDraggedRef.current, handleMouseDown }
}

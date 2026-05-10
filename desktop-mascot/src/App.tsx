import { useState, useEffect, useCallback, useRef } from 'react'
import Mascot from './components/Mascot'
import ChatBubble from './components/ChatBubble'
import ContextMenu from './components/ContextMenu'
import WardrobePanel from './components/WardrobePanel'
import GamesPanel from './components/GamesPanel'
import { useBehavior, MascotState } from './hooks/useBehavior'
import { useDrag } from './hooks/useDrag'
import { useVoice } from './hooks/useVoice'
import { useVoiceprint } from './hooks/useVoiceprint'
import { usePerception } from './hooks/usePerception'
import apiClient from './services/api-client'
import { SkinTheme, appearanceSystem } from './services/appearance-themes'

function App() {
  const [message, setMessage] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [isShy, setIsShy] = useState(false)
  const [showWardrobe, setShowWardrobe] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [currentSkin, setCurrentSkin] = useState<SkinTheme>(appearanceSystem.getCurrentSkin())
  const [affectionLevel] = useState(50)
  
  const { state, triggerAction } = useBehavior()
  const { isDragging, handleMouseDown } = useDrag()
  const { isListening, transcript, startListening, stopListening, speak } = useVoice()
  const { masterProfile, enrollMaster, verifyVoice } = useVoiceprint()
  const { faceDetected, startCamera, stopCamera } = usePerception()
  
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showMessage = useCallback((text: string, duration = 4000) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current)
    }
    setMessage(text)
    messageTimeoutRef.current = setTimeout(() => setMessage(null), duration)
  }, [])

  const handleChat = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return
    
    setIsThinking(true)
    triggerAction('think')
    showMessage('让我想想...', 10000)

    try {
      const response = await apiClient.chat(userMessage)
      setIsThinking(false)
      showMessage(response.message, 6000)
      
      if (response.emotion === 'happy') {
        triggerAction('dance')
      } else {
        triggerAction('wave')
      }

      await speak(response.message)
    } catch (error) {
      setIsThinking(false)
      showMessage('小智连接不上了...', 3000)
    }
  }, [triggerAction, showMessage, speak])

  const handleClick = useCallback(() => {
    if (isDragging) return
    
    if (isShy) {
      showMessage('...你是谁呀？(害羞)')
      return
    }
    
    const greetings = [
      '主人好呀~ ♪',
      '小智在这里！',
      '需要帮忙吗？',
      '今天也要加油哦！',
      '主人想我了吗？',
      '嘿嘿~ (◕ᴗ◕✿)',
      '有什么吩咐吗，主人？',
      '小智随时待命！✨',
    ]
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)]
    showMessage(randomGreeting)
    triggerAction('wave')
  }, [isDragging, isShy, showMessage, triggerAction])

  const handleDoubleClick = useCallback(() => {
    if (isShy) return
    showMessage('小智跳舞给主人看~ ♪')
    triggerAction('dance')
  }, [isShy, showMessage, triggerAction])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPosition({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }, [])

  const handleSkinChange = useCallback((skin: SkinTheme) => {
    setCurrentSkin(skin)
    showMessage(`换上${skin.name}啦！主人觉得怎么样？💕`)
    triggerAction('dance')
  }, [showMessage, triggerAction])

  const handleMenuAction = useCallback(async (action: string) => {
    setShowMenu(false)
    
    switch (action) {
      case 'chat':
        if (!isListening) {
          showMessage('主人请说话，小智在听~')
          startListening()
        } else {
          stopListening()
          if (transcript) {
            handleChat(transcript)
          }
        }
        break
        
      case 'wardrobe':
        setShowWardrobe(true)
        showMessage('主人想给小智换什么衣服呀？💕')
        break
        
      case 'games':
        setShowGames(true)
        showMessage('主人想和小智玩什么游戏呀？🎮')
        break
        
      case 'settings':
        showMessage('设置功能开发中...')
        break
        
      case 'organize':
        showMessage('正在分析桌面文件...')
        triggerAction('think')
        if (window.electronAPI) {
          const result = await window.electronAPI.organizeDesktop()
          if (result.moved > 0) {
            showMessage(`整理完成！移动了${result.moved}个文件~ ✨`)
            triggerAction('dance')
          } else {
            showMessage('桌面已经很整洁啦！')
          }
        }
        break
        
      case 'cleanup':
        showMessage('正在清理系统垃圾...')
        triggerAction('think')
        if (window.electronAPI) {
          const [temp, browser] = await Promise.all([
            window.electronAPI.cleanTempFiles(),
            window.electronAPI.cleanBrowserCache(),
          ])
          const totalCleaned = temp.itemsCleaned + browser.itemsCleaned
          const totalFreed = temp.freedSpace + browser.freedSpace
          const freedMB = (totalFreed / 1024 / 1024).toFixed(1)
          showMessage(`清理完成！清理了${totalCleaned}个文件，释放${freedMB}MB空间~`)
          triggerAction('jump')
        }
        break
        
      case 'health':
        showMessage('正在检查系统健康...')
        triggerAction('think')
        if (window.electronAPI) {
          const info = await window.electronAPI.getSystemInfo()
          const healthScore = 100 - 
            (info.cpuUsage > 80 ? 20 : info.cpuUsage > 60 ? 10 : 0) -
            (info.memoryUsage > 85 ? 20 : info.memoryUsage > 70 ? 10 : 0) -
            (info.diskUsage > 90 ? 25 : info.diskUsage > 80 ? 10 : 0)
          
          if (healthScore >= 90) {
            showMessage(`系统健康评分：${healthScore}分！状态很好哦~ 💚`)
          } else if (healthScore >= 70) {
            showMessage(`系统健康评分：${healthScore}分，还可以~ 💛`)
          } else {
            showMessage(`系统健康评分：${healthScore}分，建议清理一下哦 🧡`)
          }
        }
        break
        
      case 'enroll-voice':
        showMessage('开始录制主人声纹，请说话3秒...')
        triggerAction('think')
        const success = await enrollMaster()
        if (success) {
          showMessage('声纹注册成功！以后小智能认出主人啦~ 💕')
          triggerAction('dance')
        } else {
          showMessage('声纹注册失败，请重试...')
        }
        break
        
      case 'verify-voice':
        showMessage('请说话，让小智听听是不是主人...')
        const isMaster = await verifyVoice()
        if (isMaster) {
          showMessage('是主人的声音！主人好~ 💕')
          setIsShy(false)
        } else {
          showMessage('...不认识这个声音呢 (害羞躲起来)')
          setIsShy(true)
          triggerAction('sleep')
        }
        break
        
      case 'camera-on':
        showMessage('小智正在看着主人哦~ 👀')
        await startCamera()
        break
        
      case 'camera-off':
        showMessage('小智不看了~')
        stopCamera()
        break
    }
  }, [isListening, transcript, startListening, stopListening, handleChat, showMessage, triggerAction, enrollMaster, verifyVoice, startCamera, stopCamera])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onAction((action) => {
        switch (action) {
          case 'organize-desktop':
            handleMenuAction('organize')
            break
          case 'quick-cleanup':
            handleMenuAction('cleanup')
            break
          case 'health-check':
            handleMenuAction('health')
            break
          case 'enroll-voice':
            handleMenuAction('enroll-voice')
            break
        }
      })
    }
  }, [handleMenuAction])

  useEffect(() => {
    const timer = setTimeout(() => {
      showMessage('主人好！小智来陪你啦~ ♪')
    }, 1000)
    return () => clearTimeout(timer)
  }, [showMessage])

  useEffect(() => {
    if (faceDetected && !isShy) {
      showMessage('看到主人了！(开心)')
      triggerAction('wave')
    }
  }, [faceDetected, isShy, showMessage, triggerAction])

  useEffect(() => {
    if (transcript && transcript.length > 5 && !isListening) {
      handleChat(transcript)
    }
  }, [transcript, isListening, handleChat])

  const currentState: MascotState = isShy ? 'sleep' : isThinking ? 'think' : state

  return (
    <div 
      className="mascot-container"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {message && <ChatBubble message={message} />}
      
      <Mascot 
        state={currentState} 
        isShy={isShy} 
        isListening={isListening} 
        skin={currentSkin}
      />
      
      {showMenu && (
        <ContextMenu 
          x={menuPosition.x}
          y={menuPosition.y}
          onAction={handleMenuAction}
          onClose={() => setShowMenu(false)}
          isListening={isListening}
          hasVoiceprint={!!masterProfile}
        />
      )}
      
      {showWardrobe && (
        <WardrobePanel
          onClose={() => setShowWardrobe(false)}
          onSkinChange={handleSkinChange}
          affectionLevel={affectionLevel}
        />
      )}
      
      {showGames && (
        <GamesPanel
          onClose={() => setShowGames(false)}
          onMessage={showMessage}
          affectionLevel={affectionLevel}
        />
      )}
      
      {isListening && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 100, 100, 0.9)',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '10px',
          color: 'white',
          animation: 'pulse 1s infinite',
        }}>
          🎤 正在听...
        </div>
      )}
    </div>
  )
}

export default App

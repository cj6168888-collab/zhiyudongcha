import { memo, useState, useMemo, useCallback } from 'react'
import { MINI_GAMES, MiniGame, entertainmentSystem } from '../services/entertainment'

interface GamesPanelProps {
  onClose: () => void
  onMessage: (msg: string) => void
  affectionLevel: number
}

type GameState = 
  | { type: 'menu' }
  | { type: 'riddle'; question: string; hint: string }
  | { type: 'number_guess'; max: number; attempts: number }
  | { type: 'rps' }
  | { type: 'emoji'; emojis: string; hint: string }
  | { type: 'trivia'; question: string; options: string[] }
  | { type: 'word_chain'; lastWord: string }
  | { type: 'story'; title: string; content: string }

const GamesPanel = memo(({ onClose, onMessage, affectionLevel }: GamesPanelProps) => {
  const [gameState, setGameState] = useState<GameState>({ type: 'menu' })
  const [inputValue, setInputValue] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const availableGames = useMemo(() => 
    entertainmentSystem.getAvailableGames(affectionLevel),
    [affectionLevel]
  )

  const startGame = useCallback((game: MiniGame) => {
    setFeedback(null)
    setInputValue('')
    
    switch (game.id) {
      case 'riddle': {
        const { question, hint } = entertainmentSystem.startRiddle()
        setGameState({ type: 'riddle', question, hint })
        break
      }
      case 'number_guess': {
        entertainmentSystem.startNumberGuess(100)
        setGameState({ type: 'number_guess', max: 100, attempts: 0 })
        break
      }
      case 'rock_paper_scissors': {
        setGameState({ type: 'rps' })
        break
      }
      case 'emoji_guess': {
        const { emojis, hint } = entertainmentSystem.startEmojiPuzzle()
        setGameState({ type: 'emoji', emojis, hint })
        break
      }
      case 'trivia': {
        const { question, options } = entertainmentSystem.startTrivia()
        setGameState({ type: 'trivia', question, options })
        break
      }
      case 'word_chain': {
        const msg = entertainmentSystem.startWordChain()
        const match = msg.match(/"(.+?)"/)
        setGameState({ type: 'word_chain', lastWord: match ? match[1] : '一心一意' })
        setFeedback(msg)
        break
      }
      default:
        onMessage(`${game.name} 游戏开发中...`)
    }
  }, [onMessage])

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return
    
    if (gameState.type === 'riddle') {
      const result = entertainmentSystem.checkRiddleAnswer(inputValue)
      setFeedback(result.message)
      if (result.won) {
        setTimeout(() => setGameState({ type: 'menu' }), 2000)
      }
    } else if (gameState.type === 'number_guess') {
      const num = parseInt(inputValue)
      if (isNaN(num)) {
        setFeedback('请输入一个数字哦~')
        return
      }
      const result = entertainmentSystem.checkNumberGuess(num)
      setFeedback(result.message)
      if (result.won) {
        setTimeout(() => setGameState({ type: 'menu' }), 2000)
      } else {
        setGameState(prev => 
          prev.type === 'number_guess' 
            ? { ...prev, attempts: prev.attempts + 1 }
            : prev
        )
      }
    } else if (gameState.type === 'emoji') {
      const result = entertainmentSystem.checkEmojiAnswer(inputValue)
      setFeedback(result.message)
      if (result.won) {
        setTimeout(() => setGameState({ type: 'menu' }), 2000)
      }
    } else if (gameState.type === 'word_chain') {
      const result = entertainmentSystem.checkWordChain(gameState.lastWord, inputValue)
      setFeedback(result.message)
      if (result.won) {
        setTimeout(() => setGameState({ type: 'menu' }), 2000)
      } else if (result.score > 0) {
        const match = result.message.match(/"(.+?)"/)
        if (match) {
          setGameState({ type: 'word_chain', lastWord: match[1] })
        }
      }
    }
    setInputValue('')
  }, [inputValue, gameState])

  const handleRPS = useCallback((choice: 'rock' | 'paper' | 'scissors') => {
    const result = entertainmentSystem.playRPS(choice)
    setFeedback(result.message)
    setTimeout(() => {
      setFeedback(null)
    }, 3000)
  }, [])

  const handleTriviaAnswer = useCallback((answer: string) => {
    const result = entertainmentSystem.checkTriviaAnswer(answer)
    setFeedback(result.message)
    setTimeout(() => setGameState({ type: 'menu' }), 2500)
  }, [])

  const showJoke = useCallback(() => {
    const joke = entertainmentSystem.getJoke()
    setFeedback(joke)
  }, [])

  const showStory = useCallback(() => {
    const story = entertainmentSystem.getRandomStory()
    setGameState({ type: 'story', title: story.title, content: story.content })
  }, [])

  const renderContent = () => {
    if (gameState.type === 'menu') {
      return (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {MINI_GAMES.map(game => {
              const isAvailable = availableGames.some(g => g.id === game.id)
              return (
                <div
                  key={game.id}
                  data-testid={`game-${game.id}`}
                  onClick={() => isAvailable && startGame(game)}
                  style={{
                    padding: 12,
                    background: isAvailable ? 'rgba(255, 255, 255, 0.05)' : 'rgba(100, 100, 100, 0.1)',
                    borderRadius: 10,
                    cursor: isAvailable ? 'pointer' : 'not-allowed',
                    opacity: isAvailable ? 1 : 0.5,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{game.icon}</div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{game.name}</div>
                  <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>
                    {isAvailable ? game.description : `需要好感度 ${game.minAffection}`}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              data-testid="btn-joke"
              onClick={showJoke}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #FFB347, #FFCC33)',
                border: 'none',
                borderRadius: 8,
                color: '#333',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              😄 讲笑话
            </button>
            <button
              data-testid="btn-story"
              onClick={showStory}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #87CEEB, #00CED1)',
                border: 'none',
                borderRadius: 8,
                color: '#333',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              📖 讲故事
            </button>
          </div>

          {feedback && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(255, 182, 193, 0.1)',
                borderRadius: 8,
                color: '#FFB6C1',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {feedback}
            </div>
          )}
        </>
      )
    }

    if (gameState.type === 'story') {
      return (
        <div style={{ color: '#fff' }}>
          <h3 style={{ color: '#87CEEB', marginBottom: 12 }}>{gameState.title}</h3>
          <div style={{ 
            fontSize: 13, 
            lineHeight: 1.8, 
            whiteSpace: 'pre-wrap',
            maxHeight: 300,
            overflowY: 'auto',
            padding: 12,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 8,
          }}>
            {gameState.content}
          </div>
          <button
            data-testid="back-to-menu"
            onClick={() => setGameState({ type: 'menu' })}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            返回
          </button>
        </div>
      )
    }

    if (gameState.type === 'riddle') {
      return (
        <div>
          <div style={{ color: '#FFD700', fontSize: 14, marginBottom: 16 }}>
            🤔 {gameState.question}
          </div>
          <input
            data-testid="riddle-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="输入你的答案..."
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '8px 16px',
                background: '#FF69B4',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              提交答案
            </button>
            <button
              onClick={() => {
                const msg = entertainmentSystem.giveUpRiddle()
                setFeedback(msg)
                setTimeout(() => setGameState({ type: 'menu' }), 2000)
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 8,
                color: '#888',
                cursor: 'pointer',
              }}
            >
              放弃
            </button>
          </div>
          {feedback && (
            <div style={{ marginTop: 12, color: '#87CEEB', fontSize: 13 }}>{feedback}</div>
          )}
        </div>
      )
    }

    if (gameState.type === 'number_guess') {
      return (
        <div>
          <div style={{ color: '#FFD700', fontSize: 14, marginBottom: 8 }}>
            🔢 猜一个 1-{gameState.max} 之间的数字！
          </div>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
            已猜 {gameState.attempts} 次
          </div>
          <input
            data-testid="number-input"
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="输入数字..."
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#FF69B4',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            猜！
          </button>
          {feedback && (
            <div style={{ marginTop: 12, color: '#87CEEB', fontSize: 13 }}>{feedback}</div>
          )}
        </div>
      )
    }

    if (gameState.type === 'rps') {
      return (
        <div>
          <div style={{ color: '#FFD700', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
            ✊✋✌️ 选择你的出招！
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {[
              { choice: 'rock' as const, emoji: '✊', name: '石头' },
              { choice: 'paper' as const, emoji: '✋', name: '布' },
              { choice: 'scissors' as const, emoji: '✌️', name: '剪刀' },
            ].map(item => (
              <button
                key={item.choice}
                data-testid={`rps-${item.choice}`}
                onClick={() => handleRPS(item.choice)}
                style={{
                  padding: '16px 24px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 32 }}>{item.emoji}</span>
                <span style={{ color: '#fff', fontSize: 12 }}>{item.name}</span>
              </button>
            ))}
          </div>
          {feedback && (
            <div style={{ marginTop: 16, color: '#FFB6C1', fontSize: 14, textAlign: 'center' }}>
              {feedback}
            </div>
          )}
        </div>
      )
    }

    if (gameState.type === 'emoji') {
      return (
        <div>
          <div style={{ 
            fontSize: 36, 
            textAlign: 'center', 
            marginBottom: 16,
            padding: 16,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
          }}>
            {gameState.emojis}
          </div>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
            提示: {gameState.hint}
          </div>
          <input
            data-testid="emoji-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="这是什么词？"
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#FF69B4',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            提交
          </button>
          {feedback && (
            <div style={{ marginTop: 12, color: '#87CEEB', fontSize: 13 }}>{feedback}</div>
          )}
        </div>
      )
    }

    if (gameState.type === 'trivia') {
      return (
        <div>
          <div style={{ color: '#FFD700', fontSize: 14, marginBottom: 16 }}>
            ❓ {gameState.question}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gameState.options.map((opt, i) => (
              <button
                key={i}
                data-testid={`trivia-option-${i}`}
                onClick={() => handleTriviaAnswer(opt)}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  transition: 'all 0.2s',
                }}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            ))}
          </div>
          {feedback && (
            <div style={{ marginTop: 12, color: '#87CEEB', fontSize: 13 }}>{feedback}</div>
          )}
        </div>
      )
    }

    if (gameState.type === 'word_chain') {
      return (
        <div>
          <div style={{ color: '#FFD700', fontSize: 14, marginBottom: 16 }}>
            📚 成语接龙 - 用「{gameState.lastWord.slice(-1)}」开头
          </div>
          <input
            data-testid="wordchain-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="输入成语..."
            style={{
              width: '100%',
              padding: 10,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#FF69B4',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            接龙
          </button>
          {feedback && (
            <div style={{ marginTop: 12, color: '#87CEEB', fontSize: 13 }}>{feedback}</div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div
      data-testid="games-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380,
        maxHeight: '80vh',
        background: 'linear-gradient(135deg, rgba(40, 30, 50, 0.98), rgba(30, 25, 40, 0.98))',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 200, 220, 0.2)',
        zIndex: 1001,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#FFB6C1', fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🎮</span>
          {gameState.type === 'menu' ? '互动游戏' : (
            <button
              onClick={() => {
                setGameState({ type: 'menu' })
                setFeedback(null)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ← 返回
            </button>
          )}
        </h2>
        <button
          data-testid="close-games"
          onClick={onClose}
          style={{
            background: 'rgba(255, 100, 100, 0.2)',
            border: 'none',
            color: '#FF6B6B',
            width: 28,
            height: 28,
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  )
})

GamesPanel.displayName = 'GamesPanel'

export default GamesPanel

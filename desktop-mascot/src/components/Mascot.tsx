import { memo, useMemo } from 'react'
import { MascotState } from '../hooks/useBehavior'
import { SkinTheme, Accessory, PARTICLE_EFFECTS, appearanceSystem } from '../services/appearance-themes'

interface MascotProps {
  state: MascotState
  isShy?: boolean
  isListening?: boolean
  skin?: SkinTheme
  accessories?: Accessory[]
}

const stateAnimations: Record<MascotState, string> = {
  idle: 'idle-bounce 2s ease-in-out infinite',
  walk: 'walk 1s ease-in-out infinite',
  jump: 'jump 0.5s ease-out',
  dance: 'dance 0.5s ease-in-out infinite',
  sleep: 'sleep-breathe 3s ease-in-out infinite',
  wave: 'wave 0.5s ease-in-out 3',
  think: 'idle-bounce 1s ease-in-out infinite',
}

const Mascot = memo(({ state, isShy = false, isListening = false, skin, accessories }: MascotProps) => {
  const animation = stateAnimations[state] || stateAnimations.idle
  
  const currentSkin = skin || appearanceSystem.getCurrentSkin()
  const equippedAccessories = accessories || appearanceSystem.getEquippedAccessories()
  const colors = currentSkin.colors
  const particleEffect = currentSkin.particles ? PARTICLE_EFFECTS[currentSkin.particles as keyof typeof PARTICLE_EFFECTS] : null

  const particles = useMemo(() => {
    if (!particleEffect) return null
    
    return Array.from({ length: particleEffect.count }, (_, i) => ({
      id: i,
      emoji: particleEffect.emoji.split('')[0],
      delay: Math.random() * 3,
      x: 20 + Math.random() * 110,
      duration: particleEffect.speed === 'slow' ? 4 : particleEffect.speed === 'medium' ? 2.5 : 1.5,
    }))
  }, [particleEffect])

  return (
    <div
      style={{
        width: 150,
        height: 180,
        position: 'relative',
        animation,
        opacity: isShy ? 0.5 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      {particles && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {particles.map(p => (
            <span
              key={p.id}
              style={{
                position: 'absolute',
                left: p.x,
                top: -20,
                fontSize: 14,
                animation: `particle-fall ${p.duration}s linear ${p.delay}s infinite`,
                opacity: 0.8,
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}
      
      <svg
        viewBox="0 0 150 180"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="blushGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.blush} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.blush} stopOpacity="0" />
          </radialGradient>
          
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* 身体 */}
        <ellipse cx="75" cy="120" rx="40" ry="45" fill={colors.skin} />
        
        {/* 裙子/衣服 */}
        <ellipse cx="75" cy="135" rx="35" ry="30" fill={colors.outfit} opacity="0.8" />
        <ellipse cx="75" cy="130" rx="30" ry="20" fill={colors.outfitAccent} opacity="0.6" />
        
        {/* 头部 */}
        <circle cx="75" cy="60" r="42" fill={colors.skin} />
        
        {/* 头发 - 更蓬松可爱 */}
        <ellipse cx="75" cy="35" rx="38" ry="28" fill={colors.hair} />
        <ellipse cx="45" cy="45" rx="15" ry="22" fill={colors.hair} />
        <ellipse cx="105" cy="45" rx="15" ry="22" fill={colors.hair} />
        
        {/* 发色高光 */}
        {colors.hairHighlight && (
          <>
            <ellipse cx="60" cy="32" rx="12" ry="8" fill={colors.hairHighlight} opacity="0.5" />
            <ellipse cx="90" cy="32" rx="12" ry="8" fill={colors.hairHighlight} opacity="0.5" />
          </>
        )}
        
        {/* 刘海 */}
        <path
          d="M33 55 Q45 35 55 50 Q65 40 75 48 Q85 40 95 50 Q105 35 117 55"
          fill={colors.hair}
        />
        
        {/* 双马尾 */}
        <ellipse cx="28" cy="70" rx="12" ry="25" fill={colors.hair} />
        <ellipse cx="122" cy="70" rx="12" ry="25" fill={colors.hair} />
        
        {/* 蝴蝶结发饰 */}
        <path d="M65 25 Q55 15 50 25 Q55 30 65 25" fill={colors.accessory} />
        <path d="M85 25 Q95 15 100 25 Q95 30 85 25" fill={colors.accessory} />
        <circle cx="75" cy="25" r="5" fill={colors.outfitAccent} />

        {/* 眼睛 */}
        {isShy ? (
          <>
            {/* 害羞闭眼 */}
            <path d="M50 62 Q55 58 60 62" stroke={colors.eyes} strokeWidth="2" fill="none" />
            <path d="M90 62 Q95 58 100 62" stroke={colors.eyes} strokeWidth="2" fill="none" />
          </>
        ) : (
          <g style={{ animation: state !== 'sleep' ? 'blink 4s infinite' : 'none' }}>
            {state === 'sleep' ? (
              <>
                {/* 睡觉闭眼 */}
                <path d="M48 62 Q55 58 62 62" stroke={colors.eyes} strokeWidth="2" fill="none" />
                <path d="M88 62 Q95 58 102 62" stroke={colors.eyes} strokeWidth="2" fill="none" />
              </>
            ) : (
              <>
                {/* 大眼睛 */}
                <ellipse cx="55" cy="62" rx="10" ry="12" fill="white" />
                <ellipse cx="95" cy="62" rx="10" ry="12" fill="white" />
                <circle cx="57" cy="64" r="6" fill={colors.eyes} />
                <circle cx="97" cy="64" r="6" fill={colors.eyes} />
                <circle cx="58" cy="61" r="2.5" fill="white" />
                <circle cx="98" cy="61" r="2.5" fill="white" />
                <circle cx="55" cy="66" r="1.5" fill="white" />
                <circle cx="95" cy="66" r="1.5" fill="white" />
              </>
            )}
          </g>
        )}
        
        {/* 腮红 */}
        <ellipse cx="40" cy="72" rx="10" ry="6" fill="url(#blushGradient)" />
        <ellipse cx="110" cy="72" rx="10" ry="6" fill="url(#blushGradient)" />
        
        {/* 嘴巴 */}
        {state === 'dance' ? (
          <ellipse cx="75" cy="82" rx="6" ry="4" fill="#FF6B6B" />
        ) : isShy ? (
          <path d="M72 80 Q75 78 78 80" stroke="#FF6B6B" strokeWidth="2" fill="none" />
        ) : (
          <path
            d="M68 80 Q75 88 82 80"
            stroke="#FF6B6B"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        )}
        
        {/* 小手 */}
        <ellipse cx="32" cy="110" rx="14" ry="12" fill={colors.skin} />
        <ellipse cx="118" cy="110" rx="14" ry="12" fill={colors.skin} />
        
        {/* 小脚 */}
        <ellipse cx="55" cy="165" rx="14" ry="10" fill={colors.skin} />
        <ellipse cx="95" cy="165" rx="14" ry="10" fill={colors.skin} />
        
        {/* 可爱装饰 - 头顶爱心 */}
        <path
          d="M75 8 C70 0 60 0 60 10 C60 18 75 25 75 25 C75 25 90 18 90 10 C90 0 80 0 75 8"
          fill={colors.accessory}
          filter="url(#glow)"
        />

        {/* 正在听的指示 */}
        {isListening && (
          <g>
            <circle cx="130" cy="40" r="8" fill="#FF4444" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="130" cy="40" r="4" fill="white" />
          </g>
        )}

        {/* 睡眠状态的ZZZ */}
        {state === 'sleep' && (
          <g filter="url(#glow)">
            <text x="110" y="35" fontSize="14" fill="#9B59B6" fontWeight="bold">Z</text>
            <text x="120" y="25" fontSize="11" fill="#9B59B6" fontWeight="bold">z</text>
            <text x="128" y="17" fontSize="9" fill="#9B59B6" fontWeight="bold">z</text>
          </g>
        )}

        {/* 思考状态的小星星 */}
        {state === 'think' && (
          <g filter="url(#glow)">
            <text x="110" y="30" fontSize="16" fill="#FFD700">✨</text>
            <text x="120" y="45" fontSize="12" fill="#FFD700">💭</text>
          </g>
        )}
        
        {/* 跳舞状态的音符 */}
        {state === 'dance' && (
          <g filter="url(#glow)">
            <text x="20" y="35" fontSize="14" fill={colors.accessory}>♪</text>
            <text x="120" y="30" fontSize="12" fill={colors.accessory}>♫</text>
            <text x="10" y="55" fontSize="10" fill={colors.accessory}>♪</text>
          </g>
        )}

        {/* 配饰渲染 */}
        {equippedAccessories.map(acc => (
          <text
            key={acc.id}
            x={acc.position.x}
            y={acc.position.y}
            fontSize={14 * (acc.scale || 1)}
            style={{
              transform: acc.rotation ? `rotate(${acc.rotation}deg)` : undefined,
              transformOrigin: `${acc.position.x}px ${acc.position.y}px`,
            }}
          >
            {acc.emoji}
          </text>
        ))}
      </svg>
      
      <style>{`
        @keyframes particle-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translateY(200px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
})

Mascot.displayName = 'Mascot'

export default Mascot

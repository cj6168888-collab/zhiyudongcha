import { useState, useEffect, useCallback } from 'react'

interface AnalysisResult {
  keywords: string[]
  summary: string
  riskLevel: number
  emotionState: 'calm' | 'alert' | 'warning' | 'danger' | 'success' | 'thinking'
}

const EMOTION_COLORS: Record<string, string> = {
  danger: '#ff4444',
  warning: '#ff8800',
  alert: '#ffcc00',
  thinking: '#00ccff',
  success: '#44ff88',
  calm: '#6699ff',
}

const EMOTION_LABELS: Record<string, string> = {
  danger: '高风险',
  warning: '警告',
  alert: '注意',
  thinking: '分析中',
  success: '安全',
  calm: '平静',
}

declare global {
  interface Window {
    electronAPI?: {
      onScreenCaptured: (callback: (screenshot: string) => void) => void
      onAnalysisResult: (callback: (result: AnalysisResult) => void) => void
      onStealthMode: (callback: (enabled: boolean) => void) => void
      analyzeScreen: (base64: string) => Promise<AnalysisResult>
      toggleStealth: () => Promise<void>
      setClickthrough: (enabled: boolean) => Promise<void>
    }
  }
}

function KeywordBubble({ keyword, index, color }: { keyword: string; index: number; color: string }) {
  const positions = [
    { top: '10%', right: '5%' },
    { top: '15%', right: '12%' },
    { top: '20%', right: '3%' },
    { top: '25%', right: '8%' },
    { top: '30%', right: '15%' },
    { top: '35%', right: '6%' },
    { top: '40%', right: '10%' },
    { top: '45%', right: '4%' },
  ]
  
  const pos = positions[index % positions.length]
  
  return (
    <div
      style={{
        position: 'absolute',
        ...pos,
        padding: '8px 16px',
        borderRadius: '20px',
        backgroundColor: `${color}20`,
        border: `1px solid ${color}50`,
        color: color,
        fontSize: '14px',
        fontWeight: 500,
        backdropFilter: 'blur(8px)',
        animation: `fadeInSlide 0.3s ease-out ${index * 0.1}s both`,
        pointerEvents: 'none',
      }}
    >
      {keyword}
    </div>
  )
}

function RiskMeter({ riskLevel, emotionState }: { riskLevel: number; emotionState: string }) {
  const color = EMOTION_COLORS[emotionState] || EMOTION_COLORS.calm
  const label = EMOTION_LABELS[emotionState] || '平静'
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${color}50`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}`,
          animation: 'pulse 2s infinite',
        }}
      />
      <div>
        <div style={{ color: color, fontSize: '14px', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>
          风险等级: {riskLevel}%
        </div>
      </div>
      <div
        style={{
          width: '60px',
          height: '6px',
          backgroundColor: 'rgba(100, 116, 139, 0.3)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${riskLevel}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '3px',
            transition: 'width 0.5s ease-out',
          }}
        />
      </div>
    </div>
  )
}

function SummaryPanel({ summary }: { summary: string }) {
  if (!summary) return null
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '20px',
        maxWidth: '400px',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(100, 153, 255, 0.3)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: '#6699ff', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>
        📋 摘要
      </div>
      <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: 1.5 }}>
        {summary}
      </div>
    </div>
  )
}

function StealthIndicator({ isActive }: { isActive: boolean }) {
  if (!isActive) return null
  
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px 40px',
        borderRadius: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        color: '#ef4444',
        fontSize: '18px',
        fontWeight: 600,
        pointerEvents: 'none',
      }}
    >
      👻 隐身模式 · 按 Ctrl+Shift+S 恢复
    </div>
  )
}

export default function OverlayApp() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isStealthMode, setIsStealthMode] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleScreenCapture = useCallback(async (screenshot: string) => {
    if (isAnalyzing || isStealthMode) return
    
    setIsAnalyzing(true)
    try {
      const result = await window.electronAPI?.analyzeScreen(screenshot)
      if (result) {
        setAnalysisResult(result)
      }
    } catch (error) {
      console.error('[Overlay] Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, isStealthMode])

  useEffect(() => {
    window.electronAPI?.onScreenCaptured(handleScreenCapture)
    window.electronAPI?.onAnalysisResult(setAnalysisResult)
    window.electronAPI?.onStealthMode(setIsStealthMode)
  }, [handleScreenCapture])

  const emotionState = analysisResult?.emotionState || 'calm'
  const color = EMOTION_COLORS[emotionState]

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        background: 'transparent',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <StealthIndicator isActive={isStealthMode} />

      {!isStealthMode && analysisResult && (
        <>
          {analysisResult.keywords.map((keyword, i) => (
            <KeywordBubble
              key={`${keyword}-${i}`}
              keyword={keyword}
              index={i}
              color={color}
            />
          ))}

          <SummaryPanel summary={analysisResult.summary} />

          <RiskMeter
            riskLevel={analysisResult.riskLevel}
            emotionState={emotionState}
          />
        </>
      )}

      {isAnalyzing && !isStealthMode && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(0, 204, 255, 0.5)',
            color: '#00ccff',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#00ccff',
              animation: 'pulse 1s infinite',
            }}
          />
          分析中...
        </div>
      )}
    </div>
  )
}

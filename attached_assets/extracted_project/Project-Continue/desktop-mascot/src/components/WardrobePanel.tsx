import { memo, useState, useMemo } from 'react'
import { SKIN_THEMES, SkinTheme, appearanceSystem } from '../services/appearance-themes'

interface WardrobePanelProps {
  onClose: () => void
  onSkinChange: (skin: SkinTheme) => void
  affectionLevel: number
}

const WardrobePanel = memo(({ onClose, onSkinChange, affectionLevel }: WardrobePanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSkin, setSelectedSkin] = useState<string>(appearanceSystem.getCurrentSkin().id)

  const categories = [
    { id: 'all', name: '全部', icon: '👗' },
    { id: 'default', name: '经典', icon: '👧' },
    { id: 'season', name: '季节', icon: '🌸' },
    { id: 'festival', name: '节日', icon: '🎉' },
    { id: 'costume', name: '角色', icon: '🎭' },
    { id: 'fantasy', name: '幻想', icon: '✨' },
    { id: 'special', name: '限定', icon: '💖' },
  ]

  const unlockedSkins = useMemo(() => appearanceSystem.getUnlockedSkins(), [])
  const availableSkins = useMemo(() => appearanceSystem.getAvailableSkins(affectionLevel), [affectionLevel])

  const filteredSkins = useMemo(() => {
    if (selectedCategory === 'all') return SKIN_THEMES
    return SKIN_THEMES.filter(s => s.category === selectedCategory)
  }, [selectedCategory])

  const handleSelect = (skin: SkinTheme) => {
    const isUnlocked = unlockedSkins.some(s => s.id === skin.id)
    if (!isUnlocked) {
      const canUnlock = availableSkins.some(s => s.id === skin.id)
      if (canUnlock) {
        appearanceSystem.unlockSkin(skin.id, affectionLevel)
      } else {
        return
      }
    }
    
    setSelectedSkin(skin.id)
    appearanceSystem.setSkin(skin.id)
    onSkinChange(skin)
  }

  const nextUnlock = appearanceSystem.getNextUnlockPreview(affectionLevel)

  return (
    <div
      data-testid="wardrobe-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420,
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
          <span>👗</span> 小智的衣橱
        </h2>
        <button
          data-testid="close-wardrobe"
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            data-testid={`category-${cat.id}`}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: '6px 12px',
              background: selectedCategory === cat.id ? 'rgba(255, 182, 193, 0.3)' : 'rgba(255, 255, 255, 0.05)',
              border: selectedCategory === cat.id ? '1px solid rgba(255, 182, 193, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 20,
              color: selectedCategory === cat.id ? '#FFB6C1' : '#888',
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          paddingRight: 8,
        }}
      >
        {filteredSkins.map(skin => {
          const isUnlocked = unlockedSkins.some(s => s.id === skin.id)
          const canUnlock = availableSkins.some(s => s.id === skin.id)
          const isSelected = selectedSkin === skin.id

          return (
            <div
              key={skin.id}
              data-testid={`skin-${skin.id}`}
              onClick={() => handleSelect(skin)}
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(255, 182, 193, 0.3), rgba(255, 105, 180, 0.2))'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isSelected
                  ? '2px solid #FF69B4'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: 12,
                cursor: isUnlocked || canUnlock ? 'pointer' : 'not-allowed',
                opacity: isUnlocked || canUnlock ? 1 : 0.4,
                textAlign: 'center',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {!isUnlocked && !canUnlock && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    fontSize: 12,
                  }}
                >
                  🔒
                </div>
              )}
              
              <div
                style={{
                  width: 50,
                  height: 50,
                  margin: '0 auto 8px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${skin.colors.outfit}, ${skin.colors.outfitAccent})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  boxShadow: isSelected ? '0 0 12px rgba(255, 105, 180, 0.5)' : 'none',
                }}
              >
                {skin.preview}
              </div>
              
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                {skin.name}
              </div>
              
              <div style={{ color: '#888', fontSize: 10, lineHeight: 1.3 }}>
                {isUnlocked ? skin.description : `需要好感度 ${skin.minAffection}`}
              </div>
            </div>
          )
        })}
      </div>

      {nextUnlock && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'rgba(255, 215, 0, 0.1)',
            borderRadius: 8,
            border: '1px solid rgba(255, 215, 0, 0.2)',
          }}
        >
          <div style={{ color: '#FFD700', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✨</span>
            <span>再提升 {nextUnlock.needed} 点好感度可解锁「{nextUnlock.skin.name}」</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', color: '#666', fontSize: 11 }}>
        当前好感度: {affectionLevel} 💕
      </div>
    </div>
  )
})

WardrobePanel.displayName = 'WardrobePanel'

export default WardrobePanel

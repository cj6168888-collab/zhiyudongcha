// 小智外观与主题系统 - 让小智更美丽
// 陈先生出品 · cj6168888@Gmail.com

// ========== 皮肤主题定义 ==========

export interface SkinTheme {
  id: string
  name: string
  description: string
  category: 'default' | 'season' | 'festival' | 'costume' | 'fantasy' | 'special'
  preview: string  // 预览图或emoji
  unlockCondition: string
  minAffection: number
  colors: {
    skin: string           // 肤色
    hair: string           // 发色
    hairHighlight?: string // 发色高光
    eyes: string           // 眼睛颜色
    blush: string          // 腮红
    outfit: string         // 主要服装颜色
    outfitAccent: string   // 服装点缀色
    accessory: string      // 配饰颜色
  }
  accessories: string[]    // 配饰列表
  animation?: string       // 特殊动画
  particles?: string       // 粒子效果
}

// ========== 服装配件定义 ==========

export interface Accessory {
  id: string
  name: string
  type: 'hair' | 'head' | 'face' | 'neck' | 'hand' | 'body' | 'background'
  emoji: string
  svgPath?: string
  position: { x: number; y: number }
  scale?: number
  rotation?: number
  animation?: string
}

// ========== 预设皮肤主题 ==========

export const SKIN_THEMES: SkinTheme[] = [
  // 默认皮肤
  {
    id: 'default',
    name: '经典小智',
    description: '最初相遇的样子~',
    category: 'default',
    preview: '👧',
    unlockCondition: '默认解锁',
    minAffection: 0,
    colors: {
      skin: '#FFE4C4',
      hair: '#4A3728',
      eyes: '#4A3728',
      blush: '#FFB6C1',
      outfit: '#FF69B4',
      outfitAccent: '#FF1493',
      accessory: '#FF69B4'
    },
    accessories: ['ribbon']
  },

  // 季节皮肤
  {
    id: 'spring',
    name: '樱花少女',
    description: '春天的小智，粉嫩嫩的~',
    category: 'season',
    preview: '🌸',
    unlockCondition: '春季限定',
    minAffection: 25,
    colors: {
      skin: '#FFE4E1',
      hair: '#8B4513',
      hairHighlight: '#FFB7C5',
      eyes: '#FF69B4',
      blush: '#FFB6C1',
      outfit: '#FFB7C5',
      outfitAccent: '#FF69B4',
      accessory: '#FFB7C5'
    },
    accessories: ['sakura_hairpin', 'petal_particles'],
    particles: 'sakura'
  },
  {
    id: 'summer',
    name: '海边小智',
    description: '夏日清凉装扮！',
    category: 'season',
    preview: '🌊',
    unlockCondition: '夏季限定',
    minAffection: 25,
    colors: {
      skin: '#FFE4C4',
      hair: '#4A3728',
      eyes: '#4169E1',
      blush: '#FFDAB9',
      outfit: '#87CEEB',
      outfitAccent: '#00CED1',
      accessory: '#FFD700'
    },
    accessories: ['straw_hat', 'sunglasses'],
    particles: 'bubbles'
  },
  {
    id: 'autumn',
    name: '枫叶精灵',
    description: '秋天的温暖色彩~',
    category: 'season',
    preview: '🍂',
    unlockCondition: '秋季限定',
    minAffection: 25,
    colors: {
      skin: '#FFDAB9',
      hair: '#8B4513',
      hairHighlight: '#D2691E',
      eyes: '#8B4513',
      blush: '#F4A460',
      outfit: '#D2691E',
      outfitAccent: '#FF8C00',
      accessory: '#FFD700'
    },
    accessories: ['maple_leaf', 'scarf'],
    particles: 'leaves'
  },
  {
    id: 'winter',
    name: '雪国公主',
    description: '冬天的小智，暖暖的~',
    category: 'season',
    preview: '❄️',
    unlockCondition: '冬季限定',
    minAffection: 25,
    colors: {
      skin: '#FFF5EE',
      hair: '#2F4F4F',
      hairHighlight: '#87CEEB',
      eyes: '#4682B4',
      blush: '#FFB6C1',
      outfit: '#B0C4DE',
      outfitAccent: '#4682B4',
      accessory: '#E0FFFF'
    },
    accessories: ['earmuffs', 'mittens', 'snow_cape'],
    particles: 'snowflakes'
  },

  // 节日皮肤
  {
    id: 'chinese_new_year',
    name: '新年福娃',
    description: '恭喜发财，红包拿来！',
    category: 'festival',
    preview: '🧧',
    unlockCondition: '春节限定',
    minAffection: 40,
    colors: {
      skin: '#FFE4C4',
      hair: '#1C1C1C',
      eyes: '#4A3728',
      blush: '#FF6B6B',
      outfit: '#FF0000',
      outfitAccent: '#FFD700',
      accessory: '#FFD700'
    },
    accessories: ['chinese_knot', 'red_packet', 'lantern'],
    particles: 'fireworks'
  },
  {
    id: 'halloween',
    name: '万圣南瓜',
    description: 'Trick or Treat!',
    category: 'festival',
    preview: '🎃',
    unlockCondition: '万圣节限定',
    minAffection: 40,
    colors: {
      skin: '#FFE4C4',
      hair: '#FF8C00',
      eyes: '#9932CC',
      blush: '#FFB6C1',
      outfit: '#FF8C00',
      outfitAccent: '#1C1C1C',
      accessory: '#9932CC'
    },
    accessories: ['witch_hat', 'pumpkin_basket', 'bat_wings'],
    particles: 'bats'
  },
  {
    id: 'christmas',
    name: '圣诞精灵',
    description: 'Merry Christmas!',
    category: 'festival',
    preview: '🎄',
    unlockCondition: '圣诞节限定',
    minAffection: 40,
    colors: {
      skin: '#FFE4E1',
      hair: '#8B0000',
      eyes: '#228B22',
      blush: '#FF6B6B',
      outfit: '#DC143C',
      outfitAccent: '#FFFFFF',
      accessory: '#FFD700'
    },
    accessories: ['santa_hat', 'gift_box', 'christmas_bell'],
    particles: 'stars'
  },
  {
    id: 'valentines',
    name: '心动少女',
    description: '满满的爱意~',
    category: 'festival',
    preview: '💕',
    unlockCondition: '情人节限定',
    minAffection: 55,
    colors: {
      skin: '#FFE4E1',
      hair: '#C71585',
      hairHighlight: '#FF69B4',
      eyes: '#FF1493',
      blush: '#FF69B4',
      outfit: '#FF69B4',
      outfitAccent: '#FFFFFF',
      accessory: '#FF1493'
    },
    accessories: ['heart_hairpin', 'love_letter', 'cupid_wings'],
    particles: 'hearts'
  },

  // 角色扮演皮肤
  {
    id: 'maid',
    name: '女仆装',
    description: '欢迎回来，主人！',
    category: 'costume',
    preview: '🎀',
    unlockCondition: '好感度达到55',
    minAffection: 55,
    colors: {
      skin: '#FFE4C4',
      hair: '#1C1C1C',
      eyes: '#4A3728',
      blush: '#FFB6C1',
      outfit: '#1C1C1C',
      outfitAccent: '#FFFFFF',
      accessory: '#FFFFFF'
    },
    accessories: ['maid_headband', 'apron', 'feather_duster']
  },
  {
    id: 'school_uniform',
    name: '校服萌妹',
    description: '学生时代的青春~',
    category: 'costume',
    preview: '📚',
    unlockCondition: '好感度达到40',
    minAffection: 40,
    colors: {
      skin: '#FFE4C4',
      hair: '#4A3728',
      eyes: '#4A3728',
      blush: '#FFB6C1',
      outfit: '#000080',
      outfitAccent: '#FFFFFF',
      accessory: '#FF0000'
    },
    accessories: ['sailor_collar', 'school_bag']
  },
  {
    id: 'idol',
    name: '偶像小智',
    description: '舞台上最闪耀的星！',
    category: 'costume',
    preview: '⭐',
    unlockCondition: '好感度达到70',
    minAffection: 70,
    colors: {
      skin: '#FFE4E1',
      hair: '#FFD700',
      hairHighlight: '#FFA500',
      eyes: '#00CED1',
      blush: '#FF69B4',
      outfit: '#FF69B4',
      outfitAccent: '#FFD700',
      accessory: '#FFD700'
    },
    accessories: ['star_hairpin', 'microphone', 'glowsticks'],
    particles: 'sparkles',
    animation: 'dance_pose'
  },

  // 幻想系皮肤
  {
    id: 'fairy',
    name: '森林精灵',
    description: '来自精灵森林的小智~',
    category: 'fantasy',
    preview: '🧚',
    unlockCondition: '好感度达到60',
    minAffection: 60,
    colors: {
      skin: '#FAFAD2',
      hair: '#90EE90',
      hairHighlight: '#98FB98',
      eyes: '#32CD32',
      blush: '#FFB6C1',
      outfit: '#90EE90',
      outfitAccent: '#228B22',
      accessory: '#FFD700'
    },
    accessories: ['fairy_wings', 'flower_crown', 'magic_wand'],
    particles: 'fireflies'
  },
  {
    id: 'angel',
    name: '天使小智',
    description: '守护主人的天使~',
    category: 'fantasy',
    preview: '👼',
    unlockCondition: '好感度达到85',
    minAffection: 85,
    colors: {
      skin: '#FFF8DC',
      hair: '#F5DEB3',
      hairHighlight: '#FFD700',
      eyes: '#87CEEB',
      blush: '#FFB6C1',
      outfit: '#FFFFFF',
      outfitAccent: '#FFD700',
      accessory: '#FFD700'
    },
    accessories: ['angel_wings', 'halo', 'golden_bow'],
    particles: 'feathers',
    animation: 'float'
  },
  {
    id: 'demon',
    name: '小恶魔',
    description: '调皮的小恶魔模式！',
    category: 'fantasy',
    preview: '😈',
    unlockCondition: '好感度达到75',
    minAffection: 75,
    colors: {
      skin: '#FFE4C4',
      hair: '#8B0000',
      hairHighlight: '#FF4500',
      eyes: '#FF0000',
      blush: '#FF6B6B',
      outfit: '#8B0000',
      outfitAccent: '#1C1C1C',
      accessory: '#FF0000'
    },
    accessories: ['devil_horns', 'bat_wings', 'devil_tail'],
    particles: 'dark_flames'
  },

  // 特殊皮肤
  {
    id: 'anniversary',
    name: '周年纪念',
    description: '感谢主人一直以来的陪伴~',
    category: 'special',
    preview: '🎊',
    unlockCondition: '相识一周年解锁',
    minAffection: 80,
    colors: {
      skin: '#FFE4E1',
      hair: '#9370DB',
      hairHighlight: '#E6E6FA',
      eyes: '#9370DB',
      blush: '#FFB6C1',
      outfit: '#E6E6FA',
      outfitAccent: '#9370DB',
      accessory: '#FFD700'
    },
    accessories: ['crown', 'anniversary_cape', 'celebration_wand'],
    particles: 'confetti',
    animation: 'celebrate'
  },
  {
    id: 'ultimate',
    name: '命定之人',
    description: '只属于最爱小智的主人~',
    category: 'special',
    preview: '💖',
    unlockCondition: '好感度达到100',
    minAffection: 100,
    colors: {
      skin: '#FFF0F5',
      hair: '#DA70D6',
      hairHighlight: '#FFB6C1',
      eyes: '#FF69B4',
      blush: '#FF69B4',
      outfit: '#FFB6C1',
      outfitAccent: '#FFFFFF',
      accessory: '#FFD700'
    },
    accessories: ['eternal_crown', 'destiny_wings', 'heart_aura'],
    particles: 'rainbow_hearts',
    animation: 'eternal_bond'
  },
]

// ========== 配饰定义 ==========

export const ACCESSORIES: Accessory[] = [
  { id: 'ribbon', name: '蝴蝶结', type: 'hair', emoji: '🎀', position: { x: 75, y: 25 } },
  { id: 'sakura_hairpin', name: '樱花发夹', type: 'hair', emoji: '🌸', position: { x: 40, y: 35 } },
  { id: 'straw_hat', name: '草帽', type: 'head', emoji: '👒', position: { x: 75, y: 15 } },
  { id: 'sunglasses', name: '太阳镜', type: 'face', emoji: '🕶️', position: { x: 75, y: 58 } },
  { id: 'maple_leaf', name: '枫叶', type: 'hair', emoji: '🍁', position: { x: 110, y: 30 } },
  { id: 'scarf', name: '围巾', type: 'neck', emoji: '🧣', position: { x: 75, y: 95 } },
  { id: 'earmuffs', name: '耳罩', type: 'head', emoji: '🎧', position: { x: 75, y: 45 } },
  { id: 'mittens', name: '手套', type: 'hand', emoji: '🧤', position: { x: 32, y: 110 } },
  { id: 'snow_cape', name: '雪花披风', type: 'body', emoji: '❄️', position: { x: 75, y: 100 } },
  { id: 'chinese_knot', name: '中国结', type: 'hair', emoji: '🧧', position: { x: 75, y: 25 } },
  { id: 'witch_hat', name: '女巫帽', type: 'head', emoji: '🎃', position: { x: 75, y: 5 } },
  { id: 'santa_hat', name: '圣诞帽', type: 'head', emoji: '🎅', position: { x: 75, y: 10 } },
  { id: 'heart_hairpin', name: '爱心发夹', type: 'hair', emoji: '💕', position: { x: 45, y: 35 } },
  { id: 'maid_headband', name: '女仆头饰', type: 'head', emoji: '🎀', position: { x: 75, y: 20 } },
  { id: 'star_hairpin', name: '星星发夹', type: 'hair', emoji: '⭐', position: { x: 40, y: 32 } },
  { id: 'fairy_wings', name: '精灵翅膀', type: 'body', emoji: '🧚', position: { x: 75, y: 90 }, scale: 1.2 },
  { id: 'angel_wings', name: '天使翅膀', type: 'body', emoji: '👼', position: { x: 75, y: 85 }, scale: 1.5 },
  { id: 'devil_horns', name: '恶魔角', type: 'head', emoji: '😈', position: { x: 75, y: 18 } },
  { id: 'crown', name: '皇冠', type: 'head', emoji: '👑', position: { x: 75, y: 8 } },
  { id: 'halo', name: '光环', type: 'head', emoji: '😇', position: { x: 75, y: 5 } },
]

// ========== 粒子效果定义 ==========

export const PARTICLE_EFFECTS = {
  sakura: { emoji: '🌸', count: 8, speed: 'slow', direction: 'falling' },
  snowflakes: { emoji: '❄️', count: 10, speed: 'slow', direction: 'falling' },
  leaves: { emoji: '🍂', count: 6, speed: 'medium', direction: 'falling' },
  hearts: { emoji: '💕', count: 5, speed: 'slow', direction: 'floating' },
  sparkles: { emoji: '✨', count: 8, speed: 'fast', direction: 'random' },
  stars: { emoji: '⭐', count: 6, speed: 'slow', direction: 'floating' },
  bubbles: { emoji: '🫧', count: 5, speed: 'slow', direction: 'rising' },
  fireworks: { emoji: '🎆', count: 3, speed: 'fast', direction: 'exploding' },
  confetti: { emoji: '🎉', count: 12, speed: 'medium', direction: 'falling' },
  fireflies: { emoji: '✨', count: 6, speed: 'slow', direction: 'floating' },
  feathers: { emoji: '🪶', count: 4, speed: 'slow', direction: 'falling' },
  bats: { emoji: '🦇', count: 3, speed: 'fast', direction: 'random' },
  rainbow_hearts: { emoji: '🌈💕', count: 8, speed: 'slow', direction: 'floating' },
}

// ========== 主题管理器 ==========

const STORAGE_KEY = 'xiaozhi-appearance'

interface AppearanceState {
  currentSkin: string
  unlockedSkins: string[]
  equippedAccessories: string[]
  favoriteThemes: string[]
  customColors?: Partial<SkinTheme['colors']>
}

class AppearanceSystem {
  private state: AppearanceState

  constructor() {
    this.state = {
      currentSkin: 'default',
      unlockedSkins: ['default'],
      equippedAccessories: ['ribbon'],
      favoriteThemes: [],
    }
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        this.state = { ...this.state, ...JSON.parse(data) }
      }
    } catch (e) {
      console.error('加载外观数据失败:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.error('保存外观数据失败:', e)
    }
  }

  // 获取当前皮肤
  getCurrentSkin(): SkinTheme {
    return SKIN_THEMES.find(s => s.id === this.state.currentSkin) || SKIN_THEMES[0]
  }

  // 获取所有可解锁皮肤
  getAvailableSkins(affectionLevel: number): SkinTheme[] {
    return SKIN_THEMES.filter(s => s.minAffection <= affectionLevel)
  }

  // 获取已解锁皮肤
  getUnlockedSkins(): SkinTheme[] {
    return SKIN_THEMES.filter(s => this.state.unlockedSkins.includes(s.id))
  }

  // 解锁皮肤
  unlockSkin(skinId: string, affectionLevel: number): boolean {
    const skin = SKIN_THEMES.find(s => s.id === skinId)
    if (!skin) return false
    
    if (skin.minAffection > affectionLevel) return false
    
    if (!this.state.unlockedSkins.includes(skinId)) {
      this.state.unlockedSkins.push(skinId)
      this.saveToStorage()
    }
    return true
  }

  // 切换皮肤
  setSkin(skinId: string): boolean {
    if (!this.state.unlockedSkins.includes(skinId)) return false
    
    const skin = SKIN_THEMES.find(s => s.id === skinId)
    if (!skin) return false
    
    this.state.currentSkin = skinId
    this.state.equippedAccessories = [...skin.accessories]
    this.saveToStorage()
    return true
  }

  // 装备配饰
  equipAccessory(accessoryId: string): void {
    if (!this.state.equippedAccessories.includes(accessoryId)) {
      this.state.equippedAccessories.push(accessoryId)
      this.saveToStorage()
    }
  }

  // 卸下配饰
  unequipAccessory(accessoryId: string): void {
    this.state.equippedAccessories = this.state.equippedAccessories.filter(a => a !== accessoryId)
    this.saveToStorage()
  }

  // 获取已装备配饰
  getEquippedAccessories(): Accessory[] {
    return ACCESSORIES.filter(a => this.state.equippedAccessories.includes(a.id))
  }

  // 获取粒子效果
  getParticleEffect(): typeof PARTICLE_EFFECTS[keyof typeof PARTICLE_EFFECTS] | null {
    const skin = this.getCurrentSkin()
    if (skin.particles) {
      return PARTICLE_EFFECTS[skin.particles as keyof typeof PARTICLE_EFFECTS]
    }
    return null
  }

  // 根据季节自动推荐皮肤
  getSeasonalRecommendation(): SkinTheme | null {
    const month = new Date().getMonth() + 1
    
    if (month >= 3 && month <= 5) {
      return SKIN_THEMES.find(s => s.id === 'spring') || null
    } else if (month >= 6 && month <= 8) {
      return SKIN_THEMES.find(s => s.id === 'summer') || null
    } else if (month >= 9 && month <= 11) {
      return SKIN_THEMES.find(s => s.id === 'autumn') || null
    } else {
      return SKIN_THEMES.find(s => s.id === 'winter') || null
    }
  }

  // 根据节日推荐皮肤
  getFestivalRecommendation(): SkinTheme | null {
    const date = new Date()
    const month = date.getMonth() + 1
    const day = date.getDate()

    // 春节（大约1月底到2月初）
    if ((month === 1 && day >= 20) || (month === 2 && day <= 15)) {
      return SKIN_THEMES.find(s => s.id === 'chinese_new_year') || null
    }
    // 情人节
    if (month === 2 && day >= 12 && day <= 14) {
      return SKIN_THEMES.find(s => s.id === 'valentines') || null
    }
    // 万圣节
    if (month === 10 && day >= 25) {
      return SKIN_THEMES.find(s => s.id === 'halloween') || null
    }
    // 圣诞节
    if (month === 12 && day >= 20 && day <= 26) {
      return SKIN_THEMES.find(s => s.id === 'christmas') || null
    }

    return null
  }

  // 添加到收藏
  addToFavorites(skinId: string): void {
    if (!this.state.favoriteThemes.includes(skinId)) {
      this.state.favoriteThemes.push(skinId)
      this.saveToStorage()
    }
  }

  // 获取收藏皮肤
  getFavorites(): SkinTheme[] {
    return SKIN_THEMES.filter(s => this.state.favoriteThemes.includes(s.id))
  }

  // 自动检查并解锁符合条件的皮肤
  checkAndUnlockSkins(affectionLevel: number): string[] {
    const newlyUnlocked: string[] = []
    
    for (const skin of SKIN_THEMES) {
      if (skin.minAffection <= affectionLevel && !this.state.unlockedSkins.includes(skin.id)) {
        this.state.unlockedSkins.push(skin.id)
        newlyUnlocked.push(skin.name)
      }
    }
    
    if (newlyUnlocked.length > 0) {
      this.saveToStorage()
    }
    
    return newlyUnlocked
  }

  // 获取下一个可解锁皮肤预告
  getNextUnlockPreview(affectionLevel: number): { skin: SkinTheme; needed: number } | null {
    const locked = SKIN_THEMES
      .filter(s => !this.state.unlockedSkins.includes(s.id) && s.minAffection > affectionLevel)
      .sort((a, b) => a.minAffection - b.minAffection)

    if (locked.length > 0) {
      return {
        skin: locked[0],
        needed: locked[0].minAffection - affectionLevel
      }
    }
    return null
  }
}

export const appearanceSystem = new AppearanceSystem()
export { AppearanceSystem }

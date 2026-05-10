import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BirthScene = 
  | 'vault_door'
  | 'laboratory'
  | 'gene_infusion'
  | 'mode_transfer';

export type GeneType = 
  | 'LEGAL'
  | 'FINANCE'
  | 'PSYCHOLOGY'
  | 'CODING'
  | 'ASSISTANT'
  | 'MEDICAL'
  | 'STRATEGY';

export type CharacterType = 'BOY' | 'GIRL' | 'ELF' | 'MECH';
export type AvatarGender = 'FEMALE' | 'MALE' | 'NEUTRAL';
export type AvatarPersonality = 'CHEERFUL' | 'GENTLE' | 'MATURE' | 'PLAYFUL';
export type AvatarVoice = 'SWEET_FEMALE' | 'GENTLE_MALE' | 'CUTE_CHILD' | 'WISE_FEMALE';
export type InterfaceMode = 'business' | 'anime';

export interface AvatarConfig {
  name: string;
  gender: AvatarGender;
  characterType: CharacterType;
  personality: AvatarPersonality;
  voice: AvatarVoice;
  selectedGenes: GeneType[];
  interfaceMode: InterfaceMode;
}

export const GENE_OPTIONS: { type: GeneType; emoji: string; name: string; nameEn: string; desc: string }[] = [
  { type: 'LEGAL', emoji: '⚖️', name: '大律师', nameEn: 'Legal Expert', desc: '逻辑严谨，法理精通' },
  { type: 'FINANCE', emoji: '💰', name: '财务专家', nameEn: 'Finance Expert', desc: '精打细算，理财高手' },
  { type: 'STRATEGY', emoji: '🎯', name: '策划大师', nameEn: 'Strategy Master', desc: '运筹帷幄，决胜千里' },
  { type: 'PSYCHOLOGY', emoji: '🧠', name: '心理学家', nameEn: 'Psychology Expert', desc: '善解人意，洞察内心' },
  { type: 'CODING', emoji: '💻', name: '编程大师', nameEn: 'Coding Master', desc: '技术精湛，创新无限' },
  { type: 'ASSISTANT', emoji: '✨', name: '万能助手', nameEn: 'Universal Assistant', desc: '有求必应，贴心周到' },
  { type: 'MEDICAL', emoji: '🩺', name: '随身医生', nameEn: 'Medical Expert', desc: '健康守护，关爱备至' },
];

export const CHARACTER_OPTIONS: { type: CharacterType; emoji: string; name: string; desc: string }[] = [
  { type: 'BOY', emoji: '👦', name: '男孩', desc: '阳光开朗的小男孩' },
  { type: 'GIRL', emoji: '👧', name: '女孩', desc: '可爱活泼的小女孩' },
  { type: 'ELF', emoji: '🧚', name: '精灵', desc: '神秘灵动的小精灵' },
  { type: 'MECH', emoji: '🤖', name: '机械', desc: '未来科技的机械体' },
];

export const PERSONALITY_OPTIONS: { type: AvatarPersonality; name: string; desc: string }[] = [
  { type: 'CHEERFUL', name: '开朗活泼', desc: '充满活力，乐观向上' },
  { type: 'GENTLE', name: '温柔体贴', desc: '细腻温和，体贴入微' },
  { type: 'MATURE', name: '成熟稳重', desc: '沉稳可靠，值得信赖' },
  { type: 'PLAYFUL', name: '俏皮可爱', desc: '古灵精怪，天真烂漫' },
];

export const VOICE_OPTIONS: { type: AvatarVoice; name: string; desc: string }[] = [
  { type: 'SWEET_FEMALE', name: '甜美女声', desc: '温柔甜蜜的少女音色' },
  { type: 'GENTLE_MALE', name: '温柔男声', desc: '沉稳温暖的男性音色' },
  { type: 'CUTE_CHILD', name: '可爱童声', desc: '天真无邪的儿童音色' },
  { type: 'WISE_FEMALE', name: '知性女声', desc: '成熟优雅的女性音色' },
];

interface BirthState {
  currentScene: BirthScene;
  hasBirthCompleted: boolean;
  birthCompletedAt: number | null;
  avatarConfig: AvatarConfig;
  sceneProgress: Record<BirthScene, boolean>;
  dnaVerified: boolean;
  
  setScene: (scene: BirthScene) => void;
  nextScene: () => void;
  prevScene: () => void;
  updateAvatarConfig: (updates: Partial<AvatarConfig>) => void;
  toggleGene: (gene: GeneType) => void;
  setCharacterType: (type: CharacterType) => void;
  markSceneComplete: (scene: BirthScene) => void;
  setDnaVerified: (verified: boolean) => void;
  completeBirth: () => void;
  resetBirth: () => void;
}

const SCENE_ORDER: BirthScene[] = [
  'vault_door',
  'laboratory',
  'gene_infusion',
  'mode_transfer',
];

const DEFAULT_CONFIG: AvatarConfig = {
  name: '小智',
  gender: 'FEMALE',
  characterType: 'GIRL',
  personality: 'CHEERFUL',
  voice: 'CUTE_CHILD',
  selectedGenes: ['ASSISTANT'],
  interfaceMode: 'anime',
};

export const useBirthStore = create<BirthState>()(
  persist(
    (set, get) => ({
      currentScene: 'vault_door',
      hasBirthCompleted: false,
      birthCompletedAt: null,
      avatarConfig: { ...DEFAULT_CONFIG },
      dnaVerified: false,
      sceneProgress: {
        vault_door: false,
        laboratory: false,
        gene_infusion: false,
        mode_transfer: false,
      },

      setScene: (scene) => set({ currentScene: scene }),

      nextScene: () => {
        const { currentScene } = get();
        const currentIndex = SCENE_ORDER.indexOf(currentScene);
        if (currentIndex < SCENE_ORDER.length - 1) {
          set({ currentScene: SCENE_ORDER[currentIndex + 1] });
        }
      },

      prevScene: () => {
        const { currentScene } = get();
        const currentIndex = SCENE_ORDER.indexOf(currentScene);
        if (currentIndex > 0) {
          set({ currentScene: SCENE_ORDER[currentIndex - 1] });
        }
      },

      updateAvatarConfig: (updates) => {
        set((state) => ({
          avatarConfig: { ...state.avatarConfig, ...updates },
        }));
      },

      toggleGene: (gene) => {
        set((state) => {
          const genes = state.avatarConfig.selectedGenes;
          const hasGene = genes.includes(gene);
          return {
            avatarConfig: {
              ...state.avatarConfig,
              selectedGenes: hasGene
                ? genes.filter((g) => g !== gene)
                : [...genes, gene],
            },
          };
        });
      },

      setCharacterType: (type) => {
        set((state) => {
          const genderMap: Record<CharacterType, AvatarGender> = {
            BOY: 'MALE',
            GIRL: 'FEMALE',
            ELF: 'NEUTRAL',
            MECH: 'NEUTRAL',
          };
          return {
            avatarConfig: {
              ...state.avatarConfig,
              characterType: type,
              gender: genderMap[type],
            },
          };
        });
      },

      markSceneComplete: (scene) => {
        set((state) => ({
          sceneProgress: { ...state.sceneProgress, [scene]: true },
        }));
      },

      setDnaVerified: (verified) => set({ dnaVerified: verified }),

      completeBirth: () => {
        set({
          hasBirthCompleted: true,
          birthCompletedAt: Date.now(),
        });
      },

      resetBirth: () => {
        set({
          currentScene: 'vault_door',
          hasBirthCompleted: false,
          birthCompletedAt: null,
          dnaVerified: false,
          avatarConfig: { ...DEFAULT_CONFIG },
          sceneProgress: {
            vault_door: false,
            laboratory: false,
            gene_infusion: false,
            mode_transfer: false,
          },
        });
      },
    }),
    {
      name: 'avatar-birth-storage',
    }
  )
);

export const getSceneIndex = (scene: BirthScene): number => SCENE_ORDER.indexOf(scene);
export const getTotalScenes = (): number => SCENE_ORDER.length;

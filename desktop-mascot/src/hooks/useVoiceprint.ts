import { useState, useCallback, useRef } from 'react'

interface VoiceprintProfile {
  id: string
  name: string
  features: number[]
  createdAt: number
}

interface VoiceprintHook {
  isEnrolling: boolean
  isMasterVoice: boolean | null
  masterProfile: VoiceprintProfile | null
  enrollMaster: () => Promise<boolean>
  verifyVoice: () => Promise<boolean>
  clearProfile: () => void
}

const STORAGE_KEY = 'xiaozhi-voiceprint'

export function useVoiceprint(): VoiceprintHook {
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [isMasterVoice, setIsMasterVoice] = useState<boolean | null>(null)
  const [masterProfile, setMasterProfile] = useState<VoiceprintProfile | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const extractFeatures = useCallback(async (duration = 3000): Promise<number[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        
        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 2048

        const source = audioContextRef.current.createMediaStreamSource(stream)
        source.connect(analyserRef.current)

        const features: number[] = []
        const frequencyData = new Uint8Array(analyserRef.current.frequencyBinCount)
        
        const collectSamples = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(frequencyData)
          
          const bands = 16
          const bandSize = Math.floor(frequencyData.length / bands)
          
          for (let i = 0; i < bands; i++) {
            let sum = 0
            for (let j = 0; j < bandSize; j++) {
              sum += frequencyData[i * bandSize + j]
            }
            features.push(sum / bandSize)
          }
        }

        const interval = setInterval(collectSamples, 100)

        setTimeout(() => {
          clearInterval(interval)
          stream.getTracks().forEach(track => track.stop())
          
          if (audioContextRef.current) {
            audioContextRef.current.close()
          }

          const avgFeatures: number[] = []
          const samplesPerBand = features.length / 16
          
          for (let i = 0; i < 16; i++) {
            let sum = 0
            let count = 0
            for (let j = i; j < features.length; j += 16) {
              sum += features[j]
              count++
            }
            avgFeatures.push(sum / count)
          }

          resolve(avgFeatures)
        }, duration)

      } catch (error) {
        reject(error)
      }
    })
  }, [])

  const compareFeatures = useCallback((a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }, [])

  const enrollMaster = useCallback(async (): Promise<boolean> => {
    setIsEnrolling(true)
    
    try {
      console.log('开始录制主人声纹，请说话3秒...')
      const features = await extractFeatures(3000)
      
      const profile: VoiceprintProfile = {
        id: `master-${Date.now()}`,
        name: '主人',
        features,
        createdAt: Date.now(),
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      setMasterProfile(profile)
      setIsEnrolling(false)
      
      return true
    } catch (error) {
      console.error('声纹注册失败:', error)
      setIsEnrolling(false)
      return false
    }
  }, [extractFeatures])

  const verifyVoice = useCallback(async (): Promise<boolean> => {
    if (!masterProfile) {
      setIsMasterVoice(null)
      return false
    }

    try {
      const features = await extractFeatures(2000)
      const similarity = compareFeatures(masterProfile.features, features)
      
      const threshold = 0.7
      const isMaster = similarity >= threshold
      
      setIsMasterVoice(isMaster)
      console.log(`声纹匹配度: ${(similarity * 100).toFixed(1)}%, 是主人: ${isMaster}`)
      
      return isMaster
    } catch (error) {
      console.error('声纹验证失败:', error)
      setIsMasterVoice(null)
      return false
    }
  }, [masterProfile, extractFeatures, compareFeatures])

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setMasterProfile(null)
    setIsMasterVoice(null)
  }, [])

  return {
    isEnrolling,
    isMasterVoice,
    masterProfile,
    enrollMaster,
    verifyVoice,
    clearProfile,
  }
}

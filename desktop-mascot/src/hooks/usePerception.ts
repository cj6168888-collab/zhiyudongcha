import { useState, useEffect, useCallback, useRef } from 'react'

export interface PerceptionState {
  cameraActive: boolean
  microphoneActive: boolean
  faceDetected: boolean
  isSpeaking: boolean
  audioLevel: number
}

interface PerceptionHook extends PerceptionState {
  startCamera: () => Promise<void>
  stopCamera: () => void
  startMicrophone: () => Promise<void>
  stopMicrophone: () => void
}

export function usePerception(): PerceptionHook {
  const [cameraActive, setCameraActive] = useState(false)
  const [microphoneActive, setMicrophoneActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, facingMode: 'user' } 
      })
      
      if (!videoRef.current) {
        videoRef.current = document.createElement('video')
        videoRef.current.autoplay = true
        videoRef.current.muted = true
      }
      
      videoRef.current.srcObject = stream
      mediaStreamRef.current = stream
      setCameraActive(true)

      detectFaces()
    } catch (error) {
      console.error('Camera access denied:', error)
      setCameraActive(false)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        if (track.kind === 'video') {
          track.stop()
        }
      })
    }
    setCameraActive(false)
    setFaceDetected(false)
  }, [])

  const detectFaces = useCallback(() => {
    const checkForFace = () => {
      if (!videoRef.current || !cameraActive) return

      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 240
      const ctx = canvas.getContext('2d')
      
      if (ctx && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, 320, 240)
        const imageData = ctx.getImageData(0, 0, 320, 240)
        const data = imageData.data

        let skinPixels = 0
        const totalPixels = data.length / 4

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          if (r > 95 && g > 40 && b > 20 &&
              r > g && r > b &&
              Math.abs(r - g) > 15 &&
              r - g > 15 && r - b > 15) {
            skinPixels++
          }
        }

        const skinRatio = skinPixels / totalPixels
        setFaceDetected(skinRatio > 0.05 && skinRatio < 0.5)
      }

      if (cameraActive) {
        setTimeout(checkForFace, 500)
      }
    }

    setTimeout(checkForFace, 1000)
  }, [cameraActive])

  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      if (mediaStreamRef.current) {
        stream.getAudioTracks().forEach(track => {
          mediaStreamRef.current?.addTrack(track)
        })
      } else {
        mediaStreamRef.current = stream
      }

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      setMicrophoneActive(true)
      analyzeAudio()
    } catch (error) {
      console.error('Microphone access denied:', error)
      setMicrophoneActive(false)
    }
  }, [])

  const stopMicrophone = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        if (track.kind === 'audio') {
          track.stop()
        }
      })
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    setMicrophoneActive(false)
    setIsSpeaking(false)
    setAudioLevel(0)
  }, [])

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !microphoneActive) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    
    const analyze = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)
      
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const average = sum / dataArray.length
      const normalizedLevel = Math.min(average / 128, 1)
      
      setAudioLevel(normalizedLevel)
      setIsSpeaking(normalizedLevel > 0.15)

      if (microphoneActive) {
        animationFrameRef.current = requestAnimationFrame(analyze)
      }
    }

    analyze()
  }, [microphoneActive])

  useEffect(() => {
    return () => {
      stopCamera()
      stopMicrophone()
    }
  }, [stopCamera, stopMicrophone])

  return {
    cameraActive,
    microphoneActive,
    faceDetected,
    isSpeaking,
    audioLevel,
    startCamera,
    stopCamera,
    startMicrophone,
    stopMicrophone,
  }
}

import { useState, useCallback, useRef, useEffect } from 'react'

interface VoiceHook {
  isListening: boolean
  isSpeaking: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  speak: (text: string) => Promise<void>
  cancelSpeech: () => void
}

export function useVoice(): VoiceHook {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'zh-CN'

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        setTranscript(finalTranscript || interimTranscript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        if (event.error !== 'no-speech') {
          setIsListening(false)
        }
      }

      recognitionRef.current.onend = () => {
        if (isListening) {
          try {
            recognitionRef.current?.start()
          } catch (e) {
            console.log('Recognition already started')
          }
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      window.speechSynthesis.cancel()
    }
  }, [isListening])

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setTranscript('')
      setIsListening(true)
      try {
        recognitionRef.current.start()
      } catch (e) {
        console.log('Recognition may already be running')
      }
    } else {
      console.error('Speech recognition not supported')
    }
  }, [])

  const stopListening = useCallback(() => {
    setIsListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  const speak = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      synthesisRef.current = utterance

      utterance.lang = 'zh-CN'
      utterance.rate = 1.0
      utterance.pitch = 1.2
      utterance.volume = 1.0

      const voices = window.speechSynthesis.getVoices()
      const chineseVoice = voices.find(v => 
        v.lang.includes('zh') && v.name.includes('Female')
      ) || voices.find(v => v.lang.includes('zh'))
      
      if (chineseVoice) {
        utterance.voice = chineseVoice
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        resolve()
      }
      utterance.onerror = (event) => {
        setIsSpeaking(false)
        reject(event)
      }

      window.speechSynthesis.speak(utterance)
    })
  }, [])

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return {
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  }
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

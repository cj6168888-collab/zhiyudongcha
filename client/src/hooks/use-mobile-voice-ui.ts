import { useState, useEffect, useCallback } from 'react';

interface MobileVoiceUIState {
  isMobile: boolean;
  isStandalone: boolean;
  supportsNativeVoice: boolean;
  keyboardVisible: boolean;
  keyboardHeight: number;
}

export function useMobileVoiceUI(): MobileVoiceUIState {
  const [state, setState] = useState<MobileVoiceUIState>({
    isMobile: false,
    isStandalone: false,
    supportsNativeVoice: false,
    keyboardVisible: false,
    keyboardHeight: 0,
  });

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (window.innerWidth < 768 && 'ontouchstart' in window);

      const isStandalone = (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;

      const supportsNativeVoice = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
        (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

      setState(prev => ({
        ...prev,
        isMobile,
        isStandalone,
        supportsNativeVoice,
      }));
    };

    checkMobile();

    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      setState(prev => ({
        ...prev,
        keyboardVisible: true,
        keyboardHeight: e.keyboardHeight || 300,
      }));
    };

    const handleKeyboardHide = () => {
      setState(prev => ({
        ...prev,
        keyboardVisible: false,
        keyboardHeight: 0,
      }));
    };

    if ((window as any).Capacitor?.isNative) {
      window.addEventListener('keyboardWillShow', handleKeyboardShow);
      window.addEventListener('keyboardWillHide', handleKeyboardHide);
    } else {
      window.visualViewport?.addEventListener('resize', () => {
        const viewport = window.visualViewport;
        if (viewport) {
          const isKeyboardVisible = window.innerHeight - viewport.height > 100;
          setState(prev => ({
            ...prev,
            keyboardVisible: isKeyboardVisible,
            keyboardHeight: window.innerHeight - viewport.height,
          }));
        }
      });
    }

    return () => {
      window.removeEventListener('keyboardWillShow', handleKeyboardShow);
      window.removeEventListener('keyboardWillHide', handleKeyboardHide);
    };
  }, []);

  return state;
}

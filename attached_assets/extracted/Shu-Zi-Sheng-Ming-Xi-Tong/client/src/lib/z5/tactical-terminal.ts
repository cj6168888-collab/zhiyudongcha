import { useZ1Store } from '../z1/god-protocol';
import { useZ3Store } from '../z3/spirit-core';

export type ViewMode = 'BUBBLE' | 'AVATAR';
export type PerceptionStatus = 'IDLE' | 'SCANNING' | 'ALERT';

export interface PerceptionResult {
  hasRisk: boolean;
  riskLevel: number;
  targetArea?: { x: number; y: number; width: number; height: number };
  warningText?: string;
  detectedKeywords?: string[];
  emotionState?: 'neutral' | 'stressed' | 'happy' | 'angry';
}

export interface MockOpTask {
  id: string;
  description: string;
  coordinates: { x: number; y: number }[];
  action: 'click' | 'swipe' | 'type';
  payload?: string;
}

export interface Z5State {
  isInitialized: boolean;
  genesisComplete: boolean;
  viewMode: ViewMode;
  perceptionStatus: PerceptionStatus;
  lastPerception: PerceptionResult | null;
  mockOpActive: boolean;
  currentTask: MockOpTask | null;
  cameraEnabled: boolean;
  whisperEnabled: boolean;
}

const initialState: Z5State = {
  isInitialized: false,
  genesisComplete: false,
  viewMode: 'BUBBLE',
  perceptionStatus: 'IDLE',
  lastPerception: null,
  mockOpActive: false,
  currentTask: null,
  cameraEnabled: false,
  whisperEnabled: true,
};

class TacticalTerminal {
  private state: Z5State = { ...initialState };
  private listeners: Set<(state: Z5State) => void> = new Set();
  private cameraStream: MediaStream | null = null;
  private perceptionInterval: number | null = null;

  getState(): Z5State {
    return { ...this.state };
  }

  subscribe(listener: (state: Z5State) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.getState()));
  }

  private setState(updates: Partial<Z5State>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  async bootSequence(): Promise<boolean> {
    this.setState({ isInitialized: false, genesisComplete: false });
    
    await this.delay(100);
    
    const z1Store = useZ1Store.getState();
    const hasValidKey = z1Store.aiServices.some(s => s.isActive && s.apiKey);
    
    await this.delay(2000);
    
    this.setState({ 
      isInitialized: true,
      genesisComplete: hasValidKey 
    });
    
    if (hasValidKey) {
      useZ3Store.getState().triggerVisualEffect('PARTICLE_IN', 'Z5_TERMINAL');
    }
    
    return hasValidKey;
  }

  setViewMode(mode: ViewMode) {
    this.setState({ viewMode: mode });
    useZ3Store.getState().triggerVisualEffect(mode === 'AVATAR' ? 'PARTICLE_IN' : 'PARTICLE_OUT', 'Z5_TERMINAL');
  }

  async startVisionSniffing(): Promise<boolean> {
    const z1Store = useZ1Store.getState();
    if (z1Store.role !== 'MASTER') {
      console.warn('Vision sniffing requires MASTER role');
      return false;
    }
    
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      this.setState({ 
        cameraEnabled: true, 
        perceptionStatus: 'SCANNING' 
      });
      
      this.perceptionInterval = window.setInterval(() => {
        this.analyzeFrame();
      }, 2000);
      
      return true;
    } catch (err) {
      console.warn('Camera access denied:', err);
      this.setState({ cameraEnabled: false });
      return false;
    }
  }

  stopVisionSniffing() {
    if (this.perceptionInterval) {
      clearInterval(this.perceptionInterval);
      this.perceptionInterval = null;
    }
    
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    
    this.setState({ 
      cameraEnabled: false, 
      perceptionStatus: 'IDLE',
      lastPerception: null 
    });
  }

  private analyzeFrame() {
    const mockPerception: PerceptionResult = {
      hasRisk: Math.random() > 0.7,
      riskLevel: Math.random() * 100,
      detectedKeywords: ['合同', '签字', '条款'],
      emotionState: 'neutral',
    };
    
    if (mockPerception.hasRisk) {
      mockPerception.warningText = '检测到潜在风险条款';
      mockPerception.targetArea = {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 300,
        width: 150,
        height: 50
      };
      
      this.setState({ perceptionStatus: 'ALERT' });
      
      if (this.state.whisperEnabled) {
        this.whisper(mockPerception.warningText);
      }
    } else {
      this.setState({ perceptionStatus: 'SCANNING' });
    }
    
    this.setState({ lastPerception: mockPerception });
  }

  private whisper(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.volume = 0.3;
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }

  getCameraStream(): MediaStream | null {
    return this.cameraStream;
  }

  async runAutonomousTask(task: MockOpTask): Promise<void> {
    const z1Store = useZ1Store.getState();
    if (z1Store.role !== 'MASTER') {
      console.warn('MockOp requires MASTER role');
      return;
    }
    
    this.setState({ mockOpActive: true, currentTask: task });
    this.notify();
    
    for (let i = 0; i < task.coordinates.length; i++) {
      await this.delay(500);
      useZ3Store.getState().triggerVisualEffect('QUANTUM_LEAP', 'Z5_TERMINAL');
    }
    
    await this.delay(300);
    
    this.setState({ mockOpActive: false, currentTask: null });
    this.notify();
  }

  setWhisperEnabled(enabled: boolean) {
    this.setState({ whisperEnabled: enabled });
  }

  reset() {
    this.stopVisionSniffing();
    this.state = { ...initialState };
    this.notify();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const tacticalTerminal = new TacticalTerminal();

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

  private scanCount = 0;
  private riskHistory: number[] = [];
  
  private analyzeFrame() {
    this.scanCount++;
    
    const z1 = useZ1Store.getState();
    const baseRiskFactor = z1.hpBalance < 300 ? 0.3 : z1.hpBalance < 600 ? 0.15 : 0.05;
    const timeRiskFactor = (this.scanCount % 10 === 0) ? 0.2 : 0;
    const hasRisk = Math.random() < (baseRiskFactor + timeRiskFactor);
    
    const riskLevel = hasRisk ? 50 + Math.random() * 50 : Math.random() * 30;
    this.riskHistory.push(riskLevel);
    if (this.riskHistory.length > 10) this.riskHistory.shift();
    
    const avgRisk = this.riskHistory.reduce((a, b) => a + b, 0) / this.riskHistory.length;
    
    const riskKeywords = ['合同', '签字', '条款', '违约', '责任', '赔偿'];
    const safeKeywords = ['确认', '同意', '明细', '备注'];
    const detectedKeywords = hasRisk 
      ? riskKeywords.slice(0, 2 + Math.floor(Math.random() * 2))
      : safeKeywords.slice(0, 1 + Math.floor(Math.random() * 2));
    
    const emotionStates: Array<'neutral' | 'stressed' | 'happy' | 'angry'> = ['neutral', 'stressed', 'happy', 'angry'];
    const emotionIndex = avgRisk > 60 ? 1 : avgRisk < 20 ? 2 : 0;
    
    const perception: PerceptionResult = {
      hasRisk,
      riskLevel,
      detectedKeywords,
      emotionState: emotionStates[emotionIndex],
    };
    
    if (hasRisk) {
      const warnings = [
        '检测到潜在风险条款',
        '发现敏感信息，建议仔细审阅',
        '合同条款需要注意',
        '检测到不利条款'
      ];
      perception.warningText = warnings[Math.floor(Math.random() * warnings.length)];
      perception.targetArea = {
        x: 80 + (this.scanCount % 5) * 40,
        y: 100 + (this.scanCount % 4) * 60,
        width: 150,
        height: 50
      };
      
      this.setState({ perceptionStatus: 'ALERT' });
      
      if (this.state.whisperEnabled && this.scanCount % 3 === 0) {
        this.whisper(perception.warningText);
      }
    } else {
      this.setState({ perceptionStatus: 'SCANNING' });
    }
    
    this.setState({ lastPerception: perception });
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

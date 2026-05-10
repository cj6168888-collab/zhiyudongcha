import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Device Types
export type DeviceType = 'MASTER_PC' | 'MOBILE_TACTICAL' | 'AR_GLASSES' | 'IOT_HUB' | 'TV';
export type AudioMode = 'WHISPER' | 'AMBIENT' | 'HUD' | 'SILENT';
export type StreamTarget = 'BLUETOOTH_EARPHONE' | 'DEVICE_SPEAKER' | 'GLASSES_DISPLAY' | 'SUBTITLE_ONLY';
export type UserContext = 'PRIVATE_OFFICE' | 'PUBLIC_PLACE' | 'HOME' | 'MEETING' | 'TRANSIT';
export type UserStatus = 'ACTIVE' | 'IDLE' | 'SLEEPING' | 'STRESSED';
export type VisualEffect = 'PARTICLE_OUT' | 'PARTICLE_IN' | 'FRACTAL_DISSOLVE' | 'QUANTUM_LEAP';

interface DeviceNode {
  id: string;
  type: DeviceType;
  name: string;
  isOnline: boolean;
  sensorScore: number;
  proximity: number;
  hasBluetooth: boolean;
  lastSeen: Date;
}

interface StreamConfig {
  audioMode: AudioMode;
  streamTarget: StreamTarget;
  visualOverlay: boolean;
  hapticEnabled: boolean;
  noiseCancellation: boolean;
}

interface SyncPayload {
  hp: number;
  academicLevel: string;
  activeSkills: string[];
  timestamp: number;
}

interface VisualEffectEvent {
  effect: VisualEffect;
  nodeId: string;
  timestamp: number;
}

interface Z3State {
  // 1. Spirit Presence (灵魂坐标)
  activeNodeId: string | null;
  devices: DeviceNode[];
  isGhosting: boolean;
  ghostingTarget: string | null;

  // 2. Stream Control (流优先级控制)
  streamConfig: StreamConfig;
  audioMutex: boolean;
  
  // 3. User Context
  userStatus: UserStatus;
  userContext: UserContext;
  stressLevel: number;
  
  // 4. Spirit Stats (小智生命状态)
  hp: number;
  level: number;
  
  // 5. Sync State (全端同步状态)
  lastSyncPayload: SyncPayload | null;
  pendingEffects: VisualEffectEvent[];
  wsConnected: boolean;
  
  // Actions - Device Management
  registerDevice: (device: Omit<DeviceNode, 'lastSeen'>) => void;
  unregisterDevice: (deviceId: string) => void;
  updateDeviceProximity: (deviceId: string, proximity: number) => void;
  
  // Actions - Ghosting (穿行协议)
  initiateGhosting: (targetNodeId: string) => Promise<void>;
  completeGhosting: () => void;
  
  // Actions - Audio Control
  setAudioMode: (mode: AudioMode) => void;
  acquireAudioMutex: () => boolean;
  releaseAudioMutex: () => void;
  
  // Actions - User Context
  setUserStatus: (status: UserStatus) => void;
  setUserContext: (context: UserContext) => void;
  setStressLevel: (level: number) => void;
  
  // Actions - Z3 Core Functions
  syncUiState: (hp: number, academicLevel: string, activeSkills: string[]) => void;
  triggerVisualEffect: (effect: VisualEffect, nodeId: string) => void;
  arbitrateAudioStream: (intelLevel: 'PUBLIC' | 'INTERNAL' | 'SECRET') => StreamTarget;
  broadcastToAllNodes: (payload: SyncPayload) => void;
  
  // Arbitration Logic
  getBestDevice: () => DeviceNode | null;
  shouldUseWhisper: (isConfidential: boolean) => boolean;
}

// WebSocket connection for real-time sync
let wsConnection: WebSocket | null = null;

export const useZ3Store = create<Z3State>()(
  persist(
    (set, get) => ({
      // Initial State
      activeNodeId: null,
      devices: [],
      isGhosting: false,
      ghostingTarget: null,
      
      streamConfig: {
        audioMode: 'AMBIENT',
        streamTarget: 'DEVICE_SPEAKER',
        visualOverlay: true,
        hapticEnabled: true,
        noiseCancellation: false,
      },
      audioMutex: false,
      
      userStatus: 'ACTIVE',
      userContext: 'PRIVATE_OFFICE',
      stressLevel: 30,
      
      hp: 85,
      level: 1,
      
      lastSyncPayload: null,
      pendingEffects: [],
      wsConnected: false,

      // Device Management
      registerDevice: (device) => {
        set((state) => ({
          devices: [
            ...state.devices.filter(d => d.id !== device.id),
            { ...device, lastSeen: new Date() }
          ]
        }));
      },

      unregisterDevice: (deviceId) => {
        set((state) => ({
          devices: state.devices.filter(d => d.id !== deviceId),
          activeNodeId: state.activeNodeId === deviceId ? null : state.activeNodeId
        }));
      },

      updateDeviceProximity: (deviceId, proximity) => {
        set((state) => ({
          devices: state.devices.map(d => 
            d.id === deviceId ? { ...d, proximity, lastSeen: new Date() } : d
          )
        }));
      },

      // Ghosting (跨端穿行协议)
      initiateGhosting: async (targetNodeId) => {
        const { activeNodeId, devices, acquireAudioMutex, releaseAudioMutex, triggerVisualEffect } = get();
        const targetDevice = devices.find(d => d.id === targetNodeId);
        
        if (!targetDevice || targetNodeId === activeNodeId) return;

        // Acquire audio mutex to prevent dual audio
        acquireAudioMutex();
        
        set({ isGhosting: true, ghostingTarget: targetNodeId });
        
        // Trigger PARTICLE_OUT on old node
        if (activeNodeId) {
          triggerVisualEffect('PARTICLE_OUT', activeNodeId);
        }
        
        // Simulate transition delay (< 200ms as per Z3 spec)
        await new Promise(resolve => setTimeout(resolve, 180));
        
        // Trigger PARTICLE_IN on new node
        triggerVisualEffect('PARTICLE_IN', targetNodeId);
        
        set({
          activeNodeId: targetNodeId,
          isGhosting: false,
          ghostingTarget: null,
        });
        
        releaseAudioMutex();
        
        console.log(`[SpiritCore] Transfer complete: ${activeNodeId} -> ${targetNodeId}`);
      },

      completeGhosting: () => {
        set({ isGhosting: false, ghostingTarget: null });
      },

      // Audio Control with Mutex
      setAudioMode: (mode) => {
        const streamTarget = mode === 'WHISPER' ? 'BLUETOOTH_EARPHONE' :
                            mode === 'HUD' ? 'GLASSES_DISPLAY' :
                            mode === 'SILENT' ? 'SUBTITLE_ONLY' : 'DEVICE_SPEAKER';
        set((state) => ({
          streamConfig: { ...state.streamConfig, audioMode: mode, streamTarget }
        }));
      },

      acquireAudioMutex: () => {
        const { audioMutex } = get();
        if (audioMutex) return false;
        set({ audioMutex: true });
        return true;
      },

      releaseAudioMutex: () => {
        set({ audioMutex: false });
      },

      // User Context
      setUserStatus: (status) => {
        set({ userStatus: status });
        
        if (status === 'SLEEPING') {
          set((state) => ({
            streamConfig: { ...state.streamConfig, audioMode: 'SILENT', streamTarget: 'SUBTITLE_ONLY' }
          }));
        }
      },

      setUserContext: (context) => {
        set({ userContext: context });
        
        // Auto-adjust audio for public/meeting contexts
        if (context === 'PUBLIC_PLACE' || context === 'MEETING') {
          set((state) => ({
            streamConfig: { ...state.streamConfig, audioMode: 'WHISPER', streamTarget: 'BLUETOOTH_EARPHONE' }
          }));
        }
      },

      setStressLevel: (level) => {
        set({ stressLevel: level });
        
        // Auto-degrade to minimal when stressed (压力自动降级)
        if (level > 70) {
          set((state) => ({
            streamConfig: { 
              ...state.streamConfig, 
              audioMode: 'SILENT',
              streamTarget: 'SUBTITLE_ONLY',
              visualOverlay: false 
            }
          }));
        }
      },

      // ===== Z3 Core Functions =====
      
      // 全端状态同步
      syncUiState: (hpValue, academicLevel, activeSkills) => {
        const levelNum = parseInt(academicLevel.replace(/\D/g, '')) || 1;
        set({ hp: hpValue, level: levelNum });
        
        const payload: SyncPayload = {
          hp: hpValue,
          academicLevel,
          activeSkills,
          timestamp: Date.now(),
        };
        
        set({ lastSyncPayload: payload });
        
        // Broadcast to all connected nodes
        get().broadcastToAllNodes(payload);
        
        console.log('[SpiritCore] UI State synced:', payload);
      },

      // 触发视觉特效
      triggerVisualEffect: (effect, nodeId) => {
        const event: VisualEffectEvent = {
          effect,
          nodeId,
          timestamp: Date.now(),
        };
        
        set((state) => ({
          pendingEffects: [...state.pendingEffects.slice(-9), event]
        }));
        
        // Send to WebSocket for Z5 frontend rendering
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({
            type: 'VISUAL_EFFECT',
            payload: event,
          }));
        }
        
        console.log(`[SpiritCore] Visual effect triggered: ${effect} on ${nodeId}`);
      },

      // 音频流仲裁
      arbitrateAudioStream: (intelLevel) => {
        const { userContext, devices, activeNodeId } = get();
        const activeDevice = devices.find(d => d.id === activeNodeId);
        
        // 情报密级判断 (结合 Z1 权限)
        if (intelLevel === 'SECRET' || userContext === 'PUBLIC_PLACE' || userContext === 'MEETING') {
          // 秘密情报或公共场合，强制切换到耳机耳语
          if (activeDevice?.hasBluetooth) {
            set((state) => ({
              streamConfig: { ...state.streamConfig, audioMode: 'WHISPER', streamTarget: 'BLUETOOTH_EARPHONE' }
            }));
            return 'BLUETOOTH_EARPHONE';
          } else {
            // 无蓝牙时降级为字幕
            set((state) => ({
              streamConfig: { ...state.streamConfig, audioMode: 'SILENT', streamTarget: 'SUBTITLE_ONLY' }
            }));
            return 'SUBTITLE_ONLY';
          }
        }
        
        // 非秘密情报，使用环境音
        set((state) => ({
          streamConfig: { ...state.streamConfig, audioMode: 'AMBIENT', streamTarget: 'DEVICE_SPEAKER' }
        }));
        return 'DEVICE_SPEAKER';
      },

      // WebSocket 广播到所有节点
      broadcastToAllNodes: (payload) => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({
            type: 'SYNC_STATE',
            payload,
          }));
        }
        
        // Also store locally for offline nodes
        set({ lastSyncPayload: payload });
      },

      // Arbitration Logic
      getBestDevice: () => {
        const { devices } = get();
        const onlineDevices = devices.filter(d => d.isOnline);
        
        if (onlineDevices.length === 0) return null;
        
        return onlineDevices.reduce((best, current) => {
          const bestScore = best.sensorScore + best.proximity;
          const currentScore = current.sensorScore + current.proximity;
          return currentScore > bestScore ? current : best;
        });
      },

      shouldUseWhisper: (isConfidential) => {
        const { devices, activeNodeId, userContext } = get();
        const activeDevice = devices.find(d => d.id === activeNodeId);
        
        if (!activeDevice) return false;
        
        // Force whisper for confidential content or public contexts
        if ((isConfidential || userContext === 'PUBLIC_PLACE' || userContext === 'MEETING') 
            && activeDevice.hasBluetooth) {
          return true;
        }
        
        return false;
      },
    }),
    {
      name: 'z3-spirit-core-storage',
    }
  )
);

// WebSocket initialization for real-time sync
export function initZ3WebSocket(url?: string) {
  const wsUrl = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/z3`;
  
  try {
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
      console.log('[Z3] WebSocket connected');
      useZ3Store.setState({ wsConnected: true });
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'SYNC_STATE') {
          useZ3Store.setState({ lastSyncPayload: data.payload });
        }
        
        if (data.type === 'VISUAL_EFFECT') {
          const { pendingEffects } = useZ3Store.getState();
          useZ3Store.setState({
            pendingEffects: [...pendingEffects.slice(-9), data.payload]
          });
        }
      } catch (e) {
        console.error('[Z3] WebSocket message parse error:', e);
      }
    };
    
    wsConnection.onclose = () => {
      console.log('[Z3] WebSocket disconnected');
      useZ3Store.setState({ wsConnected: false });
      
      // Auto-reconnect after 3 seconds
      setTimeout(() => initZ3WebSocket(url), 3000);
    };
    
    wsConnection.onerror = (error) => {
      console.error('[Z3] WebSocket error:', error);
    };
    
  } catch (e) {
    console.error('[Z3] WebSocket init failed:', e);
  }
}

// Z3 Protocol Schema
export const Z3_SCHEMA = {
  protocol_name: "SpiritCore_Stream_v6",
  sync_strategy: "Event-Driven Fractal Synchronization",
  ghosting_protocol: {
    transition_effect: "FRACTAL_PARTICLE_FLIGHT",
    max_latency_ms: 200,
  },
  stream_modes: {
    WHISPER: "BLUETOOTH_EARPHONE",
    AMBIENT: "DEVICE_SPEAKER",
    HUD: "GLASSES_DISPLAY",
  },
  hidden_streams_for_guest: ["PRIVATE_INTEL", "ROOT_CONFIG", "BIO_METRICS"],
};

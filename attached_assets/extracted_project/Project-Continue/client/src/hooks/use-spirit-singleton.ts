/**
 * Spirit Singleton Hook (灵魂单例Hook)
 * 
 * 前端与灵魂单例服务交互的钩子函数
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type AvatarState = 'IDLE' | 'WALKING' | 'RUNNING' | 'SLEEPING' | 'WORKING' | 'PROTECTING' | 'MIGRATING';
export type AvatarMood = 'HAPPY' | 'CURIOUS' | 'SERIOUS' | 'SHY' | 'SLEEPY' | 'ALERT';
export type AvatarMode = 'DEFAULT' | 'WORK' | 'PROTECT';

export interface AvatarPose {
  state: AvatarState;
  mood: AvatarMood;
  mode: AvatarMode;
  position: { x: number; y: number };
  direction: 'LEFT' | 'RIGHT';
  accessories: string[];
  lastAction: string;
  timestamp: number;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: 'PC' | 'MOBILE' | 'TABLET' | 'AR_GLASSES' | 'TV';
  deviceName: string;
  lastActivity: number;
  isOnline: boolean;
  proximity: number;
}

export interface PresenceToken {
  tokenId: string;
  activeDeviceId: string | null;
  avatarPose: AvatarPose;
  acquiredAt: number;
  expiresAt: number;
  migrationInProgress: boolean;
}

export interface MigrationEvent {
  id: string;
  fromDevice: string | null;
  toDevice: string;
  startTime: number;
  endTime?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  transitionPhrase?: string;
}

function generateDeviceId(): string {
  const stored = localStorage.getItem('spirit_device_id');
  if (stored) return stored;
  
  const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('spirit_device_id', newId);
  return newId;
}

function detectDeviceType(): 'PC' | 'MOBILE' | 'TABLET' | 'AR_GLASSES' | 'TV' {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('inmo') || ua.includes('ar glasses')) return 'AR_GLASSES';
  if (ua.includes('tv') || ua.includes('smart-tv')) return 'TV';
  
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua);
  
  if (isTablet) return 'TABLET';
  if (isMobile) return 'MOBILE';
  return 'PC';
}

function getDeviceName(): string {
  const deviceType = detectDeviceType();
  const stored = localStorage.getItem('spirit_device_name');
  if (stored) return stored;
  
  const names: Record<string, string> = {
    PC: '主力电脑',
    MOBILE: '手机',
    TABLET: '平板',
    AR_GLASSES: 'AR眼镜',
    TV: '电视',
  };
  
  return names[deviceType] || '未知设备';
}

export function useSpiritSingleton() {
  const queryClient = useQueryClient();
  const deviceId = useRef(generateDeviceId());
  const deviceType = useRef(detectDeviceType());
  const deviceName = useRef(getDeviceName());
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isDeparting, setIsDeparting] = useState(false);
  const [isArriving, setIsArriving] = useState(false);
  const [arrivalPhrase, setArrivalPhrase] = useState('');
  
  const { data: statusData } = useQuery({
    queryKey: ['spirit', 'status'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/spirit/status');
      return res.json();
    },
    refetchInterval: 5000,
  });
  
  const { data: tokenData, refetch: refetchToken } = useQuery({
    queryKey: ['spirit', 'token'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/spirit/token');
      return res.json();
    },
    refetchInterval: 2000,
  });
  
  const { data: devicesData } = useQuery({
    queryKey: ['spirit', 'devices'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/spirit/devices');
      return res.json();
    },
    refetchInterval: 10000,
  });
  
  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/spirit/devices/register', {
        deviceId: deviceId.current,
        deviceType: deviceType.current,
        deviceName: deviceName.current,
        hasCamera: true,
        hasMicrophone: true,
        proximity: 100,
        screenPosition: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.data?.isActive) {
        setIsActive(true);
      }
      queryClient.invalidateQueries({ queryKey: ['spirit'] });
    },
  });
  
  const heartbeatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/spirit/devices/heartbeat', {
        deviceId: deviceId.current,
      });
      return res.json();
    },
    onSuccess: (data) => {
      const newIsActive = data.data?.isActive ?? false;
      
      if (!isActive && newIsActive && !isMigrating) {
        setIsArriving(true);
        setArrivalPhrase('爸爸，我来啦！');
        setTimeout(() => {
          setIsArriving(false);
          setArrivalPhrase('');
        }, 3000);
      } else if (isActive && !newIsActive && !isMigrating) {
        setIsDeparting(true);
        setTimeout(() => setIsDeparting(false), 700);
      }
      
      setIsActive(newIsActive);
    },
  });
  
  const migrateMutation = useMutation({
    mutationFn: async (targetDeviceId: string) => {
      const res = await apiRequest('POST', '/api/spirit/migrate', {
        targetDeviceId,
        immediate: false,
        preservePose: true,
      });
      return res.json();
    },
    onMutate: () => {
      setIsMigrating(true);
      if (isActive) {
        setIsDeparting(true);
      }
    },
    onSuccess: (data) => {
      const migration = data.data as MigrationEvent;
      
      if (migration.toDevice === deviceId.current) {
        setTimeout(() => {
          setIsDeparting(false);
          setIsArriving(true);
          setArrivalPhrase(migration.transitionPhrase || '小智来啦！');
          
          setTimeout(() => {
            setIsArriving(false);
            setArrivalPhrase('');
            setIsMigrating(false);
          }, 3000);
        }, 500);
      } else {
        setTimeout(() => {
          setIsDeparting(false);
          setIsMigrating(false);
        }, 700);
      }
      
      queryClient.invalidateQueries({ queryKey: ['spirit'] });
    },
    onError: () => {
      setIsDeparting(false);
      setIsMigrating(false);
    },
  });
  
  const setModeMutation = useMutation({
    mutationFn: async (mode: AvatarMode) => {
      const res = await apiRequest('POST', '/api/spirit/avatar/mode', { mode });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spirit', 'token'] });
    },
  });
  
  const updatePoseMutation = useMutation({
    mutationFn: async (pose: Partial<AvatarPose>) => {
      const res = await apiRequest('POST', '/api/spirit/avatar/pose', pose);
      return res.json();
    },
  });
  
  useEffect(() => {
    registerMutation.mutate();
    
    heartbeatRef.current = setInterval(() => {
      heartbeatMutation.mutate();
    }, 5000);
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, []);
  
  const migrateToDevice = useCallback((targetDeviceId: string) => {
    if (!isMigrating) {
      migrateMutation.mutate(targetDeviceId);
    }
  }, [isMigrating, migrateMutation]);
  
  const setMode = useCallback((mode: AvatarMode) => {
    setModeMutation.mutate(mode);
  }, [setModeMutation]);
  
  const updatePose = useCallback((pose: Partial<AvatarPose>) => {
    updatePoseMutation.mutate(pose);
  }, [updatePoseMutation]);
  
  const token = tokenData?.data as PresenceToken | undefined;
  const devices = (devicesData?.data || []) as DeviceInfo[];
  const status = statusData?.data;
  
  return {
    deviceId: deviceId.current,
    deviceType: deviceType.current,
    deviceName: deviceName.current,
    
    isActive,
    isMigrating,
    isDeparting,
    isArriving,
    arrivalPhrase,
    
    token,
    avatarPose: token?.avatarPose,
    devices,
    status,
    
    migrateToDevice,
    setMode,
    updatePose,
    refetchToken,
    
    isRegistering: registerMutation.isPending,
    isMigratingPending: migrateMutation.isPending,
  };
}

export default useSpiritSingleton;

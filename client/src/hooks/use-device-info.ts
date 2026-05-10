/**
 * 移动端检测 Hook
 * 
 * 提供响应式检测和设备信息
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isNative: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  supportsTouch: boolean;
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export function useDeviceInfo(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false,
    isNative: false,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    supportsTouch: false,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = window.devicePixelRatio || 1;
      
      // 检测触摸支持
      const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // 检测 iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // 检测 Android
      const isAndroid = /Android/.test(navigator.userAgent);
      
      // 检测 Capacitor 原生应用
      const isNative = typeof (window as any).Capacitor !== 'undefined';
      
      // 获取 Safe Area
      const style = window.getComputedStyle(document.documentElement);
      const safeAreaTop = parseInt(style.getPropertyValue('--sat') || '0') || 
        (isIOS ? 20 : 0);
      const safeAreaBottom = parseInt(style.getPropertyValue('--sab') || '0') || 
        (isIOS ? 34 : 0);

      setDeviceInfo({
        isMobile: width < MOBILE_BREAKPOINT,
        isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
        isDesktop: width >= TABLET_BREAKPOINT,
        isIOS,
        isAndroid,
        isNative,
        screenWidth: width,
        screenHeight: height,
        pixelRatio,
        supportsTouch,
        safeAreaInsets: {
          top: safeAreaTop,
          right: 0,
          bottom: safeAreaBottom,
          left: 0
        }
      });
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    
    // 监听方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(updateDeviceInfo, 100);
    });

    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  return deviceInfo;
}

/**
 * 检测是否为移动端（简化版）
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    checkMobile();
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener('change', checkMobile);
    
    return () => mql.removeEventListener('change', checkMobile);
  }, []);

  return isMobile;
}

/**
 * 检测是否为竖屏
 */
export function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return isPortrait;
}

/**
 * 检测网络状态
 */
export function useNetworkStatus(): 'online' | 'offline' {
  const [status, setStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    
    setStatus(navigator.onLine ? 'online' : 'offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}

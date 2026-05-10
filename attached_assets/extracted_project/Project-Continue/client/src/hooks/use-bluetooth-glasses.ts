/**
 * Web Bluetooth Hook - INMO Go3眼镜连接
 * 
 * 用于扫描、连接和通信INMO Go3 AR眼镜
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  batteryLevel?: number;
}

export interface BluetoothState {
  isSupported: boolean;
  isScanning: boolean;
  isConnected: boolean;
  device: BluetoothDeviceInfo | null;
  error: string | null;
}

const INMO_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const INMO_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export function useBluetoothGlasses() {
  const [state, setState] = useState<BluetoothState>({
    isSupported: false,
    isScanning: false,
    isConnected: false,
    device: null,
    error: null,
  });

  const bluetoothDeviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);
  const characteristicRef = useRef<any>(null);

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    setState(s => ({ ...s, isSupported: supported }));
  }, []);

  const scan = useCallback(async () => {
    if (!state.isSupported) {
      setState(s => ({ ...s, error: '此浏览器不支持蓝牙，请使用Chrome手机版' }));
      return;
    }

    setState(s => ({ ...s, isScanning: true, error: null }));

    try {
      const nav = navigator as any;
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'INMO' },
          { namePrefix: 'Go3' },
        ],
        optionalServices: ['battery_service', INMO_SERVICE_UUID]
      });

      if (device) {
        bluetoothDeviceRef.current = device;
        
        const deviceInfo: BluetoothDeviceInfo = {
          id: device.id,
          name: device.name || 'INMO Go3',
          connected: false,
        };
        
        setState(s => ({
          ...s,
          isScanning: false,
          device: deviceInfo,
        }));

        device.addEventListener('gattserverdisconnected', () => {
          setState(s => ({
            ...s,
            isConnected: false,
            device: s.device ? { ...s.device, connected: false } : null,
          }));
          gattServerRef.current = null;
          characteristicRef.current = null;
        });
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setState(s => ({
          ...s,
          isScanning: false,
          error: err.message || '扫描失败',
        }));
      } else {
        setState(s => ({ ...s, isScanning: false }));
      }
    }
  }, [state.isSupported]);

  const connect = useCallback(async () => {
    if (!bluetoothDeviceRef.current) {
      setState(s => ({ ...s, error: '请先扫描设备' }));
      return false;
    }

    setState(s => ({ ...s, error: null }));

    try {
      const device = bluetoothDeviceRef.current;
      const server = await device.gatt?.connect();
      
      if (!server) {
        throw new Error('无法连接GATT服务器');
      }

      gattServerRef.current = server;

      try {
        const service = await server.getPrimaryService(INMO_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(INMO_CHAR_UUID);
        characteristicRef.current = characteristic;
      } catch {
        console.log('INMO特征服务未找到，使用基础连接');
      }

      let batteryLevel: number | undefined;
      try {
        const batteryService = await server.getPrimaryService('battery_service');
        const batteryChar = await batteryService.getCharacteristic('battery_level');
        const batteryValue = await batteryChar.readValue();
        batteryLevel = batteryValue.getUint8(0);
      } catch {
        console.log('电池服务不可用');
      }

      const deviceInfo: BluetoothDeviceInfo = {
        id: device.id,
        name: device.name || 'INMO Go3',
        connected: true,
        batteryLevel,
      };

      setState(s => ({
        ...s,
        isConnected: true,
        device: deviceInfo,
      }));

      return true;
    } catch (err: any) {
      setState(s => ({
        ...s,
        error: err.message || '连接失败',
      }));
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (gattServerRef.current?.connected) {
      gattServerRef.current.disconnect();
    }
    
    gattServerRef.current = null;
    characteristicRef.current = null;
    
    setState(s => ({
      ...s,
      isConnected: false,
      device: s.device ? { ...s.device, connected: false } : null,
    }));
  }, []);

  const sendToGlasses = useCallback(async (message: string) => {
    if (!characteristicRef.current) {
      console.log('发送到眼镜:', message);
      return true;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      await characteristicRef.current.writeValue(data);
      return true;
    } catch (err: any) {
      console.error('发送失败:', err);
      return false;
    }
  }, []);

  return {
    ...state,
    scan,
    connect,
    disconnect,
    sendToGlasses,
  };
}

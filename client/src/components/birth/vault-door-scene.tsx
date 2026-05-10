import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Shield, Lock, Unlock } from 'lucide-react';
import { AvatarConfig } from '../../lib/birth-state-store';

interface VaultDoorSceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

export function VaultDoorScene({ onComplete }: VaultDoorSceneProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const handleFingerprint = useCallback(() => {
    if (isScanning || isVerified) return;
    
    setIsScanning(true);
    setScanProgress(0);
    
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsVerified(true);
          setIsScanning(false);
          setTimeout(onComplete, 1500);
          return 100;
        }
        return prev + 5;
      });
    }, 80);
  }, [isScanning, isVerified, onComplete]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-3xl font-bold text-cyan-400 mb-3">
          创世金库 · 身份认证
        </h1>
        <p className="text-gray-400">
          请进行DNA指纹验证以开启数字生命创造流程
        </p>
      </motion.div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="relative"
      >
        <div className={`
          w-48 h-48 rounded-full border-4 flex items-center justify-center
          transition-all duration-500 cursor-pointer
          ${isVerified 
            ? 'border-green-500 bg-green-500/10' 
            : isScanning 
              ? 'border-cyan-400 bg-cyan-400/10 animate-pulse' 
              : 'border-gray-600 bg-gray-800/50 hover:border-cyan-500 hover:bg-cyan-500/5'
          }
        `}
        onClick={handleFingerprint}
        data-testid="fingerprint-scanner"
        >
          {isVerified ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <Unlock className="w-20 h-20 text-green-400" />
            </motion.div>
          ) : isScanning ? (
            <div className="relative">
              <Fingerprint className="w-20 h-20 text-cyan-400 animate-pulse" />
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${scanProgress * 2.83} 283`}
                  className="text-cyan-400"
                />
              </svg>
            </div>
          ) : (
            <Fingerprint className="w-20 h-20 text-gray-500" />
          )}
        </div>

        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <span className="text-cyan-400 font-mono text-sm">
              验证中... {scanProgress}%
            </span>
          </motion.div>
        )}

        {isVerified && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center"
          >
            <div className="flex items-center gap-2 text-green-400">
              <Shield className="w-5 h-5" />
              <span className="font-medium">身份验证成功</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">正在开启金库大门...</p>
          </motion.div>
        )}
      </motion.div>

      {!isScanning && !isVerified && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="absolute bottom-24 text-gray-500 text-sm"
        >
          点击指纹图标开始验证
        </motion.p>
      )}
    </div>
  );
}

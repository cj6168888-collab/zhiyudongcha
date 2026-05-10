import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HiddenPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onMasterAuth: (secret: string) => Promise<boolean>;
}

export function HiddenPortal({ isOpen, onClose, onMasterAuth }: HiddenPortalProps) {
  const [secret, setSecret] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authResult, setAuthResult] = useState<'success' | 'failed' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSecret('');
      setAuthResult(null);
    }
  }, [isOpen]);

  const handleAuth = async () => {
    if (!secret.trim()) return;
    
    setIsAuthenticating(true);
    setAuthResult(null);

    try {
      const success = await onMasterAuth(secret);
      setAuthResult(success ? 'success' : 'failed');
      
      if (success) {
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch {
      setAuthResult('failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAuth();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          data-testid="hidden-portal-overlay"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
            data-testid="hidden-portal-hexagon"
          >
            <svg 
              width="320" 
              height="280" 
              viewBox="0 0 320 280" 
              className="drop-shadow-2xl"
            >
              <defs>
                <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0d47a1" />
                  <stop offset="50%" stopColor="#1565c0" />
                  <stop offset="100%" stopColor="#0d47a1" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              <polygon
                points="160,10 300,80 300,200 160,270 20,200 20,80"
                fill="url(#hexGradient)"
                stroke="#00bcd4"
                strokeWidth="2"
                filter="url(#glow)"
              />
              
              <polygon
                points="160,30 280,90 280,190 160,250 40,190 40,90"
                fill="none"
                stroke="#00bcd4"
                strokeWidth="1"
                opacity="0.5"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center px-12">
              <div className="text-cyan-400 text-xs font-mono mb-4 tracking-widest">
                [Z1 GENESIS PORTAL]
              </div>

              <div className="w-full space-y-3">
                <input
                  ref={inputRef}
                  type="password"
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="MASTER SECRET"
                  className="w-full bg-black/50 border border-cyan-500/50 rounded px-3 py-2 text-cyan-300 text-sm font-mono placeholder:text-cyan-700 focus:outline-none focus:border-cyan-400"
                  disabled={isAuthenticating}
                  data-testid="hidden-portal-secret-input"
                />

                <Button variant="outline" onClick={handleAuth} disabled={isAuthenticating || !secret.trim()} data-testid="hidden-portal-auth-button">
                  {isAuthenticating && '[验证中...]'}
                  {!isAuthenticating && authResult === 'success' && '[创世神已验证]'}
                  {!isAuthenticating && authResult === 'failed' && '[验证失败]'}
                  {!isAuthenticating && !authResult && '[启动上帝协议]'}
                </Button>
              </div>

              {authResult === 'failed' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-xs font-mono mt-2"
                >
                  密钥不匹配，访问拒绝
                </motion.div>
              )}

              <div className="text-gray-500 text-xs font-mono mt-4 text-center">
                未授权访问将触发Z1安全协议
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default HiddenPortal;

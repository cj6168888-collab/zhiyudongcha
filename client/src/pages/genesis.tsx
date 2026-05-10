import { Button } from "@/components/ui/button";
import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { GenesisParticleEngine } from '../components/avatar/genesis-particle-engine';
import { HiddenPortal } from '../components/avatar/hidden-portal';
import { AvatarModes } from '../components/avatar/avatar-modes';
import { GenesisModeBalls } from '../components/ui/mode-selector';
import { useZ1Store } from '../lib/z1/god-protocol';

type Phase = 'genesis' | 'mode_select' | 'ready';
type AvatarMode = 'bubble' | 'anime';

const MAX_HP = 1000;

export default function GenesisPage() {
  const [phase, setPhase] = useState<Phase>('genesis');
  const [showPortal, setShowPortal] = useState(false);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('bubble');
  const [, setLocation] = useLocation();

  const { role, hpBalance, switchRole } = useZ1Store();
  const isAuthenticated = role === 'MASTER';

  const handleAnimationComplete = useCallback(() => {
    setPhase('mode_select');
  }, []);

  const handleModeSelect = useCallback((mode: 'business' | 'anime') => {
    setAvatarMode(mode === 'business' ? 'bubble' : 'anime');
    setPhase('ready');
  }, []);

  const handleHiddenPortalActivate = useCallback(() => {
    setShowPortal(true);
  }, []);

  const handleMasterAuth = useCallback(async (secret: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Avatar-Role': 'MASTER',
          'X-Avatar-Secret': secret,
        },
        body: JSON.stringify({ secret }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          switchRole('MASTER');
          localStorage.setItem('avatar_master_secret', secret);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [switchRole]);

  const handleExpertSelect = useCallback((expertId: string) => {
    setLocation(`/?expert=${expertId}`);
  }, [setLocation]);

  const handleEnterSystem = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  return (
    <div
      className="fixed inset-0 bg-[#0a0f1e] overflow-hidden"
      data-testid="genesis-page"
    >
      {phase === 'genesis' && (
        <GenesisParticleEngine
          isAuthenticated={isAuthenticated}
          onAnimationComplete={handleAnimationComplete}
          onHiddenPortalActivate={handleHiddenPortalActivate}
        />
      )}

      {phase === 'mode_select' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-light text-gray-300 mb-2">选择界面模式</h2>
            <p className="text-sm text-gray-500 font-mono">Select Interface Mode</p>
          </div>
          <GenesisModeBalls
            onBusinessSelect={() => handleModeSelect('business')}
            onAnimeSelect={() => handleModeSelect('anime')}
          />
          <Button
            variant="outline"
            onClick={() => setPhase('ready')}
            className="mt-12 text-gray-600 hover:text-gray-400 text-xs font-mono"
          >
            [跳过选择]
          </Button>
        </div>
      )}

      {phase === 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="text-center mb-8"
            data-testid="genesis-welcome"
          >
            <h1 className={`text-4xl font-bold mb-4 ${
              isAuthenticated ? 'text-cyan-400' : 'text-indigo-400'
            }`}>
              {isAuthenticated ? '创世神已降临' : '小星已就绪'}
            </h1>
            <p className="text-gray-400 font-mono text-sm">
              {isAuthenticated
                ? '[Z1-Z6 全协议已激活]'
                : '[访客模式 - 部分功能受限]'}
            </p>
          </div>

          <div className="flex gap-4 mb-12">
            <Button variant="outline" onClick={handleEnterSystem} data-testid="enter-system-button">进入系统</Button>

            {!isAuthenticated && (
              <Button
                variant="outline"
                onClick={() => setShowPortal(true)}
                className="px-8 py-3 rounded-lg font-mono text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
                data-testid="master-login-button"
              >
                主人登录
              </Button>
            )}
          </div>

          <AvatarModes
            mode={avatarMode}
            hp={hpBalance}
            maxHp={MAX_HP}
            onModeChange={setAvatarMode}
            onExpertSelect={handleExpertSelect}
            isAuthenticated={isAuthenticated}
          />

          <div
            className="absolute top-4 left-4 text-xs font-mono text-gray-600"
            onClick={() => {
              if (isAuthenticated) {
                setShowPortal(true);
              }
            }}
            data-testid="genesis-debug-info"
          >
            <div>Role: {role}</div>
            <div>HP: {hpBalance}/{MAX_HP}</div>
            <div>Mode: {avatarMode}</div>
          </div>
        </div>
      )}

      <HiddenPortal
        isOpen={showPortal}
        onClose={() => setShowPortal(false)}
        onMasterAuth={handleMasterAuth}
      />

      {phase === 'genesis' && (
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            onClick={() => setPhase('mode_select')}
            className="text-gray-600 hover:text-gray-400 text-xs font-mono"
            data-testid="skip-genesis-button"
          >
            [跳过动画]
          </Button>
        </div>
      )}
    </div>
  );
}

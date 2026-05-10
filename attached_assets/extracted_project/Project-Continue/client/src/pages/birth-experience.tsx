import { useEffect, useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useBirthStore, getSceneIndex, getTotalScenes } from '../lib/birth-state-store';
import { VaultDoorScene } from '../components/birth/vault-door-scene';
import { LaboratoryScene } from '../components/birth/laboratory-scene';
import { GeneInfusionScene } from '../components/birth/gene-infusion-scene';
import { ModeTransferScene } from '../components/birth/mode-transfer-scene';

export default function BirthExperiencePage() {
  const [, setLocation] = useLocation();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { 
    currentScene, 
    nextScene, 
    prevScene,
    markSceneComplete,
    completeBirth,
    resetBirth,
    avatarConfig,
  } = useBirthStore();

  const sceneIndex = getSceneIndex(currentScene);
  const totalScenes = getTotalScenes();

  const handleResetClick = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    setShowResetConfirm(false);
    resetBirth();
  }, [resetBirth]);

  const handleCancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  const handleSceneComplete = useCallback(() => {
    markSceneComplete(currentScene);
    nextScene();
  }, [currentScene, markSceneComplete, nextScene]);

  const handleBirthComplete = useCallback(() => {
    completeBirth();
    setLocation('/');
  }, [completeBirth, setLocation]);

  const handleSkip = useCallback(() => {
    completeBirth();
    setLocation('/');
  }, [completeBirth, setLocation]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const renderScene = () => {
    const sceneProps = {
      onComplete: handleSceneComplete,
      avatarConfig,
    };

    switch (currentScene) {
      case 'vault_door':
        return <VaultDoorScene {...sceneProps} />;
      case 'laboratory':
        return <LaboratoryScene {...sceneProps} />;
      case 'gene_infusion':
        return <GeneInfusionScene {...sceneProps} />;
      case 'mode_transfer':
        return <ModeTransferScene onComplete={handleBirthComplete} avatarConfig={avatarConfig} />;
      default:
        return null;
    }
  };

  const getSceneHint = () => {
    switch (currentScene) {
      case 'vault_door':
        return '按下指纹认证DNA...';
      case 'laboratory':
        return '选择基因和形态...';
      case 'gene_infusion':
        return '等待基因注入完成...';
      case 'mode_transfer':
        return '选择界面模式...';
      default:
        return '';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-[#030712] overflow-hidden"
      data-testid="birth-experience-page"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-[#030712] to-[#0a0f1e]" />
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalScenes }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < sceneIndex
                  ? 'w-6 bg-cyan-400'
                  : i === sceneIndex
                  ? 'w-8 bg-cyan-500 animate-pulse'
                  : 'w-4 bg-gray-700'
              }`}
              data-testid={`progress-dot-${i}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-500 mt-2 font-mono">
          {sceneIndex + 1} / {totalScenes}
        </p>
      </div>

      <div className="absolute top-4 right-4 z-50 flex gap-3">
        <button
          onClick={handleResetClick}
          className="text-gray-600 hover:text-amber-400 text-xs font-mono transition-colors"
          data-testid="button-reset"
        >
          [重置]
        </button>
        <button
          onClick={handleSkip}
          className="text-gray-600 hover:text-gray-400 text-xs font-mono transition-colors"
          data-testid="button-skip"
        >
          [跳过]
        </button>
      </div>

      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="reset-confirm-modal"
          >
            <motion.div
              className="relative max-w-md mx-4 p-6 rounded-2xl border border-red-500/30 bg-gradient-to-b from-gray-900 to-gray-950"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                boxShadow: '0 0 60px rgba(239, 68, 68, 0.2), inset 0 0 30px rgba(239, 68, 68, 0.05)',
              }}
            >
              <div className="text-center mb-6">
                <motion.div
                  className="text-5xl mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ⚠️
                </motion.div>
                <h3 className="text-xl font-bold text-red-400 mb-2">请谨慎操作</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  确认以后小智将回归母体，<br/>
                  <span className="text-red-300">你所有的资料和小智的想法将全部消失，不可恢复！</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelReset}
                  className="flex-1 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                  data-testid="button-cancel-reset"
                >
                  取消
                </button>
                <motion.button
                  onClick={handleConfirmReset}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="button-confirm-reset"
                >
                  确认重置
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {sceneIndex > 0 && (
        <button
          onClick={prevScene}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all"
          data-testid="button-prev-scene"
        >
          ←
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {renderScene()}
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
        <p className="text-gray-600 text-xs font-mono animate-pulse">
          {getSceneHint()}
        </p>
      </div>
    </div>
  );
}

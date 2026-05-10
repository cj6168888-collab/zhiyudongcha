import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Dna, Sparkles, Zap } from 'lucide-react';
import { AvatarConfig, GENE_OPTIONS } from '../../lib/birth-state-store';

interface GeneInfusionSceneProps {
  onComplete: () => void;
  avatarConfig: AvatarConfig;
}

export function GeneInfusionScene({ onComplete, avatarConfig }: GeneInfusionSceneProps) {
  const [progress, setProgress] = useState(0);
  const [currentGeneIndex, setCurrentGeneIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const selectedGeneDetails = avatarConfig.selectedGenes.map(
    type => GENE_OPTIONS.find(g => g.type === type)!
  );

  useEffect(() => {
    const totalDuration = 4000;
    const interval = 50;
    const increment = 100 / (totalDuration / interval);

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setIsComplete(true);
          setTimeout(onComplete, 1500);
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  useEffect(() => {
    if (selectedGeneDetails.length > 1) {
      const geneInterval = 4000 / selectedGeneDetails.length;
      const timer = setInterval(() => {
        setCurrentGeneIndex(prev => 
          prev < selectedGeneDetails.length - 1 ? prev + 1 : prev
        );
      }, geneInterval);
      return () => clearInterval(timer);
    }
  }, [selectedGeneDetails.length]);

  const currentGene = selectedGeneDetails[currentGeneIndex];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-2xl font-bold text-cyan-400 mb-2">
          基因注入中
        </h1>
        <p className="text-gray-400 text-sm">
          正在将选定基因融合到数字生命核心...
        </p>
      </motion.div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="text-cyan-900"
            />
          </svg>
        </motion.div>

        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="8 8"
              className="text-cyan-800"
            />
          </svg>
        </motion.div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [0.9, 1.1, 0.9],
            opacity: 1
          }}
          transition={{ 
            scale: { duration: 2, repeat: Infinity },
            opacity: { duration: 0.5 }
          }}
          className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-600/30 flex items-center justify-center border border-cyan-500/50"
        >
          {isComplete ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            >
              <Sparkles className="w-16 h-16 text-cyan-400" />
            </motion.div>
          ) : (
            <Dna className="w-16 h-16 text-cyan-400 animate-pulse" />
          )}
        </motion.div>

        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0.5, 1.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
            style={{
              left: `${50 + 40 * Math.cos(i * Math.PI / 3)}%`,
              top: `${50 + 40 * Math.sin(i * Math.PI / 3)}%`,
            }}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
          </motion.div>
        ))}
      </div>

      <div className="mt-8 w-64">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>进度</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentGene && (
        <motion.div
          key={currentGene.type}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-center"
        >
          <span className="text-3xl">{currentGene.emoji}</span>
          <p className="text-cyan-400 font-medium mt-2">{currentGene.name}</p>
          <p className="text-gray-500 text-sm">{currentGene.desc}</p>
        </motion.div>
      )}

      {isComplete && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-green-400 font-medium"
        >
          基因注入完成！
        </motion.p>
      )}
    </div>
  );
}

/**
 * Test Audio Analyzer - 测试音频分析器功能
 */

import { useAudioAnalyzer } from '@/hooks/use-audio-analyzer';

export function TestAudioAnalyzer() {
  const {
    isRecording,
    isAnalyzing,
    duration,
    progress,
    energy,
    peak,
    result,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  } = useAudioAnalyzer(
    (analysisResult) => {
      console.log('🎵 音频分析完成:', analysisResult);
      
      // 检查是否有明显的人声特征
      const hasHumanVoice = 
        analysisResult.energy > 0.01 && // 足够的能量
        analysisResult.duration > 2.0 && // 足够的时长
        analysisResult.dominantFrequency > 80 && // 主频率在人声范围内
        analysisResult.dominantFrequency < 4000;
      
      if (hasHumanVoice) {
        console.log('✅ 检测到人声特征，适合声纹录入');
      } else {
        console.log('❌ 未检测到清晰人声，请重新录制');
      }
    },
    (currentDuration, currentEnergy, currentPeak) => {
      console.log(
        `🎙️ 实时分析: 时长 ${currentDuration.toFixed(1)}s, ` +
        `能量 ${(currentEnergy * 100).toFixed(1)}%, ` +
        `峰值 ${(currentPeak * 100).toFixed(1)}%`
      );
    }
  );

  const handleTest = async () => {
    if (isRecording) {
      console.log('⏹️ 停止录音');
      await stopRecording();
    } else {
      console.log('🎤 开始录音分析测试');
      reset();
      await startRecording({
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    }
  };

  return {
    isRecording,
    isAnalyzing,
    duration,
    progress,
    energy,
    peak,
    result,
    error,
    handleTest,
    cancelRecording,
  };
}

// 导出测试函数
export const testAudioAnalyzer = () => {
  console.log('🧪 开始测试音频分析器...');
  
  // 模拟音频数据
  const mockAudioData = new Float32Array(16000 * 3); // 3秒音频
  for (let i = 0; i < mockAudioData.length; i++) {
    // 生成模拟人声信号（基频 + 谐波）
    mockAudioData[i] = 
      0.3 * Math.sin(2 * Math.PI * 200 * i / 16000) + // 基频200Hz
      0.15 * Math.sin(2 * Math.PI * 400 * i / 16000) + // 2次谐波
      0.1 * Math.sin(2 * Math.PI * 600 * i / 16000) + // 3次谐波
      0.05 * Math.random() * 2 - 0.05; // 添加少量噪声
  }

  console.log('📊 模拟音频数据生成完成');
  console.log('✅ 音频分析器测试准备就绪');
  
  return mockAudioData;
};
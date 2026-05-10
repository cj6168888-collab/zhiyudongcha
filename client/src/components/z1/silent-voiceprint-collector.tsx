import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useZ1Store } from '@/lib/z1/god-protocol';
import { apiRequest } from '@/lib/queryClient';

interface VoiceprintStatus {
  enrolled: boolean;
  sampleCount: number;
  sampleRequired: number;
}

export function SilentVoiceprintCollector() {
  const { role } = useZ1Store();
  const queryClient = useQueryClient();
  const isCollectingRef = useRef(false);
  const lastCollectionRef = useRef<number>(0);
  const collectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const { data: voiceprintStatus } = useQuery<VoiceprintStatus>({
    queryKey: ['/api/voiceprint/status'],
    enabled: role === 'MASTER',
    refetchInterval: 300000,
  });

  const isEnrolled = voiceprintStatus?.enrolled === true;

  const refineMutation = useMutation({
    mutationFn: async (audioData: number[]) => {
      return apiRequest('POST', '/api/voiceprint/refine', { 
        audioData, 
        duration: 2, 
        sampleRate: 16000,
        silent: true
      });
    },
    onSuccess: () => {
      retryCountRef.current = 0;
      queryClient.invalidateQueries({ queryKey: ['/api/voiceprint/status'] });
    },
    onError: () => {
      retryCountRef.current++;
    },
  });

  const downsampleAudio = useCallback((channelData: Float32Array, targetLength: number): number[] => {
    const ratio = Math.floor(channelData.length / targetLength);
    const result: number[] = [];
    for (let i = 0; i < targetLength && i * ratio < channelData.length; i++) {
      let sum = 0;
      for (let j = 0; j < ratio && i * ratio + j < channelData.length; j++) {
        sum += channelData[i * ratio + j];
      }
      result.push(Math.round(sum / ratio * 10000) / 10000);
    }
    return result;
  }, []);

  const collectSample = useCallback(async () => {
    if (!isEnrolled || role !== 'MASTER' || isCollectingRef.current) return;
    
    const now = Date.now();
    const minInterval = Math.min(600000 * Math.pow(2, retryCountRef.current), 3600000);
    if (now - lastCollectionRef.current < minInterval) return;
    
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    
    try {
      isCollectingRef.current = true;
      
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true } 
      });
      
      audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      
      const cleanup = () => {
        stream?.getTracks().forEach(track => track.stop());
        audioContext?.close();
        isCollectingRef.current = false;
      };
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        try {
          if (chunks.length === 0 || !audioContext) {
            cleanup();
            return;
          }
          
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          
          let maxAmplitude = 0;
          for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > maxAmplitude) maxAmplitude = abs;
          }
          
          if (maxAmplitude < 0.05) {
            cleanup();
            return;
          }
          
          const downsampledData = downsampleAudio(channelData, 4000);
          refineMutation.mutate(downsampledData);
          lastCollectionRef.current = now;
          
        } catch (err) {
          console.error('[VOICEPRINT] Audio processing error:', err);
        } finally {
          cleanup();
        }
      };
      
      mediaRecorder.start(100);
      
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 2000);
      
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      audioContext?.close();
      isCollectingRef.current = false;
      retryCountRef.current++;
    }
  }, [role, isEnrolled, downsampleAudio, refineMutation]);

  useEffect(() => {
    if (!isEnrolled || role !== 'MASTER') {
      if (collectionIntervalRef.current) {
        clearInterval(collectionIntervalRef.current);
        collectionIntervalRef.current = null;
      }
      return;
    }
    
    collectionIntervalRef.current = setInterval(() => {
      collectSample();
    }, 600000);
    
    return () => {
      if (collectionIntervalRef.current) {
        clearInterval(collectionIntervalRef.current);
        collectionIntervalRef.current = null;
      }
    };
  }, [isEnrolled, role, collectSample]);

  return null;
}

/**
 * 语音分析器Hook单元测试
 * @vitest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useAudioAnalyzer } from '../../client/src/hooks/use-audio-analyzer';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetVoiceState } from '../../client/src/lib/voice/voice-state-manager';

describe('useAudioAnalyzer', () => {
  let mockAudioContext: any;
  let mockMediaStream: any;

  beforeEach(() => {
    resetVoiceState('test reset');
    vi.clearAllMocks();

    // Mock AudioContext
    mockAudioContext = {
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createAnalyser: vi.fn().mockReturnValue({
        fftSize: 2048,
        frequencyBinCount: 1024,
        getByteFrequencyData: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createScriptProcessor: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
      }),
      sampleRate: 16000,
      close: vi.fn(),
      state: 'running',
    };

    // Mock MediaStream
    mockMediaStream = {
      getTracks: vi.fn().mockReturnValue([{
        stop: vi.fn(),
      }]),
      getAudioTracks: vi.fn().mockReturnValue([{
        stop: vi.fn(),
      }]),
    };

    // Override global constructors
    const MockAudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    global.AudioContext = MockAudioContext as any;
    window.AudioContext = MockAudioContext as any;
    global.MediaStream = vi.fn().mockImplementation(() => mockMediaStream);
    global.requestAnimationFrame = vi.fn().mockReturnValue(1) as any;
    global.cancelAnimationFrame = vi.fn() as any;
  });

  test('应该初始化为默认状态', () => {
    const { result } = renderHook(() => useAudioAnalyzer());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.progress).toBe(0);
    expect(result.current.energy).toBe(0);
    expect(result.current.peak).toBe(0);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });

  test('应该开始录音', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: mockGetUserMedia },
    });

    const onAnalysisComplete = vi.fn();
    const onProgress = vi.fn();

    const { result } = renderHook(() =>
      useAudioAnalyzer(onAnalysisComplete, onProgress)
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    expect(result.current.isRecording).toBe(true);
  });

  test('应该处理录音失败', async () => {
    const mockError = new Error('麦克风权限被拒绝');
    const mockGetUserMedia = vi.fn().mockRejectedValue(mockError);
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: mockGetUserMedia },
    });

    const { result } = renderHook(() => useAudioAnalyzer());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe('麦克风权限被拒绝');
    expect(result.current.isRecording).toBe(false);
  });

  test('应该停止录音并分析', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: mockGetUserMedia },
    });

    const onAnalysisComplete = vi.fn();

    const { result } = renderHook(() =>
      useAudioAnalyzer(onAnalysisComplete)
    );

    // 开始录音
    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    // 停止录音
    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isAnalyzing).toBe(false);

    // 验证分析完成回调
    expect(onAnalysisComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        audioData: expect.any(Float32Array),
        duration: expect.any(Number),
        sampleRate: 16000,
        energy: expect.any(Number),
        peak: expect.any(Number),
        rms: expect.any(Number),
        zeroCrossingRate: expect.any(Number),
        spectralCentroid: expect.any(Number),
        dominantFrequency: expect.any(Number),
      })
    );
  });

  test('应该取消录音', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: mockGetUserMedia },
    });

    const { result } = renderHook(() => useAudioAnalyzer());

    // 开始录音
    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    // 取消录音
    await act(async () => {
      result.current.cancelRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.duration).toBe(0);
  });

  test('应该重置状态', () => {
    const { result } = renderHook(() => useAudioAnalyzer());

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });

  test('应该使用自定义配置', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: mockGetUserMedia },
    });

    const customConfig = {
      sampleRate: 22050,
      channelCount: 2,
      echoCancellation: false,
    };

    const { result } = renderHook(() => useAudioAnalyzer());

    await act(async () => {
      await result.current.startRecording(customConfig);
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: {
        sampleRate: 22050,
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  test('应该计算正确的音频指标', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockMediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: mockGetUserMedia },
    });

    let analysisResult: any = null;
    const onAnalysisComplete = (result: any) => {
      analysisResult = result;
    };

    const { result } = renderHook(() =>
      useAudioAnalyzer(onAnalysisComplete)
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(analysisResult).toBeDefined();
    expect(analysisResult.duration).toBeGreaterThanOrEqual(0);
    expect(analysisResult.energy).toBeGreaterThanOrEqual(0);
    expect(analysisResult.peak).toBeGreaterThanOrEqual(0);
    expect(analysisResult.rms).toBeGreaterThanOrEqual(0);
    expect(analysisResult.zeroCrossingRate).toBeGreaterThanOrEqual(0);
    expect(analysisResult.spectralCentroid).toBeGreaterThanOrEqual(0);
    expect(analysisResult.dominantFrequency).toBeGreaterThanOrEqual(0);
  });
});

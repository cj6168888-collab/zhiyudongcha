/**
 * 语音组件单元测试
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RealtimeVoiceWidget } from '../client/src/components/dashboard/widgets/realtime-voice-widget';

// Mock useRealtimeVoice hook
jest.mock('../client/src/hooks/use-realtime-voice', () => ({
  useRealtimeVoice: jest.fn().mockImplementation((onAssistantResponse, onTranscript) => ({
    state: 'idle',
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    startListening: jest.fn(),
    stopListening: jest.fn(),
    interrupt: jest.fn(),
    sendTextMessage: jest.fn(),
  })),
}));

// Mock useZ1Store
jest.mock('../client/src/lib/z1/god-protocol', () => ({
  useZ1Store: jest.fn().mockImplementation((selector) => selector({ role: 'GUEST' })),
}));

describe('RealtimeVoiceWidget', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该正确渲染初始状态', () => {
    render(<RealtimeVoiceWidget />);
    
    expect(screen.getByText('实时语音')).toBeInTheDocument();
    expect(screen.getByText('与小智实时对话')).toBeInTheDocument();
    expect(screen.getByText('未连接')).toBeInTheDocument();
    expect(screen.getByText('连接语音服务')).toBeInTheDocument();
  });

  test('应该显示连接后的状态', async () => {
    const mockConnect = jest.fn();
    jest.mocked(require('../client/src/hooks/use-realtime-voice').useRealtimeVoice).mockImplementation(() => ({
      state: 'idle',
      isConnected: true,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      interimTranscript: '',
      error: null,
      connect: mockConnect,
      disconnect: jest.fn(),
      startListening: jest.fn(),
      stopListening: jest.fn(),
      interrupt: jest.fn(),
      sendTextMessage: jest.fn(),
    }));

    render(<RealtimeVoiceWidget />);
    
    expect(screen.getByText('就绪')).toBeInTheDocument();
    expect(screen.getByText('断开连接')).toBeInTheDocument();
  });

  test('应该处理连接按钮点击', async () => {
    const mockConnect = jest.fn();
    jest.mocked(require('../client/src/hooks/use-realtime-voice').useRealtimeVoice).mockImplementation(() => ({
      state: 'disconnected',
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      interimTranscript: '',
      error: null,
      connect: mockConnect,
      disconnect: jest.fn(),
      startListening: jest.fn(),
      stopListening: jest.fn(),
      interrupt: jest.fn(),
      sendTextMessage: jest.fn(),
    }));

    render(<RealtimeVoiceWidget />);
    
    const connectButton = screen.getByText('连接语音服务');
    await user.click(connectButton);
    
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  test('应该处理语音录制开始', async () => {
    const mockStartListening = jest.fn();
    jest.mocked(require('../client/src/hooks/use-realtime-voice').useRealtimeVoice).mockImplementation(() => ({
      state: 'listening',
      isConnected: true,
      isListening: true,
      isSpeaking: false,
      transcript: '',
      interimTranscript: '正在测试',
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      startListening: mockStartListening,
      stopListening: jest.fn(),
      interrupt: jest.fn(),
      sendTextMessage: jest.fn(),
    }));

    render(<RealtimeVoiceWidget />);
    
    expect(screen.getByText('监听中')).toBeInTheDocument();
    expect(screen.getByText('正在测试')).toBeInTheDocument();
  });

  test('应该显示用户和AI对话', async () => {
    let onTranscript: (text: string, isFinal: boolean) => void;
    let onAssistantResponse: (text: string) => void;

    jest.mocked(require('../client/src/hooks/use-realtime-voice').useRealtimeVoice).mockImplementation((callback1, callback2) => {
      onAssistantResponse = callback1;
      onTranscript = callback2;
      return {
        state: 'processing',
        isConnected: true,
        isListening: false,
        isSpeaking: false,
        transcript: '你好小智',
        interimTranscript: '',
        error: null,
        connect: jest.fn(),
        disconnect: jest.fn(),
        startListening: jest.fn(),
        stopListening: jest.fn(),
        interrupt: jest.fn(),
        sendTextMessage: jest.fn(),
      };
    });

    render(<RealtimeVoiceWidget />);
    
    // 触发转录回调
    onTranscript('你好小智', true);
    onAssistantResponse('你好爸爸，有什么可以帮助你的吗？');
    
    await waitFor(() => {
      expect(screen.getByText('你说:')).toBeInTheDocument();
      expect(screen.getByText('你好小智')).toBeInTheDocument();
      expect(screen.getByText('小智:')).toBeInTheDocument();
      expect(screen.getByText('你好爸爸，有什么可以帮助你的吗？')).toBeInTheDocument();
    });
  });

  test('应该处理错误状态', () => {
    jest.mocked(require('../client/src/hooks/use-realtime-voice').useRealtimeVoice).mockImplementation(() => ({
      state: 'error',
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      interimTranscript: '',
      error: '麦克风权限被拒绝',
      connect: jest.fn(),
      disconnect: jest.fn(),
      startListening: jest.fn(),
      stopListening: jest.fn(),
      interrupt: jest.fn(),
      sendTextMessage: jest.fn(),
    }));

    render(<RealtimeVoiceWidget />);
    
    expect(screen.getByText('错误')).toBeInTheDocument();
    expect(screen.getByText('麦克风权限被拒绝')).toBeInTheDocument();
  });

  test('应该支持发送测试消息', async () => {
    const mockSendTextMessage = jest.fn();
    jest.mocked(require('../client/src/hooks/use-realtime-voice').useRealtimeVoice).mockImplementation(() => ({
      state: 'idle',
      isConnected: true,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      interimTranscript: '',
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      startListening: jest.fn(),
      stopListening: jest.fn(),
      interrupt: jest.fn(),
      sendTextMessage: mockSendTextMessage,
    }));

    render(<RealtimeVoiceWidget />);
    
    const testButton = screen.getByText('发送测试消息');
    await user.click(testButton);
    
    expect(mockSendTextMessage).toHaveBeenCalledWith('你好小智，我是爸爸');
  });
});
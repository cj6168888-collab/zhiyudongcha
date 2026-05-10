/**
 * Realtime Voice Component - 实时语音对话组件
 *
 * 专门用于与AI进行实时语音对话，与录音分析功能完全分离
 * 修复了自言自语问题：系统不会把自己的声音当作用户输入
 */

import { useState, useCallback } from 'react';
import { useRealtimeVoice } from '@/hooks/use-realtime-voice';
import { Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useZ1Store } from '@/lib/z1/god-protocol';
import { MicrophonePermissionGuide } from '@/components/permission/MicrophonePermissionGuide';
import { voiceStateManager } from '@/lib/voice/voice-state-manager';

export function RealtimeVoiceWidget() {
  const role = useZ1Store((state) => state.role);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const {
    state,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    interimTranscript,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    interrupt,
    sendTextMessage,
  } = useRealtimeVoice(
    // AI回应处理
    (responseText) => {
      setLastResponse(responseText);
    },
    // 语音识别处理
    (text, isFinal) => {
      if (isFinal) {
        setLastTranscript(text);
      }
    },
    {
      userId: role || 'GUEST',
      voiceId: 'longhuhu_v3',
      autoConnect: false,
      autoReconnect: true,
    }
  );

  const getStateBadge = () => {
    switch (state) {
      case 'disconnected':
        return <Badge variant="outline" className="text-red-400">未连接</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="text-yellow-400">连接中</Badge>;
      case 'idle':
        return <Badge variant="outline" className="text-green-400">就绪</Badge>;
      case 'listening':
        return <Badge variant="outline" className="text-blue-400 animate-pulse">监听中</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-orange-400">处理中</Badge>;
      case 'speaking':
        return <Badge variant="outline" className="text-purple-400 animate-pulse">说话中</Badge>;
      case 'interrupted':
        return <Badge variant="outline" className="text-gray-400">已打断</Badge>;
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });

        if (result.state === 'denied') {
          setPermissionError('denied');
          return;
        }

        setPermissionError(null);
        voiceStateManager.transition('START_LISTENING', '用户开始对话');
        startListening();
      } catch {
        startListening();
      }
    }
  }, [isListening, stopListening, startListening]);

  const handleTestMessage = () => {
    sendTextMessage('你好小星，我是爸爸');
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {isConnected ? <Wifi className="h-5 w-5 text-primary" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <CardTitle className="text-lg">实时语音</CardTitle>
              <CardDescription className="text-xs">与小星实时对话</CardDescription>
            </div>
          </div>
          {getStateBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 连接状态 */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleConnect}
            variant={isConnected ? "outline" : "default"}
            size="sm"
            className="flex-1"
          >
            {isConnected ? (
              <>
                <WifiOff className="h-4 w-4 mr-2" />
                断开连接
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                连接语音服务
              </>
            )}
          </Button>
        </div>

        {/* 语音控制 */}
        {isConnected && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleListening}
                variant={isListening ? "destructive" : "default"}
                size="sm"
                className="flex-1"
                disabled={state === 'processing' || state === 'speaking'}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    停止监听
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    开始对话
                  </>
                )}
              </Button>

              {(state === 'speaking' || state === 'processing') && (
                <Button
                  onClick={interrupt}
                  variant="outline"
                  size="sm"
                >
                  <VolumeX className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* 实时转录显示 */}
            <div className="space-y-2">
              {interimTranscript && (
                <div className="text-sm text-muted-foreground italic">
                  识别中: {interimTranscript}
                </div>
              )}

              {lastTranscript && (
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="text-xs text-blue-400 mb-1">你说:</div>
                  <div className="text-sm">{lastTranscript}</div>
                </div>
              )}

              {lastResponse && (
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="text-xs text-purple-400 mb-1">小星:</div>
                  <div className="text-sm">{lastResponse}</div>
                </div>
              )}
            </div>

            {/* 测试消息 */}
            <div className="pt-2 border-t border-border/50">
              <Button
                onClick={handleTestMessage}
                variant="outline"
                size="sm"
                className="w-full"
              >
                发送测试消息
              </Button>
            </div>
          </div>
        )}

        {/* 麦克风权限引导 */}
        {permissionError === 'denied' && (
          <MicrophonePermissionGuide
            onRetry={() => setPermissionError(null)}
            onOpenSettings={() => {
              window.open('chrome://settings/contentExceptions#media', '_blank');
            }}
          />
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="text-xs text-destructive">{error}</div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>• 点击"连接语音服务"建立连接</div>
          <div>• 点击"开始对话"与小星语音聊天</div>
          <div>• 小星不会听到自己的声音</div>
          <div>• 可以随时打断小星说话</div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 离线优先聊天示例页面
 * 演示如何使用 useChat Hook 和同步功能
 */

import { useState } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, CloudOff, Wifi, WifiOff, RefreshCw, Trash2, Cpu, Volume2 } from 'lucide-react';

interface ChatDemoProps {
  userId?: string;
  sessionId?: string;
}

export function ChatDemo({ userId = 'demo-user', sessionId = 'demo-session' }: ChatDemoProps) {
  const {
    messages,
    isLoading,
    networkStatus,
    config,
    sendMessage,
    clearHistory,
    updateConfig,
    suggestedModels,
    lastResponseTier,
    engineMode,
    ttsAvailable,
  } = useChat({
    userId,
    sessionId,
    initialConfig: {
      mode: 'AUTO',
      primaryModel: 'deepseek-chat',
    },
    onMessage: () => {},
    onError: () => {},
  });

  const [inputValue, setInputValue] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    await sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getNetworkIcon = () => {
    switch (networkStatus) {
      case 'ONLINE':
        return <Cloud className="w-4 h-4 text-green-500" />;
      case 'OFFLINE':
        return <CloudOff className="w-4 h-4 text-red-500" />;
      case 'UNSTABLE':
        return <Wifi className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getNetworkLabel = () => {
    switch (networkStatus) {
      case 'ONLINE':
        return '在线';
      case 'OFFLINE':
        return '离线';
      case 'UNSTABLE':
        return '不稳定';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">小星聊天 Demo</h1>
        <div className="flex items-center gap-2">
          {ttsAvailable && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Volume2 className="w-3 h-3" />
              TTS
            </Badge>
          )}
          {engineMode !== 'IDLE' && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Cpu className="w-3 h-3" />
              {engineMode}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            Tier {lastResponseTier}
          </Badge>
          {getNetworkIcon()}
          <span className="text-sm text-muted-foreground">
            {getNetworkLabel()}
          </span>
        </div>
      </div>

      {/* Network Status Alert */}
      {networkStatus === 'OFFLINE' && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            您当前处于离线状态，消息将在网络恢复后自动同步
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <Card className="h-[400px] overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>对话历史 ({messages.length} 条消息)</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearHistory()}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                清空
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                配置
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-60px)] overflow-y-auto space-y-3 pt-2">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              开始发送消息来体验聊天功能
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <div className="flex items-center justify-end gap-2 mt-1 flex-wrap">
                    {message.role === 'assistant' && message.modelUsed && (
                      <Badge variant="outline" className="text-[9px] opacity-60">
                        {message.modelUsed}
                      </Badge>
                    )}
                    <span className="text-xs opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    {message.syncStatus && (
                      <Badge
                        variant={
                          message.syncStatus === 'SYNCED'
                            ? 'default'
                            : message.syncStatus === 'PENDING'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {message.syncStatus === 'SYNCED'
                          ? '已同步'
                          : message.syncStatus === 'PENDING'
                          ? '待同步'
                          : '同步中'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Config Panel */}
      {showConfig && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">聊天配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="运行模式" className="text-sm">运行模式</label>
              <div className="flex gap-2 mt-1">
                {['SINGLE', 'ENSEMBLE', 'AUTO'].map((mode) => (
                  <Button
                    key={mode}
                    variant={config.mode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateConfig({ mode: mode as any })}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="主要模型" className="text-sm">主要模型</label>
              <select
                value={config.primaryModel}
                onChange={(e) => updateConfig({ primaryModel: e.target.value })}
                className="w-full mt-1 p-2 border rounded"
              >
                {suggestedModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
          {isLoading ? '发送中...' : '发送'}
        </Button>
      </div>

      {/* Tips */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 提示：</p>
        <ul className="list-disc list-inside space-y-1">
          <li>网络恢复后，离线消息将自动同步</li>
          <li>可以切换运行模式来测试不同的模型策略</li>
          <li>消息状态显示是否已同步到服务器</li>
        </ul>
      </div>
    </div>
  );
}

export default ChatDemo;

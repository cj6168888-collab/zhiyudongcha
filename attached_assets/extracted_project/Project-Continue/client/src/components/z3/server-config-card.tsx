import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Server, Wifi, WifiOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import {
  getServerConfig,
  saveServerConfig,
  isNativeApp,
  type ServerConfig,
} from '@/lib/server-config';

export function ServerConfigCard() {
  const [config, setConfig] = useState<ServerConfig>(getServerConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(getServerConfig());
  }, []);

  const handleTest = async () => {
    if (!config.serverUrl) return;

    setTesting(true);
    setTestResult(null);

    try {
      let url = config.serverUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      setTestResult(response.ok ? 'success' : 'error');
    } catch (e) {
      console.error('[ServerConfig] Test failed:', e);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveServerConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (updates: Partial<ServerConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setTestResult(null);
    setSaved(false);
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800" data-testid="card-server-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5 text-amber-400" />
          云端服务器
          {isNativeApp() && (
            <Badge variant="secondary" className="ml-2 text-xs">
              App 模式
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          配置小智云端服务器地址，用于完整功能和数据同步
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="serverUrl">服务器地址</Label>
          <div className="flex gap-2">
            <Input
              id="serverUrl"
              placeholder="your-app.replit.app"
              value={config.serverUrl}
              onChange={(e) => handleChange({ serverUrl: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
              data-testid="input-server-url"
            />
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!config.serverUrl || testing}
              className="min-w-[80px]"
              data-testid="button-test-connection"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '测试'
              )}
            </Button>
          </div>
          
          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${
              testResult === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {testResult === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  连接成功
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  连接失败，请检查地址
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2">
              {config.useLocalModel ? (
                <WifiOff className="w-4 h-4 text-zinc-400" />
              ) : (
                <Wifi className="w-4 h-4 text-amber-400" />
              )}
              优先使用本地模型
            </Label>
            <p className="text-xs text-zinc-500">
              开启后对话优先使用设备本地 AI 模型
            </p>
          </div>
          <Switch
            checked={config.useLocalModel}
            onCheckedChange={(checked) => handleChange({ useLocalModel: checked })}
            data-testid="switch-use-local-model"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label>自动连接</Label>
            <p className="text-xs text-zinc-500">
              启动时自动连接服务器
            </p>
          </div>
          <Switch
            checked={config.autoConnect}
            onCheckedChange={(checked) => handleChange({ autoConnect: checked })}
            data-testid="switch-auto-connect"
          />
        </div>

        <Button
          onClick={handleSave}
          className="w-full"
          disabled={saved}
          data-testid="button-save-server-config"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              已保存
            </>
          ) : (
            '保存设置'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

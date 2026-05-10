import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Server, Wifi, WifiOff, Check, AlertCircle } from 'lucide-react';
import {
  getServerConfig,
  saveServerConfig,
  isNativeApp,
  type ServerConfig,
} from '@/lib/server-config';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured?: () => void;
}

export function ServerConfigDialog({ open, onOpenChange, onConfigured }: Props) {
  const [config, setConfig] = useState<ServerConfig>(getServerConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (open) {
      setConfig(getServerConfig());
      setTestResult(null);
    }
  }, [open]);

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

      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch (e) {
      console.error('[ServerConfig] Test failed:', e);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveServerConfig(config);
    onOpenChange(false);
    onConfigured?.();
  };

  if (!isNativeApp()) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800" data-testid="dialog-server-config">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400" />
            服务器设置
          </DialogTitle>
          <DialogDescription>
            配置小星云端服务器地址，连接后可使用完整功能
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="serverUrl">服务器地址</Label>
            <div className="flex gap-2">
              <Input
                id="serverUrl"
                placeholder="your-app.replit.app"
                value={config.serverUrl}
                onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
                data-testid="input-server-url"
              />
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={!config.serverUrl || testing}
                data-testid="button-test-connection"
              >
                {testing ? '测试中...' : '测试'}
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

            <p className="text-xs text-zinc-500">
              输入你的 Replit 部署地址，例如：xiaozhi-avatar.replit.app
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>优先使用本地模型</Label>
              <p className="text-xs text-zinc-500">
                开启后，对话将优先使用本地 AI 模型
              </p>
            </div>
            <Switch
              checked={config.useLocalModel}
              onCheckedChange={(checked) => setConfig({ ...config, useLocalModel: checked })}
              data-testid="switch-use-local-model"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>自动连接</Label>
              <p className="text-xs text-zinc-500">
                启动时自动连接服务器
              </p>
            </div>
            <Switch
              checked={config.autoConnect}
              onCheckedChange={(checked) => setConfig({ ...config, autoConnect: checked })}
              data-testid="switch-auto-connect"
            />
          </div>

          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
            <h4 className="text-sm font-medium mb-2">功能对比</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex items-center gap-1 text-zinc-400 mb-1">
                  <WifiOff className="w-3 h-3" />
                  离线模式
                </div>
                <ul className="space-y-1 text-zinc-500">
                  <li>✓ 基础对话</li>
                  <li>✗ 图像理解</li>
                  <li>✗ 知识库搜索</li>
                  <li>✗ 情感记忆同步</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-1">
                  <Wifi className="w-3 h-3" />
                  在线模式
                </div>
                <ul className="space-y-1 text-zinc-400">
                  <li>✓ 完整对话能力</li>
                  <li>✓ 图像理解</li>
                  <li>✓ 知识库搜索</li>
                  <li>✓ 情感记忆同步</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} data-testid="button-save-config">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

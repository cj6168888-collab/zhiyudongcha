import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Check, Trash2, Cpu, Wifi, WifiOff, HardDrive } from 'lucide-react';
import { localLLM, SUPPORTED_MODELS, type ModelInfo } from '@/lib/local-llm';
import { useTranslation } from 'react-i18next';

interface ModelStatus {
  downloaded: boolean;
  loaded: boolean;
  downloading: boolean;
  progress: number;
}

export function LocalModelManager() {
  const { t } = useTranslation();
  const [isNative, setIsNative] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>({});
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    setIsNative(localLLM.isAvailable());
    checkAllModels();
  }, []);

  const checkAllModels = async () => {
    const statuses: Record<string, ModelStatus> = {};
    for (const model of SUPPORTED_MODELS) {
      const exists = await localLLM.checkModelExists(model.name);
      statuses[model.name] = {
        downloaded: exists,
        loaded: false,
        downloading: false,
        progress: 0,
      };
    }
    setModelStatuses(statuses);
  };

  const handleDownload = async (model: ModelInfo) => {
    setModelStatuses(prev => ({
      ...prev,
      [model.name]: { ...prev[model.name], downloading: true, progress: 0 },
    }));

    const success = await localLLM.downloadModel(model, (progress) => {
      setModelStatuses(prev => ({
        ...prev,
        [model.name]: { ...prev[model.name], progress },
      }));
    });

    setModelStatuses(prev => ({
      ...prev,
      [model.name]: {
        ...prev[model.name],
        downloading: false,
        downloaded: success,
        progress: success ? 100 : 0,
      },
    }));
  };

  const handleLoad = async (modelName: string) => {
    const success = await localLLM.loadModel(modelName);
    if (success) {
      setModelStatuses(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], loaded: key === modelName };
        });
        return updated;
      });
    }
  };

  const handleUnload = async () => {
    await localLLM.unloadModel();
    setModelStatuses(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        updated[key] = { ...updated[key], loaded: false };
      });
      return updated;
    });
  };

  const toggleOfflineMode = () => {
    setOfflineMode(!offlineMode);
    localStorage.setItem('xiaozhi_offline_mode', (!offlineMode).toString());
  };

  if (!isNative) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800" data-testid="card-local-model-web">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            本地模型
          </CardTitle>
          <CardDescription>
            本地 AI 模型仅在 Android App 中可用。
            请下载 APK 安装后使用离线功能。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800" data-testid="card-local-model-manager">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            本地模型管理
          </span>
          <Button
            variant={offlineMode ? 'default' : 'outline'}
            size="sm"
            onClick={toggleOfflineMode}
            className="gap-2"
            data-testid="button-toggle-offline"
          >
            {offlineMode ? (
              <>
                <WifiOff className="w-4 h-4" />
                离线模式
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                在线模式
              </>
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          下载本地 AI 模型，无需网络也能与小星对话
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SUPPORTED_MODELS.map((model) => {
          const status = modelStatuses[model.name] || {
            downloaded: false,
            loaded: false,
            downloading: false,
            progress: 0,
          };

          return (
            <div
              key={model.name}
              className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700"
              data-testid={`model-item-${model.name}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-white">{model.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      <HardDrive className="w-3 h-3 mr-1" />
                      {model.size}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {model.quantization}
                    </Badge>
                    {status.loaded && (
                      <Badge className="bg-green-600 text-xs">运行中</Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {!status.downloaded && !status.downloading && (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(model)}
                      data-testid={`button-download-${model.name}`}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      下载
                    </Button>
                  )}

                  {status.downloaded && !status.loaded && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleLoad(model.name)}
                      data-testid={`button-load-${model.name}`}
                    >
                      <Cpu className="w-4 h-4 mr-1" />
                      加载
                    </Button>
                  )}

                  {status.loaded && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleUnload}
                      data-testid={`button-unload-${model.name}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      卸载
                    </Button>
                  )}
                </div>
              </div>

              {status.downloading && (
                <div className="mt-3">
                  <Progress value={status.progress} className="h-2" />
                  <p className="text-xs text-zinc-400 mt-1">
                    下载中... {status.progress}%
                  </p>
                </div>
              )}

              {status.downloaded && !status.downloading && (
                <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                  <Check className="w-3 h-3" />
                  已下载
                </div>
              )}
            </div>
          );
        })}

        <div className="text-xs text-zinc-500 mt-4">
          <p>提示：</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>模型首次加载需要 10-30 秒</li>
            <li>建议设备至少 8GB 内存</li>
            <li>离线模式下部分功能（图像理解、知识库）不可用</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

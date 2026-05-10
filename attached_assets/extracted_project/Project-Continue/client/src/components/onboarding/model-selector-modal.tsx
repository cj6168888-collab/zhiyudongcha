import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, Check, Cpu, HardDrive, Zap, Shield, AlertCircle } from 'lucide-react';
import { localLLM, SUPPORTED_MODELS, type ModelInfo } from '@/lib/local-llm';

const FIRST_BOOT_KEY = 'xiaozhi_first_boot_completed';

interface ModelSelectorModalProps {
  forceOpen?: boolean;
  onComplete?: () => void;
}

export function ModelSelectorModal({ forceOpen, onComplete }: ModelSelectorModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'intro' | 'select' | 'download' | 'complete'>('intro');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const nativeCheck = localLLM.isAvailable();
    setIsNative(nativeCheck);
    
    if (forceOpen) {
      setIsOpen(true);
      return;
    }
    
    if (nativeCheck) {
      const completed = localStorage.getItem(FIRST_BOOT_KEY);
      if (!completed) {
        checkExistingModels();
      }
    }
  }, [forceOpen]);

  const checkExistingModels = async () => {
    let hasModel = false;
    for (const model of SUPPORTED_MODELS) {
      const exists = await localLLM.checkModelExists(model.name);
      if (exists) {
        hasModel = true;
        break;
      }
    }
    
    if (!hasModel) {
      setIsOpen(true);
    } else {
      localStorage.setItem(FIRST_BOOT_KEY, 'true');
    }
  };

  const handleSkip = () => {
    localStorage.setItem(FIRST_BOOT_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  };

  const handleSelectModel = () => {
    if (selectedModel) {
      setStep('download');
      startDownload();
    }
  };

  const startDownload = async () => {
    if (!selectedModel) return;
    
    const model = SUPPORTED_MODELS.find(m => m.name === selectedModel);
    if (!model) return;
    
    setDownloading(true);
    setDownloadError(null);
    setDownloadProgress(0);
    
    const success = await localLLM.downloadModel(model, (progress) => {
      setDownloadProgress(progress);
    });
    
    setDownloading(false);
    
    if (success) {
      const verifyResult = await localLLM.verifyModelIntegrity(selectedModel);
      if (verifyResult.valid) {
        await localLLM.loadModel(selectedModel);
        setStep('complete');
      } else {
        setDownloadError(`模型校验失败: ${verifyResult.error}`);
      }
    } else {
      setDownloadError('下载失败，请检查网络连接后重试');
    }
  };

  const handleComplete = () => {
    localStorage.setItem(FIRST_BOOT_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  };

  if (!isNative && !forceOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-700" data-testid="modal-model-selector">
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Cpu className="w-6 h-6 text-amber-400" />
                欢迎使用小智离线功能
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                下载本地AI模型后，即使没有网络也能和小智对话
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                  <Shield className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">隐私保护</p>
                    <p className="text-sm text-zinc-400">敏感对话在本地处理，数据不离开手机</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                  <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">离线可用</p>
                    <p className="text-sm text-zinc-400">飞行模式、地铁、山区都能使用</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
                  <HardDrive className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">一次下载</p>
                    <p className="text-sm text-zinc-400">模型保存在本地，无需重复下载</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleSkip} data-testid="button-skip-model">
                稍后设置
              </Button>
              <Button onClick={() => setStep('select')} data-testid="button-start-select">
                选择模型
              </Button>
            </div>
          </>
        )}
        
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>选择本地模型</DialogTitle>
              <DialogDescription>
                根据您的设备选择合适的模型
              </DialogDescription>
            </DialogHeader>
            
            <RadioGroup
              value={selectedModel || ''}
              onValueChange={setSelectedModel}
              className="space-y-3 py-4"
            >
              {SUPPORTED_MODELS.map((model) => (
                <Card
                  key={model.name}
                  className={`cursor-pointer transition-colors ${
                    selectedModel === model.name
                      ? 'bg-amber-900/20 border-amber-600'
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                  }`}
                  onClick={() => setSelectedModel(model.name)}
                  data-testid={`card-model-${model.name}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <RadioGroupItem value={model.name} id={model.name} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={model.name} className="font-medium text-white cursor-pointer">
                        {model.name}
                      </Label>
                      {model.description && (
                        <p className="text-sm text-zinc-400 mt-1">{model.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <HardDrive className="w-3 h-3 mr-1" />
                          {model.size}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {model.quantization}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setStep('intro')}>
                返回
              </Button>
              <Button
                onClick={handleSelectModel}
                disabled={!selectedModel}
                data-testid="button-confirm-model"
              >
                <Download className="w-4 h-4 mr-2" />
                下载所选模型
              </Button>
            </div>
          </>
        )}
        
        {step === 'download' && (
          <>
            <DialogHeader>
              <DialogTitle>正在下载模型</DialogTitle>
              <DialogDescription>
                {SUPPORTED_MODELS.find(m => m.name === selectedModel)?.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-8 space-y-4">
              <Progress value={downloadProgress} className="h-3" />
              <p className="text-center text-zinc-400">
                {downloading ? (
                  <>下载中... {downloadProgress}%</>
                ) : downloadError ? (
                  <span className="text-red-400 flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {downloadError}
                  </span>
                ) : (
                  '准备中...'
                )}
              </p>
              
              {downloadError && (
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => setStep('select')}>
                    返回选择
                  </Button>
                  <Button onClick={startDownload}>
                    重试下载
                  </Button>
                </div>
              )}
            </div>
            
            <p className="text-xs text-zinc-500 text-center">
              请保持网络连接稳定，下载可能需要几分钟
            </p>
          </>
        )}
        
        {step === 'complete' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="w-6 h-6 text-green-400" />
                设置完成！
              </DialogTitle>
              <DialogDescription>
                本地模型已准备就绪
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-900/30 flex items-center justify-center">
                <Cpu className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-zinc-300">
                {SUPPORTED_MODELS.find(m => m.name === selectedModel)?.name} 已加载
              </p>
              <p className="text-sm text-zinc-500 mt-2">
                现在即使离线也能和小智对话了
              </p>
            </div>
            
            <Button className="w-full" onClick={handleComplete} data-testid="button-complete-setup">
              开始使用
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

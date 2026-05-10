import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Mic, Shield, ShieldCheck, ShieldAlert, UserPlus, Trash2, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useZ1Store } from '@/lib/z1/god-protocol';
import { useAudioAnalyzer } from '@/hooks/use-audio-analyzer';

interface VoiceprintStatus {
  enrolled: boolean;
  sampleCount: number;
  sampleRequired: number;
  confidenceThreshold?: number;
  lastVerified?: string;
  message: string;
}

interface VoiceAuthorization {
  id: string;
  authType: string;
  target: string;
  scope?: string;
  grantedBy: string;
  expiresAt?: string;
  createdAt: string;
}

export function VoiceprintLock() {
  const role = useZ1Store((state) => state.role);
  const queryClient = useQueryClient();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [newAuthType, setNewAuthType] = useState<string>('PERSON');
  const [newAuthTarget, setNewAuthTarget] = useState('');
  const [newAuthExpiry, setNewAuthExpiry] = useState('24');

  // 使用独立的音频分析器，不与实时语音混合
  const {
    isRecording,
    isAnalyzing,
    duration,
    progress,
    energy,
    peak,
    result,
    error: analysisError,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  } = useAudioAnalyzer(
    // 分析完成后的处理
    (analysisResult) => {
      // 如果音频质量合格，发送到后端进行声纹录入
      if (analysisResult.duration >= 2.5 && analysisResult.energy > 0.01) {
        const downsampledData = downsampleAudio(analysisResult.audioData, 8000);
        enrollMutation.mutate(downsampledData);
      } else {
        console.warn('[VOICEPRINT] 音频质量不合格:', {
          duration: analysisResult.duration,
          energy: analysisResult.energy,
        });
      }
    },
    // 实时进度回调
    (_currentDuration, _currentEnergy, _currentPeak) => {
    }
  );

  const { data: status, isLoading } = useQuery<VoiceprintStatus>({
    queryKey: ['/api/voiceprint/status'],
  });

  const { data: authorizations } = useQuery<VoiceAuthorization[]>({
    queryKey: ['/api/voiceprint/authorizations'],
  });

  const [enrollError, setEnrollError] = useState<string | null>(null);

  const enrollMutation = useMutation({
    mutationFn: async (audioData: number[]) => {
      return apiRequest('POST', '/api/voiceprint/enroll', { audioData, duration: 3, sampleRate: 16000 });
    },
    onSuccess: () => {
      setEnrollError(null);
      queryClient.invalidateQueries({ queryKey: ['/api/voiceprint/status'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('403')) {
        setEnrollError('需要MASTER权限。请先在设置中验证主人身份。');
      } else {
        setEnrollError(`录入失败: ${error.message}`);
      }
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: async (data: { authType: string; target: string; expiresInHours?: number }) => {
      return apiRequest('POST', '/api/voiceprint/authorize', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voiceprint/authorizations'] });
      setAuthDialogOpen(false);
      setNewAuthTarget('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/voiceprint/authorize/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voiceprint/authorizations'] });
    },
  });

  const downsampleAudio = (channelData: Float32Array, targetLength: number): number[] => {
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
  };

  // 独立的录音分析处理，不与实时语音混淆
  const handleVoiceprintRecording = async () => {
    if (isRecording) {
      // 停止录音并分析
      await stopRecording();
    } else {
      // 开始录音分析
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

  const getStatusIcon = () => {
    if (!status?.enrolled) return <Shield className="h-6 w-6 text-muted-foreground" />;
    return <ShieldCheck className="h-6 w-6 text-green-500" />;
  };

  const getStatusBadge = () => {
    if (!status?.enrolled) return <Badge variant="outline">未激活</Badge>;
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">已激活</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="pt-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-12 h-12 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Fingerprint className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">声纹锁</CardTitle>
                <CardDescription className="text-xs">只响应主人声音</CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div className="flex-1">
              <p className="text-sm font-medium">{status?.message}</p>
              {status && !status.enrolled && (
                <p className="text-xs text-muted-foreground mt-1">
                  进度: {status.sampleCount}/{status.sampleRequired} 次声纹采样
                </p>
              )}
            </div>
          </div>

          {status && !status.enrolled && (
            <div className="space-y-3">
              <Progress value={(status.sampleCount / status.sampleRequired) * 100} className="h-2" />

              {isRecording ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <Mic className="h-4 w-4 animate-pulse" />
                    <span>正在录制声纹... {duration.toFixed(1)}s</span>
                  </div>
                  <Progress value={progress} className="h-1" />

                  {/* 实时音频分析指标 */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-blue-400" />
                      <span>能量: {(energy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-green-400" />
                      <span>峰值: {(peak * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => cancelRecording()}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleVoiceprintRecording}
                      variant="default"
                      size="sm"
                      className="flex-1"
                      disabled={duration < 2.5}
                    >
                      完成录制
                    </Button>
                  </div>
                </div>
              ) : isAnalyzing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <Activity className="h-4 w-4 animate-spin" />
                    <span>正在分析声纹...</span>
                  </div>
                  <Progress value={100} className="h-1" />
                </div>
              ) : (
                <Button
                  onClick={handleVoiceprintRecording}
                  disabled={role !== 'MASTER' || enrollMutation.isPending}
                  className="w-full"
                  data-testid="button-enroll-voiceprint"
                >
                  {enrollMutation.isPending ? (
                    <>处理中...</>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      录入第 {(status?.sampleCount || 0) + 1} 次声纹
                    </>
                  )}
                </Button>
              )}

              {role !== 'MASTER' && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  需要MASTER权限才能录入声纹
                </p>
              )}

              {(enrollError || analysisError) && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-2">
                  <ShieldAlert className="h-3 w-3" />
                  {enrollError || analysisError}
                </p>
              )}

              {/* 显示分析结果 */}
              {result && (
                <div className="text-xs space-y-1 p-2 bg-muted/30 rounded">
                  <div className="font-medium text-blue-400">音频分析结果:</div>
                  <div>时长: {result.duration.toFixed(2)}s</div>
                  <div>能量: {(result.energy * 100).toFixed(2)}%</div>
                  <div>峰值: {(result.peak * 100).toFixed(2)}%</div>
                  <div>过零率: {(result.zeroCrossingRate * 1000).toFixed(2)}</div>
                  <div>主频率: {(result.dominantFrequency).toFixed(1)}Hz</div>
                </div>
              )}
            </div>
          )}

          {status?.enrolled && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">置信阈值</span>
                <span>{((status.confidenceThreshold || 0.72) * 100).toFixed(0)}%</span>
              </div>
              {status.lastVerified && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最后验证</span>
                  <span>{new Date(status.lastVerified).toLocaleString('zh-CN')}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {status?.enrolled && (
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">授权白名单</CardTitle>
              <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={role !== 'MASTER'} data-testid="button-add-authorization">
                    <UserPlus className="h-4 w-4 mr-1" />
                    添加授权
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加对话授权</DialogTitle>
                    <DialogDescription>
                      授权特定人或操作与小星对话
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="授权类型" className="text-sm font-medium">授权类型</label>
                      <Select value={newAuthType} onValueChange={setNewAuthType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PERSON">特定人员</SelectItem>
                          <SelectItem value="ACTION">特定操作</SelectItem>
                          <SelectItem value="TEMPORARY">临时授权</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="newauthtype-person-人员名称-操作类型" className="text-sm font-medium">
                        {newAuthType === 'PERSON' ? '人员名称' : '操作类型'}
                      </label>
                      <Input
                        value={newAuthTarget}
                        onChange={(e) => setNewAuthTarget(e.target.value)}
                        placeholder={newAuthType === 'PERSON' ? '如：张三' : '如：查询天气'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="有效期小时" className="text-sm font-medium">有效期（小时）</label>
                      <Select value={newAuthExpiry} onValueChange={setNewAuthExpiry}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1小时</SelectItem>
                          <SelectItem value="24">24小时</SelectItem>
                          <SelectItem value="168">7天</SelectItem>
                          <SelectItem value="0">永久</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => authorizeMutation.mutate({
                        authType: newAuthType,
                        target: newAuthTarget,
                        expiresInHours: newAuthExpiry === '0' ? undefined : parseInt(newAuthExpiry),
                      })}
                      disabled={!newAuthTarget || authorizeMutation.isPending}
                    >
                      确认授权
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {authorizations && authorizations.length > 0 ? (
              <div className="space-y-2">
                {authorizations.map((auth) => (
                  <div
                    key={auth.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {auth.authType === 'PERSON' ? '人员' : auth.authType === 'ACTION' ? '操作' : '临时'}
                      </Badge>
                      <span className="text-sm">{auth.target}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {auth.expiresAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(auth.expiresAt).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => revokeMutation.mutate(auth.id)}
                        disabled={role !== 'MASTER'}
                        data-testid={`button-revoke-${auth.id}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无授权，非主人无法与小星对话
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

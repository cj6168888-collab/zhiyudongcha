import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Mic, Shield, ShieldCheck, ShieldAlert, UserPlus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useZ1Store } from '@/lib/z1/god-protocol';

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [newAuthType, setNewAuthType] = useState<string>('PERSON');
  const [newAuthTarget, setNewAuthTarget] = useState('');
  const [newAuthExpiry, setNewAuthExpiry] = useState('24');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true } 
      });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          
          if (audioBuffer.duration < 2.5) {
            console.error('Recording too short:', audioBuffer.duration);
            return;
          }
          
          const downsampledData = downsampleAudio(channelData, 8000);
          enrollMutation.mutate(downsampledData);
        } catch (err) {
          console.error('Audio processing error:', err);
        } finally {
          audioContext.close();
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingProgress(0);

      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 3.33;
        setRecordingProgress(Math.min(progress, 100));
        
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          let peak = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
            if (dataArray[i] > peak) peak = dataArray[i];
          }
          const average = sum / dataArray.length / 255;
          const peakNorm = peak / 255;
          const rmsDb = average > 0 ? 20 * Math.log10(average) : -Infinity;
          const peakDb = peakNorm > 0 ? 20 * Math.log10(peakNorm) : -Infinity;
          console.log(
            `[VOICEPRINT_MIC] 振幅: ${(average * 100).toFixed(2)}% | ` +
            `峰值: ${(peakNorm * 100).toFixed(2)}% | ` +
            `RMS: ${rmsDb.toFixed(1)}dB | ` +
            `Peak: ${peakDb.toFixed(1)}dB | ` +
            `进度: ${progress.toFixed(0)}%`
          );
        }
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          setIsRecording(false);
        }
      }, 100);

    } catch (error) {
      console.error('Recording error:', error);
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
                    <span>正在录制声纹...</span>
                  </div>
                  <Progress value={recordingProgress} className="h-1" />
                </div>
              ) : (
                <Button 
                  onClick={startRecording}
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
              
              {enrollError && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-2">
                  <ShieldAlert className="h-3 w-3" />
                  {enrollError}
                </p>
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
                      授权特定人或操作与小智对话
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">授权类型</label>
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
                      <label className="text-sm font-medium">
                        {newAuthType === 'PERSON' ? '人员名称' : '操作类型'}
                      </label>
                      <Input 
                        value={newAuthTarget}
                        onChange={(e) => setNewAuthTarget(e.target.value)}
                        placeholder={newAuthType === 'PERSON' ? '如：张三' : '如：查询天气'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">有效期（小时）</label>
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
                暂无授权，非主人无法与小智对话
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store, Role } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, ShieldAlert, Key, User, Mic, Fingerprint, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VoiceprintStatus {
  enrolled: boolean;
  sampleCount: number;
  sampleRequired: number;
  confidenceThreshold?: number;
  lastVerified?: string;
  message: string;
}

export function AuthGate() {
  const { role, switchRole, initialize, rootDna } = useZ1Store();
  const queryClient = useQueryClient();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [authStep, setAuthStep] = useState<'key' | 'voiceprint' | 'complete'>('key');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const { data: voiceprintStatus, refetch: refetchVoiceprint, isError: voiceprintError } = useQuery<VoiceprintStatus>({
    queryKey: ['/api/voiceprint/status'],
    enabled: role === 'MASTER',
    retry: 2,
  });

  useEffect(() => {
    if (role === 'MASTER') {
      if (voiceprintError) {
        setAuthStep('complete');
      } else if (voiceprintStatus?.enrolled) {
        setAuthStep('complete');
      } else if (voiceprintStatus !== undefined) {
        setAuthStep('voiceprint');
      }
    }
  }, [role, voiceprintStatus?.enrolled, voiceprintError, voiceprintStatus]);

  const enrollMutation = useMutation({
    mutationFn: async (audioData: number[]) => {
      return apiRequest('POST', '/api/voiceprint/enroll', { audioData, duration: 3, sampleRate: 16000 });
    },
    onSuccess: () => {
      setEnrollError(null);
      queryClient.invalidateQueries({ queryKey: ['/api/voiceprint/status'] });
      refetchVoiceprint();
    },
    onError: (error: Error) => {
      if (error.message.includes('403')) {
        setEnrollError('需要MASTER权限。请先验证主人身份。');
      } else {
        setEnrollError(`录入失败: ${error.message}`);
      }
    },
  });

  const handleMasterLogin = () => {
    if (!apiKeyInput || apiKeyInput.trim().length < 8) {
      toast({
        title: "ACCESS DENIED",
        description: "密钥长度不足，需至少8位。",
        variant: "destructive"
      });
      return;
    }
    
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const currentPort = typeof window !== 'undefined' ? parseInt(window.location.port) || 5000 : 5000;
    
    initialize({
      apiKey: apiKeyInput.trim(),
      masterSecret: apiKeyInput.trim(),
      ip: currentHost,
      port: currentPort,
      initialHp: 1000
    });
    
    toast({
      title: "Z1 PROTOCOL: ACCESS GRANTED",
      description: "Master DNA 已验证，进入声纹录入...",
      variant: "default",
      className: "border-primary text-primary"
    });
    
    setAuthStep('voiceprint');
  };

  const handleGuestSwitch = () => {
    switchRole("GUEST");
    toast({
      title: "MODE SWITCHED",
      description: "Downgraded to Guest permissions.",
    });
  };

  const skipVoiceprint = () => {
    setAuthStep('complete');
    toast({
      title: "声纹录入已跳过",
      description: "您可以稍后在设置中完成声纹录入。",
    });
  };

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
            setEnrollError('录音时间太短，请说长一点');
            return;
          }
          
          const downsampledData = downsampleAudio(channelData, 8000);
          enrollMutation.mutate(downsampledData);
        } catch (err) {
          console.error('Audio processing error:', err);
          setEnrollError('音频处理失败，请重试');
        } finally {
          audioContext.close();
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingProgress(0);
      setEnrollError(null);

      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 3.33;
        setRecordingProgress(Math.min(progress, 100));
        
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
      setEnrollError('无法访问麦克风，请检查权限');
    }
  };

  if (authStep === 'complete' && role === 'MASTER') {
    return (
      <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-green-500" />
            主人身份已确认
          </CardTitle>
          <CardDescription>
            声纹{voiceprintStatus?.enrolled ? '已激活' : '未激活'} · MASTER权限
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded text-sm text-primary font-mono break-all">
            ROOT_DNA: {rootDna || "ACTIVE"}
          </div>
          <Button onClick={handleGuestSwitch} variant="outline" className="w-full">
            <User className="w-4 h-4 mr-2" />
            切换到访客视角
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (authStep === 'voiceprint' && role === 'MASTER') {
    const progress = voiceprintStatus ? (voiceprintStatus.sampleCount / voiceprintStatus.sampleRequired) * 100 : 0;
    
    return (
      <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="text-primary" />
            声纹录入
          </CardTitle>
          <CardDescription>
            录入您的声纹，让小智只响应主人的声音
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <div className="text-4xl mb-4">🎙️</div>
            <p className="text-sm text-muted-foreground">
              请大声读出：<span className="text-primary font-medium">"小智，我是你的主人"</span>
            </p>
            <p className="text-xs text-muted-foreground">
              进度: {voiceprintStatus?.sampleCount || 0}/{voiceprintStatus?.sampleRequired || 3} 次采样
            </p>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          {isRecording ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <Mic className="h-5 w-5 animate-pulse" />
                <span>正在录制... 请说话</span>
              </div>
              <Progress value={recordingProgress} className="h-1" />
            </div>
          ) : (
            <Button 
              onClick={startRecording}
              disabled={enrollMutation.isPending}
              className="w-full h-12 text-base"
              data-testid="button-enroll-voiceprint"
            >
              {enrollMutation.isPending ? (
                <>处理中...</>
              ) : voiceprintStatus?.enrolled ? (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  声纹已完成，点击进入
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  开始录制第 {(voiceprintStatus?.sampleCount || 0) + 1} 次声纹
                </>
              )}
            </Button>
          )}
          
          {enrollError && (
            <p className="text-xs text-red-400 text-center flex items-center justify-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              {enrollError}
            </p>
          )}
          
          {voiceprintStatus?.enrolled ? (
            <Button 
              onClick={() => setAuthStep('complete')} 
              variant="default"
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              声纹已激活，进入系统
            </Button>
          ) : (
            <Button 
              onClick={skipVoiceprint} 
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              稍后再说
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {role === 'MASTER' ? <ShieldCheck className="text-primary" /> : <ShieldAlert className="text-muted-foreground" />}
          System Access Control
        </CardTitle>
        <CardDescription>
          Current Protocol Level: <span className={role === 'MASTER' ? "text-primary font-bold" : "text-muted-foreground"}>{role}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Master API Key</Label>
            <div className="flex gap-2">
              <Input 
                type="password" 
                placeholder="Enter Z1 Root Key..." 
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMasterLogin()}
                className="font-mono"
                data-testid="input-master-key"
              />
              <Button onClick={handleMasterLogin} variant="default" data-testid="button-verify-master">
                <Key className="w-4 h-4 mr-2" />
                Verify
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            * 验证后将进入声纹录入，让小智只响应主人声音。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { SpiritPresence } from "@/components/z3/spirit-presence";
import { StreamControl } from "@/components/z3/stream-control";
import { GuestIsolation } from "@/components/z3/guest-isolation";
import { MobileDeviceSettings } from "@/components/z3/mobile-device-settings";
import { GpuServerSettings } from "@/components/z3/gpu-server-settings";
import { LaptopDeviceSettings } from "@/components/z3/laptop-device-settings";
import { DeviceRecommendationSettings } from "@/components/z3/device-recommendation-settings";
import { 
  Settings,
  Shield,
  ShieldCheck,
  Clock,
  MapPin,
  Mic,
  Heart,
  Smartphone,
  AlertTriangle,
  Plus,
  Save,
  RefreshCw,
  Timer,
  Navigation,
  User,
  Users,
  Database,
  Bot,
  Cpu,
  Globe,
  Bell,
  Palette,
  Lock,
  Key,
  Wifi,
  Volume2,
  Eye,
  EyeOff,
  Languages,
  Moon,
  Sun,
  Monitor,
  Trash2,
  Upload,
  FileText,
  Camera,
  Building2,
  Calendar,
  CreditCard,
  Phone,
  Link,
  MessageSquare,
  UserPlus,
  X,
  Fingerprint,
  ScanFace,
  AudioLines,
  ShieldAlert,
  Check,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LastStandStatus {
  state: string;
  currentLevel?: string;
  triggers: {
    type: string;
    enabled: boolean;
    sensitivity: number;
    cooldown?: number;
  }[];
  deadmanSwitch: {
    enabled: boolean;
    intervalMs?: number;
    intervalHours?: number;
    lastConfirmed?: number;
    warningThreshold?: number;
    graceMinutes?: number;
  };
  voiceTriggers: number;
  geoFences: number;
  recentReports?: any[];
}

interface VoiceTrigger {
  phrase: string;
  similarity: number;
  requireVoiceprint: boolean;
  isEmergency: boolean;
}

interface GeoFence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  action: string;
}

interface UserProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  avatar?: string;
  birthday?: string;
  address?: string;
  bio?: string;
  company?: string;
  website?: string;
  wechat?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  idNumber?: string;
  bankAccount?: string;
  documents?: { name: string; type: string; uploadDate: string }[];
}

const triggerTypeLabels: Record<string, { label: string; icon: React.ComponentType<any>; description: string }> = {
  VOICE_COMMAND: { label: '语音口令', icon: Mic, description: '说出预设暗号触发保护' },
  BIOMETRIC_STRESS: { label: '生物特征压力', icon: Heart, description: '检测心率异常、声音颤抖' },
  REMOTE_COMMAND: { label: '远程指令', icon: Smartphone, description: '从其他设备远程触发' },
  GEO_FENCE: { label: '地理围栏', icon: MapPin, description: '进入敏感区域自动警戒' },
  TIME_DEADMAN: { label: '死人开关', icon: Timer, description: '定时未确认自动触发' },
  HOSTILE_VOICEPRINT: { label: '敌对声纹', icon: AlertTriangle, description: '检测到敌对人员声音' },
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const isMaster = role === 'MASTER';
  
  const [activeTab, setActiveTab] = useState('profile');
  const [newVoiceTrigger, setNewVoiceTrigger] = useState('');
  const [newGeoFence, setNewGeoFence] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    radius: 500,
    action: 'ALERT' as 'ALERT' | 'MELTDOWN'
  });
  const [deadmanInterval, setDeadmanInterval] = useState(24);
  
  const [profile, setProfile] = useState<UserProfile>({
    name: '创世神',
    title: 'CEO & Founder',
    email: '',
    phone: '',
    birthday: '',
    address: '',
    bio: '',
    company: '',
    website: '',
    wechat: '',
    emergencyContact: '',
    emergencyPhone: '',
    idNumber: '',
    bankAccount: '',
    documents: [],
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  const [biometricStatus, setBiometricStatus] = useState<{
    securityLevel: string;
    face: { enrolled: boolean; description?: string; enrolledAt?: string };
    fingerprint: { enrolled: boolean; enrolledAt?: string };
    voice: { enrolled: boolean; sampleCount?: number; enrolledAt?: string };
  }>({
    securityLevel: 'LOW',
    face: { enrolled: false },
    fingerprint: { enrolled: false },
    voice: { enrolled: false }
  });
  const [enrollingBiometric, setEnrollingBiometric] = useState<string | null>(null);
  const [faceAnalysisResult, setFaceAnalysisResult] = useState<string>('');
  
  const [avatarSettings, setAvatarSettings] = useState(() => {
    const saved = localStorage.getItem('xiaozhiVoiceSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback to defaults
      }
    }
    return {
      personality: 'loyal',
      responseStyle: 'detailed',
      language: 'zh-CN',
      voiceEnabled: true,
      wakeWord: '小智',
      voiceType: 'longanhuan',
      voiceSpeed: 1.0,
      voicePitch: 1.0,
    };
  });
  
  useEffect(() => {
    localStorage.setItem('xiaozhiVoiceSettings', JSON.stringify(avatarSettings));
  }, [avatarSettings]);
  
  const [spiritSettings, setSpiritSettings] = useState({
    syncInterval: 30,
    autoBackup: true,
    crossDeviceSync: true,
    presenceTimeout: 300,
  });
  
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: true,
    sound: true,
    vibrate: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });
  
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: 'dark',
    accentColor: 'gold',
    fontSize: 'medium',
    animations: true,
  });

  const { data: lastStandStatus, refetch: refetchLastStand } = useQuery<LastStandStatus>({
    queryKey: ['/api/last-stand/status'],
    retry: false,
    enabled: isMaster,
  });

  const { data: voiceTriggersList, refetch: refetchVoiceTriggers } = useQuery<VoiceTrigger[]>({
    queryKey: ['/api/last-stand/config/voice-triggers'],
    retry: false,
    enabled: isMaster,
  });

  const { data: geoFencesList, refetch: refetchGeoFences } = useQuery<GeoFence[]>({
    queryKey: ['/api/last-stand/config/geo-fences'],
    retry: false,
    enabled: isMaster,
  });

  useEffect(() => {
    const interval = lastStandStatus?.deadmanSwitch?.intervalMs || 
                     (lastStandStatus?.deadmanSwitch?.intervalHours ? lastStandStatus.deadmanSwitch.intervalHours * 60 * 60 * 1000 : null);
    if (interval) {
      setDeadmanInterval(interval / (1000 * 60 * 60));
    }
  }, [lastStandStatus?.deadmanSwitch?.intervalMs, lastStandStatus?.deadmanSwitch?.intervalHours]);

  const confirmDeadman = useMutation({
    mutationFn: () => apiRequest('POST', '/api/last-stand/confirm-deadman'),
    onSuccess: () => {
      toast({ title: '已确认安全', description: '死人开关计时器已重置' });
      refetchLastStand();
    },
    onError: () => toast({ title: '确认失败', variant: 'destructive' })
  });

  const updateTrigger = useMutation({
    mutationFn: ({ type, config }: { type: string; config: any }) => 
      apiRequest('POST', `/api/last-stand/config/trigger/${type}`, config),
    onSuccess: () => {
      toast({ title: '设置已保存' });
      refetchLastStand();
    },
    onError: () => toast({ title: '保存失败', variant: 'destructive' })
  });

  const addVoiceTrigger = useMutation({
    mutationFn: (phrase: string) => 
      apiRequest('POST', '/api/last-stand/config/voice-triggers/add', { 
        phrase,
        similarity: 0.8,
        requireVoiceprint: true,
        isEmergency: true
      }),
    onSuccess: () => {
      toast({ title: '语音触发词已添加' });
      setNewVoiceTrigger('');
      refetchLastStand();
      refetchVoiceTriggers();
    },
    onError: () => toast({ title: '添加失败', variant: 'destructive' })
  });

  const configureDeadman = useMutation({
    mutationFn: (intervalHours: number) => 
      apiRequest('POST', '/api/last-stand/config/deadman-switch', {
        enabled: true,
        intervalMs: intervalHours * 60 * 60 * 1000,
        warningThreshold: 0.8
      }),
    onSuccess: () => {
      toast({ title: '死人开关已配置' });
      refetchLastStand();
    },
    onError: () => toast({ title: '配置失败', variant: 'destructive' })
  });

  const addGeoFence = useMutation({
    mutationFn: (fence: typeof newGeoFence) => 
      apiRequest('POST', '/api/last-stand/config/geo-fences', {
        fences: [...(geoFencesList || []), { ...fence, id: `fence_${Date.now()}` }]
      }),
    onSuccess: () => {
      toast({ title: '地理围栏已添加' });
      setNewGeoFence({ name: '', latitude: 0, longitude: 0, radius: 500, action: 'ALERT' });
      refetchLastStand();
      refetchGeoFences();
    },
    onError: () => toast({ title: '添加失败', variant: 'destructive' })
  });

  const getTimeRemaining = () => {
    if (!lastStandStatus?.deadmanSwitch?.lastConfirmed || !lastStandStatus?.deadmanSwitch?.intervalMs) {
      return null;
    }
    const deadline = lastStandStatus.deadmanSwitch.lastConfirmed + lastStandStatus.deadmanSwitch.intervalMs;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return '已过期';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时 ${minutes}分钟`;
  };

  const stateColors: Record<string, string> = {
    STANDBY: 'bg-green-500/20 text-green-400 border-green-500/30',
    ALERT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    EXECUTING: 'bg-red-500/20 text-red-400 border-red-500/30',
    RECOVERY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const stateLabels: Record<string, string> = {
    STANDBY: '待命',
    ALERT: '警戒',
    EXECUTING: '执行中',
    RECOVERY: '恢复中',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="container mx-auto px-4 pt-4">
        <GlobalWakeHeader 
          title="设置中心"
          subtitle="系统配置与个人偏好"
        />
      </div>
      
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto gap-1 bg-slate-900/50 p-1.5">
            <TabsTrigger value="profile" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 data-[state=active]:bg-gold-500/20" data-testid="tab-profile">
              <User className="w-4 h-4" />
              <span className="text-xs md:text-sm">个人</span>
            </TabsTrigger>
            <TabsTrigger value="avatar" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 data-[state=active]:bg-gold-500/20" data-testid="tab-avatar">
              <Bot className="w-4 h-4" />
              <span className="text-xs md:text-sm">小智</span>
            </TabsTrigger>
            <TabsTrigger value="spirit" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 data-[state=active]:bg-gold-500/20" data-testid="tab-spirit">
              <Cpu className="w-4 h-4" />
              <span className="text-xs md:text-sm">灵核</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 data-[state=active]:bg-gold-500/20" data-testid="tab-security">
              <Shield className="w-4 h-4" />
              <span className="text-xs md:text-sm">安全</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 data-[state=active]:bg-gold-500/20" data-testid="tab-notifications">
              <Bell className="w-4 h-4" />
              <span className="text-xs md:text-sm">通知</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 data-[state=active]:bg-gold-500/20" data-testid="tab-appearance">
              <Palette className="w-4 h-4" />
              <span className="text-xs md:text-sm">外观</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-gold-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-gold-400" />
                    头像与照片
                  </CardTitle>
                  <CardDescription>上传个人照片作为头像</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center overflow-hidden border-4 border-gold-500/30">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt="头像" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-white" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 p-1.5 bg-gold-600 rounded-full cursor-pointer hover:bg-gold-700 transition-colors">
                        <Camera className="w-4 h-4 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAvatarFile(file);
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setProfile(p => ({ ...p, avatar: e.target?.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          data-testid="input-avatar-upload"
                        />
                      </label>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-400 mb-2">支持 JPG、PNG 格式，最大 5MB</p>
                      <Button variant="outline" size="sm" onClick={() => setProfile(p => ({ ...p, avatar: undefined }))} data-testid="button-remove-avatar">
                        <Trash2 className="w-4 h-4 mr-2" />
                        移除头像
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isMaster && (
                <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-emerald-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-emerald-400" />
                      生物特征认证
                      <Badge className={`ml-2 ${
                        biometricStatus.securityLevel === 'MAXIMUM' ? 'bg-emerald-500/20 text-emerald-400' :
                        biometricStatus.securityLevel === 'HIGH' ? 'bg-blue-500/20 text-blue-400' :
                        biometricStatus.securityLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {biometricStatus.securityLevel === 'MAXIMUM' ? '最高安全' :
                         biometricStatus.securityLevel === 'HIGH' ? '高安全' :
                         biometricStatus.securityLevel === 'MEDIUM' ? '中等安全' : '低安全'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>小智通过生物特征识别主人身份</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className={`p-4 rounded-lg border transition-all ${
                        biometricStatus.face.enrolled 
                          ? 'bg-emerald-900/20 border-emerald-500/30' 
                          : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <ScanFace className={`w-5 h-5 ${biometricStatus.face.enrolled ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className="font-medium">面容识别</span>
                          </div>
                          {biometricStatus.face.enrolled && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          {biometricStatus.face.enrolled 
                            ? biometricStatus.face.description || '面容已录入' 
                            : '使用面容快速解锁'}
                        </p>
                        {biometricStatus.face.enrolled ? (
                          <p className="text-xs text-emerald-400">
                            录入于 {new Date(biometricStatus.face.enrolledAt || '').toLocaleDateString()}
                          </p>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            disabled={enrollingBiometric === 'face' || !profile.avatar}
                            onClick={async () => {
                              if (!profile.avatar) {
                                toast({ title: '请先上传头像', description: '需要头像照片进行面容录入' });
                                return;
                              }
                              setEnrollingBiometric('face');
                              try {
                                const response = await fetch('/api/biometric/face/enroll', {
                                  method: 'POST',
                                  headers: { 
                                    'Content-Type': 'application/json',
                                    'X-Avatar-Role': 'MASTER'
                                  },
                                  body: JSON.stringify({ imageBase64: profile.avatar })
                                });
                                const result = await response.json();
                                if (result.success) {
                                  setBiometricStatus(s => ({
                                    ...s,
                                    securityLevel: result.profile?.securityLevel || s.securityLevel,
                                    face: {
                                      enrolled: true,
                                      description: result.profile?.face?.description,
                                      enrolledAt: new Date().toISOString()
                                    }
                                  }));
                                  setFaceAnalysisResult(result.message);
                                  toast({ title: '面容录入成功', description: result.message });
                                } else {
                                  toast({ title: '面容录入失败', description: result.error, variant: 'destructive' });
                                }
                              } catch (error) {
                                toast({ title: '面容录入失败', variant: 'destructive' });
                              } finally {
                                setEnrollingBiometric(null);
                              }
                            }}
                            data-testid="button-enroll-face"
                          >
                            {enrollingBiometric === 'face' ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 分析中...</>
                            ) : (
                              <><ScanFace className="w-4 h-4 mr-2" /> 录入面容</>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className={`p-4 rounded-lg border transition-all ${
                        biometricStatus.fingerprint.enrolled 
                          ? 'bg-emerald-900/20 border-emerald-500/30' 
                          : 'bg-slate-800/50 border-slate-700/50 hover:border-blue-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Fingerprint className={`w-5 h-5 ${biometricStatus.fingerprint.enrolled ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className="font-medium">指纹识别</span>
                          </div>
                          {biometricStatus.fingerprint.enrolled && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          {biometricStatus.fingerprint.enrolled 
                            ? '指纹已录入' 
                            : '使用指纹快速解锁'}
                        </p>
                        {biometricStatus.fingerprint.enrolled ? (
                          <p className="text-xs text-emerald-400">
                            录入于 {new Date(biometricStatus.fingerprint.enrolledAt || '').toLocaleDateString()}
                          </p>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            disabled={enrollingBiometric === 'fingerprint'}
                            onClick={async () => {
                              if (!window.PublicKeyCredential) {
                                toast({ title: '设备不支持', description: '您的设备/浏览器不支持指纹识别', variant: 'destructive' });
                                return;
                              }
                              setEnrollingBiometric('fingerprint');
                              try {
                                const challenge = new Uint8Array(32);
                                crypto.getRandomValues(challenge);
                                
                                const credential = await navigator.credentials.create({
                                  publicKey: {
                                    challenge,
                                    rp: { name: '小智数字生命', id: window.location.hostname },
                                    user: {
                                      id: new Uint8Array(16),
                                      name: 'master@avatar.local',
                                      displayName: '创世神'
                                    },
                                    pubKeyCredParams: [
                                      { type: 'public-key', alg: -7 },
                                      { type: 'public-key', alg: -257 }
                                    ],
                                    authenticatorSelection: {
                                      authenticatorAttachment: 'platform',
                                      userVerification: 'required'
                                    },
                                    timeout: 60000
                                  }
                                }) as PublicKeyCredential;

                                if (credential) {
                                  const response = await fetch('/api/biometric/fingerprint/enroll', {
                                    method: 'POST',
                                    headers: { 
                                      'Content-Type': 'application/json',
                                      'X-Avatar-Role': 'MASTER'
                                    },
                                    body: JSON.stringify({
                                      credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
                                      publicKey: 'webauthn-credential',
                                      attestationType: 'platform'
                                    })
                                  });
                                  const result = await response.json();
                                  if (result.success) {
                                    setBiometricStatus(s => ({
                                      ...s,
                                      securityLevel: result.profile?.securityLevel || s.securityLevel,
                                      fingerprint: {
                                        enrolled: true,
                                        enrolledAt: new Date().toISOString()
                                      }
                                    }));
                                    toast({ title: '指纹录入成功', description: result.message });
                                  }
                                }
                              } catch (error: any) {
                                if (error.name !== 'NotAllowedError') {
                                  toast({ title: '指纹录入失败', description: error.message, variant: 'destructive' });
                                }
                              } finally {
                                setEnrollingBiometric(null);
                              }
                            }}
                            data-testid="button-enroll-fingerprint"
                          >
                            {enrollingBiometric === 'fingerprint' ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 等待验证...</>
                            ) : (
                              <><Fingerprint className="w-4 h-4 mr-2" /> 录入指纹</>
                            )}
                          </Button>
                        )}
                      </div>

                      <div className={`p-4 rounded-lg border transition-all ${
                        biometricStatus.voice.enrolled 
                          ? 'bg-emerald-900/20 border-emerald-500/30' 
                          : 'bg-slate-800/50 border-slate-700/50 hover:border-purple-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <AudioLines className={`w-5 h-5 ${biometricStatus.voice.enrolled ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className="font-medium">声纹识别</span>
                          </div>
                          {biometricStatus.voice.enrolled && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          {biometricStatus.voice.enrolled 
                            ? `已录入 ${biometricStatus.voice.sampleCount || 3} 次声纹样本` 
                            : '使用声音解锁'}
                        </p>
                        {biometricStatus.voice.enrolled ? (
                          <p className="text-xs text-emerald-400">
                            录入于 {new Date(biometricStatus.voice.enrolledAt || '').toLocaleDateString()}
                          </p>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => setActiveTab('security')}
                            data-testid="button-enroll-voice"
                          >
                            <AudioLines className="w-4 h-4 mr-2" /> 前往录入
                          </Button>
                        )}
                      </div>
                    </div>

                    {faceAnalysisResult && (
                      <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-500/20">
                        <p className="text-sm text-emerald-300">{faceAnalysisResult}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-gold-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-gold-400" />
                    基本信息
                  </CardTitle>
                  <CardDescription>你的个人基本资料</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><User className="w-4 h-4" /> 姓名</Label>
                      <Input
                        value={profile.name}
                        onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                        placeholder="输入真实姓名"
                        data-testid="input-profile-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Building2 className="w-4 h-4" /> 头衔/职位</Label>
                      <Input
                        value={profile.title}
                        onChange={(e) => setProfile(p => ({ ...p, title: e.target.value }))}
                        placeholder="如：CEO、总经理"
                        data-testid="input-profile-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Building2 className="w-4 h-4" /> 公司/单位</Label>
                      <Input
                        value={profile.company || ''}
                        onChange={(e) => setProfile(p => ({ ...p, company: e.target.value }))}
                        placeholder="输入公司名称"
                        data-testid="input-profile-company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> 生日</Label>
                      <Input
                        type="date"
                        value={profile.birthday || ''}
                        onChange={(e) => setProfile(p => ({ ...p, birthday: e.target.value }))}
                        data-testid="input-profile-birthday"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><FileText className="w-4 h-4" /> 个人简介</Label>
                    <Textarea
                      value={profile.bio || ''}
                      onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                      placeholder="简短介绍自己..."
                      rows={3}
                      className="resize-none"
                      data-testid="input-profile-bio"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-400" />
                    联系方式
                  </CardTitle>
                  <CardDescription>电话、邮箱和社交账号</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> 手机号码</Label>
                      <Input
                        value={profile.phone}
                        onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+86 1xx xxxx xxxx"
                        data-testid="input-profile-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> 邮箱</Label>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                        placeholder="your@email.com"
                        data-testid="input-profile-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> 微信号</Label>
                      <Input
                        value={profile.wechat || ''}
                        onChange={(e) => setProfile(p => ({ ...p, wechat: e.target.value }))}
                        placeholder="输入微信号"
                        data-testid="input-profile-wechat"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Link className="w-4 h-4" /> 个人网站</Label>
                      <Input
                        value={profile.website || ''}
                        onChange={(e) => setProfile(p => ({ ...p, website: e.target.value }))}
                        placeholder="https://..."
                        data-testid="input-profile-website"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> 地址</Label>
                    <Input
                      value={profile.address || ''}
                      onChange={(e) => setProfile(p => ({ ...p, address: e.target.value }))}
                      placeholder="输入详细地址"
                      data-testid="input-profile-address"
                    />
                  </div>
                </CardContent>
              </Card>

              {isMaster && (
                <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-orange-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                      紧急联系人
                    </CardTitle>
                    <CardDescription>紧急情况时的联系人信息</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> 紧急联系人姓名</Label>
                        <Input
                          value={profile.emergencyContact || ''}
                          onChange={(e) => setProfile(p => ({ ...p, emergencyContact: e.target.value }))}
                          placeholder="输入紧急联系人"
                          data-testid="input-profile-emergency-contact"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> 紧急联系电话</Label>
                        <Input
                          value={profile.emergencyPhone || ''}
                          onChange={(e) => setProfile(p => ({ ...p, emergencyPhone: e.target.value }))}
                          placeholder="紧急联系人电话"
                          data-testid="input-profile-emergency-phone"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isMaster && (
                <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-red-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-red-400" />
                      敏感信息（仅创世神可见）
                    </CardTitle>
                    <CardDescription>身份证号、银行账户等隐私信息</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> 身份证号</Label>
                        <Input
                          type="password"
                          value={profile.idNumber || ''}
                          onChange={(e) => setProfile(p => ({ ...p, idNumber: e.target.value }))}
                          placeholder="输入身份证号"
                          data-testid="input-profile-id-number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> 银行账户</Label>
                        <Input
                          type="password"
                          value={profile.bankAccount || ''}
                          onChange={(e) => setProfile(p => ({ ...p, bankAccount: e.target.value }))}
                          placeholder="输入银行账户"
                          data-testid="input-profile-bank-account"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      <Lock className="w-3 h-3 inline mr-1" />
                      此信息加密存储，仅用于紧急身份验证
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-400" />
                    资料文档上传
                  </CardTitle>
                  <CardDescription>上传身份证、护照、合同等重要文件</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-purple-500/50 transition-colors">
                    <input
                      type="file"
                      id="doc-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const newDoc = {
                            name: file.name,
                            type: file.type,
                            uploadDate: new Date().toISOString().split('T')[0]
                          };
                          setProfile(p => ({
                            ...p,
                            documents: [...(p.documents || []), newDoc]
                          }));
                          toast({
                            title: "文件已添加",
                            description: `${file.name} 已添加到文档列表`,
                          });
                        }
                      }}
                      data-testid="input-doc-upload"
                    />
                    <label htmlFor="doc-upload" className="cursor-pointer">
                      <Upload className="w-10 h-10 mx-auto text-slate-500 mb-3" />
                      <p className="text-sm text-slate-400">点击或拖拽文件到此处上传</p>
                      <p className="text-xs text-slate-500 mt-1">支持 PDF、图片、Word 文档</p>
                    </label>
                  </div>

                  {profile.documents && profile.documents.length > 0 && (
                    <div className="space-y-2">
                      <Label>已上传文档</Label>
                      <div className="space-y-2">
                        {profile.documents.map((doc, index) => (
                          <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-purple-400" />
                              <div>
                                <p className="text-sm font-medium">{doc.name}</p>
                                <p className="text-xs text-slate-500">上传于 {doc.uploadDate}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setProfile(p => ({
                                  ...p,
                                  documents: p.documents?.filter((_, i) => i !== index)
                                }));
                              }}
                              data-testid={`button-remove-doc-${index}`}
                            >
                              <X className="w-4 h-4 text-slate-400" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    团队成员
                  </CardTitle>
                  <CardDescription>管理分身团队（仅创世神可见）</CardDescription>
                </CardHeader>
                <CardContent>
                  {isMaster ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-400">团队成员管理功能开发中...</p>
                      <Button variant="outline" size="sm" data-testid="button-add-team-member">
                        <Plus className="w-4 h-4 mr-2" />
                        添加成员
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">仅创世神可管理团队成员</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button className="bg-gold-600 hover:bg-gold-700" data-testid="button-save-profile">
                  <Save className="w-4 h-4 mr-2" />
                  保存所有资料
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="avatar" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-purple-900/20 to-slate-900/80 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-400" />
                    小智人设
                  </CardTitle>
                  <CardDescription>调整AI助手的行为风格</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>人格类型</Label>
                      <Select value={avatarSettings.personality} onValueChange={(v) => setAvatarSettings(s => ({ ...s, personality: v }))}>
                        <SelectTrigger data-testid="select-personality">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="loyal">忠诚可靠</SelectItem>
                          <SelectItem value="playful">活泼俏皮</SelectItem>
                          <SelectItem value="professional">专业严谨</SelectItem>
                          <SelectItem value="caring">温柔体贴</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>回复风格</Label>
                      <Select value={avatarSettings.responseStyle} onValueChange={(v) => setAvatarSettings(s => ({ ...s, responseStyle: v }))}>
                        <SelectTrigger data-testid="select-response-style">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="concise">简洁明了</SelectItem>
                          <SelectItem value="detailed">详细周全</SelectItem>
                          <SelectItem value="creative">创意发散</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>语音功能</Label>
                        <p className="text-xs text-slate-500">启用语音交互</p>
                      </div>
                      <Switch 
                        checked={avatarSettings.voiceEnabled}
                        onCheckedChange={(v) => setAvatarSettings(s => ({ ...s, voiceEnabled: v }))}
                        data-testid="switch-voice-enabled"
                      />
                    </div>
                    
                    {avatarSettings.voiceEnabled && (
                      <>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>语音类型</Label>
                            <Select value={avatarSettings.voiceType} onValueChange={(v) => setAvatarSettings(s => ({ ...s, voiceType: v }))}>
                              <SelectTrigger data-testid="select-voice-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-96">
                                <div className="px-2 py-1.5 text-xs font-semibold text-purple-400 bg-purple-900/30">Azure 神经语音 (海外可用)</div>
                                <SelectItem value="azure_xiaoyi">👧 晓伊 - 儿童女声 (8~12岁)</SelectItem>
                                <SelectItem value="azure_xiaoxiao">🌸 晓晓 - 活泼少女 (支持多种情感)</SelectItem>
                                <SelectItem value="azure_xiaomo">💕 晓墨 - 温柔少女音</SelectItem>
                                <SelectItem value="azure_xiaoxuan">✨ 晓萱 - 温婉知性女</SelectItem>
                                <SelectItem value="azure_yunxi">🧒 云希 - 阳光男声 (可调年轻风格)</SelectItem>
                                <SelectItem value="azure_yunyang">🎙️ 云扬 - 专业播音员</SelectItem>
                                
                                <div className="px-2 py-1.5 text-xs font-semibold text-amber-400 bg-amber-900/30 mt-2">DashScope 真人语音 (国内可用)</div>
                                <SelectItem value="longhuhu_v3">🧒 龙呼呼 - 天真烂漫女童 (6~10岁)</SelectItem>
                                <SelectItem value="longdaiyu_v3">👧 龙黛玉 - 娇率才女音 (15~25岁)</SelectItem>
                                <SelectItem value="longanhuan">💃 龙安欢 - 欢脱元气女 (20~30岁)</SelectItem>
                                <SelectItem value="longanrou_v3">💕 龙安柔 - 温柔闺蜜女 (20~30岁)</SelectItem>
                                <SelectItem value="longanqin_v3">🌸 龙安亲 - 亲和活泼女 (20~25岁)</SelectItem>
                                <SelectItem value="longanling_v3">✨ 龙安灵 - 灵动聪慧女 (20~30岁)</SelectItem>
                                <SelectItem value="longanya_v3">👑 龙安雅 - 高雅气质女 (25~35岁)</SelectItem>
                                <SelectItem value="longanwen_v3">📚 龙安温 - 优雅知性女 (25~35岁)</SelectItem>
                                <SelectItem value="longanli_v3">💼 龙安莉 - 利落从容女 (25~35岁)</SelectItem>
                                <SelectItem value="longanyang">☀️ 龙安洋 - 阳光大男孩 (20~30岁)</SelectItem>
                                <SelectItem value="longhan_v3">❤️ 龙寒 - 温暖痴情男 (20~30岁)</SelectItem>
                                <SelectItem value="longanlang_v3">🏃 龙安朗 - 清爽利落男 (20~25岁)</SelectItem>
                                <SelectItem value="longanzhi_v3">🎓 龙安智 - 睿智轻熟男 (25~35岁)</SelectItem>
                                <SelectItem value="longanyun_v3">🏠 龙安昀 - 居家暖男 (30~35岁)</SelectItem>
                                <SelectItem value="longlaobo_v3">👴 龙老伯 - 沧桑岁月爷 (60岁+)</SelectItem>
                                <SelectItem value="longlaoyi_v3">👵 龙老姨 - 慈祥阿姨 (60岁+)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">Azure语音在Replit上可用，DashScope语音需本地运行</p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>唤醒词</Label>
                            <Input
                              value={avatarSettings.wakeWord}
                              onChange={(e) => setAvatarSettings(s => ({ ...s, wakeWord: e.target.value }))}
                              placeholder="小智"
                              data-testid="input-wake-word"
                            />
                          </div>
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>语速: {avatarSettings.voiceSpeed.toFixed(1)}x</Label>
                            <Slider
                              value={[avatarSettings.voiceSpeed]}
                              onValueChange={([v]) => setAvatarSettings(s => ({ ...s, voiceSpeed: v }))}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                              data-testid="slider-voice-speed"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>音调: {avatarSettings.voicePitch.toFixed(1)}</Label>
                            <Slider
                              value={[avatarSettings.voicePitch]}
                              onValueChange={([v]) => setAvatarSettings(s => ({ ...s, voicePitch: v }))}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                              data-testid="slider-voice-pitch"
                            />
                          </div>
                        </div>
                        
                        <div className="p-3 rounded-lg bg-purple-900/30 border border-purple-500/20">
                          <p className="text-sm text-purple-300 mb-2">语音预览 (真人 AI 语音)</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/voice/synthesize', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    text: '主人你好，我是小智，很高兴为你服务～',
                                    voice: avatarSettings.voiceType,
                                    rate: avatarSettings.voiceSpeed,
                                    pitch: avatarSettings.voicePitch,
                                  }),
                                });
                                const result = await response.json();
                                if (result.success && result.audioBase64) {
                                  const audio = new Audio(`data:audio/mp3;base64,${result.audioBase64}`);
                                  audio.play();
                                } else {
                                  if ('speechSynthesis' in window) {
                                    const utterance = new SpeechSynthesisUtterance('主人你好，我是小智，很高兴为你服务');
                                    utterance.lang = 'zh-CN';
                                    utterance.rate = avatarSettings.voiceSpeed;
                                    utterance.pitch = avatarSettings.voicePitch;
                                    speechSynthesis.speak(utterance);
                                  }
                                }
                              } catch (error) {
                                if ('speechSynthesis' in window) {
                                  const utterance = new SpeechSynthesisUtterance('主人你好，我是小智，很高兴为你服务');
                                  utterance.lang = 'zh-CN';
                                  utterance.rate = avatarSettings.voiceSpeed;
                                  utterance.pitch = avatarSettings.voicePitch;
                                  speechSynthesis.speak(utterance);
                                }
                              }
                            }}
                            data-testid="button-preview-voice"
                          >
                            <Volume2 className="w-4 h-4 mr-2" />
                            试听语音
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-save-avatar">
                      <Save className="w-4 h-4 mr-2" />
                      保存设置
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="spirit" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {!isMaster ? (
                <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/30">
                  <CardContent className="py-12 text-center">
                    <Lock className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                    <p className="text-slate-400">灵核控制仅对创世神开放</p>
                    <p className="text-sm text-slate-500 mt-2">请使用主密钥登录</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <DeviceRecommendationSettings />
                  
                  <GpuServerSettings />
                  
                  <LaptopDeviceSettings />
                  
                  <MobileDeviceSettings />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <SpiritPresence />
                      <GuestIsolation />
                    </div>
                    
                    <div className="space-y-6">
                      <StreamControl />
                    </div>
                  </div>

                  <Card className="bg-gradient-to-br from-cyan-900/20 to-slate-900/80 border-cyan-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-cyan-400" />
                        同步配置
                      </CardTitle>
                      <CardDescription>Z3协议 - 跨设备同步参数</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>同步间隔 (秒)</Label>
                          <Slider
                            value={[spiritSettings.syncInterval]}
                            onValueChange={([v]) => setSpiritSettings(s => ({ ...s, syncInterval: v }))}
                            min={10}
                            max={120}
                            step={10}
                            data-testid="slider-sync-interval"
                          />
                          <p className="text-xs text-slate-500">{spiritSettings.syncInterval} 秒</p>
                        </div>
                        <div className="space-y-2">
                          <Label>存在超时 (秒)</Label>
                          <Slider
                            value={[spiritSettings.presenceTimeout]}
                            onValueChange={([v]) => setSpiritSettings(s => ({ ...s, presenceTimeout: v }))}
                            min={60}
                            max={600}
                            step={30}
                            data-testid="slider-presence-timeout"
                          />
                          <p className="text-xs text-slate-500">{spiritSettings.presenceTimeout} 秒</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>自动备份</Label>
                            <p className="text-xs text-slate-500">定期备份重要数据</p>
                          </div>
                          <Switch 
                            checked={spiritSettings.autoBackup}
                            onCheckedChange={(v) => setSpiritSettings(s => ({ ...s, autoBackup: v }))}
                            data-testid="switch-auto-backup"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>跨设备同步</Label>
                            <p className="text-xs text-slate-500">在所有设备间同步状态</p>
                          </div>
                          <Switch 
                            checked={spiritSettings.crossDeviceSync}
                            onCheckedChange={(v) => setSpiritSettings(s => ({ ...s, crossDeviceSync: v }))}
                            data-testid="switch-cross-device-sync"
                          />
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-save-spirit">
                          <Save className="w-4 h-4 mr-2" />
                          保存设置
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-400" />
                        数据库管理
                      </CardTitle>
                      <CardDescription>个人与团队数据存储</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-blue-400" />
                            <span className="font-medium">人脉网络</span>
                          </div>
                          <p className="text-2xl font-bold text-blue-400">--</p>
                          <p className="text-xs text-slate-500">联系人记录</p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-purple-400" />
                            <span className="font-medium">资源库</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-400">--</p>
                          <p className="text-xs text-slate-500">文件存储</p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-gold-400" />
                            <span className="font-medium">记忆库</span>
                          </div>
                          <p className="text-2xl font-bold text-gold-400">--</p>
                          <p className="text-xs text-slate-500">对话记录</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {!isMaster ? (
                <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/30">
                  <CardContent className="py-12 text-center">
                    <Lock className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                    <p className="text-slate-400">安全设置仅对创世神开放</p>
                    <p className="text-sm text-slate-500 mt-2">请使用主密钥登录</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-gold-500/20">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gold-500/10">
                          <Shield className="w-6 h-6 text-gold-400" />
                        </div>
                        <div>
                          <CardTitle className="text-gold-100">最后防线协议</CardTitle>
                          <CardDescription>Last Stand Protocol</CardDescription>
                        </div>
                      </div>
                      <Badge 
                        className={`${stateColors[lastStandStatus?.state || 'STANDBY']} border`}
                        data-testid="badge-protocol-state"
                      >
                        {stateLabels[lastStandStatus?.state || 'STANDBY'] || lastStandStatus?.state}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        {lastStandStatus?.state === 'STANDBY' ? '系统正常运行，所有保护措施就绪' : 
                         lastStandStatus?.state === 'ALERT' ? '检测到潜在威胁，已进入警戒状态' :
                         lastStandStatus?.state === 'EXECUTING' ? '正在执行保护协议...' : '系统恢复中...'}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="bg-gradient-to-br from-orange-900/20 to-slate-900/80 border-orange-500/20">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Timer className="w-5 h-5 text-orange-400" />
                          <div>
                            <CardTitle className="text-orange-100">死人开关</CardTitle>
                            <CardDescription>定时确认安全机制</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>启用状态</Label>
                          <Switch 
                            checked={lastStandStatus?.deadmanSwitch?.enabled}
                            onCheckedChange={(enabled) => {
                              if (enabled) {
                                configureDeadman.mutate(deadmanInterval);
                              } else {
                                updateTrigger.mutate({ type: 'TIME_DEADMAN', config: { enabled: false } });
                              }
                            }}
                            data-testid="switch-deadman-enabled"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>确认间隔: {deadmanInterval} 小时</Label>
                          <Slider
                            value={[deadmanInterval]}
                            onValueChange={([v]) => setDeadmanInterval(v)}
                            min={1}
                            max={72}
                            step={1}
                            data-testid="slider-deadman-interval"
                          />
                        </div>

                        {lastStandStatus?.deadmanSwitch?.enabled && (
                          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-slate-400">剩余时间</span>
                              <span className="text-sm font-medium text-orange-400">
                                {getTimeRemaining()}
                              </span>
                            </div>
                            <Button 
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={() => confirmDeadman.mutate()}
                              disabled={confirmDeadman.isPending}
                              data-testid="button-confirm-safety"
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              确认安全
                            </Button>
                          </div>
                        )}

                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => configureDeadman.mutate(deadmanInterval)}
                          data-testid="button-save-deadman"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          保存设置
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-900/20 to-slate-900/80 border-purple-500/20">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Mic className="w-5 h-5 text-purple-400" />
                          <div>
                            <CardTitle className="text-purple-100">语音触发词</CardTitle>
                            <CardDescription>紧急暗号设置</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="输入触发短语..."
                            value={newVoiceTrigger}
                            onChange={(e) => setNewVoiceTrigger(e.target.value)}
                            data-testid="input-voice-trigger"
                          />
                          <Button
                            onClick={() => newVoiceTrigger && addVoiceTrigger.mutate(newVoiceTrigger)}
                            disabled={!newVoiceTrigger || addVoiceTrigger.isPending}
                            data-testid="button-add-voice-trigger"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        <ScrollArea className="h-24">
                          <div className="space-y-2">
                            {voiceTriggersList?.map((trigger, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                                <span className="text-sm">{trigger.phrase}</span>
                                <div className="flex items-center gap-2">
                                  {trigger.isEmergency && <Badge variant="destructive" className="text-xs">紧急</Badge>}
                                </div>
                              </div>
                            ))}
                            {(!voiceTriggersList || voiceTriggersList.length === 0) && (
                              <p className="text-sm text-slate-500 text-center py-4">暂无触发词</p>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-gradient-to-br from-blue-900/20 to-slate-900/80 border-blue-500/20">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-blue-400" />
                        <div>
                          <CardTitle className="text-blue-100">地理围栏</CardTitle>
                          <CardDescription>敏感区域设置</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-5">
                        <Input
                          placeholder="围栏名称"
                          value={newGeoFence.name}
                          onChange={(e) => setNewGeoFence(prev => ({ ...prev, name: e.target.value }))}
                          data-testid="input-geofence-name"
                        />
                        <Input
                          type="number"
                          placeholder="纬度"
                          value={newGeoFence.latitude || ''}
                          onChange={(e) => setNewGeoFence(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                          data-testid="input-geofence-lat"
                        />
                        <Input
                          type="number"
                          placeholder="经度"
                          value={newGeoFence.longitude || ''}
                          onChange={(e) => setNewGeoFence(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                          data-testid="input-geofence-lng"
                        />
                        <Input
                          type="number"
                          placeholder="半径(米)"
                          value={newGeoFence.radius}
                          onChange={(e) => setNewGeoFence(prev => ({ ...prev, radius: parseInt(e.target.value) || 500 }))}
                          data-testid="input-geofence-radius"
                        />
                        <Button
                          onClick={() => newGeoFence.name && addGeoFence.mutate(newGeoFence)}
                          disabled={!newGeoFence.name || addGeoFence.isPending}
                          data-testid="button-add-geofence"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          添加
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {geoFencesList?.map((fence) => (
                          <Badge 
                            key={fence.id}
                            variant={fence.action === 'MELTDOWN' ? 'destructive' : 'secondary'}
                            className="flex items-center gap-1"
                          >
                            <Navigation className="w-3 h-3" />
                            {fence.name}
                          </Badge>
                        ))}
                        {(!geoFencesList || geoFencesList.length === 0) && (
                          <p className="text-sm text-slate-500">暂无地理围栏</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-yellow-400" />
                    通知设置
                  </CardTitle>
                  <CardDescription>管理消息推送偏好</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <div>
                          <Label>邮件通知</Label>
                          <p className="text-xs text-slate-500">重要事项通过邮件提醒</p>
                        </div>
                      </div>
                      <Switch 
                        checked={notificationSettings.email}
                        onCheckedChange={(v) => setNotificationSettings(s => ({ ...s, email: v }))}
                        data-testid="switch-email-notifications"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        <div>
                          <Label>推送通知</Label>
                          <p className="text-xs text-slate-500">实时推送到设备</p>
                        </div>
                      </div>
                      <Switch 
                        checked={notificationSettings.push}
                        onCheckedChange={(v) => setNotificationSettings(s => ({ ...s, push: v }))}
                        data-testid="switch-push-notifications"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <Label>声音提示</Label>
                          <p className="text-xs text-slate-500">收到通知时播放提示音</p>
                        </div>
                      </div>
                      <Switch 
                        checked={notificationSettings.sound}
                        onCheckedChange={(v) => setNotificationSettings(s => ({ ...s, sound: v }))}
                        data-testid="switch-sound"
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <Label>免打扰时段</Label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">开始时间</Label>
                        <Input
                          type="time"
                          value={notificationSettings.quietHoursStart}
                          onChange={(e) => setNotificationSettings(s => ({ ...s, quietHoursStart: e.target.value }))}
                          data-testid="input-quiet-start"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">结束时间</Label>
                        <Input
                          type="time"
                          value={notificationSettings.quietHoursEnd}
                          onChange={(e) => setNotificationSettings(s => ({ ...s, quietHoursEnd: e.target.value }))}
                          data-testid="input-quiet-end"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button data-testid="button-save-notifications">
                      <Save className="w-4 h-4 mr-2" />
                      保存设置
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border-slate-700/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-pink-400" />
                    外观设置
                  </CardTitle>
                  <CardDescription>自定义界面显示</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>主题模式</Label>
                      <div className="flex gap-2">
                        {[
                          { value: 'dark', icon: Moon, label: '深色' },
                          { value: 'light', icon: Sun, label: '浅色' },
                          { value: 'system', icon: Monitor, label: '跟随系统' },
                        ].map(theme => (
                          <Button
                            key={theme.value}
                            variant={appearanceSettings.theme === theme.value ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setAppearanceSettings(s => ({ ...s, theme: theme.value }))}
                            data-testid={`button-theme-${theme.value}`}
                          >
                            <theme.icon className="w-4 h-4 mr-2" />
                            {theme.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>强调色</Label>
                      <div className="flex gap-2">
                        {[
                          { value: 'gold', color: 'bg-gold-500', label: '金色' },
                          { value: 'blue', color: 'bg-blue-500', label: '蓝色' },
                          { value: 'purple', color: 'bg-purple-500', label: '紫色' },
                          { value: 'green', color: 'bg-green-500', label: '绿色' },
                        ].map(accent => (
                          <button
                            key={accent.value}
                            className={`w-10 h-10 rounded-full ${accent.color} ${appearanceSettings.accentColor === accent.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                            onClick={() => setAppearanceSettings(s => ({ ...s, accentColor: accent.value }))}
                            data-testid={`button-accent-${accent.value}`}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>界面动画</Label>
                        <p className="text-xs text-slate-500">启用过渡动画效果</p>
                      </div>
                      <Switch 
                        checked={appearanceSettings.animations}
                        onCheckedChange={(v) => setAppearanceSettings(s => ({ ...s, animations: v }))}
                        data-testid="switch-animations"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button data-testid="button-save-appearance">
                      <Save className="w-4 h-4 mr-2" />
                      保存设置
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const Mail = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

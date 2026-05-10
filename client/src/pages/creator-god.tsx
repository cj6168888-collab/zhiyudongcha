import { useState } from 'react';
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scan, Fingerprint, KeyRound, Shield, CheckCircle2, XCircle, Heart, FileText, CreditCard, User, Activity, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthStep = 'face' | 'fingerprint' | 'password';
type AuthStatus = 'pending' | 'scanning' | 'success' | 'failed';

interface AuthState {
  face: AuthStatus;
  fingerprint: AuthStatus;
  password: AuthStatus;
}

export default function CreatorGod() {
  const { t } = useTranslation();
  const { role } = useZ1Store();
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStep, setCurrentStep] = useState<AuthStep>('face');
  const [password, setPassword] = useState('');
  const [authState, setAuthState] = useState<AuthState>({
    face: 'pending',
    fingerprint: 'pending',
    password: 'pending'
  });

  const simulateBiometric = (step: AuthStep) => {
    setAuthState(prev => ({ ...prev, [step]: 'scanning' }));
    
    setTimeout(() => {
      setAuthState(prev => ({ ...prev, [step]: 'success' }));
      
      if (step === 'face') {
        setTimeout(() => setCurrentStep('fingerprint'), 500);
      } else if (step === 'fingerprint') {
        setTimeout(() => setCurrentStep('password'), 500);
      }
    }, 2000);
  };

  const handlePasswordSubmit = () => {
    setAuthState(prev => ({ ...prev, password: 'scanning' }));
    
    setTimeout(() => {
      if (password.length >= 4) {
        setAuthState(prev => ({ ...prev, password: 'success' }));
        setTimeout(() => setIsAuthenticated(true), 500);
      } else {
        setAuthState(prev => ({ ...prev, password: 'failed' }));
      }
    }, 1000);
  };

  const getStepIcon = (step: AuthStep, status: AuthStatus) => {
    const iconClass = "w-8 h-8";
    
    if (status === 'scanning') {
      return <Loader2 className={`${iconClass} animate-spin text-primary`} />;
    }
    if (status === 'success') {
      return <CheckCircle2 className={`${iconClass} text-green-500`} />;
    }
    if (status === 'failed') {
      return <XCircle className={`${iconClass} text-destructive`} />;
    }
    
    switch (step) {
      case 'face':
        return <Scan className={`${iconClass} text-muted-foreground`} />;
      case 'fingerprint':
        return <Fingerprint className={`${iconClass} text-muted-foreground`} />;
      case 'password':
        return <KeyRound className={`${iconClass} text-muted-foreground`} />;
    }
  };

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background px-8 pt-8 pb-24 md:pb-8">
        <GlobalWakeHeader 
          title="私人保险库" 
          subtitle="您的私密空间 · 个人健康 · 文件存储"
        />

        <div className="flex items-center gap-2 mb-6">
          <Badge variant="secondary">访客权限</Badge>
        </div>

        <Tabs defaultValue="health" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="health" data-testid="tab-guest-health">
              <Heart className="w-4 h-4 mr-2" />
              身体状况
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-guest-files">
              <FileText className="w-4 h-4 mr-2" />
              私人文件
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-500" />
                  身体状况监测
                </CardTitle>
                <CardDescription>来自可穿戴设备的健康数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Heart className="w-6 h-6 mx-auto text-red-500 mb-2" />
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-xs text-muted-foreground">心率 BPM</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Activity className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                    <div className="text-2xl font-bold">--/--</div>
                    <div className="text-xs text-muted-foreground">血压 mmHg</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <div className="w-6 h-6 mx-auto text-orange-500 mb-2 font-bold">💤</div>
                    <div className="text-2xl font-bold">--h</div>
                    <div className="text-xs text-muted-foreground">昨夜睡眠</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <div className="w-6 h-6 mx-auto text-green-500 mb-2 font-bold">🚶</div>
                    <div className="text-2xl font-bold">--</div>
                    <div className="text-xs text-muted-foreground">今日步数</div>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  连接可穿戴设备以获取实时数据
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  私人文件
                </CardTitle>
                <CardDescription>加密存储的私密文件</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>私人文件夹为空</p>
                  <p className="text-sm">拖拽文件到此处上传</p>
                  <Button className="mt-4" variant="outline" data-testid="button-guest-upload">
                    上传文件
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (!isAuthenticated) {
    const progress = 
      (authState.face === 'success' ? 33 : 0) +
      (authState.fingerprint === 'success' ? 33 : 0) +
      (authState.password === 'success' ? 34 : 0);

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-lg w-full border-primary/30 bg-gradient-to-br from-background to-primary/5">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              {t('creator.title')}
            </CardTitle>
            <CardDescription>
              {t('creator.biometric_required')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={progress} className="h-2" />
            
            <div className="grid grid-cols-3 gap-4">
              <div 
                className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                  currentStep === 'face' ? 'border-primary bg-primary/10' : 
                  authState.face === 'success' ? 'border-green-500/50 bg-green-500/10' : 
                  'border-border'
                }`}
              >
                {getStepIcon('face', authState.face)}
                <span className="text-xs mt-2 text-center">{t('creator.scan_face')}</span>
              </div>
              
              <div 
                className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                  currentStep === 'fingerprint' ? 'border-primary bg-primary/10' : 
                  authState.fingerprint === 'success' ? 'border-green-500/50 bg-green-500/10' : 
                  'border-border'
                }`}
              >
                {getStepIcon('fingerprint', authState.fingerprint)}
                <span className="text-xs mt-2 text-center">{t('creator.scan_fingerprint')}</span>
              </div>
              
              <div 
                className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                  currentStep === 'password' ? 'border-primary bg-primary/10' : 
                  authState.password === 'success' ? 'border-green-500/50 bg-green-500/10' : 
                  'border-border'
                }`}
              >
                {getStepIcon('password', authState.password)}
                <span className="text-xs mt-2 text-center">{t('creator.enter_password')}</span>
              </div>
            </div>
            
            {currentStep === 'face' && authState.face === 'pending' && (
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => simulateBiometric('face')}
                data-testid="button-scan-face"
              >
                <Scan className="w-5 h-5 mr-2" />
                开始面部扫描
              </Button>
            )}
            
            {currentStep === 'fingerprint' && authState.fingerprint === 'pending' && (
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => simulateBiometric('fingerprint')}
                data-testid="button-scan-fingerprint"
              >
                <Fingerprint className="w-5 h-5 mr-2" />
                按压指纹传感器
              </Button>
            )}
            
            {currentStep === 'password' && authState.password !== 'success' && (
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="输入创世密码..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  className="text-center text-lg tracking-widest"
                  data-testid="input-password"
                />
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handlePasswordSubmit}
                  disabled={authState.password === 'scanning'}
                  data-testid="button-verify-password"
                >
                  {authState.password === 'scanning' ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('creator.verifying')}
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-5 h-5 mr-2" />
                      {t('creator.verify')}
                    </>
                  )}
                </Button>
                {authState.password === 'failed' && (
                  <p className="text-sm text-destructive text-center">{t('creator.failed')}</p>
                )}
              </div>
            )}
            
            {authState.face === 'scanning' && (
              <div className="text-center text-sm text-muted-foreground animate-pulse">
                正在扫描面部特征...请保持静止
              </div>
            )}
            
            {authState.fingerprint === 'scanning' && (
              <div className="text-center text-sm text-muted-foreground animate-pulse">
                正在读取指纹...请保持按压
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <GlobalWakeHeader 
        title={t('creator.title')} 
        subtitle={t('creator.subtitle')}
      />

      <div className="flex items-center gap-2 mb-6">
        <Badge variant="outline" className="text-green-500 border-green-500/50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t('creator.verified')}
        </Badge>
        <Badge variant="secondary">创世神权限</Badge>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="w-4 h-4 mr-2" />
            {t('creator.profile')}
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <Heart className="w-4 h-4 mr-2" />
            {t('creator.health')}
          </TabsTrigger>
          <TabsTrigger value="files" data-testid="tab-files">
            <FileText className="w-4 h-4 mr-2" />
            {t('creator.files')}
          </TabsTrigger>
          <TabsTrigger value="cards" data-testid="tab-cards">
            <CreditCard className="w-4 h-4 mr-2" />
            {t('creator.cards')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                主人档案
              </CardTitle>
              <CardDescription>创世神的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="称呼" className="text-sm text-muted-foreground">称呼</label>
                  <div className="font-medium">创世神 / 主人</div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="联系方式" className="text-sm text-muted-foreground">联系方式</label>
                  <div className="font-medium">cj6168888@Gmail.com</div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="权限等级" className="text-sm text-muted-foreground">权限等级</label>
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-600">ZONE_GOLD</Badge>
                </div>
                <div className="space-y-2">
                  <label htmlFor="系统信任度" className="text-sm text-muted-foreground">系统信任度</label>
                  <div className="font-medium text-green-500">100%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-500" />
                身体状况监测
              </CardTitle>
              <CardDescription>来自可穿戴设备的健康数据</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Heart className="w-6 h-6 mx-auto text-red-500 mb-2" />
                  <div className="text-2xl font-bold">72</div>
                  <div className="text-xs text-muted-foreground">心率 BPM</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Activity className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                  <div className="text-2xl font-bold">120/80</div>
                  <div className="text-xs text-muted-foreground">血压 mmHg</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="w-6 h-6 mx-auto text-orange-500 mb-2 font-bold">💤</div>
                  <div className="text-2xl font-bold">7.5h</div>
                  <div className="text-xs text-muted-foreground">昨夜睡眠</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="w-6 h-6 mx-auto text-green-500 mb-2 font-bold">🚶</div>
                  <div className="text-2xl font-bold">8,432</div>
                  <div className="text-xs text-muted-foreground">今日步数</div>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                连接可穿戴设备以获取实时数据
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                私人文件保险库
              </CardTitle>
              <CardDescription>加密存储的私密文件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>私人文件保险库为空</p>
                <p className="text-sm">拖拽文件到此处上传，或点击下方按钮</p>
                <Button className="mt-4" variant="outline" data-testid="button-upload-file">
                  上传文件
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-500" />
                卡片与账户
              </CardTitle>
              <CardDescription>银行卡、会员卡等重要卡片信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无添加的卡片</p>
                <p className="text-sm">安全存储您的卡片信息</p>
                <Button className="mt-4" variant="outline" data-testid="button-add-card">
                  添加卡片
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

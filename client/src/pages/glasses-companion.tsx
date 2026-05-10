/**
 * 眼镜伴侣页面 - INMO Go3 AR眼镜连接与感知控制
 *
 * 功能：
 * 1. 蓝牙扫描连接眼镜
 * 2. 开启视觉/听觉感知
 * 3. 显示AI响应并推送到眼镜
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useBluetoothGlasses } from "@/hooks/use-bluetooth-glasses";
import { usePerceptionSession, PerceptionResponse } from "@/hooks/use-perception-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Glasses,
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Battery,
  Wifi,
  Brain,
  Send,
  Volume2,
  Monitor,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function GlassesCompanionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const bluetooth = useBluetoothGlasses();
  const perception = usePerceptionSession(bluetooth.device?.id || 'demo-device');

  const [responseHistory, setResponseHistory] = useState<PerceptionResponse[]>([]);

  useEffect(() => {
    if (perception.lastResponse && perception.lastResponse.type !== 'SILENT') {
      setResponseHistory(prev => [perception.lastResponse!, ...prev.slice(0, 9)]);

      if (bluetooth.isConnected && perception.lastResponse.displayText) {
        bluetooth.sendToGlasses(perception.lastResponse.displayText);
      }

      if (perception.lastResponse.speakText) {
        const utterance = new SpeechSynthesisUtterance(perception.lastResponse.speakText);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.1;
        speechSynthesis.speak(utterance);
      }
    }
  }, [perception.lastResponse]);

  const handleStartVision = async () => {
    if (!perception.session) {
      toast({ title: "请先启动感知会话", variant: "destructive" });
      return;
    }
    if (videoRef.current && canvasRef.current) {
      await perception.startVision(videoRef.current, canvasRef.current);
    }
  };

  const handlePerceive = () => {
    perception.perceive();
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'URGENT': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'NORMAL': return 'bg-blue-500';
      default: return 'bg-green-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DISPLAY': return <Monitor className="w-4 h-4" />;
      case 'SPEAK': return <Volume2 className="w-4 h-4" />;
      case 'BOTH': return <Sparkles className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-4 pt-4 pb-24 md:pb-4" data-testid="glasses-companion-page">
      <header className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回</span>
        </Button>
        <div className="flex items-center gap-2">
          <Glasses className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            眼镜伴侣
          </h1>
        </div>
        <div className="w-16" />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bluetooth className="w-5 h-5 text-blue-400" />
              蓝牙连接
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!bluetooth.isSupported ? (
              <div className="flex items-center gap-2 text-amber-400 bg-amber-950/30 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">此浏览器不支持蓝牙，请使用Chrome手机版</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {bluetooth.isConnected ? (
                      <BluetoothConnected className="w-8 h-8 text-green-400" />
                    ) : bluetooth.isScanning ? (
                      <BluetoothSearching className="w-8 h-8 text-blue-400 animate-pulse" />
                    ) : (
                      <Bluetooth className="w-8 h-8 text-slate-400" />
                    )}
                    <div>
                      <div className="font-medium">
                        {bluetooth.device?.name || 'INMO Go3'}
                      </div>
                      <div className="text-sm text-slate-400">
                        {bluetooth.isConnected ? '已连接' : bluetooth.isScanning ? '搜索中...' : '未连接'}
                      </div>
                    </div>
                  </div>

                  {bluetooth.device?.batteryLevel && (
                    <div className="flex items-center gap-1 text-green-400">
                      <Battery className="w-4 h-4" />
                      <span className="text-sm">{bluetooth.device.batteryLevel}%</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!bluetooth.isConnected ? (
                    <>
                      <Button
                        onClick={bluetooth.scan}
                        disabled={bluetooth.isScanning}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        data-testid="scan-button"
                      >
                        {bluetooth.isScanning ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <BluetoothSearching className="w-4 h-4 mr-2" />
                        )}
                        {bluetooth.isScanning ? '搜索中...' : '扫描眼镜'}
                      </Button>
                      {bluetooth.device && (
                        <Button
                          onClick={bluetooth.connect}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          data-testid="connect-button"
                        >
                          <BluetoothConnected className="w-4 h-4 mr-2" />
                          连接
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={bluetooth.disconnect}
                      variant="outline"
                      className="flex-1 border-red-500 text-red-400 hover:bg-red-950"
                      data-testid="disconnect-button"
                    >
                      断开连接
                    </Button>
                  )}
                </div>

                {bluetooth.error && (
                  <div className="text-red-400 text-sm bg-red-950/30 p-2 rounded">
                    {bluetooth.error}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="w-5 h-5 text-purple-400" />
              感知会话
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${perception.session ? 'bg-green-400' : 'bg-slate-500'}`} />
                <span className="text-sm">
                  {perception.session ? `会话ID: ${perception.session.id.slice(-8)}` : '未启动'}
                </span>
              </div>

              {perception.session ? (
                <Button
                  onClick={perception.endSession}
                  size="sm"
                  variant="outline"
                  className="border-red-500 text-red-400"
                  data-testid="end-session-button"
                >
                  结束会话
                </Button>
              ) : (
                <Button
                  onClick={perception.startSession}
                  disabled={perception.isCreatingSession}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="start-session-button"
                >
                  {perception.isCreatingSession ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  启动感知
                </Button>
              )}
            </div>

            <Separator className="bg-slate-700" />

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={perception.visionActive ? perception.stopVision : handleStartVision}
                disabled={!perception.session}
                variant={perception.visionActive ? "default" : "outline"}
                className={perception.visionActive ? "bg-cyan-600 hover:bg-cyan-700" : ""}
                data-testid="vision-toggle"
              >
                {perception.visionActive ? (
                  <Eye className="w-4 h-4 mr-2" />
                ) : (
                  <EyeOff className="w-4 h-4 mr-2" />
                )}
                视觉 {perception.visionActive ? '开' : '关'}
              </Button>

              <Button
                onClick={perception.audioActive ? perception.stopAudio : perception.startAudio}
                disabled={!perception.session}
                variant={perception.audioActive ? "default" : "outline"}
                className={perception.audioActive ? "bg-cyan-600 hover:bg-cyan-700" : ""}
                data-testid="audio-toggle"
              >
                {perception.audioActive ? (
                  <Mic className="w-4 h-4 mr-2" />
                ) : (
                  <MicOff className="w-4 h-4 mr-2" />
                )}
                听觉 {perception.audioActive ? '开' : '关'}
              </Button>
            </div>

            <Button
              onClick={handlePerceive}
              disabled={!perception.session || perception.isProcessing}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
              data-testid="perceive-button"
            >
              {perception.isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {perception.isProcessing ? '小星思考中...' : '让小星感知'}
            </Button>

            {perception.error && (
              <div className="text-red-400 text-sm bg-red-950/30 p-2 rounded">
                {perception.error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 relative">
        <video
          ref={videoRef}
          className={`w-full max-w-md mx-auto rounded-lg ${perception.visionActive ? 'block' : 'hidden'}`}
          playsInline
          muted
          data-testid="camera-preview"
        />
        <canvas ref={canvasRef} className="hidden" />

        {perception.visionActive && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-white">实时感知中</span>
          </div>
        )}
      </div>

      <Card className="mt-4 bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-400" />
            小星响应
          </CardTitle>
        </CardHeader>
        <CardContent>
          {responseHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>开启感知后，小星的响应会显示在这里</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <AnimatePresence>
                {responseHistory.map((response, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-slate-800/50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(response.type)}
                      <Badge className={getUrgencyColor(response.urgency)}>
                        {response.urgency}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {response.type === 'DISPLAY' ? '显示' : response.type === 'SPEAK' ? '语音' : '显示+语音'}
                      </span>
                    </div>

                    {response.displayText && (
                      <p className="text-cyan-300">{response.displayText}</p>
                    )}

                    {response.reasoning && (
                      <p className="text-xs text-slate-500 mt-2 italic">
                        推理：{response.reasoning}
                      </p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="mt-6 text-center text-slate-500 text-xs">
        陈先生出品 · cj6168888@Gmail.com
      </footer>
    </div>
  );
}

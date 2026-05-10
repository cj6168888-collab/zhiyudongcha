/**
 * Desktop Fairy Demo Page (桌面精灵演示页面)
 *
 * 展示小星跨设备迁移、多状态切换等功能
 */

import { useState } from 'react';
import { DesktopFairy, DesktopFairyContainer } from '@/components/avatar/desktop-fairy';
import useSpiritSingleton from '@/hooks/use-spirit-singleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import {
  Monitor,
  Smartphone,
  Tablet,
  Glasses,
  Tv,
  Sparkles,
  Briefcase,
  Shield,
  MoveRight,
  Zap,
  Heart,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const deviceIcons = {
  PC: Monitor,
  MOBILE: Smartphone,
  TABLET: Tablet,
  AR_GLASSES: Glasses,
  TV: Tv,
};

export default function DesktopFairyDemo() {
  const { t } = useTranslation();
  const {
    deviceId,
    deviceType,
    deviceName,
    isActive,
    isMigrating,
    isDeparting,
    isArriving,
    arrivalPhrase,
    token,
    avatarPose,
    devices,
    status,
    migrateToDevice,
    setMode,
    refetchToken,
  } = useSpiritSingleton();

  const [demoMode, setDemoMode] = useState<'DEFAULT' | 'WORK' | 'PROTECT'>('DEFAULT');
  const [demoState, setDemoState] = useState<'IDLE' | 'WALKING' | 'SLEEPING'>('IDLE');

  const DeviceIcon = deviceIcons[deviceType as keyof typeof deviceIcons] || Monitor;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6">
      <DesktopFairyContainer />

      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            桌面精灵系统
          </h1>
          <p className="text-slate-400">Desktop Fairy - 小星的跨设备存在</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DeviceIcon className="w-5 h-5 text-cyan-400" />
                当前设备
              </CardTitle>
              <CardDescription className="text-slate-400">
                {deviceName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">设备ID</span>
                <code className="text-xs bg-slate-700 px-2 py-1 rounded">
                  {deviceId.slice(0, 16)}...
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">小星状态</span>
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className={cn(
                    isActive && "bg-green-500/20 text-green-400 border-green-500/30"
                  )}
                >
                  {isActive ? '🌟 小星在这里' : '💤 小星在别处'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">迁移状态</span>
                <Badge variant="outline" className={cn(
                  isMigrating && "border-yellow-500 text-yellow-400"
                )}>
                  {isMigrating ? '迁移中...' : '稳定'}
                </Badge>
              </div>

              <Separator className="bg-slate-700" />

              <div className="space-y-2">
                <span className="text-sm text-slate-400">小星模式</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={avatarPose?.mode === 'DEFAULT' ? 'default' : 'outline'}
                    onClick={() => setMode('DEFAULT')}
                    className="text-xs"
                    data-testid="button-mode-default"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    默认
                  </Button>
                  <Button
                    size="sm"
                    variant={avatarPose?.mode === 'WORK' ? 'default' : 'outline'}
                    onClick={() => setMode('WORK')}
                    className="text-xs"
                    data-testid="button-mode-work"
                  >
                    <Briefcase className="w-3 h-3 mr-1" />
                    工作
                  </Button>
                  <Button
                    size="sm"
                    variant={avatarPose?.mode === 'PROTECT' ? 'default' : 'outline'}
                    onClick={() => setMode('PROTECT')}
                    className="text-xs"
                    data-testid="button-mode-protect"
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    保护
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-yellow-400" />
                已连接设备
                <Badge variant="outline" className="ml-auto">
                  {devices.length} 台
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>正在搜索设备...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {devices.map((device) => {
                    const Icon = deviceIcons[device.deviceType as keyof typeof deviceIcons] || Monitor;
                    const isThisDevice = device.deviceId === deviceId;
                    const isActiveDevice = token?.activeDeviceId === device.deviceId;

                    return (
                      <motion.div
                        key={device.deviceId}
                        layout
                        className={cn(
                          "p-4 rounded-lg border transition-all",
                          isActiveDevice
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-slate-700 hover:border-slate-600",
                          isThisDevice && "ring-1 ring-blue-500"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-2 rounded-md",
                              isActiveDevice ? "bg-cyan-500 text-white" : "bg-slate-700"
                            )}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {device.deviceName}
                                {isThisDevice && (
                                  <span className="text-xs text-blue-400 ml-1">(本机)</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">{device.deviceType}</p>
                            </div>
                          </div>

                          <Badge
                            variant={device.isOnline ? 'default' : 'secondary'}
                            className={cn(
                              "text-xs",
                              device.isOnline && "bg-green-500/20 text-green-400"
                            )}
                          >
                            {device.isOnline ? '在线' : '离线'}
                          </Badge>
                        </div>

                        {isActiveDevice && (
                          <div className="flex items-center gap-1 text-xs text-cyan-400 mb-2">
                            <Heart className="w-3 h-3" />
                            <span>小星正在这里</span>
                          </div>
                        )}

                        {!isActiveDevice && device.isOnline && !isThisDevice && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs mt-2"
                            onClick={() => migrateToDevice(device.deviceId)}
                            disabled={isMigrating}
                            data-testid={`button-migrate-${device.deviceId}`}
                          >
                            <MoveRight className="w-3 h-3 mr-1" />
                            召唤小星到这里
                          </Button>
                        )}

                        {!isActiveDevice && device.isOnline && isThisDevice && (
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full text-xs mt-2 bg-cyan-600 hover:bg-cyan-700"
                            onClick={() => migrateToDevice(device.deviceId)}
                            disabled={isMigrating}
                            data-testid="button-summon-here"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            召唤小星到本机
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg">小星姿态预览</CardTitle>
            <CardDescription className="text-slate-400">
              在下方实时预览小星的不同状态和动画
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[400px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden border border-slate-700">
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cyan-900/20 to-transparent" />

              <AnimatePresence>
                {(isActive || isDeparting || isArriving) && (
                  <DesktopFairy
                    isActive={isActive}
                    state={avatarPose?.state || 'IDLE'}
                    mood={avatarPose?.mood || 'HAPPY'}
                    mode={avatarPose?.mode || 'DEFAULT'}
                    position={{ x: 50, y: 30 }}
                    direction={avatarPose?.direction || 'RIGHT'}
                    size="xl"
                    isDeparting={isDeparting}
                    isArriving={isArriving}
                    arrivalPhrase={arrivalPhrase}
                    enableDrag={false}
                    enableGazeFollow={true}
                  />
                )}
              </AnimatePresence>

              {!isActive && !isDeparting && !isArriving && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>小星正在别的设备上</p>
                    <p className="text-sm">点击上方"召唤小星到本机"按钮</p>
                  </div>
                </div>
              )}

              {isMigrating && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-cyan-400"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.1,
                        repeat: Infinity,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDemoState('IDLE')}
                data-testid="button-state-idle"
              >
                待机
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDemoState('WALKING')}
                data-testid="button-state-walking"
              >
                走路
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDemoState('SLEEPING')}
                data-testid="button-state-sleeping"
              >
                睡觉
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchToken()}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                刷新
              </Button>
            </div>
          </CardContent>
        </Card>

        {token && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg">灵魂令牌状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">令牌ID</span>
                  <p className="font-mono text-xs truncate">{token.tokenId}</p>
                </div>
                <div>
                  <span className="text-slate-400">活跃设备</span>
                  <p className="font-mono text-xs truncate">{token.activeDeviceId || '无'}</p>
                </div>
                <div>
                  <span className="text-slate-400">小星状态</span>
                  <p>{token.avatarPose.state}</p>
                </div>
                <div>
                  <span className="text-slate-400">心情</span>
                  <p>{token.avatarPose.mood}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

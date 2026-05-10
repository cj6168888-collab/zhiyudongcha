import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Play, Pause, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { tacticalTerminal, MockOpTask } from '@/lib/z5/tactical-terminal';

interface MockOpLayerProps {
  isActive?: boolean;
  onTaskComplete?: (taskId: string) => void;
}

export function MockOpLayer({ isActive: externalActive, onTaskComplete }: MockOpLayerProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentTask, setCurrentTask] = useState<MockOpTask | null>(null);
  const [fingerPosition, setFingerPosition] = useState({ x: 0, y: 0 });
  const [actionIndex, setActionIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = tacticalTerminal.subscribe((state) => {
      setIsActive(state.mockOpActive);
      setCurrentTask(state.currentTask);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (currentTask && currentTask.coordinates.length > 0) {
      let index = 0;
      const interval = setInterval(() => {
        if (index < currentTask.coordinates.length) {
          setFingerPosition(currentTask.coordinates[index]);
          setActionIndex(index);
          index++;
        } else {
          clearInterval(interval);
          onTaskComplete?.(currentTask.id);
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [currentTask, onTaskComplete]);

  const runDemoTask = async () => {
    const demoTask: MockOpTask = {
      id: 'demo-task-1',
      description: '演示自主办公任务',
      coordinates: [
        { x: 100, y: 150 },
        { x: 200, y: 200 },
        { x: 150, y: 300 },
        { x: 250, y: 250 },
      ],
      action: 'click',
    };

    await tacticalTerminal.runAutonomousTask(demoTask);
  };

  return (
    <>
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="fixed inset-0 z-40 pointer-events-none"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.3)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="mock-op-overlay"
          >
            <motion.div
              className="absolute w-12 h-12 flex items-center justify-center"
              style={{
                left: fingerPosition.x - 24,
                top: fingerPosition.y - 24,
              }}
              animate={{
                left: fingerPosition.x - 24,
                top: fingerPosition.y - 24,
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-md animate-pulse" />
                <Hand className="w-8 h-8 text-cyan-400 relative z-10" />
              </div>

              <motion.div
                className="absolute w-16 h-16 border-2 border-cyan-400/50 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            </motion.div>

            {currentTask && (
              <div className="absolute top-4 left-4 right-4">
                <motion.div
                  className="bg-slate-800/90 border border-slate-600 rounded-lg p-3"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium text-slate-200">
                        拟人操作执行中
                      </span>
                    </div>
                    <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
                      步骤 {actionIndex + 1}/{currentTask.coordinates.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{currentTask.description}</p>
                </motion.div>
              </div>
            )}

            {currentTask && currentTask.coordinates.map((coord, i) => (
              <motion.div
                key={i}
                className={cn(
                  "absolute w-3 h-3 rounded-full",
                  i <= actionIndex ? 'bg-cyan-400' : 'bg-slate-600'
                )}
                style={{
                  left: coord.x - 6,
                  top: coord.y - 6,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
              />
            ))}

            {currentTask && actionIndex > 0 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {currentTask.coordinates.slice(0, actionIndex + 1).map((coord, i) => {
                  if (i === 0) return null;
                  const prev = currentTask.coordinates[i - 1];
                  return (
                    <motion.line
                      key={i}
                      x1={prev.x}
                      y1={prev.y}
                      x2={coord.x}
                      y2={coord.y}
                      stroke="rgba(34, 211, 238, 0.5)"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  );
                })}
              </svg>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-slate-700 bg-slate-800/50" data-testid="mock-op-panel">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Hand className="w-4 h-4" />
              拟人操作遮罩层
            </div>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? '执行中' : '待命'}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-xs text-slate-400">
            当小星执行自主办公任务时，会在屏幕表面覆盖透明 UI 层，展示虚拟手指的点击路径，确保过程透明可控。
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runDemoTask}
              disabled={isActive}
              className="gap-2"
              data-testid="button-run-demo"
            >
              <Play className="w-4 h-4" />
              演示任务
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!isActive}
              className="gap-2"
              data-testid="button-pause-task"
            >
              <Pause className="w-4 h-4" />
              暂停执行
            </Button>
          </div>

          {currentTask && (
            <div className="p-3 bg-slate-900/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">当前任务</span>
                <Badge variant="outline">{currentTask.action}</Badge>
              </div>
              <p className="text-xs text-slate-300">{currentTask.description}</p>
              <div className="text-xs text-slate-500">
                路径点: {currentTask.coordinates.length} 个
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

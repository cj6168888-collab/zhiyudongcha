/**
 * SkillMarketplace - 技能市场页面
 *
 * 浏览、管理和使用 OpenClaw 技能系统
 *
 * @version 1.0.0
 * @date 2026-03-18
 */

import { useState, useEffect } from 'react';
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Search, Grid, List, Plus, Play,
  ChevronRight, Zap, MousePointer2,
  Keyboard, Camera, AppWindow, FileText,
  Settings, RefreshCw, Check, X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSkillEngine, useOpenClawStore, type Skill, type SkillResult } from "@/lib/ai-skill-engine";

type CategoryFilter = 'all' | 'control' | 'automation' | 'file' | 'system';
type ViewMode = 'grid' | 'list';

const categoryConfig: Record<CategoryFilter, { label: string; icon: typeof MousePointer2; color: string }> = {
  all: { label: '全部', icon: Grid, color: 'text-gray-400' },
  control: { label: '控制', icon: MousePointer2, color: 'text-green-400' },
  automation: { label: '自动化', icon: Zap, color: 'text-blue-400' },
  file: { label: '文件', icon: FileText, color: 'text-yellow-400' },
  system: { label: '系统', icon: Settings, color: 'text-purple-400' },
};

export default function SkillMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<SkillResult | null>(null);

  const { isConnected, devices, activeDevice } = useOpenClawStore();

  // 加载技能列表
  useEffect(() => {
    const engine = getSkillEngine();
    setSkills(engine.getAllSkills());
  }, []);

  // 过滤技能
  const filteredSkills = skills.filter(skill => {
    // 类别过滤
    if (categoryFilter !== 'all' && skill.category !== categoryFilter) {
      return false;
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.patterns.some(p => p.toLowerCase().includes(query))
      );
    }

    return true;
  });

  // 执行技能
  const handleExecuteSkill = async (skill: Skill) => {
    if (!isConnected) {
      toast.error('设备未连接，无法执行技能');
      return;
    }

    setSelectedSkill(skill);
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await skill.execute();
      setExecutionResult(result);

      if (result.success) {
        toast.success(`技能 "${skill.name}" 执行成功`);
      } else {
        toast.error(result.error || '执行失败');
      }
    } catch (error) {
      setExecutionResult({
        success: false,
        error: error instanceof Error ? error.message : '执行异常',
        duration: 0
      });
      toast.error('执行异常');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <SafeLayout headerTitle="技能市场" headerRight={
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          className="p-2 rounded-xl bg-white/5 active:bg-white/10"
        >
          {viewMode === 'grid' ? (
            <List className="w-4 h-4 text-gray-400" />
          ) : (
            <Grid className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
    }>
      <div className="space-y-4 pb-20">

        {/* 连接状态提示 */}
        {!isConnected && (
          <div className="mx-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[11px] text-amber-400">
              设备未连接，部分功能可能无法使用。请先连接PC设备。
            </p>
          </div>
        )}

        {/* 搜索栏 */}
        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索技能..."
              className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* 类别过滤 */}
        <div className="px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const Icon = config.icon;
              const isActive = categoryFilter === key;

              return (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key as CategoryFilter)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-[11px] font-bold uppercase transition-all",
                    isActive
                      ? "bg-primary text-white"
                      : "bg-white/5 text-gray-400 active:bg-white/10"
                  )}
                >
                  <Icon className={cn("w-3 h-3", isActive ? "text-white" : config.color)} />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 技能统计 */}
        <div className="px-4">
          <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase">
            <span>共 {filteredSkills.length} 个技能</span>
            <span>{isConnected ? '在线' : '离线'}</span>
          </div>
        </div>

        {/* 技能列表 */}
        <div className="px-4">
          {filteredSkills.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">没有找到匹配的技能</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onExecute={() => handleExecuteSkill(skill)}
                  isExecuting={isExecuting && selectedSkill?.id === skill.id}
                  disabled={!isConnected}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSkills.map((skill) => (
                <SkillListItem
                  key={skill.id}
                  skill={skill}
                  onExecute={() => handleExecuteSkill(skill)}
                  isExecuting={isExecuting && selectedSkill?.id === skill.id}
                  disabled={!isConnected}
                />
              ))}
            </div>
          )}
        </div>

        {/* 执行结果弹窗 */}
        {executionResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm p-6 rounded-3xl bg-[#0a0a0f] border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">执行结果</h3>
                <button onClick={() => setExecutionResult(null)}>
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className={cn(
                "p-4 rounded-2xl mb-4",
                executionResult.success
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              )}>
                <div className="flex items-center gap-2">
                  {executionResult.success ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                  <span className={cn(
                    "text-sm font-bold",
                    executionResult.success ? "text-green-500" : "text-red-500"
                  )}>
                    {executionResult.success ? '成功' : '失败'}
                  </span>
                </div>

                {executionResult.error && (
                  <p className="text-[11px] text-gray-400 mt-2">{executionResult.error}</p>
                )}

                <p className="text-[10px] text-gray-600 mt-2">
                  耗时: {executionResult.duration}ms
                </p>
              </div>

              <button
                onClick={() => setExecutionResult(null)}
                className="w-full h-12 rounded-2xl bg-white/10 text-sm font-bold text-white active:bg-white/20"
              >
                关闭
              </button>
            </div>
          </div>
        )}

      </div>
    </SafeLayout>
  );
}

// 技能卡片组件
function SkillCard({
  skill,
  onExecute,
  isExecuting,
  disabled
}: {
  skill: Skill;
  onExecute: () => void;
  isExecuting: boolean;
  disabled: boolean;
}) {
  const categoryColor = {
    control: 'bg-green-500/20 text-green-400',
    automation: 'bg-blue-500/20 text-blue-400',
    file: 'bg-yellow-500/20 text-yellow-400',
    system: 'bg-purple-500/20 text-purple-400',
  }[skill.category];

  const CategoryIcon = {
    control: MousePointer2,
    automation: Zap,
    file: FileText,
    system: Settings,
  }[skill.category];

  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-xl", categoryColor)}>
          <CategoryIcon className="w-4 h-4" />
        </div>
        <button
          onClick={onExecute}
          disabled={disabled || isExecuting}
          className="p-2 rounded-xl bg-green-500/20 text-green-400 active:bg-green-500/30 disabled:opacity-50"
        >
          {isExecuting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white">{skill.name}</h3>
        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{skill.description}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {skill.patterns.slice(0, 3).map((pattern, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-gray-500"
          >
            {pattern.replace(/[{}]/g, '')}
          </span>
        ))}
      </div>
    </div>
  );
}

// 技能列表项组件
function SkillListItem({
  skill,
  onExecute,
  isExecuting,
  disabled
}: {
  skill: Skill;
  onExecute: () => void;
  isExecuting: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white truncate">{skill.name}</h3>
        <p className="text-[10px] text-gray-500 truncate">{skill.description}</p>
      </div>

      <button
        onClick={onExecute}
        disabled={disabled || isExecuting}
        className="p-3 rounded-xl bg-green-500/20 text-green-400 active:bg-green-500/30 disabled:opacity-50"
      >
        {isExecuting ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

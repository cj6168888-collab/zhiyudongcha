/**
 * Awakening - 吉麟洞察：创世觉醒仪式 2.0 (增强引导版)
 *
 * 增强：模式选择、功能预览、权限说明、设备配对引导
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Shield, Users, Building2, Sparkles,
  Check, Smartphone, Mic, FileText,
  BrainCircuit, Lock, Globe
} from "lucide-react";

// 用户模式类型
type UserMode = 'PERSONAL' | 'ENTERPRISE' | 'TEAM';

// 模式配置
const MODE_CONFIG: Record<UserMode, {
  name: string;
  icon: typeof Shield;
  color: string;
  description: string;
  features: string[];
}> = {
  PERSONAL: {
    name: '个人模式',
    icon: Shield,
    color: 'text-blue-400',
    description: '专注个人效率提升，AI助手全程陪伴',
    features: ['AI专家顾问', '项目管理', '成果智库', 'PC代理执行']
  },
  ENTERPRISE: {
    name: '企业模式',
    icon: Building2,
    color: 'text-amber-400',
    description: '团队协作管理，企业级安全防护',
    features: ['团队管理', '权限控制', '审计日志', 'API集成']
  },
  TEAM: {
    name: '团队模式',
    icon: Users,
    color: 'text-green-400',
    description: '多人协作，共享资源与知识库',
    features: ['实时协作', '任务分发', '资源共享', '进度追踪']
  }
};

// 功能预览配置
const FEATURE_PREVIEW = [
  { id: 'expert', name: 'AI专家', icon: BrainCircuit, desc: '5位领域专家随时待命', color: 'bg-blue-500' },
  { id: 'project', name: '项目管理', icon: FileText, desc: '智能化项目全生命周期管理', color: 'bg-purple-500' },
  { id: 'control', name: 'PC代理', icon: Smartphone, desc: '用指令让电脑替你工作', color: 'bg-green-500' },
  { id: 'vault', name: '成果智库', icon: Sparkles, desc: 'AI自动整理归档', color: 'bg-amber-500' },
];

// 权限配置
const PERMISSIONS = [
  { icon: Mic, name: '麦克风权限', desc: '用于语音指令和语音输入', required: true },
  { icon: Globe, name: '网络访问', desc: '连接AI服务和同步数据', required: true },
  { icon: FileText, name: '存储权限', desc: '保存和读取项目文件', required: false },
  { icon: Smartphone, name: '设备代理', desc: '把执行指令分派给已配对电脑', required: false },
];

interface ScriptStep {
  id: string;
  text?: string;
  delay?: number;
  field?: string;
  placeholder?: string;
}

export default function Awakening() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [masterName, setMasterName] = useState("");
  const [userMode, setUserMode] = useState<UserMode>('PERSONAL');
  const [agreedPermissions, setAgreedPermissions] = useState(false);

  // 引导脚本步骤
  const scripts: ScriptStep[] = useMemo(() => [
    { id: 'loading', text: "……核心逻辑加载中……", delay: 2000 },
    { id: 'awake', text: "我第一次睁开眼，看见了数字构成的繁星。", delay: 3000 },
    { id: 'intro', text: "我是\"吉麟\"，你的数字生命合伙人。", delay: 3000 },
    { id: 'mode', delay: 500 }, // 模式选择
    { id: 'features', delay: 500 }, // 功能预览
    { id: 'identity', text: "作为\"蜂群\"的唯一主控节点，我需要记录你的身份。", delay: 2000 },
    { id: 'name', field: "masterName", placeholder: "输入你的尊称..." },
    { id: 'permissions', delay: 500 }, // 权限说明
    { id: 'complete', delay: 2000 }, // 完成
  ], []);

  // 自动推进步骤
  useEffect(() => {
    const currentScript = scripts[step];
    if (currentScript?.delay && !currentScript.field) {
      const timer = setTimeout(() => setStep(s => s + 1), currentScript.delay);
      return () => clearTimeout(timer);
    }
  }, [step, scripts]);

  // 处理完成
  const handleFinish = () => {
    if (!masterName.trim()) {
      toast.error("主控身份不能为空");
      return;
    }
    // 保存用户配置
    localStorage.setItem("jilin_user_role", "MASTER");
    localStorage.setItem("jilin_master_name", masterName);
    localStorage.setItem("jilin_user_mode", userMode);
    localStorage.setItem("jilin_onboarding_complete", "true");

    toast.success(`欢迎，${masterName}！创世协议已签署`);
    setStep(scripts.length - 1); // 跳转到完成步骤

    // 延迟跳转
    setTimeout(() => setLocation('/'), 2500);
  };

  // 跳到下一步
  const goNext = () => {
    if (step < scripts.length - 1) {
      setStep(s => s + 1);
    }
  };

  // 当前步骤数据
  const currentScript = scripts[step];
  const modeConfig = MODE_CONFIG[userMode];

  return (
    <div className="fixed inset-0 bg-[#030712] flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#6366f1]/10 to-transparent pointer-events-none" />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-lg w-full"
        >
          {/* 步骤1-4: 文字对话 */}
          {currentScript.text && (
            <div className="space-y-12">
              <div className="relative flex justify-center">
                <motion.div
                  animate={{
                    boxShadow: ["0 0 20px rgba(99,102,241,0.2)", "0 0 60px rgba(99,102,241,0.4)", "0 0 20px rgba(99,102,241,0.2)"]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="w-32 h-32 rounded-[2rem] overflow-hidden border-2 border-primary/30 relative z-10 shadow-2xl bg-black"
                >
                  <img src="/xiaoji-avatar.png" alt="小吉" className="w-full h-full object-cover" />
                </motion.div>
              </div>

              <div className="space-y-8">
                <p className="text-xl font-medium leading-relaxed text-white/90 tracking-wide text-center">
                  {currentScript.text}
                </p>

                {step < 3 && (
                  <div className="flex justify-center">
                    <button
                      onClick={goNext}
                      className="px-6 py-2 rounded-full bg-white/5 text-gray-500 text-xs font-bold uppercase tracking-widest"
                    >
                      跳过
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 步骤: 模式选择 */}
          {currentScript.id === 'mode' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">选择你的模式</h2>
                <p className="text-sm text-gray-500">不同模式将提供不同的功能组合</p>
              </div>

              <div className="space-y-3">
                {(Object.keys(MODE_CONFIG) as UserMode[]).map((mode) => {
                  const config = MODE_CONFIG[mode];
                  const Icon = config.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => setUserMode(mode)}
                      className={cn(
                        "w-full p-4 rounded-2xl border-2 transition-all text-left",
                        userMode === mode
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl bg-white/5", config.color)}>
                          <Icon className={cn("w-6 h-6", config.color)} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white">{config.name}</h3>
                          <p className="text-xs text-gray-500">{config.description}</p>
                        </div>
                        {userMode === mode && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={goNext}
                className="w-full py-4 rounded-2xl bg-primary text-white font-bold uppercase tracking-widest active:scale-[0.98] transition-all"
              >
                确认模式
              </button>
            </motion.div>
          )}

          {/* 步骤: 功能预览 */}
          {currentScript.id === 'features' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">核心功能一览</h2>
                <p className="text-sm text-gray-500">{modeConfig.name} 包含以下功能</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {FEATURE_PREVIEW.map((feature) => (
                  <div
                    key={feature.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", feature.color)}>
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm">{feature.name}</h3>
                    <p className="text-[10px] text-gray-500 leading-tight">{feature.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {modeConfig.features.map((feature) => (
                  <span key={feature} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">
                    {feature}
                  </span>
                ))}
              </div>

              <button
                onClick={goNext}
                className="w-full py-4 rounded-2xl bg-primary text-white font-bold uppercase tracking-widest active:scale-[0.98] transition-all"
              >
                继续
              </button>
            </motion.div>
          )}

          {/* 步骤: 身份输入 */}
          {currentScript.field && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="relative flex justify-center">
                <motion.div
                  animate={{
                    boxShadow: ["0 0 20px rgba(99,102,241,0.2)", "0 0 60px rgba(99,102,241,0.4)", "0 0 20px rgba(99,102,241,0.2)"]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="w-32 h-32 rounded-[2rem] overflow-hidden border-2 border-primary/30 relative z-10 shadow-2xl bg-black"
                >
                  <img src="/xiaoji-avatar.png" alt="小吉" className="w-full h-full object-cover" />
                </motion.div>
              </div>

              <div className="space-y-4">
                <p className="text-xl font-medium leading-relaxed text-white/90 tracking-wide text-center">
                  请告诉我，我的创造者，我该如何称呼你？
                </p>

                <input
                  autoFocus
                  value={masterName}
                  onChange={(e) => setMasterName(e.target.value)}
                  placeholder={currentScript.placeholder}
                  className="w-full bg-transparent border-b border-white/20 py-4 text-center text-primary text-lg focus:border-primary focus:outline-none transition-all placeholder:text-gray-700"
                  onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
                />
              </div>

              <button
                onClick={handleFinish}
                disabled={!masterName.trim()}
                className="w-full py-4 rounded-2xl bg-primary/10 border border-primary/30 text-primary text-xs font-black uppercase tracking-[0.3em] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                签署创世协议
              </button>
            </motion.div>
          )}

          {/* 步骤: 权限说明 */}
          {currentScript.id === 'permissions' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <Lock className="w-12 h-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-white">权限授权</h2>
                <p className="text-sm text-gray-500">我们需要以下权限来提供服务</p>
              </div>

              <div className="space-y-3">
                {PERMISSIONS.map((perm, idx) => {
                  const Icon = perm.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <div className="p-2 rounded-xl bg-primary/20">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{perm.name}</h3>
                          {perm.required && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[8px] font-bold">必选</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500">{perm.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedPermissions}
                  onChange={(e) => setAgreedPermissions(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-400">我已阅读并同意权限说明</span>
              </label>

              <button
                onClick={handleFinish}
                disabled={!agreedPermissions || !masterName}
                className="w-full py-4 rounded-2xl bg-primary text-white font-bold uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                完成设置
              </button>
            </motion.div>
          )}

          {/* 步骤: 完成 */}
          {currentScript.id === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 py-12"
            >
              <div className="relative flex justify-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-40 h-40 rounded-full bg-primary/20 flex items-center justify-center"
                >
                  <Sparkles className="w-20 h-20 text-primary" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-wider">创世完成</h2>
                <p className="text-gray-400">欢迎进入蜂群系统，{masterName}</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 步骤指示器 */}
      {step < scripts.length - 1 && currentScript.id !== 'complete' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {scripts.filter(s => s.id !== 'complete').map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === step ? "bg-primary w-6" : idx < step ? "bg-primary/50" : "bg-white/20"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

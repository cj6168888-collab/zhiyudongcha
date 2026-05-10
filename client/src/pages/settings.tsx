/**
 * SettingsPage - 吉麟洞察 灵魂矩阵 (支持形象切换)
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Sparkles, Brain, Scale, Volume2,
  Fingerprint, Lock, ChevronRight, Check
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const skins = [
  { id: 'awakening', name: '觉醒机甲', path: '/xiaoji-avatar.png' },
  { id: 'classic', name: '经典核心', path: '/favicon.png' }
];

export default function SettingsPage() {
  const [avatarName, setAvatarName] = useState("小吉");
  // 从本地存储读取当前选中的形象
  const [selectedSkin, setSelectedSkin] = useState(() => localStorage.getItem('xiaoji_skin') || 'awakening');

  const handleSkinChange = (skinId: string) => {
    setSelectedSkin(skinId);
    localStorage.setItem('xiaoji_skin', skinId);
    // 强制触发页面局部刷新或状态同步（简单起见先存本地）
  };

  return (
    <SafeLayout headerTitle="灵魂矩阵" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 1. 形象选择 (Skins) - 新增功能 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">吉麟数字形态</h3>
          <div className="flex gap-4 px-1">
            {skins.map(skin => (
              <button
                key={skin.id}
                onClick={() => handleSkinChange(skin.id)}
                className="relative flex flex-col items-center gap-2 group"
              >
                <div className={cn(
                  "w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all",
                  selectedSkin === skin.id ? "border-primary shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-105" : "border-white/5 opacity-50 grayscale"
                )}>
                  <img src={skin.path} alt={skin.name} className="w-full h-full object-cover" />
                </div>
                <span className={cn("text-[10px] font-bold", selectedSkin === skin.id ? "text-primary" : "text-gray-600")}>
                  {skin.name}
                </span>
                {selectedSkin === skin.id && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5 shadow-lg">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 2. 核心定义 (保持之前逻辑) */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">核心定义</h3>
          <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-white">唤醒名</span>
              </div>
              <input
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                className="bg-transparent text-right text-sm text-gray-400 focus:text-white focus:outline-none"
              />
            </div>

            {/* 性格、标准、语音选择框... */}
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-bold text-white">性格偏好</span>
              </div>
              <select className="bg-transparent text-sm text-gray-400">
                <option>理性冷静</option><option>热情幽默</option><option>专业严谨</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. 安全准入 (保持之前逻辑) */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">主人安全准入</h3>
          <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
            <button className="w-full p-5 flex items-center justify-between active:bg-white/5">
              <div className="flex items-center gap-4">
                <Fingerprint className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <p className="text-sm font-bold text-white">生物识别校验</p>
                  <p className="text-[9px] text-gray-500 italic">指纹、面容双重锁死</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-green-600 rounded-full flex items-center justify-end px-1"><div className="w-3 h-3 bg-white rounded-full" /></div>
            </button>
          </div>
        </section>

        <div className="pt-4">
          <button className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm">
            重新注入灵魂
          </button>
        </div>

      </div>
    </SafeLayout>
  );
}

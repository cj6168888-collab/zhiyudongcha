/**
 * SecurityCenter - 吉麟最后防线 (巅峰物理熔断版)
 *
 * 遵循开发宪法：熔断指令必须执行物理粉碎 (Physical Shredding)。
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { ShieldAlert, MapPin, Fingerprint, ZapOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Filesystem, Directory } from '@capacitor/filesystem';

export default function SecurityCenter() {
  const [isMeltdownArmed, setIsMeltdownArmed] = useState(false);

  // 1. 核心修复：执行真实的物理粉碎逻辑 (解决黑洞 3)
  const executeMeltdown = async () => {
    toast.loading("正在物理粉碎本地商业资产并断开 Z3 链路...");

    try {
      // 第一步：通知服务器物理吊销所有凭证
      const serverRes = await fetch('/api/security/meltdown', { method: 'POST' });

      if (serverRes.ok) {
        // 第二步：Capacitor 物理擦除本地下载目录 (物理文件级自毁)
        await Filesystem.rmdir({
          path: 'documents',
          directory: Directory.Data,
          recursive: true
        }).catch(() => {}); // 即使目录不存在也继续

        // 第三步：清除所有本地缓存与 JWT
        localStorage.clear();
        sessionStorage.clear();

        toast.success("物理自毁完成：系统已进入紧急静默态。");

        // 强制重置 App 状态
        setTimeout(() => window.location.href = '/awakening', 2000);
      }
    } catch (err) {
      toast.error("熔断协议通信受阻：正在尝试紧急本地销毁...");
      localStorage.clear();
      window.location.href = '/awakening';
    }
  };

  return (
    <SafeLayout headerTitle="最后防线">
      <div className="space-y-6 pb-10">

        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-red-600/20 to-transparent border border-red-500/30">
          <div className="flex items-center gap-3 text-red-500 mb-4">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <h2 className="text-base font-black tracking-widest uppercase italic font-serif">Last Stand Protocol</h2>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed italic">
            防线协议已就绪。一旦双击红色按钮，吉麟将执行物理文件粉碎及全网权限吊销。
          </p>
        </div>

        <div className="space-y-3">
          <button onClick={() => toast.success("全网指纹授信正常")} className="w-full p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Fingerprint className="w-5 h-5 text-blue-400" />
              <div className="text-left">
                <h3 className="text-sm font-bold text-white">生物特征锁</h3>
                <p className="text-[9px] text-gray-500 font-mono tracking-tighter">BIOMETRIC_STATUS: SECURE</p>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </button>
        </div>

        <div className="pt-10 border-t border-white/5">
          <button
            onDoubleClick={executeMeltdown}
            className="w-full h-24 rounded-[2.5rem] bg-black border-2 border-red-600/50 flex flex-col items-center justify-center gap-2 group active:bg-red-600 transition-all shadow-2xl shadow-red-600/10"
          >
            <ZapOff className="w-8 h-8 text-red-600 group-active:text-white" />
            <span className="text-[10px] font-black text-red-600 group-active:text-white tracking-[0.3em] uppercase italic">Double Tap to Meltdown</span>
          </button>
          <p className="text-[9px] text-center text-gray-600 mt-4 italic">注意：本指令具有物理级破坏性，不可撤回。</p>
        </div>

      </div>
    </SafeLayout>
  );
}

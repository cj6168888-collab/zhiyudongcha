/**
 * ScannerLab - 扫描实验室 3.0
 * 支持多页文档会话（DocumentPlugin）+ 单页文件上传
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Camera,
  FileUp,
  Scan,
  CheckCircle2,
  UploadCloud,
  Globe,
  Lock,
  Loader2,
  Plus,
  Trash2,
  X,
  FileText,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/lib/useApi";
import { useGlobalStore } from "@/store/globalStore";
import { useDocumentScan } from "@/hooks/use-document-scan";

interface ScanRecord {
  id: string;
  name: string;
  status: string;
  createdAt?: number;
}

export default function ScannerLab() {
  const shareToSwarm    = useGlobalStore((s) => s.shareToSwarm);
  const setShareToSwarm = useGlobalStore((s) => s.setShareToSwarm);
  const addScan         = useGlobalStore((s) => s.addScan);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { state, pages, startSession, addPage, removePage, submit, reset } = useDocumentScan();

  const { data: recentScans = [] } = useApiQuery(
    ["/api/scans/recent"],
    async () => {
      const res = await fetch("/api/scans/recent");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return (data.items || data || []) as ScanRecord[];
    }
  );

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleString("zh-CN", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const isSubmitting = state === 'submitting';
  const isActive     = state === 'active' || state === 'submitting';

  // Open file picker — on first pick, auto-starts a session
  const openPicker = async () => {
    if (state === 'idle' || state === 'done' || state === 'error') {
      await startSession();
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addPage(file);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (pages.length === 0) return;
    const result = await submit(shareToSwarm);
    if (result.success) {
      toast.success(result.message);
      pages.forEach((p) =>
        addScan({ id: `${Date.now()}`, name: p.file.name, status: 'COMPLETED', createdAt: Date.now() })
      );
      reset();
    } else {
      toast.error(result.message);
    }
  };

  const handleReset = () => {
    reset();
    toast.info('扫描会话已清除');
  };

  return (
    <SafeLayout headerTitle="扫描实验室" showBack={true}>
      <div className="space-y-6 pb-10">
        {/* Hidden file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.docx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* ── 采集入口 ── */}
        {!isActive && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={openPicker}
              className="h-40 rounded-[2.5rem] bg-primary flex flex-col items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-primary/20"
            >
              <Camera className="w-8 h-8 text-white" />
              <span className="text-xs font-black text-white uppercase tracking-widest">拍照扫描</span>
            </button>
            <button
              onClick={openPicker}
              className="h-40 rounded-[2.5rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <FileUp className="w-8 h-8 text-blue-400" />
              <span className="text-xs font-black text-white uppercase tracking-widest">文件导入</span>
            </button>
          </div>
        )}

        {/* ── 多页会话面板 ── */}
        {isActive && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
                扫描会话 · {pages.length} 页
              </h3>
              <button onClick={handleReset} className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                <X className="w-3 h-3" /> 放弃
              </button>
            </div>

            {/* 页面缩略列表 */}
            <div className="space-y-2">
              {pages.map((page, i) => (
                <div key={page.addedAt} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  {page.previewUrl ? (
                    <img src={page.previewUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 bg-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">{page.file.name}</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">
                      第 {i + 1} 页 · {(page.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => removePage(i)}
                    disabled={isSubmitting}
                    className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 active:bg-red-500/30"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>

            {/* 继续添加页 */}
            <button
              onClick={openPicker}
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl border border-dashed border-white/20 flex items-center justify-center gap-2 text-xs text-gray-500 font-bold active:bg-white/5 transition-all disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> 继续添加页面
            </button>
          </section>
        )}

        {/* ── 上传配置 + 提交 ── */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Upload Configuration
          </h3>
          <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-6">
            {/* 蜂群同步切换 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {shareToSwarm ? (
                  <Globe className="w-5 h-5 text-purple-400" />
                ) : (
                  <Lock className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <p className="text-sm font-bold text-white">蜂群同步模式</p>
                  <p className="text-[9px] text-gray-500">
                    {shareToSwarm ? "所有子账户均可调取此知识" : "仅主账户可见，逻辑物理隔离"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShareToSwarm(!shareToSwarm)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all flex items-center px-1",
                  shareToSwarm ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"
                )}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-lg" />
              </button>
            </div>

            {/* 提交按钮 */}
            <button
              onClick={isActive ? handleSubmit : openPicker}
              disabled={isSubmitting || (isActive && pages.length === 0)}
              className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
              {isSubmitting
                ? `正在注入 ${pages.length} 页...`
                : isActive
                ? `注入核心（${pages.length} 页）`
                : '开始注入核心'}
            </button>
          </div>
        </section>

        {/* ── 最近采集列表 ── */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Recent Insights
          </h3>
          <div className="space-y-2">
            {recentScans.length === 0 ? (
              <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                <Scan className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">暂无扫描记录，开始一次扫描试试</p>
              </div>
            ) : (
              recentScans.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Scan className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{item.name}</p>
                      <p className="text-[9px] text-gray-600 uppercase">
                        Status: {item.status}{item.createdAt ? ` · ${formatTime(item.createdAt)}` : ''}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </SafeLayout>
  );
}

/**
 * NodeTerminal - Navigator-X 节点端 - 移动端UI
 *
 * 节点端入口 - 执行与辅助
 * 功能：
 * 1. 核心数据输入区
 * 2. AI草案预览
 * 3. 一键推送按钮
 * 4. 状态追踪（已发送/已读/已采纳）
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  FileText, Send, Clock, CheckCircle, Eye,
  Sparkles, Upload, Activity, RefreshCw
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function NodeTerminal() {
  const [coreData, setCoreData] = useState("");
  const [draftType, setDraftType] = useState<'REPORT' | 'PLAN' | 'PROPOSAL'>('REPORT');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'sent' | 'read' | 'adopted'>('idle');

  const handleGenerateDraft = async () => {
    if (!coreData.trim()) return;

    setIsGenerating(true);
    toast.success("正在根据老板偏好生成草案...");

    // 模拟生成
    await new Promise(resolve => setTimeout(resolve, 2000));

    setGeneratedDraft(`【${draftType === 'REPORT' ? '工作汇报' : draftType === 'PLAN' ? '计划书' : '方案书'}草案】

基于核心数据"${coreData.slice(0, 30)}..."，已按照领导的偏好风格自动优化。

1. 执行摘要
2. 当前进展
3. 下一步计划
4. 所需支持`);

    setIsGenerating(false);
  };

  const handleSubmit = () => {
    if (!generatedDraft) return;

    setSubmissionStatus('sent');
    toast.success("已一键推送到主控端，真实性审计报告已附带");

    // 模拟状态更新
    setTimeout(() => setSubmissionStatus('read'), 3000);
    setTimeout(() => setSubmissionStatus('adopted'), 6000);
  };

  const getStatusDisplay = () => {
    switch (submissionStatus) {
      case 'sent':
        return { icon: Send, text: '已发送', color: 'text-blue-400', bg: 'bg-blue-500/10' };
      case 'read':
        return { icon: Eye, text: '已读', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
      case 'adopted':
        return { icon: CheckCircle, text: '已采纳', color: 'text-green-400', bg: 'bg-green-500/10' };
      default:
        return { icon: Clock, text: '待发送', color: 'text-gray-400', bg: 'bg-gray-500/10' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <SafeLayout headerTitle="节点端">
      <div className="space-y-6 pb-10">

        {/* 状态指示 */}
        <div className={cn("p-4 rounded-3xl border flex items-center justify-between", statusDisplay.bg, `border-${statusDisplay.color.split('-')[1]}-500/20`)}>
          <div className="flex items-center gap-3">
            <StatusIcon className={cn("w-5 h-5", statusDisplay.color)} />
            <span className={cn("text-sm font-bold", statusDisplay.color)}>
              汇报状态: {statusDisplay.text}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-[9px] text-gray-500 font-mono">Node Online</span>
          </div>
        </div>

        {/* 草案类型选择 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Draft Type
          </h3>
          <div className="flex gap-2">
            {(['REPORT', 'PLAN', 'PROPOSAL'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setDraftType(type)}
                className={cn(
                  "flex-1 py-3 rounded-2xl text-xs font-bold uppercase transition-all",
                  draftType === type
                    ? "bg-primary text-white"
                    : "bg-white/5 text-gray-500"
                )}
              >
                {type === 'REPORT' ? '汇报' : type === 'PLAN' ? '计划书' : '方案'}
              </button>
            ))}
          </div>
        </section>

        {/* 核心数据输入 */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic px-1">
            Core Data Input
          </h3>
          <div className="p-5 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-4">
            <textarea
              value={coreData}
              onChange={(e) => setCoreData(e.target.value)}
              placeholder="输入核心数据和要点，AI将自动生成完整草案..."
              className="w-full h-32 bg-transparent text-sm text-white outline-none resize-none placeholder:text-gray-600"
            />
            <button
              onClick={handleGenerateDraft}
              disabled={!coreData.trim() || isGenerating}
              className="w-full py-3 rounded-2xl bg-white/5 text-primary text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  根据领导偏好生成草案
                </>
              )}
            </button>
          </div>
        </section>

        {/* 草案预览 */}
        {generatedDraft && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
                Draft Preview
              </h3>
              <span className="text-[9px] text-primary">AI优化版</span>
            </div>
            <div className="p-5 rounded-[2.5rem] bg-white/5 border border-primary/20">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                {generatedDraft}
              </pre>

              {/* 真实性审计 */}
              <div className="mt-4 p-3 rounded-2xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-500 text-[10px] font-bold mb-2">
                  <CheckCircle className="w-4 h-4" />
                  真实性审计报告
                </div>
                <div className="space-y-1 text-[9px] text-gray-500">
                  <p>内容完整性: 95%</p>
                  <p>数据准确性: 88%</p>
                  <p>格式规范性: 92%</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 一键推送 */}
        <button
          onClick={handleSubmit}
          disabled={!generatedDraft || submissionStatus !== 'idle'}
          className="w-full py-5 rounded-[2rem] bg-primary text-white font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
        >
          <Upload className="w-5 h-5" />
          {submissionStatus === 'idle' ? '一键汇报主控端' : submissionStatus === 'sent' ? '已发送...' : '已采纳'}
        </button>

      </div>
    </SafeLayout>
  );
}

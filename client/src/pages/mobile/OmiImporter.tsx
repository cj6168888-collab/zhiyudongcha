/**
 * OmiImporter — Omi 数据导入
 * 支持粘贴 JSON 或上传 Omi 导出文件
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Radio, Upload, CheckCircle2, XCircle, RefreshCw, Link2, Link2Off,
  FileJson, ArrowRight, AlertTriangle, Info,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState, useRef } from "react";

// ── 类型 ──────────────────────────────────────────────

interface SyncState {
  status: string;
  lastSyncedAt: string | null;
  cursor: string | null;
  errorMessage: string | null;
  accountRef: string | null;
}

interface ImportResult {
  memoriesImported: number;
  memoriesSkipped: number;
  conversationsImported: number;
  conversationsSkipped: number;
  candidatesCreated: number;
  errors: string[];
}

// ── 工具 ─────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

function statusColor(status: string) {
  if (status === "idle") return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
  if (status === "syncing") return "text-blue-400 border-blue-400/30 bg-blue-400/10";
  if (status === "error") return "text-red-400 border-red-400/30 bg-red-400/10";
  if (status === "disconnected") return "text-gray-400 border-gray-400/30 bg-gray-400/10";
  return "text-gray-400 border-gray-400/30 bg-gray-400/10";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    idle: "已连接",
    syncing: "导入中",
    error: "出现错误",
    disconnected: "已断开",
  };
  return map[status] ?? status;
}

// ── 导入结果卡片 ─────────────────────────────────────

function ResultCard({ result }: { result: ImportResult }) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      hasErrors ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"
    )}>
      <div className="flex items-center gap-2">
        {hasErrors ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        <span className="text-sm font-semibold text-white/90">导入完成</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-white/10">
          <p className="text-gray-500">记忆导入</p>
          <p className="text-white font-bold mt-0.5">{result.memoriesImported} 条</p>
          {result.memoriesSkipped > 0 && <p className="text-gray-600">跳过 {result.memoriesSkipped}</p>}
        </div>
        <div className="p-2 rounded-lg bg-white/10">
          <p className="text-gray-500">对话导入</p>
          <p className="text-white font-bold mt-0.5">{result.conversationsImported} 条</p>
          {result.conversationsSkipped > 0 && <p className="text-gray-600">跳过 {result.conversationsSkipped}</p>}
        </div>
        <div className="p-2 rounded-lg bg-white/10 col-span-2">
          <p className="text-gray-500">生成候选项</p>
          <p className="text-indigo-400 font-bold mt-0.5">{result.candidatesCreated} 个（需在收件箱确认）</p>
        </div>
      </div>

      {hasErrors && (
        <div className="space-y-1">
          <p className="text-xs text-amber-400 font-semibold">{result.errors.length} 条失败：</p>
          {result.errors.slice(0, 5).map((e, i) => (
            <p key={i} className="text-xs text-amber-500/80 font-mono truncate">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────

export default function OmiImporter() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [tab, setTab] = useState<"paste" | "file">("paste");

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["omi-status"],
    queryFn: () => apiFetch("/api/providers/omi/status"),
    staleTime: 15_000,
  });

  const syncState: SyncState | null = statusData?.state ?? null;
  const connected = statusData?.connected ?? false;

  const connect = useMutation({
    mutationFn: () => apiFetch("/api/providers/omi/connect", { method: "POST", body: "{}" }),
    onSuccess: (data) => {
      if (!data.success) { toast.error(data.error ?? "连接失败"); return; }
      toast.success("Omi 已连接");
      qc.invalidateQueries({ queryKey: ["omi-status"] });
    },
    onError: () => toast.error("网络异常"),
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch("/api/providers/omi/disconnect", { method: "POST" }),
    onSuccess: () => {
      toast.success("已断开 Omi 连接");
      qc.invalidateQueries({ queryKey: ["omi-status"] });
    },
    onError: () => toast.error("网络异常"),
  });

  const doImport = useMutation({
    mutationFn: (payload: object) =>
      apiFetch("/api/providers/omi/import", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["omi-status"] });
      qc.invalidateQueries({ queryKey: ["conversation-inbox"] });
      qc.invalidateQueries({ queryKey: ["conversation-inbox-counts"] });
      if (data.success) {
        setImportResult(data.result);
        toast.success("导入完成，请前往收件箱确认候选项");
      } else {
        toast.error(data.error ?? "导入失败");
      }
    },
    onError: () => toast.error("网络异常"),
  });

  const handlePasteImport = () => {
    if (!jsonText.trim()) { toast.error("请粘贴 Omi 导出的 JSON 内容"); return; }
    try {
      const payload = JSON.parse(jsonText);
      doImport.mutate(payload);
    } catch {
      toast.error("JSON 格式错误，请检查内容");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        doImport.mutate(payload);
      } catch {
        toast.error("文件解析失败，请确认是有效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <SafeLayout headerTitle="Omi 导入">
      {/* 连接状态 */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 mb-5">
        <Radio className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white/90">Omi 提供方</span>
            {syncState && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", statusColor(syncState.status))}>
                {statusLabel(syncState.status)}
              </span>
            )}
          </div>
          {syncState?.lastSyncedAt && (
            <p className="text-xs text-gray-500 mt-1">
              上次同步：{format(new Date(syncState.lastSyncedAt), "MM-dd HH:mm")}
            </p>
          )}
          {syncState?.errorMessage && (
            <p className="text-xs text-red-400 mt-1 truncate">{syncState.errorMessage}</p>
          )}
          {!syncState && !statusLoading && (
            <p className="text-xs text-gray-600 mt-1">尚未连接</p>
          )}
        </div>
        {connected ? (
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="flex items-center gap-1 text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg active:scale-95 transition-all flex-shrink-0"
          >
            <Link2Off className="w-3.5 h-3.5" />
            断开
          </button>
        ) : (
          <button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="flex items-center gap-1 text-xs text-indigo-400 border border-indigo-400/30 px-2 py-1 rounded-lg active:scale-95 transition-all flex-shrink-0"
          >
            <Link2 className="w-3.5 h-3.5" />
            连接
          </button>
        )}
      </div>

      {/* 导入说明 */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-5">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300 leading-relaxed">
          导入的 Omi 记忆和对话会成为<strong>候选项</strong>，需在<strong>收件箱</strong>确认后才会落入长期记忆，不会直接覆盖现有数据。重复导入会自动跳过。
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        {(["paste", "file"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors",
              tab === t
                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                : "border-white/10 bg-white/5 text-gray-500"
            )}
          >
            {t === "paste" ? "粘贴 JSON" : "上传文件"}
          </button>
        ))}
      </div>

      {/* 粘贴模式 */}
      {tab === "paste" && (
        <div className="space-y-3 mb-5">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={'{\n  "memories": [...],\n  "conversations": [...]\n}'}
            className="w-full h-48 bg-black/40 border border-white/15 rounded-xl p-4 text-xs text-white/80 font-mono resize-none focus:outline-none focus:border-indigo-500/50 placeholder-gray-700"
          />
          <button
            onClick={handlePasteImport}
            disabled={doImport.isPending || !jsonText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
          >
            {doImport.isPending
              ? <><RefreshCw className="w-4 h-4 animate-spin" />导入中…</>
              : <><ArrowRight className="w-4 h-4" />开始导入</>
            }
          </button>
        </div>
      )}

      {/* 文件上传模式 */}
      {tab === "file" && (
        <div className="mb-5">
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={doImport.isPending}
            className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-white/20 text-gray-500 active:border-indigo-500/50 active:text-indigo-400 transition-colors disabled:opacity-50"
          >
            {doImport.isPending ? (
              <><RefreshCw className="w-8 h-8 animate-spin text-indigo-400" /><span className="text-sm text-indigo-400">导入中…</span></>
            ) : (
              <><FileJson className="w-8 h-8" /><span className="text-sm">点击选择 Omi 导出文件（.json）</span></>
            )}
          </button>
        </div>
      )}

      {/* 导入结果 */}
      {importResult && <ResultCard result={importResult} />}
    </SafeLayout>
  );
}

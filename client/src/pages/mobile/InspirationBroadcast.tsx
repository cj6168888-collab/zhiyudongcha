/**
 * InspirationBroadcast - 想法暂存
 *
 * 只做沟通过程里的想法捕捉和回到对话，不模拟广播、分发或分析结果。
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lightbulb,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface IdeaNote {
  id: string;
  content: string;
  createdAt: number;
}

const storageKey = "xiaozhi_idea_capture_notes";

function loadIdeas(): IdeaNote[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveIdeas(ideas: IdeaNote[]) {
  localStorage.setItem(storageKey, JSON.stringify(ideas.slice(0, 20)));
}

export default function InspirationBroadcast() {
  const [, setLocation] = useLocation();
  const [idea, setIdea] = useState("");
  const [ideas, setIdeas] = useState<IdeaNote[]>(loadIdeas);

  const latestIdea = ideas[0] ?? null;
  const wordCount = useMemo(() => idea.trim().length, [idea]);

  const handleSave = () => {
    const content = idea.trim();
    if (!content) {
      toast.error("先写下这个想法");
      return;
    }

    const next = [{ id: `${Date.now()}`, content, createdAt: Date.now() }, ...ideas].slice(0, 20);
    setIdeas(next);
    saveIdeas(next);
    setIdea("");
    toast.success("想法已暂存");
  };

  const handleContinueInChat = (content?: string) => {
    const selected = (content ?? idea).trim();
    if (selected) {
      sessionStorage.setItem("xiaozhi_resume_prompt", `帮我继续展开这个想法：${selected}`);
    }
    setLocation("/");
  };

  const handleRemove = (id: string) => {
    const next = ideas.filter((item) => item.id !== id);
    setIdeas(next);
    saveIdeas(next);
    toast.success("已移除");
  };

  return (
    <SafeLayout headerTitle="想法暂存" showBack={true}>
      <div className="space-y-5 pb-10">
        <section className="rounded-2xl border border-violet-200/15 bg-[#11101f] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-200/25 bg-violet-300/[0.12] text-violet-100">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white">先把想法留住</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                这里不广播、不自动立项。只是把突然想到的内容暂存，再带回和小智的对话里继续推敲。
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="暂存" value={`${ideas.length}`} tone="violet" />
            <Metric label="当前字数" value={`${wordCount}`} tone="cyan" />
            <Metric label="状态" value={latestIdea ? "有想法" : "空"} tone={latestIdea ? "emerald" : "slate"} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="px-1 text-xs font-black text-slate-300">记录想法</h3>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="例如：这个项目可以先从一个真实用户场景切入，让小智帮我拆成任务和材料清单。"
              className="min-h-[130px] w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-violet-200/50"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={handleSave}
                disabled={!idea.trim()}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-black text-white active:bg-white/10 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                暂存
              </button>
              <button
                onClick={() => handleContinueInChat()}
                disabled={!idea.trim()}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-black text-slate-950 active:scale-[0.99] disabled:opacity-40"
              >
                <MessageCircle className="h-4 w-4" />
                让小智展开
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-300">暂存列表</h3>
            <span className="text-[10px] font-bold text-slate-500">本机保存</span>
          </div>

          {ideas.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <p className="text-xs leading-5 text-slate-400">
                  暂无想法。首页仍是主要沟通区，这里只负责把零散念头先放住。
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {ideas.map((item) => (
                <IdeaCard key={item.id} item={item} onContinue={handleContinueInChat} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
            <p className="text-[11px] leading-5 text-cyan-100/75">
              想法被展开、写入任务或进入项目之前，都应该经过和小智的对话确认，避免在这个页面里制造假流程。
            </p>
          </div>
        </section>
      </div>
    </SafeLayout>
  );
}

function IdeaCard({
  item,
  onContinue,
  onRemove,
}: {
  item: IdeaNote;
  onContinue: (content: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black leading-5 text-white">{item.content}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            <Clock className="h-3 w-3" />
            {formatTime(item.createdAt)}
          </p>
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 active:bg-red-300/10 active:text-red-200"
          aria-label="移除想法"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={() => onContinue(item.content)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-xs font-black text-white active:bg-white/10"
      >
        带回对话
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "violet" | "cyan" | "emerald" | "slate" }) {
  const toneClass = {
    violet: "text-violet-200",
    cyan: "text-cyan-100",
    emerald: "text-emerald-100",
    slate: "text-slate-300",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-[10px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function formatTime(value: number) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

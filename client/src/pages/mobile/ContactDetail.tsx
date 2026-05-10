/**
 * ContactDetail - 联系人详情页 1.0
 *
 * 功能：联系人基本信息、关联项目、交互记录、快捷操作
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import {
  Phone, Mail, Building2, Briefcase, Edit2, Trash2,
  Calendar, MessageCircle, ChevronRight, UserPlus, Clock,
  Star, History
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  projectId?: string;
  notes?: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface Project {
  id: string;
  name: string;
  title?: string;
  status: string;
  progress: number;
}

interface Interaction {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE';
  date: number;
  summary: string;
}

export default function ContactDetail({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const contactId = params.id;

  // 获取联系人详情
  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: [`/api/persons/${contactId}`],
    queryFn: async () => {
      const res = await fetch(`/api/business/persons/${contactId}`);
      const data = await res.json();
      return data.data || data;
    },
  });

  // 获取关联项目
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      const data = await res.json();
      return data.projects || data || [];
    },
  });

  // 获取交互记录
  const { data: interactions = [] } = useQuery<Interaction[]>({
    queryKey: ['/api/persons', contactId, 'interactions'],
    queryFn: async () => {
      const res = await fetch(`/api/persons/${contactId}/interactions`);
      const data = await res.json();
      return data.data || data || [];
    },
  });

  // 更新联系人
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Contact>) => {
      const res = await fetch(`/api/business/persons/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/persons/${contactId}`] });
      toast.success("联系人已更新");
    }
  });

  // 删除联系人
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/persons/${contactId}`, { method: 'DELETE' });
      return res;
    },
    onSuccess: () => {
      toast.success("联系人已删除");
      setLocation('/contacts');
    }
  });

  // 格式化时间
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 获取关联项目信息
  const linkedProject = projects.find(p => p.id === contact?.projectId);

  // 获取交互类型图标
  const getInteractionIcon = (type: Interaction['type']) => {
    switch (type) {
      case 'CALL': return Phone;
      case 'EMAIL': return Mail;
      case 'MEETING': return Calendar;
      case 'NOTE': return MessageCircle;
      default: return Clock;
    }
  };

  if (isLoading) {
    return (
      <SafeLayout headerTitle="联系人详情" showBack={true}>
        <div className="animate-pulse space-y-4 p-4">
          <div className="h-40 bg-white/5 rounded-3xl" />
          <div className="h-20 bg-white/5 rounded-2xl" />
          <div className="h-20 bg-white/5 rounded-2xl" />
        </div>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout headerTitle="联系人详情" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 联系人头部信息 */}
        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-amber-500/10 to-transparent border border-white/5">
          <div className="flex items-start gap-4">
            {/* 头像 */}
            <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center text-primary text-3xl font-black shrink-0">
              {contact?.name?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{contact?.name || '未命名'}</h1>
              <p className="text-sm text-gray-400 mt-1">{contact?.title || '未设置职位'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{contact?.company || '未设置单位'}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setLocation(`/contacts?edit=${contactId}`)}
                className="p-2 rounded-xl bg-white/5 active:bg-white/10"
              >
                <Edit2 className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => {
                  if (confirm('确定要删除此联系人吗？')) {
                    deleteMutation.mutate();
                  }
                }}
                className="p-2 rounded-xl bg-white/5 active:bg-white/10"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* 快捷操作按钮 */}
          <div className="flex gap-3 mt-6">
            {contact?.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex-1 py-3 rounded-2xl bg-green-500/20 text-green-400 text-center text-xs font-bold uppercase"
              >
                <Phone className="w-4 h-4 mx-auto mb-1" />
                电话
              </a>
            )}
            {contact?.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex-1 py-3 rounded-2xl bg-blue-500/20 text-blue-400 text-center text-xs font-bold uppercase"
              >
                <Mail className="w-4 h-4 mx-auto mb-1" />
                邮件
              </a>
            )}
            <button className="flex-1 py-3 rounded-2xl bg-purple-500/20 text-purple-400 text-center text-xs font-bold uppercase">
              <MessageCircle className="w-4 h-4 mx-auto mb-1" />
              消息
            </button>
          </div>
        </div>

        {/* 联系方式 */}
        <section className="px-1 space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase">联系方式</h2>
          <div className="space-y-2">
            {contact?.phone && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                <Phone className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-white">{contact.phone}</span>
              </div>
            )}
            {contact?.email && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                <Mail className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-white">{contact.email}</span>
              </div>
            )}
            {contact?.company && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                <Building2 className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-white">{contact.company}</span>
              </div>
            )}
            {!contact?.phone && !contact?.email && !contact?.company && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <p className="text-xs text-gray-500">暂无联系方式</p>
              </div>
            )}
          </div>
        </section>

        {/* 关联项目 */}
        <section className="px-1 space-y-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase">关联项目</h2>
          {linkedProject ? (
            <div
              onClick={() => setLocation(`/projects/${linkedProject.id}`)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 active:bg-white/10"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{linkedProject.name || linkedProject.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${linkedProject.progress || 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">{linkedProject.progress || 0}%</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
              <Briefcase className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">暂无关联项目</p>
              <button
                onClick={() => setLocation('/projects')}
                className="mt-2 text-xs text-primary"
              >
                关联项目
              </button>
            </div>
          )}
        </section>

        {/* 标签 */}
        {contact?.tags && contact.tags.length > 0 && (
          <section className="px-1 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase">标签</h2>
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 备注 */}
        {contact?.notes && (
          <section className="px-1 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase">备注</h2>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm text-gray-300 leading-relaxed">{contact.notes}</p>
            </div>
          </section>
        )}

        {/* 交互记录 */}
        <section className="px-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-500 uppercase">交互记录</h2>
            <button className="text-[10px] text-primary flex items-center gap-1">
              添加记录 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {interactions.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">暂无交互记录</p>
              </div>
            ) : (
              interactions.slice(0, 5).map((interaction) => {
                const Icon = getInteractionIcon(interaction.type);
                return (
                  <div
                    key={interaction.id}
                    className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/5"
                  >
                    <div className="p-2 rounded-lg bg-white/5">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{interaction.summary}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{formatDate(interaction.date)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 时间信息 */}
        <section className="px-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>创建于: {formatDate(contact?.createdAt)}</span>
            <span>更新于: {formatDate(contact?.updatedAt)}</span>
          </div>
        </section>

      </div>
    </SafeLayout>
  );
}

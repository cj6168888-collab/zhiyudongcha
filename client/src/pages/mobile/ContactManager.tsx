/**
 * ContactManager - 吉麟人脉中心 2.0 (状态绑定修复版)
 *
 * 修复：搜索框状态绑定、完整表单验证、删除确认
 */
import { SafeLayout } from "@/components/mobile/SafeLayout";
import { UserPlus, Search, Trash2, Edit2, X, Briefcase, Check, Upload, Download } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from "@/lib/useApi";

interface Contact {
  id: string;
  name: string;
  title?: string;
  company?: string;
  projectId?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  createdAt?: number;
}

export default function ContactManager() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Omit<Contact, 'id'>>({ name: '', title: '', company: '', projectId: '', phone: '', email: '' });

  // 项目列表（统一 API）
  const { data: projects = [] } = useApiQuery(
    ['/api/projects'],
    async () => {
      const res = await fetch('/api/projects');
      const data = await res.json();
      return (data.projects || data.items || data) as unknown[];
    }
  );

  // 加载联系人数据
  const loadContacts = async () => {
    const res = await fetch('/api/persons');
    const data = await res.json();
    if (data.success) setContacts(data.items || []);
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // 删除联系人（统一 API）
  const deleteMutation = useApiMutation(
    (contactId: string) =>
      fetch(`/api/persons/${contactId}`, { method: 'DELETE' }).then(r => r.json()),
    {
      successMessage: '联系人已移除',
      errorMessage: '删除失败',
      invalidateKeys: [['/api/persons']],
      onSuccess: () => loadContacts(),
    }
  );

  // 4. 过滤联系人列表
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.company?.toLowerCase().includes(query) ||
      c.title?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // 5. 处理表单提交
  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      toast.error("请输入姓名");
      return;
    }

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/business/persons/${editingId}` : '/api/persons';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success(editingId ? "商务资源已修订" : "新资源已入库");
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', title: '', company: '', projectId: '', phone: '', email: '' });
        loadContacts();
      } else {
        toast.error("保存失败");
      }
    } catch (err) {
      toast.error("同步失败");
    }
  };

  // 6. 重置表单
  const resetForm = () => {
    setFormData({ name: '', title: '', company: '', projectId: '', phone: '', email: '' });
    setEditingId(null);
  };

  // 7. 处理编辑
  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      title: contact.title || '',
      company: contact.company || '',
      projectId: contact.projectId || '',
      phone: contact.phone || '',
      email: contact.email || ''
    });
    setShowForm(true);
  };

  // 8. 处理删除
  const handleDelete = (contactId: string) => {
    if (confirm('确定要删除此联系人吗？')) {
      deleteMutation.mutate(contactId);
    }
  };

  return (
    <SafeLayout headerTitle="人脉资源" showBack={true}>
      <div className="space-y-6 pb-10">

        {/* 搜索区域 */}
        <div className="flex gap-3 px-1">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="检索资源、项目、专家建议..."
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
            />
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <UserPlus className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* 联系人列表 */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1 italic">Verified Connections</h2>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500">
                {searchQuery ? '未找到匹配的联系人' : '暂无联系人，点击 + 添加第一个联系人'}
              </p>
            </div>
          ) : (
            filteredContacts.map((c) => (
              <div
                key={c.id}
                onClick={() => setLocation(`/contacts/${c.id}`)}
                className="p-5 rounded-[2.5rem] bg-white/5 border border-white/5 space-y-4 animate-in fade-in zoom-in-95 duration-300 group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary text-xl font-black shadow-inner shrink-0">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white tracking-tight truncate">{c.name}</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{c.title || '未设置职位'} @ {c.company || '核心项目部'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(c)}
                      className="p-2 text-gray-600 active:text-primary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-2 text-gray-600 active:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 展示关联项目 */}
                {c.projectId && (
                  <div className="flex items-center gap-2 px-1 py-2 border-t border-white/5">
                    <Briefcase className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-[9px] text-gray-500 uppercase font-black">Associated Node:</span>
                    <span className="text-[9px] text-primary font-bold uppercase tracking-widest truncate">
                      {Array.isArray(projects) ? (projects as Array<{id: string; name: string}>).find((p) => p.id === c.projectId)?.name || 'Linked' : 'Linked'}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 建立/修订人脉抽屉 */}
        {showForm && (
          <div className="fixed inset-0 z-[1000] flex items-end">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => {setShowForm(false); resetForm();}} />
            <div className="relative w-full bg-[#0f172a] rounded-t-[3rem] border-t border-white/10 p-8 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tighter uppercase italic">{editingId ? 'Revise Resource' : 'Register Node'}</h3>
                <button onClick={() => {setShowForm(false); resetForm();}} className="p-2 text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  placeholder="姓名 *"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 h-14 px-5 rounded-2xl text-white outline-none focus:border-primary transition-colors"
                />
                <input
                  placeholder="职位"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 h-14 px-5 rounded-2xl text-white outline-none focus:border-primary transition-colors"
                />
                <input
                  placeholder="单位"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 h-14 px-5 rounded-2xl text-white outline-none focus:border-primary transition-colors"
                />
                <input
                  placeholder="电话"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 h-14 px-5 rounded-2xl text-white outline-none focus:border-primary transition-colors"
                />
                <input
                  placeholder="邮箱"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 h-14 px-5 rounded-2xl text-white outline-none focus:border-primary transition-colors"
                />
                <select
                  className="w-full bg-white/5 border border-white/10 h-14 px-5 rounded-2xl text-white outline-none focus:border-primary transition-colors"
                  value={formData.projectId}
                  onChange={(e) => setFormData({...formData, projectId: e.target.value})}
                >
                  <option value="">关联特定商务项目节点...</option>
                  {Array.isArray(projects) && projects.map((p:any) => <option key={p.id} value={p.id}>{p.name || p.title}</option>)}
                </select>
                <button
                  onClick={handleSubmit}
                  className="w-full h-16 bg-primary text-white font-black uppercase rounded-2xl mt-4 shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
                  disabled={!formData.name?.trim()}
                >
                  确认同步
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </SafeLayout>
  );
}

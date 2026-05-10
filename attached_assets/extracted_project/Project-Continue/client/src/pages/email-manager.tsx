import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Mail, Plus, Trash2, RefreshCw, Settings, 
  FileText, Receipt, Briefcase, ChevronRight,
  AlertCircle, CheckCircle, X, ArrowLeft, Paperclip,
  Reply, Send
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAvatarStore } from '@/lib/avatar/avatar-store';
import { Link, useLocation } from 'wouter';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

interface EmailProvider {
  code: string;
  name: string;
  domains: string[];
  instructions: string;
}

interface EmailAccount {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  status: string;
  lastSyncAt: string | null;
}

interface EmailCategory {
  code: string;
  name: string;
  nameEn: string;
  icon: string;
}

interface EmailStats {
  totalAccounts: number;
  totalEmails: number;
  unreadCount: number;
  invoiceCount: number;
  reportCount: number;
}

interface EmailMessage {
  id: string;
  accountId: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  category: string | null;
  importance: string | null;
  isRead: boolean;
  hasAttachments: boolean;
  receivedAt: string | null;
  attachments?: Array<{ id: string; filename: string; contentType: string; size: number }>;
}

export default function EmailManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addMessage, setChatOpen, speak } = useAvatarStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [customImapHost, setCustomImapHost] = useState('');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState<string>('all');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const { data: providers = [] } = useQuery<EmailProvider[]>({
    queryKey: ['/api/email/providers'],
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<EmailAccount[]>({
    queryKey: ['/api/email/accounts'],
  });

  const { data: categories = [] } = useQuery<EmailCategory[]>({
    queryKey: ['/api/email/categories'],
  });

  const { data: stats } = useQuery<EmailStats>({
    queryKey: ['/api/email/stats'],
  });

  const { data: allEmails = [] } = useQuery<EmailMessage[]>({
    queryKey: ['/api/email/messages', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/email/messages', { credentials: 'include' });
      return res.json();
    },
  });

  const { data: emailMessages = [], isLoading: emailsLoading } = useQuery<EmailMessage[]>({
    queryKey: ['/api/email/messages', emailFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (emailFilter === 'unread') params.set('unread', 'true');
      else if (emailFilter !== 'all') params.set('category', emailFilter);
      const res = await fetch(`/api/email/messages?${params.toString()}`, { credentials: 'include' });
      return res.json();
    },
  });

  const { data: selectedEmail } = useQuery<EmailMessage>({
    queryKey: ['/api/email/messages', selectedEmailId],
    queryFn: async () => {
      const res = await fetch(`/api/email/messages/${selectedEmailId}`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedEmailId,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/email/${id}/read`, { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/stats'] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await fetch(`/api/email/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('发送失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '回复已发送' });
      setShowReplyForm(false);
      setReplyContent('');
    },
    onError: (error) => {
      toast({ title: '发送失败', description: error.message, variant: 'destructive' });
    },
  });

  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const syncAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingAccountId(id);
      const res = await fetch(`/api/email/accounts/${id}/sync`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('同步失败');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: '邮箱同步完成', 
        description: `新增 ${data.newEmails || 0} 封邮件，发现 ${data.invoicesCreated || 0} 张发票` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/stats'] });
      
      if (data.summary) {
        addMessage({
          role: 'assistant',
          content: data.summary,
          timestamp: Date.now(),
        });
        setChatOpen(true);
        speak(data.summary.substring(0, 200));
      }
    },
    onError: (error) => {
      toast({ title: '同步失败', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      setSyncingAccountId(null);
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      setSyncingAll(true);
      const res = await fetch('/api/email/sync-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('同步失败');
      return res.json();
    },
    onSuccess: (data) => {
      const totalNew = data.results?.reduce((sum: number, r: any) => sum + (r.newEmails || 0), 0) || 0;
      const totalInvoices = data.results?.reduce((sum: number, r: any) => sum + (r.invoicesCreated || 0), 0) || 0;
      toast({ 
        title: '全部邮箱同步完成', 
        description: `新增 ${totalNew} 封邮件，发现 ${totalInvoices} 张发票` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/stats'] });
      
      if (data.summary) {
        addMessage({
          role: 'assistant',
          content: data.summary,
          timestamp: Date.now(),
        });
        setChatOpen(true);
        speak(data.summary.substring(0, 200));
      }
    },
    onError: (error) => {
      toast({ title: '同步失败', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      setSyncingAll(false);
    },
  });

  const detectProviderMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch('/api/email/detect-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data) {
        setSelectedProvider(data);
      }
    },
  });

  const addAccountMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; imapHost?: string }) => {
      const res = await fetch('/api/email/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('添加失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '邮箱添加成功' });
      queryClient.invalidateQueries({ queryKey: ['/api/email/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/stats'] });
      setShowAddDialog(false);
      setNewEmail('');
      setNewPassword('');
      setSelectedProvider(null);
    },
    onError: (error) => {
      toast({ title: '添加失败', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/email/accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '邮箱已删除' });
      queryClient.invalidateQueries({ queryKey: ['/api/email/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email/stats'] });
    },
  });

  const handleEmailChange = (email: string) => {
    setNewEmail(email);
    if (email.includes('@')) {
      detectProviderMutation.mutate(email);
    }
  };

  const handleAddAccount = () => {
    if (!newEmail || !newPassword) return;
    addAccountMutation.mutate({
      email: newEmail,
      password: newPassword,
      imapHost: selectedProvider?.code === 'custom' ? customImapHost : undefined,
    });
  };

  const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
      '126': '📧',
      '163': '📧',
      'qq': '📮',
      'gmail': '✉️',
      'outlook': '📬',
      'sina': '📪',
      'custom': '⚙️',
    };
    return icons[provider] || '📧';
  };

  const [, setLocation] = useLocation();

  return (
    <div className="h-screen bg-gradient-to-b from-[#0a1628] via-[#030712] to-[#0a0f1e] flex flex-col overflow-hidden">
      {/* 紧凑顶栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-gray-400 hover:text-white p-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-semibold text-white">邮箱</span>
          </div>
          {stats && (
            <div className="flex items-center gap-3 ml-4 text-xs">
              <span className="text-gray-400">{stats.totalEmails} 封</span>
              {stats.unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-cyan-600 text-white rounded text-xs">{stats.unreadCount} 未读</span>
              )}
              {stats.invoiceCount > 0 && (
                <span className="text-amber-400">{stats.invoiceCount} 发票</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <Button 
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-cyan-400 hover:bg-cyan-900/30"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncingAll || syncAccountMutation.isPending}
              data-testid="button-sync-all"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncingAll ? 'animate-spin' : ''}`} />
              同步
            </Button>
          )}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 text-xs bg-cyan-600 hover:bg-cyan-500" data-testid="button-add-email">
                <Plus className="w-3 h-3 mr-1" />
                添加
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">添加邮箱账户</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-gray-300">邮箱地址</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="example@126.com"
                    className="bg-gray-800 border-gray-700 text-white"
                    data-testid="input-email"
                  />
                </div>
                {selectedProvider && (
                  <div className="p-2 bg-cyan-900/30 border border-cyan-700 rounded text-xs">
                    <p className="text-cyan-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {selectedProvider.name}
                    </p>
                    <p className="text-gray-400 mt-1">{selectedProvider.instructions}</p>
                  </div>
                )}
                {selectedProvider?.code === 'custom' && (
                  <div>
                    <Label className="text-gray-300">IMAP服务器</Label>
                    <Input
                      value={customImapHost}
                      onChange={(e) => setCustomImapHost(e.target.value)}
                      placeholder="imap.example.com"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-gray-300">授权码</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="邮箱授权码（非登录密码）"
                    className="bg-gray-800 border-gray-700 text-white"
                    data-testid="input-password"
                  />
                </div>
                <Button
                  onClick={handleAddAccount}
                  disabled={!newEmail || !newPassword || addAccountMutation.isPending}
                  className="w-full bg-cyan-600 hover:bg-cyan-500"
                  data-testid="button-confirm-add"
                >
                  {addAccountMutation.isPending ? '添加中...' : '确认添加'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 主内容区域 - 三栏布局 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧分类栏 */}
        <div className="w-14 shrink-0 border-r border-gray-800 flex flex-col py-2">
          <button
            onClick={() => setEmailFilter('all')}
            className={`flex flex-col items-center py-2 px-1 transition-colors ${
              emailFilter === 'all' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            data-testid="filter-all"
          >
            <Mail className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">全部</span>
            {stats?.totalEmails ? <span className="text-[8px] text-gray-500">{stats.totalEmails}</span> : null}
          </button>
          <button
            onClick={() => setEmailFilter('unread')}
            className={`flex flex-col items-center py-2 px-1 transition-colors ${
              emailFilter === 'unread' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            data-testid="filter-unread"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">未读</span>
            {stats?.unreadCount ? <span className="text-[8px] text-cyan-500">{stats.unreadCount}</span> : null}
          </button>
          <button
            onClick={() => setEmailFilter('invoice')}
            className={`flex flex-col items-center py-2 px-1 transition-colors ${
              emailFilter === 'invoice' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            data-testid="filter-invoice"
          >
            <Receipt className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">发票</span>
            {stats?.invoiceCount ? <span className="text-[8px] text-amber-500">{stats.invoiceCount}</span> : null}
          </button>
          <button
            onClick={() => setEmailFilter('report')}
            className={`flex flex-col items-center py-2 px-1 transition-colors ${
              emailFilter === 'report' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            data-testid="filter-report"
          >
            <FileText className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">汇报</span>
            {stats?.reportCount ? <span className="text-[8px] text-gray-500">{stats.reportCount}</span> : null}
          </button>
          <button
            onClick={() => setEmailFilter('travel')}
            className={`flex flex-col items-center py-2 px-1 transition-colors ${
              emailFilter === 'travel' ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
            data-testid="filter-travel"
          >
            <Briefcase className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">出差</span>
          </button>
          
          <div className="flex-1" />
          
          {/* 账户管理入口 */}
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex flex-col items-center py-2 px-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 transition-colors"
            data-testid="button-manage-accounts"
          >
            <Settings className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">账户</span>
            {accounts.length > 0 && <span className="text-[8px] text-gray-500">{accounts.length}</span>}
          </button>
        </div>

        {/* 中间列表+右侧详情 */}
        {emailsLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">加载中...</div>
        ) : emailMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">暂无邮件</p>
              <p className="text-gray-500 text-xs mt-1">请先添加邮箱并同步</p>
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* 邮件列表 */}
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <div className="h-full overflow-y-auto border-r border-gray-800">
                {emailMessages.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => {
                      setSelectedEmailId(email.id);
                      if (!email.isRead) markReadMutation.mutate(email.id);
                    }}
                    className={`px-3 py-2 cursor-pointer border-b border-gray-800/50 transition-colors ${
                      selectedEmailId === email.id 
                        ? 'bg-cyan-900/30 border-l-2 border-l-cyan-400' 
                        : 'hover:bg-gray-800/30'
                    } ${!email.isRead ? 'bg-gray-800/20' : ''}`}
                    data-testid={`email-item-${email.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {!email.isRead && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
                      <span className={`text-xs truncate flex-1 ${!email.isRead ? 'text-white font-medium' : 'text-gray-400'}`}>
                        {email.fromName || email.fromEmail?.split('@')[0] || '未知'}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {email.receivedAt ? new Date(email.receivedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${!email.isRead ? 'text-gray-200' : 'text-gray-500'}`}>
                      {email.subject || '(无主题)'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-gray-600 truncate flex-1">{email.snippet}</p>
                      {email.hasAttachments && <Paperclip className="w-2.5 h-2.5 text-gray-500 shrink-0" />}
                      {email.category && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-700/50 text-gray-400 shrink-0">
                          {categories.find(c => c.code === email.category)?.name || email.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* 邮件详情 */}
            <ResizablePanel defaultSize={65}>
              <div className="h-full overflow-y-auto p-4">
                {selectedEmail ? (
                  <div>
                    <h2 className="text-base font-semibold text-white mb-2">{selectedEmail.subject || '(无主题)'}</h2>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                      <span className="font-medium text-cyan-400">{selectedEmail.fromName || selectedEmail.fromEmail}</span>
                      {selectedEmail.fromName && <span className="text-gray-500">&lt;{selectedEmail.fromEmail}&gt;</span>}
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">
                      {selectedEmail.receivedAt ? new Date(selectedEmail.receivedAt).toLocaleString('zh-CN') : ''}
                    </p>
                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-gray-800">
                        {selectedEmail.attachments.map((att) => (
                          <button 
                            key={att.id} 
                            onClick={() => window.open(`/api/email/attachments/${att.id}/download`, '_blank')}
                            className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-1 text-gray-300 transition-colors cursor-pointer"
                            data-testid={`download-attachment-${att.id}`}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            {att.filename}
                            <span className="text-gray-500">({Math.round(att.size / 1024)}KB)</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                      {selectedEmail.bodyText || '(邮件内容为空)'}
                    </div>
                    
                    {/* 回复区域 */}
                    <div className="border-t border-gray-800 pt-4 mt-4">
                      {!showReplyForm ? (
                        <Button
                          onClick={() => setShowReplyForm(true)}
                          variant="outline"
                          size="sm"
                          className="text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                          data-testid="button-reply"
                        >
                          <Reply className="w-3 h-3 mr-1" />
                          回复
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">回复给: {selectedEmail.fromEmail}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-300"
                              onClick={() => { setShowReplyForm(false); setReplyContent(''); }}
                              data-testid="button-cancel-reply"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <Textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="输入回复内容..."
                            className="min-h-[100px] bg-gray-800 border-gray-700 text-gray-200 text-sm"
                            data-testid="input-reply"
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={() => replyMutation.mutate({ id: selectedEmail.id, body: replyContent })}
                              disabled={!replyContent.trim() || replyMutation.isPending}
                              size="sm"
                              className="bg-cyan-600 hover:bg-cyan-500 text-xs"
                              data-testid="button-send-reply"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              {replyMutation.isPending ? '发送中...' : '发送'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">选择邮件查看</p>
                    </div>
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}

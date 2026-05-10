import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Receipt, Plus, FileText, CheckCircle, Clock, X,
  ChevronRight, Trash2, Send, ArrowLeft, Calendar
} from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { GlobalWakeHeader } from '@/components/ui/global-wake-header';
import { Link } from 'wouter';

interface Invoice {
  id: string;
  emailId: string | null;
  amount: string | null;
  totalAmount: string | null;
  sellerName: string | null;
  invoiceNo: string | null;
  invoiceType: string | null;
  invoiceDate: string | null;
  expenseReportId: string | null;
  status: string;
  createdAt: string;
}

interface ExpenseReport {
  id: string;
  title: string;
  description: string | null;
  totalAmount: string;
  status: string;
  expenseType: string;
  invoiceCount: number;
  createdAt: string;
  submittedAt: string | null;
}

const EXPENSE_TYPES = [
  { value: 'travel', label: '差旅费用' },
  { value: 'meal', label: '餐饮费用' },
  { value: 'transport', label: '交通费用' },
  { value: 'office', label: '办公用品' },
  { value: 'other', label: '其他费用' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'text-gray-400' },
  pending: { label: '待审批', color: 'text-yellow-400' },
  approved: { label: '已通过', color: 'text-green-400' },
  rejected: { label: '已驳回', color: 'text-red-400' },
};

export default function ExpenseManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ExpenseReport | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newExpenseType, setNewExpenseType] = useState('other');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: unassignedInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices/unassigned'],
  });

  const { data: expenseReports = [], isLoading: reportsLoading } = useQuery<ExpenseReport[]>({
    queryKey: ['/api/expense-reports'],
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; expenseType: string }) => {
      const res = await fetch('/api/expense-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('创建失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '报销单创建成功' });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-reports'] });
      setShowCreateDialog(false);
      setNewTitle('');
      setNewDescription('');
      setNewExpenseType('other');
    },
    onError: (error) => {
      toast({ title: '创建失败', description: error.message, variant: 'destructive' });
    },
  });

  const addInvoicesMutation = useMutation({
    mutationFn: async ({ reportId, invoiceIds }: { reportId: string; invoiceIds: string[] }) => {
      const res = await fetch(`/api/expense-reports/${reportId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceIds }),
      });
      if (!res.ok) throw new Error('添加失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '发票添加成功' });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices/unassigned'] });
      setSelectedInvoices([]);
    },
    onError: (error) => {
      toast({ title: '添加失败', description: error.message, variant: 'destructive' });
    },
  });

  const removeInvoiceMutation = useMutation({
    mutationFn: async ({ reportId, invoiceId }: { reportId: string; invoiceId: string }) => {
      const res = await fetch(`/api/expense-reports/${reportId}/invoices/${invoiceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('移除失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '发票已移除' });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices/unassigned'] });
    },
  });

  const submitReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/expense-reports/${reportId}/submit`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('提交失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '报销单已提交' });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-reports'] });
      setSelectedReport(null);
    },
    onError: (error) => {
      toast({ title: '提交失败', description: error.message, variant: 'destructive' });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/expense-reports/${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('删除失败');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '报销单已删除' });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      setSelectedReport(null);
    },
  });

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const reportInvoices = invoices.filter(inv => inv.expenseReportId === selectedReport?.id);

  const formatAmount = (amount: string | null) => {
    if (!amount) return '¥0.00';
    const num = parseFloat(amount);
    return `¥${num.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <GlobalWakeHeader />
      
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/email">
              <Button variant="ghost" size="icon" data-testid="button-back-email">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Receipt className="h-6 w-6 text-gold-400" />
                报销管理
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                管理发票和报销单 · {unassignedInvoices.length} 张待处理发票
              </p>
            </div>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gold-500/20 text-gold-300 hover:bg-gold-500/30" data-testid="button-create-report">
                <Plus className="h-4 w-4 mr-2" />
                创建报销单
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-gold-500/20">
              <DialogHeader>
                <DialogTitle className="text-white">创建报销单</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">标题</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="例：12月差旅报销"
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-report-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">费用类型</Label>
                  <Select value={newExpenseType} onValueChange={setNewExpenseType}>
                    <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-expense-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">描述（可选）</Label>
                  <Input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="报销说明..."
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-report-description"
                  />
                </div>
                <Button
                  onClick={() => createReportMutation.mutate({
                    title: newTitle,
                    description: newDescription,
                    expenseType: newExpenseType,
                  })}
                  disabled={!newTitle || createReportMutation.isPending}
                  className="w-full bg-gold-500/20 text-gold-300 hover:bg-gold-500/30"
                  data-testid="button-confirm-create"
                >
                  {createReportMutation.isPending ? '创建中...' : '创建'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="bg-slate-800/50 border border-gold-500/10">
            <TabsTrigger value="invoices" className="data-[state=active]:bg-gold-500/20" data-testid="tab-invoices">
              待处理发票 ({unassignedInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-gold-500/20" data-testid="tab-reports">
              报销单 ({expenseReports.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            {unassignedInvoices.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-800/30 rounded-lg p-8 text-center border border-gold-500/10"
              >
                <Receipt className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">暂无待处理发票</p>
                <p className="text-gray-500 text-sm mt-2">
                  同步邮箱后，识别到的发票会自动出现在这里
                </p>
                <Link href="/email">
                  <Button variant="outline" className="mt-4" data-testid="button-goto-email">
                    前往邮箱管理
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {selectedInvoices.length > 0 && (
                  <div className="bg-gold-500/10 rounded-lg p-4 flex items-center justify-between border border-gold-500/20">
                    <span className="text-gold-300">
                      已选择 {selectedInvoices.length} 张发票
                    </span>
                    <Select
                      onValueChange={(reportId) => {
                        addInvoicesMutation.mutate({ reportId, invoiceIds: selectedInvoices });
                      }}
                    >
                      <SelectTrigger className="w-48 bg-slate-800 border-slate-700" data-testid="select-add-to-report">
                        <SelectValue placeholder="添加到报销单..." />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseReports
                          .filter(r => r.status === 'draft')
                          .map(report => (
                            <SelectItem key={report.id} value={report.id}>
                              {report.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-3">
                  {unassignedInvoices.map((invoice) => (
                    <motion.div
                      key={invoice.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800/50 rounded-lg p-4 border border-gold-500/10 hover:border-gold-500/30 transition-colors"
                      data-testid={`invoice-card-${invoice.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selectedInvoices.includes(invoice.id)}
                          onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                          data-testid={`checkbox-invoice-${invoice.id}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gold-400" />
                            <span className="text-white font-medium">
                              {invoice.sellerName || '未知商户'}
                            </span>
                            {invoice.invoiceNo && (
                              <span className="text-gray-500 text-sm">
                                #{invoice.invoiceNo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(invoice.invoiceDate)}
                            </span>
                            {invoice.emailId && (
                              <span className="text-blue-400">来自邮件</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gold-400">
                            {formatAmount(invoice.totalAmount || invoice.amount)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            {selectedReport ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedReport(null)}
                    className="text-gray-400"
                    data-testid="button-back-reports"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回列表
                  </Button>
                  <div className="flex gap-2">
                    {selectedReport.status === 'draft' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => deleteReportMutation.mutate(selectedReport.id)}
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          data-testid="button-delete-report"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </Button>
                        <Button
                          onClick={() => submitReportMutation.mutate(selectedReport.id)}
                          disabled={reportInvoices.length === 0}
                          className="bg-gold-500/20 text-gold-300 hover:bg-gold-500/30"
                          data-testid="button-submit-report"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          提交审批
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-6 border border-gold-500/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedReport.title}</h2>
                      {selectedReport.description && (
                        <p className="text-gray-400 mt-1">{selectedReport.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="text-gray-400">
                          {EXPENSE_TYPES.find(t => t.value === selectedReport.expenseType)?.label}
                        </span>
                        <span className={STATUS_LABELS[selectedReport.status]?.color || 'text-gray-400'}>
                          {STATUS_LABELS[selectedReport.status]?.label || selectedReport.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gold-400">
                        {formatAmount(selectedReport.totalAmount)}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {selectedReport.invoiceCount} 张发票
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">发票列表</h3>
                  {reportInvoices.length === 0 ? (
                    <div className="bg-slate-800/30 rounded-lg p-6 text-center border border-dashed border-gold-500/20">
                      <Receipt className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-400">暂无发票</p>
                      <p className="text-gray-500 text-sm mt-1">
                        请从"待处理发票"中选择发票添加
                      </p>
                    </div>
                  ) : (
                    reportInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="bg-slate-800/50 rounded-lg p-4 border border-gold-500/10 flex items-center justify-between"
                        data-testid={`report-invoice-${invoice.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gold-400" />
                          <div>
                            <span className="text-white">{invoice.sellerName || '未知商户'}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              {formatDate(invoice.invoiceDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-gold-400 font-medium">
                            {formatAmount(invoice.totalAmount || invoice.amount)}
                          </span>
                          {selectedReport.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeInvoiceMutation.mutate({
                                reportId: selectedReport.id,
                                invoiceId: invoice.id,
                              })}
                              className="text-gray-400 hover:text-red-400"
                              data-testid={`button-remove-invoice-${invoice.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="grid gap-3">
                {expenseReports.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-slate-800/30 rounded-lg p-8 text-center border border-gold-500/10"
                  >
                    <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">暂无报销单</p>
                    <p className="text-gray-500 text-sm mt-2">
                      创建报销单后，可以将发票添加到报销单中
                    </p>
                  </motion.div>
                ) : (
                  expenseReports.map((report) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedReport(report)}
                      className="bg-slate-800/50 rounded-lg p-4 border border-gold-500/10 hover:border-gold-500/30 transition-colors cursor-pointer"
                      data-testid={`report-card-${report.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {report.status === 'draft' ? (
                            <Clock className="h-5 w-5 text-gray-400" />
                          ) : report.status === 'approved' ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : (
                            <FileText className="h-5 w-5 text-gold-400" />
                          )}
                          <div>
                            <h3 className="text-white font-medium">{report.title}</h3>
                            <div className="flex items-center gap-3 text-sm mt-1">
                              <span className="text-gray-400">
                                {EXPENSE_TYPES.find(t => t.value === report.expenseType)?.label}
                              </span>
                              <span className={STATUS_LABELS[report.status]?.color || 'text-gray-400'}>
                                {STATUS_LABELS[report.status]?.label || report.status}
                              </span>
                              <span className="text-gray-500">
                                {report.invoiceCount} 张发票
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gold-400">
                            {formatAmount(report.totalAmount)}
                          </span>
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Image, File, CheckCircle, XCircle, Clock, Eye, RefreshCw, Trash2, MessageCircle, Plus, Edit, AlertCircle, Star, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadedDocument {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  category: string | null;
  totalFiles: number;
  status: string;
  processingProgress: number;
  extractedText: string | null;
  structuredData: any;
  createdAt: string;
}

interface DocumentPage {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  rawText: string | null;
  ocrConfidence: number | null;
  errorMessage: string | null;
}

interface DocumentMessage {
  id: string;
  role: "MASTER" | "AI";
  messageType: string;
  content: string;
  createdAt: string;
  isApplied?: boolean;
}

type FeedbackType = "SUPPLEMENT" | "CORRECTION" | "HIGHLIGHT" | "REVISION";

const feedbackLabels: Record<FeedbackType, { label: string; icon: React.ReactNode; color: string }> = {
  SUPPLEMENT: { label: "补充信息", icon: <Plus className="w-4 h-4" />, color: "text-blue-500" },
  CORRECTION: { label: "纠错", icon: <Edit className="w-4 h-4" />, color: "text-orange-500" },
  HIGHLIGHT: { label: "划重点", icon: <Star className="w-4 h-4" />, color: "text-yellow-500" },
  REVISION: { label: "修正", icon: <AlertCircle className="w-4 h-4" />, color: "text-red-500" },
};

export default function DocumentManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("CONTRACT");
  const [category, setCategory] = useState("LEGAL");
  const [viewingDoc, setViewingDoc] = useState<UploadedDocument | null>(null);
  const [viewingPages, setViewingPages] = useState<DocumentPage[]>([]);
  const [conversationMessages, setConversationMessages] = useState<DocumentMessage[]>([]);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("SUPPLEMENT");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [uploadingSupp, setUploadingSupp] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supplementInputRef = useRef<HTMLInputElement>(null);

  const { data: documentsData, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents/documents");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "上传成功", description: `${data.filesUploaded} 个文件正在处理中` });
        setSelectedFiles([]);
        setTitle("");
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } else {
        toast({ title: "上传失败", description: data.error, variant: "destructive" });
      }
      setUploading(false);
    },
    onError: (error: any) => {
      toast({ title: "上传失败", description: error.message, variant: "destructive" });
      setUploading(false);
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 20) {
      toast({ title: "文件数量超限", description: "最多支持同时上传20个文件", variant: "destructive" });
      return;
    }
    setSelectedFiles(files);
  }, [toast]);

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast({ title: "请选择文件", variant: "destructive" });
      return;
    }
    setUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));
    formData.append("title", title || `文档_${new Date().toISOString().slice(0, 10)}`);
    formData.append("documentType", documentType);
    formData.append("category", category);
    uploadMutation.mutate(formData);
  };

  const handleViewDocument = async (doc: UploadedDocument) => {
    setViewingDoc(doc);
    setConversationMessages([]);
    setFeedbackContent("");
    try {
      const [docRes, convRes] = await Promise.all([
        fetch(`/api/documents/documents/${doc.id}`),
        fetch(`/api/documents/documents/${doc.id}/conversation`),
      ]);
      const docData = await docRes.json();
      const convData = await convRes.json();
      if (docData.success) {
        setViewingPages(docData.pages || []);
      }
      if (convData.success) {
        setConversationMessages(convData.messages || []);
      }
    } catch (error) {
      console.error("Failed to load document details:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (conversationMessages.length > 0) {
      scrollToBottom();
    }
  }, [conversationMessages]);

  const handleSendFeedback = async () => {
    if (!viewingDoc || !feedbackContent.trim()) return;
    
    setSendingFeedback(true);
    try {
      const res = await fetch(`/api/documents/documents/${viewingDoc.id}/conversation/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType: feedbackType,
          content: feedbackContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const newMessages: DocumentMessage[] = [];
        if (data.userMessage) newMessages.push(data.userMessage);
        if (data.aiResponse) newMessages.push(data.aiResponse);
        if (newMessages.length > 0) {
          setConversationMessages(prev => [...prev, ...newMessages]);
        }
        setFeedbackContent("");
        toast({ title: "反馈已提交", description: "AI已处理您的反馈" });
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } else {
        toast({ title: "发送失败", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "发送失败", description: error.message, variant: "destructive" });
    }
    setSendingFeedback(false);
  };

  const handleRequestAnalysis = async () => {
    if (!viewingDoc) return;
    setSendingFeedback(true);
    try {
      const res = await fetch(`/api/documents/documents/${viewingDoc.id}/conversation/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.message) {
        setConversationMessages(prev => [...prev, data.message]);
        toast({ title: "分析完成" });
      } else if (!data.success) {
        toast({ title: "分析失败", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "分析失败", description: error.message, variant: "destructive" });
    }
    setSendingFeedback(false);
  };

  const handleSupplementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingDoc) return;
    
    setUploadingSupp(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`/api/documents/documents/${viewingDoc.id}/supplements`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "补充资料已上传", description: "小智正在分析中..." });
        // 刷新对话消息
        setTimeout(async () => {
          const convRes = await fetch(`/api/documents/documents/${viewingDoc.id}/conversation`);
          const convData = await convRes.json();
          if (convData.success) {
            setConversationMessages(convData.messages || []);
          }
        }, 3000);
      } else {
        toast({ title: "上传失败", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "上传失败", description: error.message, variant: "destructive" });
    }
    setUploadingSupp(false);
    if (supplementInputRef.current) {
      supplementInputRef.current.value = "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "PROCESSING":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "IMAGE":
        return <Image className="w-4 h-4" />;
      case "PDF":
        return <FileText className="w-4 h-4 text-red-500" />;
      case "WORD":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "EXCEL":
        return <FileText className="w-4 h-4 text-green-500" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  const documents: UploadedDocument[] = documentsData?.documents || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">文档管理</h1>
          <p className="text-muted-foreground">上传合同、发票等文档，自动提取关键信息</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              上传文档
            </CardTitle>
            <CardDescription>支持图片、PDF、Word、Excel等格式，最多20个文件</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>文档标题</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：2024年合作协议"
                data-testid="input-doc-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>文档类型</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger data-testid="select-doc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTRACT">合同</SelectItem>
                    <SelectItem value="INVOICE">发票</SelectItem>
                    <SelectItem value="RECEIPT">收据</SelectItem>
                    <SelectItem value="REPORT">报告</SelectItem>
                    <SelectItem value="OTHER">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>分类</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEGAL">法律</SelectItem>
                    <SelectItem value="FINANCE">财务</SelectItem>
                    <SelectItem value="BUSINESS">商务</SelectItem>
                    <SelectItem value="PERSONAL">个人</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>选择文件</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    点击或拖拽文件到此处
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    支持 JPG, PNG, PDF, Word, Excel
                  </p>
                </label>
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                      <File className="w-4 h-4" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              data-testid="button-upload"
            >
              {uploading ? "上传中..." : `上传 ${selectedFiles.length} 个文件`}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>文档列表</CardTitle>
            <CardDescription>共 {documents.length} 个文档</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无文档，请上传</div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`card-document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(doc.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{doc.title}</span>
                            <Badge variant="outline">{doc.documentType}</Badge>
                            {doc.category && <Badge variant="secondary">{doc.category}</Badge>}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>{doc.totalFiles} 个文件</span>
                            <span>{new Date(doc.createdAt).toLocaleString("zh-CN")}</span>
                          </div>
                          {doc.status === "PROCESSING" && (
                            <Progress value={doc.processingProgress} className="mt-2 h-1 w-32" />
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDocument(doc)}
                        data-testid={`button-view-${doc.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{viewingDoc?.title}</DialogTitle>
            <DialogDescription>
              {viewingDoc?.documentType} · {viewingDoc?.status}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="text" className="mt-4">
            <TabsList>
              <TabsTrigger value="conversation" className="flex items-center gap-1">
                <MessageCircle className="w-4 h-4" />
                智能对话
              </TabsTrigger>
              <TabsTrigger value="text">提取文本</TabsTrigger>
              <TabsTrigger value="analysis">结构化分析</TabsTrigger>
              <TabsTrigger value="pages">文件详情</TabsTrigger>
            </TabsList>
            <TabsContent value="conversation" className="mt-4">
              <div className="flex flex-col h-[400px]">
                <ScrollArea className="flex-1 border rounded-lg p-4 mb-3">
                  {conversationMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                      <p>暂无对话记录</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleRequestAnalysis}
                        disabled={sendingFeedback}
                      >
                        请求AI分析
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {conversationMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "MASTER" ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${msg.id}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              msg.role === "MASTER"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {msg.role === "MASTER" && msg.messageType !== "QUESTION" && (
                              <div className={`text-xs mb-1 opacity-80 ${feedbackLabels[msg.messageType as FeedbackType]?.color || ""}`}>
                                {feedbackLabels[msg.messageType as FeedbackType]?.label || msg.messageType}
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className="text-xs opacity-60 mt-1">
                              {new Date(msg.createdAt).toLocaleTimeString("zh-CN")}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                <div className="space-y-2">
                  <div className="flex gap-1 flex-wrap items-center">
                    {(Object.keys(feedbackLabels) as FeedbackType[]).map((type) => (
                      <Button
                        key={type}
                        variant={feedbackType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFeedbackType(type)}
                        className="flex items-center gap-1"
                        data-testid={`button-feedback-${type.toLowerCase()}`}
                      >
                        {feedbackLabels[type].icon}
                        <span className="hidden sm:inline">{feedbackLabels[type].label}</span>
                      </Button>
                    ))}
                    <div className="h-4 w-px bg-border mx-1" />
                    <input
                      ref={supplementInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleSupplementUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => supplementInputRef.current?.click()}
                      disabled={uploadingSupp}
                      className="flex items-center gap-1"
                      data-testid="button-upload-supplement"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="hidden sm:inline">{uploadingSupp ? "上传中..." : "补充资料"}</span>
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={feedbackContent}
                      onChange={(e) => setFeedbackContent(e.target.value)}
                      placeholder={`输入您的${feedbackLabels[feedbackType].label}内容...`}
                      className="flex-1 resize-none"
                      rows={2}
                      data-testid="input-feedback"
                    />
                    <Button
                      onClick={handleSendFeedback}
                      disabled={!feedbackContent.trim() || sendingFeedback}
                      data-testid="button-send-feedback"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="text" className="mt-4">
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                {viewingDoc?.extractedText ? (
                  <pre className="whitespace-pre-wrap text-sm">{viewingDoc.extractedText}</pre>
                ) : (
                  <p className="text-muted-foreground">暂无提取文本</p>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="analysis" className="mt-4">
              <ScrollArea className="h-[400px]">
                {viewingDoc?.structuredData ? (
                  <div className="space-y-4">
                    {viewingDoc.structuredData.parties?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">合同方</h4>
                        <div className="space-y-1">
                          {viewingDoc.structuredData.parties.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">{p.role}</Badge>
                              <span>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewingDoc.structuredData.amounts?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">金额</h4>
                        <div className="space-y-1">
                          {viewingDoc.structuredData.amounts.map((a: any, i: number) => (
                            <div key={i} className="text-sm">
                              <span className="font-mono">{a.currency} {a.value.toLocaleString()}</span>
                              <span className="text-muted-foreground ml-2">{a.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewingDoc.structuredData.dates?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">日期</h4>
                        <div className="space-y-1">
                          {viewingDoc.structuredData.dates.map((d: any, i: number) => (
                            <div key={i} className="text-sm">
                              <span className="font-mono">{d.date}</span>
                              <span className="text-muted-foreground ml-2">{d.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewingDoc.structuredData.risks?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">风险点</h4>
                        <div className="space-y-1">
                          {viewingDoc.structuredData.risks.map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Badge variant={r.level === "HIGH" ? "destructive" : "secondary"}>{r.level}</Badge>
                              <span>{r.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewingDoc.structuredData.summary && (
                      <div>
                        <h4 className="font-medium mb-2">摘要</h4>
                        <p className="text-sm text-muted-foreground">{viewingDoc.structuredData.summary}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">暂无结构化分析</p>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="pages" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {viewingPages.map((page) => (
                    <div key={page.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(page.fileType)}
                          <span className="font-medium">{page.fileName}</span>
                          <Badge variant="outline">{page.fileType}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(page.status)}
                          {page.ocrConfidence && (
                            <span className="text-xs text-muted-foreground">
                              置信度: {(page.ocrConfidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      {page.errorMessage && (
                        <p className="text-sm text-destructive mt-2">{page.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

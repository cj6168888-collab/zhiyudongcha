import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { GlobalWakeHeader } from "@/components/ui/global-wake-header";
import { LocalWhisperSTT } from "@/lib/whisper-local";
import { 
  Sparkles,
  Mic,
  MicOff,
  Send,
  Upload,
  FileText,
  X,
  RefreshCw,
  Check,
  Loader2,
  ArrowLeft,
  Brain,
  Target,
  AlertTriangle,
  Lightbulb,
  FolderPlus,
  Camera,
  Image,
  FileArchive,
  FileAudio,
  File,
  Users,
  UserPlus
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface UploadedFile {
  name: string;
  content: string;
  type: string;
  parsedType?: string;
  isProcessing?: boolean;
  parseError?: boolean;
}

interface ExtractedPerson {
  name: string;
  role?: string;
  organization?: string;
  phone?: string[];
  email?: string[];
  confidence: number;
}

interface DiscoveredContact {
  person: ExtractedPerson;
  status: 'pending' | 'added' | 'skipped';
}

const getFileIcon = (type: string, parsedType?: string) => {
  const t = parsedType || type;
  if (t.includes('image') || t === 'image') return <Image className="w-3 h-3" />;
  if (t.includes('pdf') || t === 'pdf') return <FileText className="w-3 h-3" />;
  if (t.includes('word') || t === 'word') return <FileText className="w-3 h-3" />;
  if (t.includes('zip') || t.includes('rar') || t === 'archive') return <FileArchive className="w-3 h-3" />;
  if (t.includes('audio') || t === 'audio') return <FileAudio className="w-3 h-3" />;
  return <File className="w-3 h-3" />;
};

interface GeneratedProject {
  title: string;
  description: string;
  category: string;
  priority: number;
  objectives: string[];
  currentConditions: string[];
  missingConditions: string[];
  swotAnalysis?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  aiReasoning?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function SmartProjectCreate() {
  const { toast } = useToast();
  const { role } = useZ1Store();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [userInput, setUserInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [discoveredContacts, setDiscoveredContacts] = useState<DiscoveredContact[]>([]);
  const [isExtractingEntities, setIsExtractingEntities] = useState(false);

  // 本地优先的混合语音识别 (Whisper Local + Web Speech fallback)
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const sttRef = useRef<LocalWhisperSTT | null>(null);
  const pendingVoiceTextRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (sttRef.current) {
        sttRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (sttRef.current) {
      sttRef.current.stop();
    }
    pendingVoiceTextRef.current = "";

    sttRef.current = new LocalWhisperSTT({
      onStart: () => {
        setIsListening(true);
        toast({ title: "开始录音", description: "请说出您的项目想法..." });
      },
      onResult: (text, isFinal) => {
        if (isFinal) {
          pendingVoiceTextRef.current = pendingVoiceTextRef.current ? `${pendingVoiceTextRef.current} ${text}` : text;
          setUserInput(prev => prev ? `${prev} ${text}` : text);
          setInterimTranscript("");
        } else {
          setInterimTranscript(text);
        }
      },
      onError: (error) => {
        toast({ title: "语音识别失败", description: error, variant: "destructive" });
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
        setInterimTranscript("");
        if (pendingVoiceTextRef.current.trim()) {
          toast({ title: "语音识别完成", description: "正在自动生成项目..." });
          setTimeout(() => {
            const sendBtn = document.querySelector('[data-testid="button-send"]') as HTMLButtonElement;
            if (sendBtn && !sendBtn.disabled) {
              sendBtn.click();
            }
          }, 100);
        }
      },
    }, {
      mode: 'HYBRID',  // 混合模式：优先本地，降级云端
      language: 'zh',
    });

    sttRef.current.start();
  }, [toast]);

  const stopListening = useCallback(() => {
    if (sttRef.current) {
      sttRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const extractEntitiesFromText = async (text: string) => {
    if (!text.trim() || text.length < 10) return;
    
    try {
      setIsExtractingEntities(true);
      const response = await apiRequest('POST', '/api/entities/extract', {
        text,
        autoHarvest: false,
        minConfidence: 0.6,
      }) as { success: boolean; extraction: { persons: ExtractedPerson[] } };
      
      if (response.success && response.extraction.persons.length > 0) {
        const newContacts = response.extraction.persons
          .filter(p => !discoveredContacts.some(dc => dc.person.name === p.name))
          .map(p => ({ person: p, status: 'pending' as const }));
        
        if (newContacts.length > 0) {
          setDiscoveredContacts(prev => [...prev, ...newContacts]);
          toast({
            title: `发现 ${newContacts.length} 个联系人`,
            description: newContacts.map(c => c.person.name).join('、'),
          });
        }
      }
    } catch (error) {
      console.error('Entity extraction failed:', error);
    } finally {
      setIsExtractingEntities(false);
    }
  };

  const addContactToDB = async (contact: DiscoveredContact) => {
    try {
      await apiRequest('POST', '/api/entities/harvest', {
        persons: [contact.person],
        autoConfirm: false,
        source: 'SMART_PROJECT_CREATE',
      });
      
      setDiscoveredContacts(prev => 
        prev.map(c => c.person.name === contact.person.name ? { ...c, status: 'added' } : c)
      );
      
      toast({ title: "联系人已添加", description: `${contact.person.name} 已加入人脉库` });
    } catch {
      toast({ title: "添加失败", variant: "destructive" });
    }
  };

  const skipContact = (name: string) => {
    setDiscoveredContacts(prev => 
      prev.map(c => c.person.name === name ? { ...c, status: 'skipped' } : c)
    );
  };

  const parseFileWithAI = async (fileName: string, base64Data: string, mimeType: string) => {
    try {
      const response = await apiRequest('POST', '/api/files/parse', {
        fileName, base64Data, mimeType
      });
      return response as { success: boolean; text: string; parsedType: string; metadata?: any };
    } catch {
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setIsParsingFiles(true);
    
    const fileArray = Array.from(files);
    const fileNames: string[] = [];
    
    for (const file of fileArray) {
      const tempFile: UploadedFile = {
        name: file.name,
        content: '',
        type: file.type || 'text/plain',
        isProcessing: true
      };
      fileNames.push(file.name);
      setUploadedFiles(prev => [...prev, tempFile]);
    }
    
    const parsePromises = fileArray.map(file => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = event.target?.result as string;
          const base64Data = result.split(',')[1] || result;
          
          const parsed = await parseFileWithAI(file.name, base64Data, file.type);
          
          setUploadedFiles(prev => prev.map(f => 
            f.name === file.name && f.isProcessing 
              ? {
                  name: file.name,
                  content: parsed?.text || (parsed === null ? '[解析失败]' : ''),
                  type: file.type,
                  parsedType: parsed?.parsedType || 'unknown',
                  isProcessing: false,
                  parseError: parsed === null || !parsed.success
                }
              : f
          ));
          resolve();
        };
        reader.onerror = () => {
          setUploadedFiles(prev => prev.map(f => 
            f.name === file.name && f.isProcessing 
              ? { ...f, content: '[读取失败]', isProcessing: false, parseError: true }
              : f
          ));
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });
    
    await Promise.all(parsePromises);
    setIsParsingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setIsParsingFiles(true);
    
    const tempFileName = `拍照_${new Date().toLocaleTimeString()}.jpg`;
    const tempFile: UploadedFile = {
      name: tempFileName,
      content: '',
      type: 'image/jpeg',
      isProcessing: true
    };
    setUploadedFiles(prev => [...prev, tempFile]);
    
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const base64Data = result.split(',')[1] || result;
      const parsed = await parseFileWithAI(tempFileName, base64Data, 'image/jpeg');
      
      setUploadedFiles(prev => prev.map(f => 
        f.name === tempFileName && f.isProcessing 
          ? {
              name: tempFileName,
              content: parsed?.text || '[OCR识别失败]',
              type: 'image/jpeg',
              parsedType: 'image',
              isProcessing: false,
              parseError: !parsed?.text
            }
          : f
      ));
      
      if (parsed?.text) {
        toast({ title: "图片已识别", description: `小智已识别图片内容（${parsed.text.length}字）` });
      } else {
        toast({ title: "识别失败", description: "未能识别图片内容，请重试", variant: "destructive" });
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.name === tempFileName && f.isProcessing 
          ? { ...f, content: '[读取失败]', isProcessing: false, parseError: true }
          : f
      ));
      toast({ title: "拍照失败", description: "读取照片时出错", variant: "destructive" });
    } finally {
      setIsParsingFiles(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRecording = () => {
    if (isListening) {
      stopListening();
      toast({ title: "录音已停止", description: "语音识别结束" });
    } else {
      startListening();
    }
  };

  const createProjectMutation = useMutation({
    mutationFn: async (project: GeneratedProject) => {
      return apiRequest('POST', '/api/projects', {
        title: project.title,
        description: project.description,
        category: project.category,
        priority: project.priority,
        currentConditions: project.currentConditions,
        missingConditions: project.missingConditions,
        swotAnalysis: project.swotAnalysis,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "项目已立项", description: "项目创建成功，已进入待审批状态" });
      navigate("/projects");
    },
    onError: () => {
      toast({ title: "立项失败", description: "创建项目时出现问题", variant: "destructive" });
    },
  });

  const generateProjectMutation = useMutation({
    mutationFn: async (data: { input: string; files: UploadedFile[]; previousProject?: GeneratedProject; feedback?: string }) => {
      return apiRequest('POST', '/api/projects/smart-create', data);
    },
    onSuccess: (data: any) => {
      setGeneratedProject(data.project);
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: data.message || '项目已自动创建并保存到数据库',
        timestamp: new Date()
      }]);
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "项目已立项", description: data.savedProject?.title || data.project?.title });
      setTimeout(() => navigate("/projects"), 1500);
    },
    onError: () => {
      toast({ title: "生成失败", description: "AI推理过程出现问题，请重试", variant: "destructive" });
      setIsGenerating(false);
    },
  });

  const handleSendMessage = () => {
    if (!userInput.trim() && uploadedFiles.length === 0) return;
    
    const textToAnalyze = userInput + ' ' + uploadedFiles.map(f => f.content).join(' ');
    extractEntitiesFromText(textToAnalyze);
    
    setConversation(prev => [...prev, {
      role: 'user',
      content: userInput || `[上传了 ${uploadedFiles.length} 个文件]`,
      timestamp: new Date()
    }]);
    
    setIsGenerating(true);
    
    if (generatedProject) {
      generateProjectMutation.mutate({
        input: "",
        files: uploadedFiles,
        previousProject: generatedProject,
        feedback: userInput,
      });
    } else {
      generateProjectMutation.mutate({
        input: userInput,
        files: uploadedFiles,
      });
    }
    
    setUserInput("");
  };

  const handleConfirmProject = () => {
    if (!generatedProject) return;
    createProjectMutation.mutate(generatedProject);
  };

  const handleRegenerate = () => {
    if (!generatedProject) return;
    setIsGenerating(true);
    generateProjectMutation.mutate({
      input: "请重新推理生成项目方案",
      files: uploadedFiles,
      previousProject: generatedProject,
      feedback: "请换一个思路重新生成",
    });
  };

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              访问被拒绝
            </CardTitle>
            <CardDescription>此功能仅对主人开放</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <GlobalWakeHeader />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回项目中心
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">智能项目创建</h1>
              <p className="text-slate-400 text-sm">告诉小智您的想法，她会帮您生成项目</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  告诉小智您的想法
                </CardTitle>
                <CardDescription>语音或文字描述您的项目构想，越详细越好</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-48 border border-slate-700/50 rounded-lg p-3 bg-slate-900/50">
                  {conversation.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <Sparkles className="w-8 h-8 mb-2" />
                      <p className="text-sm text-center">开始描述您的项目想法...</p>
                      <p className="text-xs text-center mt-1">例如："我想做一个线下咖啡店，目标客群是年轻白领..."</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {conversation.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                            msg.role === 'user' 
                              ? 'bg-purple-500/20 text-purple-200' 
                              : 'bg-slate-700/50 text-slate-200'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isGenerating && (
                        <div className="flex justify-start">
                          <div className="bg-slate-700/50 p-2 rounded-lg flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                            <span className="text-sm text-slate-300">小智正在推理分析...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
                
                <div className="flex gap-2">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="输入您的想法，或上传资料后点击发送..."
                    className="bg-slate-900 border-slate-600 text-white min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    data-testid="input-idea"
                  />
                </div>
                
                {/* 实时语音识别显示 */}
                {isListening && (
                  <div className="p-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className="w-1 bg-purple-400 rounded-full animate-pulse"
                            style={{ height: `${4 + i * 3}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-purple-300 italic">
                        {interimTranscript || "正在聆听..."}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleRecording}
                    className={`border-slate-600 ${isListening ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse' : ''}`}
                    data-testid="button-voice"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-slate-600"
                    disabled={isParsingFiles}
                    data-testid="button-upload"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isParsingFiles ? '解析中...' : '上传资料'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.doc,.docx,.pdf,.jpg,.jpeg,.png,.gif,.zip,.rar,.mp3,.wav,.m4a,.json,.csv,.xml"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    className="border-slate-600"
                    disabled={isParsingFiles}
                    data-testid="button-camera"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    拍照
                  </Button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraCapture}
                  />
                  
                  <div className="flex-1" />
                  
                  <Button
                    onClick={handleSendMessage}
                    disabled={isGenerating || (!userInput.trim() && uploadedFiles.length === 0 && !generatedProject)}
                    className="bg-purple-500 hover:bg-purple-600"
                    data-testid="button-send"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">已上传的资料：</p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((file, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className={`border-slate-600 text-slate-300 flex items-center gap-1 ${file.isProcessing ? 'animate-pulse' : ''}`}
                        >
                          {file.isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            getFileIcon(file.type, file.parsedType)
                          )}
                          {file.name}
                          {file.parsedType && !file.isProcessing && (
                            <span className="text-xs text-green-400">✓</span>
                          )}
                          <button 
                            onClick={() => removeFile(i)}
                            className="ml-1 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {discoveredContacts.filter(c => c.status === 'pending').length > 0 && (
                  <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Users className="w-4 h-4" />
                      <span className="text-sm font-medium">发现新联系人</span>
                      {isExtractingEntities && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>
                    <div className="space-y-2">
                      {discoveredContacts.filter(c => c.status === 'pending').map((contact, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-800/50 p-2 rounded">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-white">{contact.person.name}</span>
                            {contact.person.role && (
                              <span className="text-xs text-slate-400 ml-2">{contact.person.role}</span>
                            )}
                            {contact.person.organization && (
                              <span className="text-xs text-slate-500 ml-1">@ {contact.person.organization}</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-green-400 hover:text-green-300"
                              onClick={() => addContactToDB(contact)}
                              data-testid={`button-add-contact-${i}`}
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              添加
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-slate-400 hover:text-slate-300"
                              onClick={() => skipContact(contact.person.name)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-400" />
                    生成的项目方案
                  </CardTitle>
                  {generatedProject && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                        className="text-slate-400 hover:text-white"
                        data-testid="button-regenerate"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        重新推理
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!generatedProject ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Brain className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">等待您的输入...</p>
                    <p className="text-xs mt-1">小智会根据您的想法和资料生成项目方案</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-400">项目名称</label>
                        <div className="text-lg font-semibold text-white mt-1">{generatedProject.title}</div>
                      </div>
                      
                      <div>
                        <label className="text-xs text-slate-400">项目描述</label>
                        <p className="text-sm text-slate-300 mt-1">{generatedProject.description}</p>
                      </div>
                      
                      <div className="flex gap-4">
                        <div>
                          <label className="text-xs text-slate-400">分类</label>
                          <Badge className="block mt-1 bg-blue-500/20 text-blue-400">{generatedProject.category}</Badge>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">优先级</label>
                          <Badge className="block mt-1 bg-orange-500/20 text-orange-400">P{generatedProject.priority}</Badge>
                        </div>
                      </div>
                      
                      {generatedProject.objectives && generatedProject.objectives.length > 0 && (
                        <div>
                          <label className="text-xs text-slate-400">项目目标</label>
                          <ul className="mt-1 space-y-1">
                            {generatedProject.objectives.map((obj, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-green-400 mt-1">•</span>
                                {obj}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400">现有条件</label>
                          <ul className="mt-1 space-y-1">
                            {(generatedProject.currentConditions || []).map((c, i) => (
                              <li key={i} className="text-xs text-green-400 flex items-center gap-1">
                                <Check className="w-3 h-3" />{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">缺失条件</label>
                          <ul className="mt-1 space-y-1">
                            {(generatedProject.missingConditions || []).map((c, i) => (
                              <li key={i} className="text-xs text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      
                      {generatedProject.swotAnalysis && (
                        <div>
                          <label className="text-xs text-slate-400 mb-2 block">SWOT分析</label>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-green-500/10 p-2 rounded border border-green-500/20">
                              <div className="font-medium text-green-400 mb-1">优势</div>
                              {generatedProject.swotAnalysis.strengths?.map((s, i) => (
                                <div key={i} className="text-slate-300">• {s}</div>
                              ))}
                            </div>
                            <div className="bg-red-500/10 p-2 rounded border border-red-500/20">
                              <div className="font-medium text-red-400 mb-1">劣势</div>
                              {generatedProject.swotAnalysis.weaknesses?.map((w, i) => (
                                <div key={i} className="text-slate-300">• {w}</div>
                              ))}
                            </div>
                            <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20">
                              <div className="font-medium text-blue-400 mb-1">机会</div>
                              {generatedProject.swotAnalysis.opportunities?.map((o, i) => (
                                <div key={i} className="text-slate-300">• {o}</div>
                              ))}
                            </div>
                            <div className="bg-amber-500/10 p-2 rounded border border-amber-500/20">
                              <div className="font-medium text-amber-400 mb-1">威胁</div>
                              {generatedProject.swotAnalysis.threats?.map((t, i) => (
                                <div key={i} className="text-slate-300">• {t}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {generatedProject.aiReasoning && (
                        <div>
                          <label className="text-xs text-slate-400">小智的推理</label>
                          <p className="text-xs text-slate-400 mt-1 italic">{generatedProject.aiReasoning}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            
            {generatedProject && (
              <div className="flex justify-end gap-3">
                <Textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="有什么需要修改的？告诉小智..."
                  className="bg-slate-900 border-slate-600 text-white text-sm h-10 py-2"
                  data-testid="input-feedback"
                />
                <Button
                  onClick={handleConfirmProject}
                  disabled={createProjectMutation.isPending}
                  className="bg-green-500 hover:bg-green-600 whitespace-nowrap"
                  data-testid="button-confirm"
                >
                  {createProjectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FolderPlus className="w-4 h-4 mr-2" />
                  )}
                  确认立项
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

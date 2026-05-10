/**
 * DesktopExperts - 桌面端五大专家咨询页面
 *
 * 功能：
 * - 五大专家卡片展示
 * - 实时咨询状态
 * - 专家详情和工作站
 * - 贡献度统计
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck, Wallet, BrainCircuit, HeartPulse, FileText,
  MessageSquare, TrendingUp, Clock, CheckCircle2, Sparkles,
  BarChart3, Users, Calendar, AlertTriangle, ChevronRight,
  Send, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

// 专家数据
interface Expert {
  id: string;
  name: string;
  title: string;
  icon: typeof ShieldCheck;
  color: string;
  bg: string;
  borderColor: string;
  desc: string;
  detailedDesc: string;
  status: 'idle' | 'consulting' | 'analyzing';
  contribution: number;
  consultations: number;
  avgResponseTime: number;
  model: string;
  specialties: string[];
}

const experts: Expert[] = [
  {
    id: 'legal',
    name: '法务专家',
    title: 'Legal Expert',
    icon: ShieldCheck,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    desc: '陷阱条款识别、谈判辩论策略',
    detailedDesc: '基于海量法律文书训练的专家，精通合同法、劳动法、公司法等领域的风险识别。可自动分析合同条款，识别不平等条款和潜在法律风险。',
    status: 'idle',
    contribution: 85,
    consultations: 234,
    avgResponseTime: 180,
    model: 'Claude Sonnet',
    specialties: ['合同审阅', '风险识别', '谈判策略', '法规咨询']
  },
  {
    id: 'finance',
    name: '财务专家',
    title: 'Finance Expert',
    icon: Wallet,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    desc: '盈亏分析、资金流预警',
    detailedDesc: '专业的财务分析专家，提供投资回报分析、成本控制建议、财务风险预警等服务。擅长从财务数据中发现问题并提供优化建议。',
    status: 'idle',
    contribution: 92,
    consultations: 189,
    avgResponseTime: 150,
    model: 'DeepSeek V3',
    specialties: ['投资分析', '成本优化', '预算编制', '税务筹划']
  },
  {
    id: 'strategy',
    name: '策划专家',
    title: 'Strategy Expert',
    icon: BrainCircuit,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    desc: '商业闭环方案、行业数据分析',
    detailedDesc: '战略规划专家，擅长商业模式设计、市场分析和竞争策略制定。基于行业数据和趋势分析，提供前瞻性的战略建议。',
    status: 'analyzing',
    contribution: 78,
    consultations: 156,
    avgResponseTime: 220,
    model: 'GPT-4o',
    specialties: ['商业策划', '市场分析', '竞争策略', '创新方案']
  },
  {
    id: 'psychology',
    name: '心理专家',
    title: 'Psychology Expert',
    icon: HeartPulse,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    desc: '团队士气曲线、员工状态预警',
    detailedDesc: '专业的心理学顾问，提供团队管理、沟通技巧、压力管理等咨询。帮助管理者更好地理解员工心理，提升团队凝聚力。',
    status: 'idle',
    contribution: 65,
    consultations: 98,
    avgResponseTime: 200,
    model: 'Claude Haiku',
    specialties: ['团队管理', '沟通技巧', '压力管理', '冲突调解']
  },
  {
    id: 'secretary',
    name: '全能秘书',
    title: 'Secretary Expert',
    icon: FileText,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    desc: '日程管理、礼仪提醒、事务协调',
    detailedDesc: '全能型秘书专家，处理日程安排、会议协调、邮件撰写等日常事务。让你从繁琐事务中解放出来，专注于重要决策。',
    status: 'consulting',
    contribution: 88,
    consultations: 412,
    avgResponseTime: 120,
    model: 'GPT-4o Mini',
    specialties: ['日程管理', '邮件处理', '会议协调', '事务提醒']
  },
];

// 模拟咨询记录
interface ConsultationRecord {
  id: string;
  expertId: string;
  question: string;
  answer: string;
  timestamp: Date;
  adopted: boolean;
}

const mockRecords: ConsultationRecord[] = [
  {
    id: '1',
    expertId: 'legal',
    question: '这份合同第3条是否有风险？',
    answer: '经分析，第3条存在以下风险点：1) 违约金比例过高；2) 免责条款过于宽泛；3) 争议解决条款对我方不利。建议与对方协商修改。',
    timestamp: new Date(Date.now() - 3600000),
    adopted: true
  },
  {
    id: '2',
    expertId: 'finance',
    question: '项目预算是否合理？',
    answer: '根据历史数据和市场行情，当前预算略高于行业平均水平15%。建议优化供应链或调整项目范围以控制成本。',
    timestamp: new Date(Date.now() - 7200000),
    adopted: false
  },
];

export default function DesktopExperts() {
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [records] = useState<ConsultationRecord[]>(mockRecords);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'consulting':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 咨询中
        </Badge>;
      case 'analyzing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 分析中
        </Badge>;
      default:
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> 可用
        </Badge>;
    }
  };

  const handleConsult = () => {
    if (!inputQuestion.trim() || !selectedExpert) return;
    setIsConsulting(true);
    setTimeout(() => {
      setIsConsulting(false);
      setInputQuestion('');
    }, 2000);
  };

  return (
    <div className="flex h-full bg-[#030712]">
      {/* 左侧：专家列表 */}
      <div className="w-80 border-r border-white/10 bg-black/20 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            五大专家席位
          </h2>
          <p className="text-xs text-gray-500 mt-1">多模型路由 · 智能匹配</p>
        </div>

        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {experts.map((expert) => (
              <button
                key={expert.id}
                onClick={() => setSelectedExpert(expert)}
                className={cn(
                  "w-full text-left p-4 rounded-xl transition-all",
                  selectedExpert?.id === expert.id
                    ? `${expert.bg} border ${expert.borderColor}`
                    : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", expert.bg)}>
                    <expert.icon className={cn("w-5 h-5", expert.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">{expert.name}</h3>
                      {getStatusBadge(expert.status)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{expert.desc}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-gray-600">贡献度 {expert.contribution}%</span>
                      <span className="text-[10px] text-gray-600">咨询 {expert.consultations}次</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* 统计概览 */}
        <div className="p-4 border-t border-white/10">
          <h3 className="text-xs font-bold text-gray-400 mb-3">本月统计</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-white">1,089</p>
              <p className="text-[10px] text-gray-500">总咨询量</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-green-400">87%</p>
              <p className="text-[10px] text-gray-500">采纳率</p>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：专家详情和咨询 */}
      <div className="flex-1 flex flex-col">
        {!selectedExpert ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">选择一位专家开始咨询</p>
            </div>
          </div>
        ) : (
          <>
            {/* 专家详情头部 */}
            <div className={cn("p-6 border-b border-white/10 bg-gradient-to-r", selectedExpert.bg, "to-transparent")}>
              <div className="flex items-start gap-4">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0", selectedExpert.bg, "border", selectedExpert.borderColor)}>
                  <selectedExpert.icon className={cn("w-8 h-8", selectedExpert.color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">{selectedExpert.name}</h2>
                    {getStatusBadge(selectedExpert.status)}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{selectedExpert.title}</p>
                  <p className="text-sm text-gray-500 mt-2 max-w-2xl">{selectedExpert.detailedDesc}</p>
                </div>
              </div>

              {/* 专业领域 */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-gray-500">专业领域：</span>
                {selectedExpert.specialties.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>

              {/* 性能指标 */}
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-white">{selectedExpert.contribution}%</p>
                  <p className="text-[10px] text-gray-500">贡献度</p>
                </div>
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-white">{selectedExpert.consultations}</p>
                  <p className="text-[10px] text-gray-500">咨询次数</p>
                </div>
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-white">{selectedExpert.avgResponseTime}ms</p>
                  <p className="text-[10px] text-gray-500">平均响应</p>
                </div>
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-black text-white">{selectedExpert.model}</p>
                  <p className="text-[10px] text-gray-500">底层模型</p>
                </div>
              </div>
            </div>

            {/* 咨询区域 */}
            <div className="flex-1 flex">
              {/* 输入区域 */}
              <div className="flex-1 p-6 flex flex-col">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  在线咨询
                </h3>

                <Card className="flex-1 bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <textarea
                      value={inputQuestion}
                      onChange={(e) => setInputQuestion(e.target.value)}
                      placeholder={`向${selectedExpert.name}提问...`}
                      className="w-full h-32 bg-transparent border-none text-white placeholder:text-gray-600 resize-none focus:outline-none text-sm"
                    />
                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-xs">
                          📎 上传文件
                        </Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10 text-xs">
                          📋 参考上下文
                        </Badge>
                      </div>
                      <Button
                        className="bg-indigo-500 hover:bg-indigo-600"
                        onClick={handleConsult}
                        disabled={!inputQuestion.trim() || isConsulting}
                      >
                        {isConsulting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            分析中...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            发送咨询
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 快捷问题 */}
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">快捷问题：</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedExpert.id === 'legal' && (
                      <>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('帮我审阅这份合同')}>审阅合同</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('识别谈判中的法律风险')}>识别法律风险</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('如何应对对方的霸王条款')}>应对霸王条款</Badge>
                      </>
                    )}
                    {selectedExpert.id === 'finance' && (
                      <>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('分析项目的投资回报率')}>投资回报分析</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('优化成本结构建议')}>成本优化</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('财务风险预警')}>风险预警</Badge>
                      </>
                    )}
                    {selectedExpert.id === 'strategy' && (
                      <>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('制定下季度市场策略')}>市场策略</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('分析竞争对手')}>竞品分析</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('商业模式优化建议')}>商业模式</Badge>
                      </>
                    )}
                    {selectedExpert.id === 'psychology' && (
                      <>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('团队士气下降怎么办')}>士气问题</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('如何提升员工积极性')}>提升积极性</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('处理团队冲突')}>冲突处理</Badge>
                      </>
                    )}
                    {selectedExpert.id === 'secretary' && (
                      <>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('安排下周会议日程')}>日程安排</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('起草商务邮件')}>起草邮件</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-white/10" onClick={() => setInputQuestion('会议纪要整理')}>会议纪要</Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 历史记录 */}
              <div className="w-80 border-l border-white/10 p-4 bg-black/20">
                <h3 className="text-sm font-bold text-white mb-4">咨询记录</h3>
                <ScrollArea className="h-[calc(100%-2rem)]">
                  <div className="space-y-3">
                    {records.filter(r => r.expertId === selectedExpert.id).map((record) => (
                      <Card key={record.id} className="bg-white/5 border-white/10">
                        <CardContent className="p-3">
                          <p className="text-xs text-gray-400 mb-2">问：{record.question}</p>
                          <p className="text-xs text-white mb-2">{record.answer.slice(0, 100)}...</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-600">
                              {record.timestamp.toLocaleString('zh-CN')}
                            </span>
                            {record.adopted ? (
                              <Badge className="text-[10px] bg-green-500/20 text-green-400">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> 已采纳
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                未采纳
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

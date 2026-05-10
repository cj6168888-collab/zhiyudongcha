/**
 * DesktopContacts - 桌面端人脉管理页面
 *
 * 功能：
 * - 人脉列表展示
 * - 分类管理
 * - 搜索和筛选
 * - 联系人详情
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, Search, Plus, MoreVertical, Phone, Mail, Briefcase,
  Building2, Calendar, MessageSquare, Star, Filter, Grid, List,
  UserPlus, Download, Upload, Trash2, Edit, ChevronRight,
  User, Tag, Heart, Shield, Handshake
} from "lucide-react";
import { cn } from "@/lib/utils";

// 联系人类型
interface Contact {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  tags: string[];
  category: 'CLIENT' | 'PARTNER' | 'TEAM' | 'VIP' | 'OTHER';
  lastContact?: Date;
  notes?: string;
  starred: boolean;
}

// 模拟数据
const mockContacts: Contact[] = [
  {
    id: '1',
    name: '张总',
    title: 'CEO',
    company: '华创科技',
    phone: '138****8888',
    email: 'zhang@huachuang.com',
    tags: ['重要客户', '战略合作'],
    category: 'VIP',
    lastContact: new Date(Date.now() - 86400000),
    notes: '对AI产品非常有兴趣，已进入深度洽谈阶段',
    starred: true
  },
  {
    id: '2',
    name: '李经理',
    title: '采购总监',
    company: '鑫达集团',
    phone: '139****6666',
    email: 'li@xinda.com',
    tags: ['企业客户', '长期合作'],
    category: 'CLIENT',
    lastContact: new Date(Date.now() - 86400000 * 3),
    starred: true
  },
  {
    id: '3',
    name: '王工程师',
    title: '技术总监',
    company: '蓝海科技',
    phone: '136****5555',
    email: 'wang@lanhai.com',
    tags: ['技术专家', '合作伙伴'],
    category: 'PARTNER',
    lastContact: new Date(Date.now() - 86400000 * 7),
    starred: false
  },
  {
    id: '4',
    name: '陈助理',
    title: '行政助理',
    company: '华创科技',
    phone: '137****4444',
    email: 'chen@huachuang.com',
    tags: ['对接人'],
    category: 'CLIENT',
    lastContact: new Date(Date.now() - 86400000),
    starred: false
  },
  {
    id: '5',
    name: '刘总',
    title: '董事长',
    company: '远景资本',
    phone: '135****3333',
    email: 'liu@yuanjing.com',
    tags: ['投资人', '战略合作'],
    category: 'VIP',
    lastContact: new Date(Date.now() - 86400000 * 14),
    notes: '投资圈重要人物，关注AI赛道',
    starred: true
  },
  {
    id: '6',
    name: '团队成员-小王',
    title: '产品经理',
    company: '小星科技',
    phone: '136****2222',
    email: 'xiaowang@xiaoxing.com',
    tags: ['核心团队'],
    category: 'TEAM',
    lastContact: new Date(Date.now() - 3600000),
    starred: false
  },
];

const categoryConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Star }> = {
  VIP: { label: 'VIP客户', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Star },
  CLIENT: { label: '客户', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Building2 },
  PARTNER: { label: '合作伙伴', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Handshake },
  TEAM: { label: '团队成员', color: 'text-green-400', bg: 'bg-green-500/20', icon: Users },
  OTHER: { label: '其他', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Tag },
};

export default function DesktopContacts() {
  const [contacts] = useState<Contact[]>(mockContacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // 过滤联系人
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || c.category === categoryFilter;
    const matchesStarred = !showStarredOnly || c.starred;
    return matchesSearch && matchesCategory && matchesStarred;
  });

  // 统计
  const stats = {
    total: contacts.length,
    vip: contacts.filter(c => c.category === 'VIP').length,
    clients: contacts.filter(c => c.category === 'CLIENT').length,
    partners: contacts.filter(c => c.category === 'PARTNER').length,
    starred: contacts.filter(c => c.starred).length,
  };

  const getInitials = (name: string) => {
    return name.split('').slice(0, 2).join('').toUpperCase();
  };

  const formatLastContact = (date?: Date) => {
    if (!date) return '从未联系';
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    return `${Math.floor(days / 30)}月前`;
  };

  return (
    <div className="flex h-full bg-[#030712]">
      {/* 左侧人脉列表 */}
      <div className={cn(
        "border-r border-white/10 bg-black/20 flex flex-col transition-all",
        selectedContact ? "w-96" : "w-full"
      )}>
        {/* 顶部栏 */}
        <div className="flex-shrink-0 p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white">人脉管理</h2>
              <Badge variant="outline" className="text-xs">
                {stats.total} 位联系人
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <UserPlus className="w-4 h-4" />
              添加
            </Button>
          </div>

          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="搜索联系人..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="flex-shrink-0 p-4 border-b border-white/10">
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={cn(
                "p-2 rounded-lg text-center transition-all",
                categoryFilter === 'ALL' ? "bg-indigo-500/20 border border-indigo-500/30" : "bg-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-lg font-black text-white">{stats.total}</p>
              <p className="text-[10px] text-gray-500">全部</p>
            </button>
            <button
              onClick={() => setCategoryFilter('VIP')}
              className={cn(
                "p-2 rounded-lg text-center transition-all",
                categoryFilter === 'VIP' ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-lg font-black text-amber-400">{stats.vip}</p>
              <p className="text-[10px] text-gray-500">VIP</p>
            </button>
            <button
              onClick={() => setCategoryFilter('CLIENT')}
              className={cn(
                "p-2 rounded-lg text-center transition-all",
                categoryFilter === 'CLIENT' ? "bg-blue-500/20 border border-blue-500/30" : "bg-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-lg font-black text-blue-400">{stats.clients}</p>
              <p className="text-[10px] text-gray-500">客户</p>
            </button>
            <button
              onClick={() => setShowStarredOnly(!showStarredOnly)}
              className={cn(
                "p-2 rounded-lg text-center transition-all",
                showStarredOnly ? "bg-yellow-500/20 border border-yellow-500/30" : "bg-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-lg font-black text-yellow-400">{stats.starred}</p>
              <p className="text-[10px] text-gray-500">星标</p>
            </button>
          </div>
        </div>

        {/* 联系人列表 */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {filteredContacts.map(contact => {
              const category = categoryConfig[contact.category];
              const CategoryIcon = category.icon;

              return (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all flex items-start gap-3",
                    selectedContact?.id === contact.id
                      ? "bg-indigo-500/20 border border-indigo-500/30"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback className="bg-indigo-500/20 text-indigo-400 text-sm">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    {contact.starred && (
                      <Star className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white truncate">{contact.name}</h3>
                      <span className="text-[10px] text-gray-500">
                        {formatLastContact(contact.lastContact)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {contact.title} {contact.company && `@ ${contact.company}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn("text-[10px]", category.bg, category.color)}>
                        {category.label}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧联系人详情 */}
      {selectedContact && (
        <div className="flex-1 flex flex-col bg-black/20">
          <div className="flex-shrink-0 p-6 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={selectedContact.avatar} />
                  <AvatarFallback className="bg-indigo-500/20 text-indigo-400 text-xl">
                    {getInitials(selectedContact.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedContact.name}</h2>
                    <Badge className={cn(
                      "text-xs",
                      categoryConfig[selectedContact.category].bg,
                      categoryConfig[selectedContact.category].color
                    )}>
                      {categoryConfig[selectedContact.category].label}
                    </Badge>
                    {selectedContact.starred && (
                      <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedContact.title} {selectedContact.company && `@ ${selectedContact.company}`}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    {selectedContact.phone && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedContact.phone}
                      </span>
                    )}
                    {selectedContact.email && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedContact.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit className="w-4 h-4" />
                  编辑
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {/* 标签 */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">标签</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedContact.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-white/10">
                    <Plus className="w-3 h-3 mr-1" />
                    添加标签
                  </Badge>
                </div>
              </div>

              {/* 快捷操作 */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">快捷操作</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Button variant="outline" className="gap-2 bg-white/5">
                    <Phone className="w-4 h-4 text-green-400" />
                    拨打电话
                  </Button>
                  <Button variant="outline" className="gap-2 bg-white/5">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    发送消息
                  </Button>
                  <Button variant="outline" className="gap-2 bg-white/5">
                    <Mail className="w-4 h-4 text-purple-400" />
                    发送邮件
                  </Button>
                </div>
              </div>

              {/* 备注 */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">备注</h3>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-400">
                      {selectedContact.notes || '暂无备注'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 联系历史 */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3">联系历史</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">通话</p>
                      <p className="text-xs text-gray-500">今天 14:30 · 12分钟</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">发送消息</p>
                      <p className="text-xs text-gray-500">昨天 10:15</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">商务会面</p>
                      <p className="text-xs text-gray-500">3天前 · 华创科技会议室</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

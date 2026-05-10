import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, MessageCircle, Send, Wifi, WifiOff, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { cn } from "@/lib/utils";
import { getAuthenticatedWsUrlAsync } from "@/lib/queryClient";

interface OnlineUser {
  userId: string;
  username: string;
  role: 'MASTER' | 'GUEST';
  deviceType: string;
  connectedAt: number;
}

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface Z3Status {
  connectedDevices: number;
  onlineUsers: OnlineUser[];
  wsPath: string;
  protocol: string;
}

export function CollaborationPanel() {
  const { role } = useZ1Store();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery<Z3Status>({
    queryKey: ["/api/z3/status"],
    refetchInterval: 30000,
  });

  const getUserId = () => {
    const stored = sessionStorage.getItem('z3_user_id');
    if (stored) return stored;
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('z3_user_id', newId);
    return newId;
  };

  const connectWebSocket = useCallback(async () => {
    const wsUrl = await getAuthenticatedWsUrlAsync('/ws/z3');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      const userId = getUserId();
      const username = role === 'MASTER' ? '系统管理员' : `分身_${userId.slice(-4)}`;
      
      ws.send(JSON.stringify({
        type: 'USER_JOIN',
        userId,
        username,
        role,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'USER_LIST_UPDATE') {
          setOnlineUsers(data.users || []);
        }
        
        if (data.type === 'USER_JOINED') {
          setMessages(prev => [...prev, {
            userId: 'system',
            username: '系统',
            message: `${data.user.username} 加入了协作`,
            timestamp: data.timestamp,
          }]);
        }
        
        if (data.type === 'USER_LEFT') {
          setMessages(prev => [...prev, {
            userId: 'system',
            username: '系统',
            message: `${data.username} 离开了协作`,
            timestamp: data.timestamp,
          }]);
        }
        
        if (data.type === 'CHAT_MESSAGE') {
          setMessages(prev => [...prev, {
            userId: data.userId,
            username: data.username,
            message: data.message,
            timestamp: data.timestamp,
          }]);
        }
        
        if (data.type === 'DATA_CHANGE') {
          setMessages(prev => [...prev, {
            userId: 'system',
            username: '系统',
            message: `数据已更新: ${data.entity} ${data.action === 'CREATE' ? '新增' : data.action === 'UPDATE' ? '修改' : '删除'}`,
            timestamp: data.timestamp,
          }]);
        }
      } catch (e) {
        console.error('[Z3] Message parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [role]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      message: inputMessage.trim(),
    }));
    
    setInputMessage("");
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-2" data-testid="card-collaboration">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>实时协作</span>
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-500" />
          )}
        </div>
        <Badge variant="outline" className="text-[10px] h-5" data-testid="badge-online-count">
          {onlineUsers.length || status?.connectedDevices || 0} 在线
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {onlineUsers.map((user, idx) => (
          <div
            key={`${user.userId}-${idx}`}
            className="flex items-center gap-1 px-2 py-0.5 bg-secondary/50 rounded-full text-[10px]"
            data-testid={`user-badge-${user.userId}`}
          >
            <Circle className={cn("w-1.5 h-1.5", user.role === 'MASTER' ? 'fill-primary text-primary' : 'fill-green-500 text-green-500')} />
            <span>{user.username}</span>
          </div>
        ))}
        {onlineUsers.length === 0 && (
          <span className="text-[10px] text-muted-foreground">等待连接...</span>
        )}
      </div>

      <Button
        variant="outline"
        onClick={() => setShowChat(!showChat)}
        data-testid="button-toggle-chat"
      >
        <MessageCircle className="w-3 h-3" />
        <span>{showChat ? '隐藏消息' : '查看消息'}</span>
        {messages.length > 0 && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
            {messages.length}
          </Badge>
        )}
        {showChat ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      {showChat && (
        <div className="space-y-1.5 pt-1">
          <ScrollArea className="h-24 border rounded p-1.5 bg-secondary/10 text-[10px]">
            {messages.length === 0 ? (
              <div className="text-muted-foreground text-center py-3">暂无消息</div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="mb-1" data-testid={`chat-message-${i}`}>
                  <span className="text-muted-foreground">[{formatTime(msg.timestamp)}]</span>
                  <span className={msg.userId === 'system' ? 'text-yellow-500 ml-1' : 'text-primary ml-1'}>
                    {msg.username}:
                  </span>
                  <span className="ml-1">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>
          
          <div className="flex gap-1.5">
            <Input
              placeholder="输入消息..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="h-7 text-[10px]"
              disabled={!isConnected}
              data-testid="input-chat-message"
            />
            <Button
              size="sm"
              className="h-7 px-2"
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
              data-testid="button-send-message"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

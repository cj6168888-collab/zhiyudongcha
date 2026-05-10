import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { getAuthenticatedWsUrlAsync } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface TeamMember {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  role: 'MASTER' | 'GUEST';
  isOnline: boolean;
}

export function CollaborationWidget() {
  const { role } = useZ1Store();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [scrollIndex, setScrollIndex] = useState(0);
  const [speakingUserId, setSpeakingUserId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: allSettings } = useQuery<any[]>({
    queryKey: ["/api/user-settings"],
    refetchInterval: 60000,
  });

  const getUserId = () => {
    const stored = sessionStorage.getItem('z3_user_id');
    if (stored) return stored;
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('z3_user_id', newId);
    return newId;
  };

  const setSpeaker = useCallback((speakerUserId: string) => {
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }
    setSpeakingUserId(speakerUserId);
    speakingTimeoutRef.current = setTimeout(() => {
      setSpeakingUserId(null);
    }, 60000);
  }, []);

  const connectWebSocket = useCallback(async () => {
    const wsUrl = await getAuthenticatedWsUrlAsync('/ws/z3');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      const currentUserId = getUserId();
      const username = role === 'MASTER' ? '创世神' : `分身_${currentUserId.slice(-4)}`;

      ws.send(JSON.stringify({
        type: 'USER_JOIN',
        userId: currentUserId,
        username,
        role,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'USER_LIST_UPDATE') {
          setOnlineCount((data.users || []).length);
        }
        if (data.type === 'CHAT_MESSAGE') {
          setMessages(prev => [...prev.slice(-50), {
            id: `${data.timestamp}_${data.userId}`,
            userId: data.userId,
            username: data.username,
            message: data.message,
            timestamp: data.timestamp,
          }]);
          setScrollIndex(0);
          setSpeaker(data.userId);
        }
        if (data.type === 'USER_JOINED' || data.type === 'USER_LEFT') {
          setMessages(prev => [...prev.slice(-50), {
            id: `${data.timestamp}_system`,
            userId: 'system',
            username: '系统',
            message: data.type === 'USER_JOINED'
              ? `${data.user?.username || '用户'} 加入`
              : `${data.username || '用户'} 离开`,
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
  }, [role, setSpeaker]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      message: inputMessage.trim(),
    }));
    setInputMessage("");
  };

  const members: TeamMember[] = allSettings && allSettings.length > 0
    ? allSettings.map((setting) => ({
        userId: setting.userId,
        displayName: `${setting.realName || '用户'}的${setting.avatarName || '小星'}`,
        avatarEmoji: setting.avatarEmoji || '🤖',
        role: setting.userId === 'master' ? 'MASTER' as const : 'GUEST' as const,
        isOnline: isConnected,
      }))
    : [{
        userId: 'master',
        displayName: '创世神的小星',
        avatarEmoji: '👑',
        role: 'MASTER' as const,
        isOnline: isConnected
      }];

  const visibleMessages = messages.slice(-(5 + scrollIndex)).slice(0, 5).reverse();

  const handleScroll = (e: React.WheelEvent) => {
    if (e.deltaY < 0 && scrollIndex < messages.length - 5) {
      setScrollIndex(prev => Math.min(prev + 1, messages.length - 5));
    } else if (e.deltaY > 0 && scrollIndex > 0) {
      setScrollIndex(prev => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="space-y-3" data-testid="card-collaboration">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          )} />
          <span className="text-[10px] text-muted-foreground">
            {isConnected ? Math.max(1, onlineCount) : 0} / {members.length} 在线
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center items-end">
        {members.map((member) => {
          const isSpeaking = speakingUserId === member.userId ||
            (speakingUserId && member.displayName.includes(speakingUserId.split('_').pop() || ''));

          return (
            <div
              key={member.userId}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300",
                isSpeaking && "scale-110"
              )}
              title={member.displayName}
              data-testid={`team-member-${member.userId}`}
            >
              <div className={cn(
                "rounded-full flex items-center justify-center transition-all duration-300",
                isConnected
                  ? "bg-gradient-to-br from-primary/30 to-amber-500/30 border-2 border-primary shadow-lg shadow-primary/20"
                  : "bg-slate-800/50 grayscale opacity-40 border border-slate-700",
                isSpeaking
                  ? "w-14 h-14 text-2xl animate-pulse ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
                  : "w-10 h-10 text-lg"
              )}
              style={isSpeaking ? { animation: 'shake 0.5s ease-in-out infinite' } : {}}
              >
                <span className={cn(
                  "transition-all duration-300",
                  isConnected ? "" : "brightness-50"
                )}>
                  {member.avatarEmoji}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className={cn(
                  "truncate max-w-[50px] text-center transition-all duration-300",
                  isConnected ? "text-foreground" : "text-muted-foreground/50",
                  isSpeaking ? "text-[10px] font-bold text-primary" : "text-[9px]"
                )}>
                  {member.displayName}
                </span>
                {isSpeaking && (
                  <span className="text-[8px] text-amber-400 animate-pulse">发言中</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(-1px) rotate(-1deg); }
          75% { transform: translateX(1px) rotate(1deg); }
        }
      `}</style>

      <div
        ref={scrollRef}
        className="min-h-[80px] bg-secondary/10 rounded-lg p-2 cursor-ns-resize"
        onWheel={handleScroll}
        data-testid="public-chat-panel"
      >
        {visibleMessages.length === 0 ? (
          <div className="text-center text-[10px] text-muted-foreground/50 py-4">
            公屏暂无消息
          </div>
        ) : (
          visibleMessages.map((msg, idx) => {
            const isFirst = idx === 0;
            const opacity = 1 - (idx * 0.2);
            const scale = isFirst ? 1 : 0.95 - (idx * 0.03);

            return (
              <div
                key={msg.id}
                className={cn(
                  "transition-all duration-300 rounded px-2",
                  isFirst ? "bg-primary/20 border border-primary/30 py-0.5 mb-0.5" : "bg-transparent py-0 leading-tight"
                )}
                style={{
                  opacity: Math.max(0.3, opacity),
                  transform: `scale(${scale})`,
                  transformOrigin: 'left center',
                }}
                data-testid={`chat-message-${idx}`}
              >
                <span className={cn(
                  "font-medium",
                  isFirst ? "text-primary text-xs" : "text-muted-foreground text-[10px]",
                  msg.userId === 'system' && "text-yellow-500"
                )}>
                  {msg.username}:
                </span>
                <span className={cn(
                  "ml-1",
                  isFirst ? "text-foreground text-xs" : "text-muted-foreground text-[10px]"
                )}>
                  {msg.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-1.5">
        <Input
          placeholder="发送公屏消息..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="h-7 text-[10px] bg-secondary/30"
          disabled={!isConnected}
          data-testid="input-public-message"
        />
        <Button variant="outline" onClick={sendMessage} disabled={!isConnected || !inputMessage.trim()} data-testid="button-send-public"><Send className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

import { useZ1Store } from "@/lib/z1/god-protocol";
import { useZ3Store, Z3_SCHEMA } from "@/lib/z3/spirit-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, 
  Lock, 
  Eye,
  EyeOff,
  MessageCircle,
  Send
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Sensitive keywords that trigger evasive responses
const SENSITIVE_KEYWORDS = ['ip', 'api', 'key', 'password', 'secret', '服务器', '密码', '密钥', '配置'];

// Cute evasive responses in anime style
const EVASIVE_RESPONSES = [
  "那是小智的秘密哦~ (◕‿◕✿)",
  "嗯...这个问题好复杂，小智还在学习中呢~",
  "主人说这个不能告诉别人哦 ♪(´ε` )",
  "诶？小智听不太懂这个问题呢~ ٩(◕‿◕｡)۶",
  "这个...让小智想想别的话题好不好？(｡•́︿•̀｡)",
];

export function GuestIsolation() {
  const { role } = useZ1Store();
  const { streamConfig } = useZ3Store();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const handleQuery = () => {
    if (!query.trim()) return;

    const lowerQuery = query.toLowerCase();
    const isSensitive = SENSITIVE_KEYWORDS.some(kw => lowerQuery.includes(kw));

    if (role === 'GUEST' && isSensitive) {
      // Evasive response for guests querying sensitive info
      setIsBlocked(true);
      setResponse(EVASIVE_RESPONSES[Math.floor(Math.random() * EVASIVE_RESPONSES.length)]);
    } else if (role === 'MASTER') {
      setIsBlocked(false);
      setResponse(`[MASTER ACCESS] 查询已处理: "${query}"`);
    } else {
      setIsBlocked(false);
      setResponse(`小智收到啦~ 正在处理: "${query}"`);
    }
    
    setQuery("");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="w-5 h-5 text-primary" />
          访客隔离流 (Guest Stream Isolation)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Current Role Display */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
          <span className="text-sm text-muted-foreground">当前权限等级</span>
          <Badge 
            variant={role === 'MASTER' ? "default" : "secondary"}
            className={cn(
              role === 'MASTER' && "bg-accent text-accent-foreground"
            )}
          >
            {role}
          </Badge>
        </div>

        {/* Hidden Streams List */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">访客不可见的数据流:</p>
          <div className="flex flex-wrap gap-2">
            {Z3_SCHEMA.hidden_streams_for_guest.map((stream) => (
              <Badge key={stream} variant="outline" className="font-mono text-xs">
                {role === 'GUEST' ? (
                  <><EyeOff className="w-3 h-3 mr-1" />{stream}</>
                ) : (
                  <><Eye className="w-3 h-3 mr-1" />{stream}</>
                )}
              </Badge>
            ))}
          </div>
        </div>

        {/* Query Simulation */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            模拟查询 (测试隔离逻辑)
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="试试问「服务器IP是什么」..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              data-testid="input-query-test"
            />
            <Button onClick={handleQuery} data-testid="button-send-query">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          {response && (
            <div className={cn(
              "p-3 rounded-lg text-sm",
              isBlocked 
                ? "bg-destructive/10 border border-destructive/30" 
                : "bg-primary/10 border border-primary/30"
            )}>
              {isBlocked && (
                <div className="flex items-center gap-1 text-destructive text-xs mb-1">
                  <Lock className="w-3 h-3" />
                  <span>SENSITIVE_QUERY_BLOCKED</span>
                </div>
              )}
              <p>{response}</p>
            </div>
          )}
        </div>

        {/* Access Control Summary */}
        {role === 'GUEST' && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
            <p className="text-yellow-600 dark:text-yellow-400">
              访客模式下，所有涉及 ROOT_CONFIG、BIO_METRICS 的查询将被优雅拦截，系统将以二次元语境回避敏感问题。
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

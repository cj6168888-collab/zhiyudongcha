import { useZ1Store } from "@/lib/z1/god-protocol";
import { useZ3Store } from "@/lib/z3/spirit-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
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

const SENSITIVE_KEYWORDS = ['ip', 'api', 'key', 'password', 'secret', '服务器', '密码', '密钥', '配置'];

const HIDDEN_STREAM_KEYS = [
  { key: 'ROOT_CONFIG', labelKey: 'hidden.root_config' },
  { key: 'BIO_METRICS', labelKey: 'hidden.bio_metrics' },
  { key: 'VAULT_SECRETS', labelKey: 'hidden.vault_secrets' },
  { key: 'HP_BALANCE', labelKey: 'hidden.hp_balance' },
];

export function GuestIsolation() {
  const { t } = useTranslation();
  const { role } = useZ1Store();
  const { streamConfig } = useZ3Store();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const getEvasiveResponse = () => {
    const responses = [
      t('guest.evasive_1'),
      t('guest.evasive_2'),
      t('guest.evasive_3'),
      t('guest.evasive_4'),
      t('guest.evasive_5'),
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleQuery = () => {
    if (!query.trim()) return;

    const lowerQuery = query.toLowerCase();
    const isSensitive = SENSITIVE_KEYWORDS.some(kw => lowerQuery.includes(kw));

    if (role === 'GUEST' && isSensitive) {
      setIsBlocked(true);
      setResponse(getEvasiveResponse());
    } else if (role === 'MASTER') {
      setIsBlocked(false);
      setResponse(`${t('guest.master_access')}: "${query}"`);
    } else {
      setIsBlocked(false);
      setResponse(`${t('guest.processing')}: "${query}"`);
    }
    
    setQuery("");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="w-5 h-5 text-primary" />
          {t('guest.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
          <span className="text-sm text-muted-foreground">{t('guest.permission_level')}</span>
          <Badge 
            variant={role === 'MASTER' ? "default" : "secondary"}
            className={cn(
              role === 'MASTER' && "bg-accent text-accent-foreground"
            )}
          >
            {role}
          </Badge>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t('guest.hidden_streams')}</p>
          <div className="flex flex-wrap gap-2">
            {HIDDEN_STREAM_KEYS.map((stream) => (
              <Badge key={stream.key} variant="outline" className="font-mono text-xs">
                {role === 'GUEST' ? (
                  <><EyeOff className="w-3 h-3 mr-1" />{t(stream.labelKey)}</>
                ) : (
                  <><Eye className="w-3 h-3 mr-1" />{t(stream.labelKey)}</>
                )}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            {t('guest.query_sim')}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder={t('guest.query_placeholder')}
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
                  <span>{t('guest.blocked')}</span>
                </div>
              )}
              <p>{response}</p>
            </div>
          )}
        </div>

        {role === 'GUEST' && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
            <p className="text-yellow-600 dark:text-yellow-400">
              {t('guest.notice')}
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

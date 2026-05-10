import { Button } from '@/components/ui/button';
import { MessageSquare, FileText, Brain, Shield, Zap, Calendar } from 'lucide-react';
import { useLocation } from 'wouter';

const QUICK_ACTIONS = [
  { id: 'chat', icon: MessageSquare, label: '对话', path: '/chat' },
  { id: 'intel', icon: FileText, label: '情报', path: '/z2' },
  { id: 'experts', icon: Brain, label: '专家', path: '/z4' },
  { id: 'security', icon: Shield, label: '安全', path: '/z1' },
  { id: 'compute', icon: Zap, label: '算力', path: '/z1' },
  { id: 'schedule', icon: Calendar, label: '日程', path: '/' },
];

export function QuickActionsWidget() {
  const [, setLocation] = useLocation();

  return (
    <div className="grid grid-cols-3 gap-2 h-full p-2">
      {QUICK_ACTIONS.map(action => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          className="flex flex-col items-center justify-center h-full min-h-[48px] gap-1 bg-background/50 hover:bg-primary/20 border-primary/30"
          onClick={() => setLocation(action.path)}
          data-testid={`quick-action-${action.id}`}
        >
          <action.icon className="h-4 w-4 text-primary" />
          <span className="text-xs">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}

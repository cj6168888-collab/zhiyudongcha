import { HpCompactWidget } from './widgets/hp-compact-widget';
import { ModulesWidget } from './widgets/modules-widget';
import { CollaborationWidget } from './widgets/collaboration-widget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Grid3x3 } from 'lucide-react';
import { MobileCard, MobileGrid } from '@/components/ui/mobile-layout';
import { useIsMobile } from '@/hooks/use-device-info';

function WidgetCard({ 
  title, 
  icon: Icon, 
  children,
  className = ''
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`bg-card/50 border-primary/20 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

function MobileWidgetCard({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>; 
  children: React.ReactNode;
}) {
  return (
    <MobileCard>
      <div className="text-sm font-medium flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </MobileCard>
  );
}

export function StaticDashboard() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        <HpCompactWidget />
        
        <MobileWidgetCard title="协作面板" icon={Users}>
          <CollaborationWidget />
        </MobileWidgetCard>

        <MobileWidgetCard title="核心模块" icon={Grid3x3}>
          <ModulesWidget />
        </MobileWidgetCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <HpCompactWidget />
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
        <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-3 sm:gap-4 order-2 md:order-1">
          <WidgetCard title="协作面板" icon={Users}>
            <CollaborationWidget />
          </WidgetCard>
        </div>

        <div className="md:col-span-9 lg:col-span-10 flex flex-col gap-3 sm:gap-4 order-1 md:order-2">
          <WidgetCard title="核心模块" icon={Grid3x3} className="flex-1">
            <ModulesWidget />
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}

import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  MessageCircle, 
  Users, 
  Briefcase, 
  Menu,
  Mail,
  Lightbulb,
  Settings,
  Server,
  Crown,
  Vault,
  Glasses,
  Rocket
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";
import { useZ1Store } from "@/lib/z1/god-protocol";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: "首页", path: "/" },
  { icon: MessageCircle, label: "对话", path: "/chat" },
  { icon: Users, label: "人脉", path: "/network" },
  { icon: Briefcase, label: "项目", path: "/projects" },
];

const moreNavItemsBase: NavItem[] = [
  { icon: Rocket, label: "进化", path: "/evolution" },
  { icon: Glasses, label: "眼镜", path: "/glasses" },
  { icon: Mail, label: "邮件", path: "/email" },
  { icon: Lightbulb, label: "灵感", path: "/inspiration" },
  { icon: Server, label: "灵核", path: "/spirit" },
];

const getCreatorNavItem = (isMaster: boolean): NavItem => ({
  icon: isMaster ? Crown : Vault,
  label: isMaster ? "创世神" : "私人保险库",
  path: "/creator",
});

export function MobileNav() {
  const [location, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { role } = useZ1Store();
  
  const moreNavItems = [...moreNavItemsBase, getCreatorNavItem(role === 'MASTER')];

  const handleNavigate = (path: string) => {
    setLocation(path);
    setSheetOpen(false);
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border"
      style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      data-testid="mobile-nav"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[44px] gap-1 transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${item.path.replace('/', '') || 'home'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
        
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[44px] gap-1 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="nav-more"
            >
              <Menu className="w-5 h-5" />
              <span className="text-xs font-medium">更多</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <div className="py-4">
              <h3 className="text-lg font-semibold mb-4 px-4">更多功能</h3>
              <div className="grid grid-cols-4 gap-4 px-4">
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className="flex flex-col items-center justify-center p-3 min-h-[72px] rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      data-testid={`nav-more-${item.path.replace('/', '')}`}
                    >
                      <Icon className="w-6 h-6 mb-2 text-primary" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-6 px-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">其他</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "情报中心", path: "/intel" },
                    { label: "费用管理", path: "/expense" },
                    { label: "远程控制", path: "/remote" },
                    { label: "每日报告", path: "/reports" },
                    { label: "策略大脑", path: "/brain" },
                    { label: "资源保险库", path: "/vault" },
                    { label: "设置", path: "/settings" },
                  ].map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className="px-4 py-2 rounded-full bg-muted/50 hover:bg-muted border border-border/50 hover:border-primary/30 text-sm transition-colors"
                      data-testid={`nav-more-${item.path.replace('/', '')}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

export function MobilePageContainer({ 
  children, 
  className,
  noPadding = false 
}: { 
  children: React.ReactNode; 
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div 
      className={cn(
        "min-h-screen w-full",
        !noPadding && "px-4 py-4 md:px-6 md:py-6",
        "md:pb-6",
        className
      )}
      style={{ paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-screen-xl mx-auto w-full">
        {children}
      </div>
    </div>
  );
}

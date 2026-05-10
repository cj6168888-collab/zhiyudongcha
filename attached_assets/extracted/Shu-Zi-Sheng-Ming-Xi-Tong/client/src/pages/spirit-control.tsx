import { useZ1Store } from "@/lib/z1/god-protocol";
import { SpiritPresence } from "@/components/z3/spirit-presence";
import { StreamControl } from "@/components/z3/stream-control";
import { GuestIsolation } from "@/components/z3/guest-isolation";
import { Button } from "@/components/ui/button";
import { Ghost, ArrowLeft, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SpiritControl() {
  const { role } = useZ1Store();
  const [, setLocation] = useLocation();

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Lock className="w-6 h-6" />
              ZONE_RED: 访问被拒绝
            </CardTitle>
            <CardDescription>
              灵魂仲裁控制台仅限 MASTER 权限访问。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回控制台
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-light flex items-center gap-3">
              <Ghost className="w-8 h-8 text-primary" />
              Z3: 灵魂仲裁 (Spirit Core)
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              跨端穿行 · 多模态流 · 访客隔离
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <SpiritPresence />
          <GuestIsolation />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          <StreamControl />
        </div>
      </div>
    </div>
  );
}

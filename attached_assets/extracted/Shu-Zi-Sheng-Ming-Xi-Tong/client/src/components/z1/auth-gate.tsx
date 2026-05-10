import { useState } from "react";
import { useZ1Store, Role } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, Key, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AuthGate() {
  const { role, switchRole, initialize, rootDna } = useZ1Store();
  const [apiKeyInput, setApiKeyInput] = useState("");

  const handleMasterLogin = () => {
    // Simulation of Z1 validation
    if (apiKeyInput.length > 5) {
        initialize({
            apiKey: apiKeyInput,
            ip: "192.168.1.X",
            port: 8080,
            initialHp: 1000,
            masterSecret: "remaster" // 补充必需字段
        });
        toast({
            title: "Z1 PROTOCOL: ACCESS GRANTED",
            description: "Master DNA Verified. Root privileges unlocked.",
            variant: "default",
            className: "border-primary text-primary"
        });
    } else {
        toast({
            title: "ACCESS DENIED",
            description: "Invalid DNA Signature.",
            variant: "destructive"
        });
    }
  };

  const handleGuestSwitch = () => {
    switchRole("GUEST");
    toast({
        title: "MODE SWITCHED",
        description: "Downgraded to Guest permissions.",
    });
  };

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {role === 'MASTER' ? <ShieldCheck className="text-primary" /> : <ShieldAlert className="text-muted-foreground" />}
          System Access Control
        </CardTitle>
        <CardDescription>
            Current Protocol Level: <span className={role === 'MASTER' ? "text-primary font-bold" : "text-muted-foreground"}>{role}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {role === 'GUEST' ? (
            <div className="space-y-3">
                <div className="space-y-1">
                    <Label>Master API Key</Label>
                    <div className="flex gap-2">
                    <Input 
                        type="password" 
                        placeholder="Enter Z1 Root Key..." 
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="font-mono"
                        aria-label="Master API Key"
                    />
                        <Button onClick={handleMasterLogin} variant="default">
                            <Key className="w-4 h-4 mr-2" />
                            Verify
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    * Guest Mode restricts access to critical Z6 infrastructure and relationship databases.
                </p>
            </div>
        ) : (
            <div className="space-y-3">
                 <div className="p-3 bg-primary/10 border border-primary/20 rounded text-sm text-primary font-mono break-all">
                    ROOT_DNA: {rootDna || "ACTIVE"}
                 </div>
                 <Button onClick={handleGuestSwitch} variant="outline" className="w-full">
                    <User className="w-4 h-4 mr-2" />
                    Switch to Guest View
                 </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

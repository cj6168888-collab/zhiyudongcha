import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personApi, z2CoreApi, type RelationshipInsight } from "@/lib/api";
import { useZ1Store } from "@/lib/z1/god-protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Network, Plus, Search, AlertTriangle, TrendingUp, Link as LinkIcon, Trash2, Eye, ArrowLeft, Shield } from "lucide-react";
import { useState } from "react";
import type { InsertPerson, Person } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function RelationshipNetwork() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useZ1Store();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [insightDialog, setInsightDialog] = useState<{ open: boolean; data: RelationshipInsight | null }>({ open: false, data: null });

  // Fetch all persons
  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["persons"],
    queryFn: personApi.getAll,
  });

  // Search by weakness
  const { data: searchResults } = useQuery({
    queryKey: ["persons", "weakness", searchKeyword],
    queryFn: () => personApi.searchByWeakness(searchKeyword),
    enabled: searchKeyword.length > 2,
  });

  // Create person mutation
  const createMutation = useMutation({
    mutationFn: personApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      setIsAddDialogOpen(false);
      toast({
        title: "TARGET LOGGED",
        description: "New person added to relationship matrix.",
        className: "border-primary text-primary"
      });
    },
    onError: () => {
      toast({
        title: "OPERATION FAILED",
        description: "Failed to add person.",
        variant: "destructive"
      });
    }
  });

  // Shred mutation
  const shredMutation = useMutation({
    mutationFn: (targetId: string) => z2CoreApi.permanentShred(targetId, 'person'),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["persons"] });
      toast({
        title: "SHRED COMPLETE",
        description: result.message,
        className: "border-destructive text-destructive"
      });
    },
    onError: () => {
      toast({
        title: "SHRED FAILED",
        description: "Failed to destroy target.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newPerson: InsertPerson = {
      name: formData.get("name") as string,
      role: formData.get("role") as string || null,
      organization: formData.get("organization") as string || null,
      weakness: formData.get("weakness") as string || null,
      decisionStyle: formData.get("decisionStyle") as string || null,
      tags: (formData.get("tags") as string)?.split(",").map(t => t.trim()).filter(Boolean) || [],
      interestChain: null,
      decisionDna: null,
      lastInteraction: null,
      connectionNodes: [],
      bondStrength: 0.5,
      conflictPoints: [],
      accessLevel: formData.get("accessLevel") as string || "ZONE_BLUE",
    };

    createMutation.mutate(newPerson);
  };

  const handleInsight = async (name: string) => {
    try {
      const insight = await z2CoreApi.getRelationshipInsight(name);
      setInsightDialog({ open: true, data: insight });
    } catch {
      toast({
        title: "INSIGHT FAILED",
        description: "Cannot generate relationship insight for this target.",
        variant: "destructive"
      });
    }
  };

  const displayPersons = searchKeyword.length > 2 ? searchResults : persons;

  if (role !== 'MASTER') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              ZONE_RED: Access Denied
            </CardTitle>
            <CardDescription>
              Relationship Intelligence is restricted to MASTER protocol level.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-light flex items-center gap-3">
                <Network className="w-8 h-8 text-primary" />
                Z2: Relationship Matrix
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                博弈画像与利益链分析 · Intelligence Network
              </p>
            </div>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-person">
                <Plus className="w-4 h-4 mr-2" />
                Add Target
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Target to Matrix</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required data-testid="input-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" name="role" placeholder="CEO, Director..." data-testid="input-role" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <Input id="organization" name="organization" data-testid="input-organization" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weakness">Weakness (弱点)</Label>
                  <Textarea id="weakness" name="weakness" placeholder="Identify vulnerabilities..." data-testid="input-weakness" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="decisionStyle">Decision Style</Label>
                    <Select name="decisionStyle" defaultValue="CONSERVATIVE">
                      <SelectTrigger data-testid="select-decision-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AGGRESSIVE">AGGRESSIVE</SelectItem>
                        <SelectItem value="CONSERVATIVE">CONSERVATIVE</SelectItem>
                        <SelectItem value="SWING">SWING</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessLevel">Access Level</Label>
                    <Select name="accessLevel" defaultValue="ZONE_BLUE">
                      <SelectTrigger data-testid="select-access-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ZONE_RED">ZONE_RED (Owner Only)</SelectItem>
                        <SelectItem value="ZONE_BLUE">ZONE_BLUE (Team)</SelectItem>
                        <SelectItem value="ZONE_GREEN">ZONE_GREEN (Guest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input id="tags" name="tags" placeholder="investor, competitor, ally" data-testid="input-tags" />
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-person">
                  LOG TARGET
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Search Bar */}
      <div className="mb-6 max-w-md">
        <Label htmlFor="search" className="mb-2 block text-sm">Search by Weakness</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search vulnerabilities..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-10"
            data-testid="input-search-weakness"
          />
        </div>
      </div>

      {/* Person Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading intelligence...</div>
      ) : displayPersons && displayPersons.length === 0 ? (
        <div className="text-center py-12">
          <Network className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No targets in database. Add your first intelligence node.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayPersons?.map((person) => (
            <Card key={person.id} className="hover:border-primary/50 transition-all group" data-testid={`card-person-${person.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span data-testid={`text-person-name-${person.id}`}>{person.name}</span>
                  <div className="flex items-center gap-1">
                    {person.accessLevel && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          person.accessLevel === 'ZONE_RED' ? 'border-destructive text-destructive' :
                          person.accessLevel === 'ZONE_BLUE' ? 'border-primary text-primary' :
                          'border-green-500 text-green-500'
                        }`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {person.accessLevel.replace('ZONE_', '')}
                      </Badge>
                    )}
                    {person.bondStrength && person.bondStrength > 0.7 && (
                      <Badge variant="outline" className="text-xs">
                        <LinkIcon className="w-3 h-3 mr-1" />
                        Strong
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                <CardDescription className="space-y-1">
                  {person.role && <div className="text-xs">Role: {person.role}</div>}
                  {person.organization && <div className="text-xs">Org: {person.organization}</div>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {person.weakness && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                    <div className="flex items-center gap-1 text-destructive font-medium mb-1">
                      <AlertTriangle className="w-3 h-3" />
                      WEAKNESS
                    </div>
                    <p className="text-muted-foreground" data-testid={`text-weakness-${person.id}`}>{person.weakness}</p>
                  </div>
                )}
                
                {person.decisionStyle && (
                  <div className="flex items-center gap-2 text-xs">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">Style:</span>
                    <Badge variant="secondary" className="text-xs">{person.decisionStyle}</Badge>
                  </div>
                )}

                {person.tags && person.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {person.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleInsight(person.name)}
                    data-testid={`button-insight-${person.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Insight
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => shredMutation.mutate(person.id)}
                    data-testid={`button-shred-${person.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Insight Dialog */}
      <Dialog open={insightDialog.open} onOpenChange={(open) => setInsightDialog({ ...insightDialog, open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              博弈素材分析 (Relationship Insight)
            </DialogTitle>
          </DialogHeader>
          {insightDialog.data && (
            <div className="space-y-4">
              <div className="p-3 bg-card border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Target</div>
                <div className="font-medium text-lg">{insightDialog.data.person.name}</div>
                {insightDialog.data.person.organization && (
                  <div className="text-sm text-muted-foreground">{insightDialog.data.person.organization}</div>
                )}
              </div>
              
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="text-sm text-destructive font-medium mb-1">Vulnerability Analysis</div>
                <p className="text-sm">{insightDialog.data.vulnerabilityAnalysis}</p>
              </div>

              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-sm text-primary font-medium mb-1">Interest Chain Summary</div>
                <p className="text-sm">{insightDialog.data.interestChainSummary}</p>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-muted-foreground">Risk Level: </span>
                  <Badge variant={
                    insightDialog.data.riskLevel === 'HIGH' ? 'destructive' :
                    insightDialog.data.riskLevel === 'MEDIUM' ? 'secondary' : 'outline'
                  }>
                    {insightDialog.data.riskLevel}
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                <div className="text-sm text-accent font-medium mb-1">Suggested Approach</div>
                <p className="text-sm">{insightDialog.data.suggestedApproach}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

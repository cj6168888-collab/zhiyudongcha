export interface Inspiration {
  id: string;
  userId: string;
  type: 'idea' | 'opportunity' | 'trend' | 'warning';
  title: string;
  content: string;
  source?: string;
  sourceType?: string;
  tags?: string[];
  status: 'draft' | 'active' | 'archived' | 'confirmed';
  relevanceScore?: number;
  aiSummary?: string;
  aiRefinedPlan?: string;
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  role?: string | null;
  organization?: string | null;
  tags?: string[] | null;
  weakness?: string | null;
  interestChain?: Record<string, unknown> | null;
  decisionStyle?: string | null;
  decisionDna?: string | null;
  lastInteraction?: string | null;
  connectionNodes?: string[] | null;
  bondStrength?: number | null;
  conflictPoints?: string[] | null;
  accessLevel?: string | null;
  approvalStatus?: string | null;
  addedBy?: string | null;
  createdAt?: string | null;
}

export type InsertPerson = Omit<Person, 'id' | 'createdAt'>;

export interface Project {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt?: string;
}

export interface VaultItem {
  id: string;
  category: string;
  fileName: string;
  filePath?: string;
  fileHash?: string;
  description?: string;
  tags?: string[];
  accessLevel?: string;
  quality?: number;
  createdAt?: string;
}

export type InsertVaultItem = Omit<VaultItem, 'id' | 'createdAt'>;

export interface ShadowMemory {
  id: string;
  userId: string;
  content: string;
  category?: string;
  importance?: number;
  createdAt?: string;
}

export type InsertShadowMemory = Omit<ShadowMemory, 'id' | 'createdAt'>;

export interface TalkSession {
  id: string;
  userId: string;
  title?: string;
  type: 'CASUAL' | 'MEETING' | 'NEGOTIATION' | 'CONFERENCE' | 'CONSULTATION';
  status: 'active' | 'completed' | 'archived';
  summary?: string;
  entities?: ExtractedEntity[];
  opportunities?: OpportunitySignal[];
  duration?: number;
  talkType?: string;
  talkTypeConfidence?: number;
  keyPoints?: string[];
  actionItems?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedEntity {
  id: string;
  sessionId: string;
  name: string;
  role?: string;
  organization?: string;
  importance: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyPoints?: string[];
  entityType?: string;
  entityValue?: string;
  confidence?: number;
  context?: string;
  linkedPersonId?: string;
  createdAt: string;
}

export interface OpportunitySignal {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  type: 'potential' | 'emerging' | 'confirmed';
  priority: 'low' | 'medium' | 'high';
  confidenceScore?: number;
  actionItems?: string[];
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | number;
  estimatedValue?: number;
  probability?: number;
  suggestedActions?: string[];
  createdAt: string;
}

export interface InsightsProcessing {
  id: string;
  userId: string;
  sourceType: string;
  sourceId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage?: string;
  etaSeconds?: number;
  percentComplete?: number;
  result?: {
    summary: string;
    keyInsights: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    topics?: string[];
  };
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface UserSettings {
  id: string;
  userId: string;
  voiceEnabled: boolean;
  autoAnalyze: boolean;
  wakeWordSensitivity: number;
  systemPrompt?: string;
  voiceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

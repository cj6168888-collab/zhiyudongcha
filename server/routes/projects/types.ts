export interface ProjectInsight {
  type: 'warning' | 'opportunity' | 'info' | 'action';
  title: string;
  content: string;
  projectId?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ProjectData {
  id?: string;
  title?: string;
  name?: string;
  status?: string | null;
  priority?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  spent?: number | null;
  progress?: number | null;
  riskScore?: number | null;
  category?: string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  swotAnalysis?: Record<string, unknown>;
  missingConditions?: string[];
  currentConditions?: string[];
  description?: string;
}

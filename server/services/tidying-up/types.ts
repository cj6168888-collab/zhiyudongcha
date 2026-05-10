export interface FileMetadata {
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  deviceId: string;
  fileHash?: string;
}

export interface ScanResult {
  files: FileMetadata[];
  totalSize: number;
  totalCount: number;
  scanTime: Date;
  deviceId: string;
  scanPath: string;
}

export interface SemanticAnalysis {
  projectName?: string;
  category: FileCategory;
  suggestedName?: string;
  confidence: number;
  keywords: string[];
  relatedFiles?: string[];
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  archiveSuggestion?: ArchiveSuggestion;
}

export type FileCategory =
  | 'CONTRACT'
  | 'REPORT'
  | 'INVOICE'
  | 'PRESENTATION'
  | 'CODE'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'SPREADSHEET'
  | 'ARCHIVE'
  | 'TEMP'
  | 'UNKNOWN';

export interface ArchiveSuggestion {
  action: 'ARCHIVE' | 'DELETE' | 'KEEP' | 'MOVE';
  targetPath?: string;
  reason: string;
  daysSinceAccess: number;
}

export interface RenameRule {
  pattern: RegExp;
  replacement: string;
  category?: FileCategory;
  priority: number;
}

export interface RenameSuggestion {
  originalName: string;
  suggestedName: string;
  reason: string;
  confidence: number;
  ruleName: string;
}

export interface TidyingTask {
  id: string;
  deviceId: string;
  taskType: 'SCAN' | 'RENAME' | 'MOVE' | 'ARCHIVE' | 'DELETE' | 'DEDUPE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  files: TidyingFileAction[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface TidyingFileAction {
  filePath: string;
  action: 'RENAME' | 'MOVE' | 'DELETE' | 'ARCHIVE';
  newPath?: string;
  newName?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  error?: string;
}

export interface DuplicateGroup {
  hash: string;
  files: FileMetadata[];
  totalSize: number;
  recommendedKeep: string;
  duplicateCount: number;
}

export interface HotColdAnalysis {
  hotFiles: FileMetadata[];
  coldFiles: FileMetadata[];
  threshold: number;
  coldThresholdDays: number;
  recommendations: ArchiveSuggestion[];
}

export interface DesktopAnalysis {
  iconCount: number;
  chaosScore: number;
  suggestions: string[];
  categories: Record<FileCategory, number>;
  duplicates: number;
  tempFiles: number;
}

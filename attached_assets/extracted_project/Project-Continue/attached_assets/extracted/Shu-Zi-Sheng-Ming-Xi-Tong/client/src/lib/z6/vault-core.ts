import { apiRequest } from '../queryClient';

export type DownloadCategory = 'RESEARCH' | 'SOFTWARE' | 'MEDIA' | 'BOOKS';
export type DownloadStatus = 'PENDING' | 'DOWNLOADING' | 'INDEXING' | 'COMPLETE' | 'FAILED';
export type ComputeJobType = 'PDF_EDIT' | 'VIDEO_TRANSCODE' | 'REPORT_ANALYSIS' | 'DREAM_SIMULATION';
export type ComputeJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
export type DreamType = 'BUSINESS_SIMULATION' | 'SELF_EVOLUTION' | 'MEMORY_CONSOLIDATION';

export interface DownloadTask {
  id: string;
  url: string;
  category: DownloadCategory;
  status: DownloadStatus;
  progress: number;
  fileSize?: number;
  fileName?: string;
  sandboxResult?: 'SAFE' | 'QUARANTINE' | 'PENDING';
  errorMessage?: string;
  vaultItemId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ComputeJob {
  id: string;
  jobType: ComputeJobType;
  status: ComputeJobStatus;
  priority: number;
  inputPayload?: Record<string, unknown>;
  outputResult?: Record<string, unknown>;
  progress: number;
  processingTimeMs?: number;
  sourceDevice: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DreamLog {
  id: string;
  dreamType: DreamType;
  simulationCount: number;
  decisionsOptimized: number;
  patchesGenerated: string[];
  insightsDiscovered?: Record<string, unknown>;
  durationMs?: number;
  status: 'SLEEPING' | 'DREAMING' | 'AWAKENED';
  createdAt: string;
}

export interface VaultStats {
  totalDownloads: number;
  activeDownloads: number;
  totalComputeJobs: number;
  activeComputeJobs: number;
  totalDreams: number;
  storageUsed: number;
  categories: {
    RESEARCH: number;
    SOFTWARE: number;
    MEDIA: number;
    BOOKS: number;
  };
}

class VaultCore {
  async addDownloadTask(url: string, category: DownloadCategory): Promise<DownloadTask> {
    const response = await apiRequest('POST', '/api/z6/downloads', { url, category });
    return response.json();
  }

  async getDownloadTasks(): Promise<DownloadTask[]> {
    const response = await apiRequest('GET', '/api/z6/downloads');
    return response.json();
  }

  async cancelDownload(taskId: string): Promise<void> {
    await apiRequest('DELETE', `/api/z6/downloads/${taskId}`);
  }

  async submitComputeJob(
    jobType: ComputeJobType,
    inputPayload: Record<string, unknown>,
    priority: number = 5
  ): Promise<ComputeJob> {
    const response = await apiRequest('POST', '/api/z6/compute', {
      jobType,
      inputPayload,
      priority,
    });
    return response.json();
  }

  async getComputeJobs(): Promise<ComputeJob[]> {
    const response = await apiRequest('GET', '/api/z6/compute');
    return response.json();
  }

  async initiateDream(dreamType: DreamType): Promise<DreamLog> {
    const response = await apiRequest('POST', '/api/z6/dream', { dreamType });
    return response.json();
  }

  async getDreamLogs(): Promise<DreamLog[]> {
    const response = await apiRequest('GET', '/api/z6/dream');
    return response.json();
  }

  async getVaultStats(): Promise<VaultStats> {
    const response = await apiRequest('GET', '/api/z6/stats');
    return response.json();
  }

  async physicalShred(itemId: string, table: 'vault' | 'person'): Promise<{ success: boolean; message: string }> {
    const response = await apiRequest('POST', '/api/z2/shred', { targetId: itemId, table });
    return response.json();
  }

  async searchByIntent(intent: string): Promise<unknown[]> {
    const response = await apiRequest('GET', `/api/z2/vault/intent?q=${encodeURIComponent(intent)}`);
    return response.json();
  }

  simulateGutmannShred(iterations: number = 35): string[] {
    const patterns = [
      '0x00', '0xFF', '0x55', '0xAA', '0x92', '0x49', '0x24',
      '0x6D', '0xB6', '0xDB', '0x00', '0x11', '0x22', '0x33',
      '0x44', '0x55', '0x66', '0x77', '0x88', '0x99', '0xAA',
      '0xBB', '0xCC', '0xDD', '0xEE', '0xFF', 'RANDOM_1',
      'RANDOM_2', 'RANDOM_3', 'RANDOM_4', '0x00', '0xFF',
      '0x55', '0xAA', '0x00'
    ];
    return patterns.slice(0, iterations);
  }
}

export const vaultCore = new VaultCore();

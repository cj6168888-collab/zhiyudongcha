import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';
import { Book, Film, Settings, FileText, Download, HardDrive, Cloud } from 'lucide-react';

interface DownloadItem {
  id: string;
  name: string;
  type: 'book' | 'video' | 'software' | 'document';
  progress: number;
  size?: string;
  status: 'downloading' | 'completed' | 'paused' | 'error';
}

interface VaultStatusBarProps {
  downloads?: DownloadItem[];
  storageUsed?: number;
  storageTotal?: number;
  className?: string;
}

const typeIcons = {
  book: Book,
  video: Film,
  software: Settings,
  document: FileText,
};

const typeColors = {
  book: 'text-amber-400',
  video: 'text-purple-400',
  software: 'text-cyan-400',
  document: 'text-green-400',
};

export function VaultStatusBar({ downloads = [], storageUsed = 0, storageTotal = 10737418240, className = '' }: VaultStatusBarProps) {
  const activeDownloads = (downloads || []).filter(d => d.status === 'downloading');
  const storagePercent = storageTotal > 0 ? (storageUsed / storageTotal) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={`hidden md:block fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border z-40 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">资源堡垒</span>
            </div>
            
            {activeDownloads.length > 0 && (
              <div className="flex items-center gap-3">
                {activeDownloads.slice(0, 3).map(item => (
                  <DownloadIndicator key={item.id} item={item} />
                ))}
                {activeDownloads.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{activeDownloads.length - 3} 项
                  </span>
                )}
              </div>
            )}
            
            {activeDownloads.length === 0 && (
              <span className="text-xs text-muted-foreground">暂无下载任务</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-muted-foreground" />
              <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${storagePercent > 80 ? 'bg-red-500' : storagePercent > 60 ? 'bg-yellow-500' : 'bg-primary'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${storagePercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {formatBytes(storageUsed)} / {formatBytes(storageTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DownloadIndicator({ item }: { item: DownloadItem }) {
  const Icon = typeIcons[item.type];
  const colorClass = typeColors[item.type];
  
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
      <Icon className={`w-3 h-3 ${colorClass}`} />
      <div className="flex flex-col">
        <span className="text-xs text-foreground truncate max-w-[120px]">{item.name}</span>
        <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${item.progress}%` }}
          />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">{item.progress}%</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function MiniVaultIcon({ downloads, onClick }: { downloads: DownloadItem[]; onClick?: () => void }) {
  const activeCount = downloads.filter(d => d.status === 'downloading').length;
  
  return (
    <Button variant="outline" onClick={onClick}><Download className="w-5 h-5 text-primary" />
      {activeCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-primary-foreground font-bold"
        >
          {activeCount}
        </motion.div>
      )}</Button>
  );
}

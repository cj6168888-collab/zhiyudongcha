import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileLayout, MobileCard, MobileButton } from '@/components/ui/mobile-layout';
import { useIsMobile } from '@/hooks/use-device-info';
import { recordingHistoryService, type RecordingEntry } from '@/lib/recording-history';
import { Trash2, Play, Mic, Clock, BarChart3, Search, Plus, ArrowLeft, X, AudioLines, Pause } from 'lucide-react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function RecordingHistory() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<RecordingEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = () => {
    const data = searchQuery 
      ? recordingHistoryService.search(searchQuery)
      : recordingHistoryService.getAll();
    setRecordings(data);
  };

  const handlePlay = (recording: RecordingEntry) => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else if (recording.audioData) {
      const audio = new Audio(recording.audioData);
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    } else {
      toast({ title: '无法播放', description: '该录音暂无音频数据', variant: 'destructive' });
    }
  };

  const handleDelete = (id: string) => {
    recordingHistoryService.delete(id);
    loadRecordings();
    if (selectedRecording?.id === id) {
      setSelectedRecording(null);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const AnalysisDetail = ({ analysis }: { analysis: RecordingEntry['analysis'] }) => {
    if (!analysis) return null;
    
    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">能量:</span>
          <span className="ml-2">{analysis.energy.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">峰值:</span>
          <span className="ml-2">{analysis.peak.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">RMS:</span>
          <span className="ml-2">{analysis.rms.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">过零率:</span>
          <span className="ml-2">{analysis.zeroCrossingRate.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">主频率:</span>
          <span className="ml-2">{analysis.dominantFrequency.toFixed(0)} Hz</span>
        </div>
        <div>
          <span className="text-muted-foreground">频谱中心:</span>
          <span className="ml-2">{analysis.spectralCentroid.toFixed(0)} Hz</span>
        </div>
      </div>
    );
  };

  if (isMobile) {
    if (selectedRecording) {
      return (
        <MobileLayout 
          showHeader 
          headerTitle="录音详情"
          onBack={() => setSelectedRecording(null)}
        >
          <div className="flex flex-col gap-4">
            <MobileCard>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {formatDate(selectedRecording.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Mic className="w-5 h-5 text-primary" />
                <span className="text-lg font-medium">
                  {formatDuration(selectedRecording.duration)}
                </span>
              </div>
              
              {selectedRecording.notes && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">备注</p>
                  <p>{selectedRecording.notes}</p>
                </div>
              )}
              
              {selectedRecording.tags && selectedRecording.tags.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">标签</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRecording.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-secondary rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedRecording.analysis && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">分析结果</p>
                  <AnalysisDetail analysis={selectedRecording.analysis} />
                </div>
              )}
            </MobileCard>
            
            <div className="flex gap-2">
              {selectedRecording.audioData && (
                <MobileButton 
                  variant="primary"
                  className="flex-1"
                  onClick={() => handlePlay(selectedRecording)}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      暂停播放
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      播放录音
                    </>
                  )}
                </MobileButton>
              )}
              <MobileButton 
                variant="outline"
                onClick={() => handleDelete(selectedRecording.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </MobileButton>
            </div>
          </div>
        </MobileLayout>
      );
    }

    return (
      <MobileLayout showHeader headerTitle="录音历史" onBack={() => setLocation('/')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜索录音..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  const results = e.target.value
                    ? recordingHistoryService.search(e.target.value)
                    : recordingHistoryService.getAll();
                  setRecordings(results);
                }}
                className="pl-9"
              />
            </div>
            <MobileButton 
              size="icon"
              variant="primary"
              onClick={() => {
                // Navigate to recording page or start recording
                setLocation('/insight');
              }}
              className="h-11 w-11"
            >
              <Mic className="w-5 h-5" />
            </MobileButton>
          </div>

          {recordings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AudioLines className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无录音记录</p>
              <p className="text-sm mt-1">点击麦克风开始录音</p>
              <MobileButton 
                variant="primary"
                className="mt-4"
                onClick={() => setLocation('/insight')}
              >
                <Mic className="w-4 h-4 mr-2" />
                开始录音
              </MobileButton>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recordings.map(recording => (
                <MobileCard 
                  key={recording.id} 
                  onClick={() => setSelectedRecording(recording)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{formatDuration(recording.duration)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(recording.timestamp)}
                        </p>
                      </div>
                    </div>
                    {recording.analysis && (
                      <Badge variant="outline" className="text-xs">
                        <BarChart3 className="w-3 h-3 mr-1" />
                        已分析
                      </Badge>
                    )}
                  </div>
                </MobileCard>
              ))}
            </div>
          )}
        </div>
      </MobileLayout>
    );
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold mb-6">录音历史</h1>
        
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索录音..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                const results = e.target.value
                  ? recordingHistoryService.search(e.target.value)
                  : recordingHistoryService.getAll();
                setRecordings(results);
              }}
              className="w-full h-11 pl-9 pr-4 rounded-lg bg-background border border-input"
            />
          </div>
        </div>

        {recordings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mic className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">暂无录音记录</p>
            <p className="text-sm mt-1">开始录音后将在此显示</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recordings.map(recording => (
              <div
                key={recording.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setSelectedRecording(recording)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5 text-primary" />
                    <span className="font-medium">{formatDuration(recording.duration)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(recording.timestamp)}
                  </span>
                </div>
                
                {recording.analysis && (
                  <div className="text-sm text-muted-foreground">
                    <BarChart3 className="w-4 h-4 inline mr-1" />
                    已分析
                  </div>
                )}
                
                {recording.tags && recording.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {recording.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-secondary rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

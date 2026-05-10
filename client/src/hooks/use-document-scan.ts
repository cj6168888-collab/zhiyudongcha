import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { DocumentPlugin } from '../plugins';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('useDocumentScan');

export interface ScanPage {
  file: File;
  previewUrl: string;
  addedAt: number;
}

export type ScanSessionState = 'idle' | 'active' | 'submitting' | 'done' | 'error';

export interface UseDocumentScanResult {
  state: ScanSessionState;
  pages: ScanPage[];
  sessionId: string | null;
  projectId: string | null;
  /** Start a new multi-page scan session */
  startSession: (projectId?: string) => Promise<void>;
  /** Add a file as the next page */
  addPage: (file: File) => Promise<void>;
  /** Remove a page by index */
  removePage: (index: number) => void;
  /** Upload all pages and trigger analysis */
  submit: (shareToSwarm?: boolean) => Promise<{ success: boolean; message: string }>;
  /** Discard session and all pages */
  reset: () => void;
}

export function useDocumentScan(): UseDocumentScanResult {
  const [state, setState]     = useState<ScanSessionState>('idle');
  const [pages, setPages]     = useState<ScanPage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const previewUrls = useRef<string[]>([]);

  const startSession = useCallback(async (pid?: string) => {
    // Revoke any lingering preview URLs from previous session
    previewUrls.current.forEach(URL.revokeObjectURL);
    previewUrls.current = [];

    setPages([]);
    setProjectId(pid ?? null);
    setState('active');

    if (Capacitor.isNativePlatform()) {
      try {
        const session = await DocumentPlugin.startScanSession({ projectId: pid ?? 'DEFAULT' });
        setSessionId(session.sessionId);
        log.info('DocumentPlugin session started', { sessionId: session.sessionId, projectId: pid });
      } catch (err) {
        log.warn('DocumentPlugin.startScanSession failed, continuing without native session', err);
        setSessionId(null);
      }
    } else {
      setSessionId(`web-session-${Date.now()}`);
    }
  }, []);

  const addPage = useCallback(async (file: File) => {
    if (state !== 'active') return;

    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.push(previewUrl);

    setPages(prev => [...prev, { file, previewUrl, addedAt: Date.now() }]);

    // On native, register the page in the DocumentPlugin session (best-effort)
    if (Capacitor.isNativePlatform() && sessionId && !sessionId.startsWith('web-')) {
      try {
        await DocumentPlugin.addPage({ sessionId, uri: previewUrl });
      } catch (err) {
        log.warn('DocumentPlugin.addPage failed', err);
      }
    }
  }, [state, sessionId]);

  const removePage = useCallback((index: number) => {
    setPages(prev => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current = previewUrls.current.filter(u => u !== removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const submit = useCallback(async (shareToSwarm = false): Promise<{ success: boolean; message: string }> => {
    if (pages.length === 0) return { success: false, message: '请先添加至少一页' };

    setState('submitting');

    try {
      const formData = new FormData();
      pages.forEach((page, i) => formData.append(`file_${i}`, page.file, page.file.name));
      formData.append('shareToSwarm', String(shareToSwarm));
      formData.append('sessionId',   sessionId ?? '');
      formData.append('projectId',   projectId ?? '');
      formData.append('pageCount',   String(pages.length));

      const res = await fetch('/api/scans/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      // On native: notify DocumentPlugin that session is complete (triggers TRIGGER_BATCH_ANALYSIS)
      if (Capacitor.isNativePlatform() && sessionId && !sessionId.startsWith('web-')) {
        try {
          await DocumentPlugin.finishAndAnalyze({ sessionId });
          log.info('DocumentPlugin session finished', { sessionId });
        } catch (err) {
          log.warn('DocumentPlugin.finishAndAnalyze failed', err);
        }
      }

      setState('done');
      return {
        success: true,
        message: shareToSwarm
          ? `${pages.length} 页已加密同步至蜂群`
          : `${pages.length} 页已私密存入核心`,
      };
    } catch (err) {
      log.error('Document scan submit failed', err);
      setState('error');
      return { success: false, message: '上传失败，请稍后重试' };
    }
  }, [pages, sessionId, projectId]);

  const reset = useCallback(() => {
    // Cancel native session if active
    if (Capacitor.isNativePlatform() && sessionId && !sessionId.startsWith('web-')) {
      DocumentPlugin.cancelSession({ sessionId }).catch(() => {});
    }
    previewUrls.current.forEach(URL.revokeObjectURL);
    previewUrls.current = [];
    setPages([]);
    setSessionId(null);
    setProjectId(null);
    setState('idle');
  }, [sessionId]);

  return { state, pages, sessionId, projectId, startSession, addPage, removePage, submit, reset };
}

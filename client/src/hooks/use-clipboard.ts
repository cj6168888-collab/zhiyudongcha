/**
 * Clipboard Utilities
 *
 * Provides copy to clipboard functionality with
 * fallback support and feedback callbacks.
 */

import React, { useState, useCallback } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('Clipboard');

export interface CopyOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  duration?: number;
}

export interface UseClipboardReturn {
  copy: (text: string, options?: CopyOptions) => Promise<boolean>;
  copyHtml: (html: string, text: string, options?: CopyOptions) => Promise<boolean>;
  copied: boolean;
  reset: () => void;
}

const FALLBACK_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <textarea id="copy-area" style="position:absolute;left:-9999px;">{text}</textarea>
    </body>
  </html>
`;

async function createFallback(text: string): Promise<void> {
  const blob = new Blob([FALLBACK_HTML.replace('{text}', text)], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const popup = window.open(blobUrl, '_blank');

  if (!popup) {
    throw new Error('Failed to open popup for copy fallback');
  }

  try {
    const textarea = popup.document.getElementById('copy-area') as HTMLTextAreaElement;
    if (textarea) {
      textarea.select();
      popup.document.execCommand('copy');
    }
  } finally {
    setTimeout(() => {
      popup.close();
      URL.revokeObjectURL(blobUrl);
    }, 100);
  }
}

export function useClipboard(duration = 2000): UseClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, options?: CopyOptions): Promise<boolean> => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          logger.debug('[useClipboard] Copied text to clipboard');
        } else {
          await createFallback(text);
        }

        setCopied(true);

        options?.onSuccess?.();

        if (duration > 0) {
          setTimeout(() => setCopied(false), duration);
        }

        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('[useClipboard] Failed to copy:', err);
        options?.onError?.(err);
        setCopied(false);
        return false;
      }
    },
    [duration]
  );

  const copyHtml = useCallback(
    async (html: string, text: string, options?: CopyOptions): Promise<boolean> => {
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          const blob = new Blob([html], { type: 'text/html' });
          const plainText = new Blob([text], { type: 'text/plain' });
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': blob,
              'text/plain': plainText,
            }),
          ]);
          logger.debug('[useClipboard] Copied HTML to clipboard');
        } else {
          await createFallback(html);
        }

        setCopied(true);
        options?.onSuccess?.();

        if (duration > 0) {
          setTimeout(() => setCopied(false), duration);
        }

        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('[useClipboard] Failed to copy HTML:', err);
        options?.onError?.(err);
        return false;
      }
    },
    [duration]
  );

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copy, copyHtml, copied, reset };
}

export async function copyToClipboard(
  text: string,
  options?: CopyOptions
): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      await createFallback(text);
    }

    options?.onSuccess?.();
    logger.debug('[clipboard] Copied to clipboard');

    if (options?.duration && options.duration > 0) {
      setTimeout(() => {}, options.duration);
    }

    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options?.onError?.(err);
    logger.warn('[clipboard] Failed to copy:', err);
    return false;
  }
}

export async function copyToClipboardHtml(
  html: string,
  text: string,
  options?: CopyOptions
): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
    } else {
      await createFallback(html);
    }

    options?.onSuccess?.();
    logger.debug('[clipboard] Copied HTML to clipboard');
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options?.onError?.(err);
    logger.warn('[clipboard] Failed to copy HTML:', err);
    return false;
  }
}

export function isClipboardSupported(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}

export function isClipboardItemSupported(): boolean {
  return !!window.ClipboardItem;
}

export default useClipboard;

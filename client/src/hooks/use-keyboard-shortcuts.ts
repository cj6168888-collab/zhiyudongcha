/**
 * Keyboard Shortcuts Hook
 *
 * Manages keyboard shortcuts with support for
 * modifiers, combinations, and scoped shortcuts.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useKeyboardShortcuts');

export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta' | 'mod';

export interface Shortcut {
  key: string;
  modifiers?: KeyModifier[];
  action: () => void;
  description?: string;
  enabled?: boolean;
  target?: HTMLElement | Window | Document;
}

export interface UseKeyboardShortcutsReturn {
  register: (shortcut: Shortcut) => void;
  unregister: (key: string) => void;
  unregisterAll: () => void;
  isPressed: (key: string) => boolean;
}

function parseShortcut(key: string): { key: string; modifiers: Set<string> } {
  const parts = key.toLowerCase().split('+');
  const modifiers = new Set(parts.slice(0, -1));
  const mainKey = parts[parts.length - 1];
  return { key: mainKey, modifiers };
}

function matchesEvent(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const { key: shortcutKey, modifiers } = parseShortcut(shortcut.key);

  const keyMatches = event.key.toLowerCase() === shortcutKey ||
    event.code?.replace('Key', '').toLowerCase() === shortcutKey ||
    event.code?.toLowerCase() === shortcutKey;

  if (!keyMatches) return false;

  const ctrlMatch = !modifiers.has('ctrl') || event.ctrlKey;
  const altMatch = !modifiers.has('alt') || event.altKey;
  const shiftMatch = !modifiers.has('shift') || event.shiftKey;
  const metaMatch = !modifiers.has('meta') || event.metaKey;

  const modMatch = !modifiers.has('mod') || event.ctrlKey || event.metaKey;

  return ctrlMatch && altMatch && shiftMatch && metaMatch && modMatch;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  dependencies: any[] = []
): UseKeyboardShortcutsReturn {
  const shortcutsRef = useRef<Shortcut[]>(shortcuts);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    pressedKeysRef.current.add(event.key.toLowerCase());
    setPressedKeys(new Set(pressedKeysRef.current));

    for (const shortcut of shortcutsRef.current) {
      if (shortcut.enabled === false) continue;

      const target = shortcut.target || window;
      if (target !== window && !(target as any).contains?.(event.target as Node)) continue;

      if (matchesEvent(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();

        logger.debug(`[useKeyboardShortcuts] Triggered: ${shortcut.key}`);

        try {
          shortcut.action();
        } catch (error) {
          logger.error(`[useKeyboardShortcuts] Error executing shortcut: ${shortcut.key}`, error);
        }

        break;
      }
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    pressedKeysRef.current.delete(event.key.toLowerCase());
    setPressedKeys(new Set(pressedKeysRef.current));
  }, []);

  useEffect(() => {
    const target = shortcuts[0]?.target || window;

    const onKeyDown = (event: Event) => {
      handleKeyDown(event as KeyboardEvent);
    };

    const onKeyUp = (event: Event) => {
      handleKeyUp(event as KeyboardEvent);
    };

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);

    return () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const register = useCallback((shortcut: Shortcut) => {
    shortcutsRef.current = [...shortcutsRef.current, shortcut];
    logger.debug(`[useKeyboardShortcuts] Registered: ${shortcut.key}`);
  }, []);

  const unregister = useCallback((key: string) => {
    const { key: shortcutKey } = parseShortcut(key);
    shortcutsRef.current = shortcutsRef.current.filter(
      (s) => !s.key.toLowerCase().endsWith(shortcutKey)
    );
    logger.debug(`[useKeyboardShortcuts] Unregistered: ${key}`);
  }, []);

  const unregisterAll = useCallback(() => {
    shortcutsRef.current = [];
    pressedKeysRef.current.clear();
    setPressedKeys(new Set());
    logger.debug('[useKeyboardShortcuts] Unregistered all shortcuts');
  }, []);

  const isPressed = useCallback((key: string) => {
    return pressedKeys.has(key.toLowerCase());
  }, [pressedKeys]);

  return { register, unregister, unregisterAll, isPressed };
}

export function useGlobalKeyboardShortcuts(
  shortcuts: Shortcut[]
): UseKeyboardShortcutsReturn {
  return useKeyboardShortcuts(shortcuts);
}

export function useLocalKeyboardShortcuts(
  containerRef: React.RefObject<HTMLElement>,
  shortcuts: Shortcut[]
): UseKeyboardShortcutsReturn {
  const wrappedShortcuts = shortcuts.map((s) => ({
    ...s,
    target: containerRef.current || undefined,
  }));

  return useKeyboardShortcuts(wrappedShortcuts);
}

export function createShortcut(
  key: string,
  action: () => void,
  options?: {
    modifiers?: KeyModifier[];
    description?: string;
    enabled?: boolean;
  }
): Shortcut {
  return {
    key,
    modifiers: options?.modifiers,
    action,
    description: options?.description,
    enabled: options?.enabled ?? true,
  };
}

export function shortcutToString(shortcut: Shortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers) {
    if (shortcut.modifiers.includes('mod')) {
      parts.push('Mod');
    } else {
      if (shortcut.modifiers.includes('ctrl')) parts.push('Ctrl');
      if (shortcut.modifiers.includes('alt')) parts.push('Alt');
      if (shortcut.modifiers.includes('shift')) parts.push('Shift');
      if (shortcut.modifiers.includes('meta')) parts.push('Meta');
    }
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}

export function isValidShortcut(key: string): boolean {
  const validKeys = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
    'enter', 'escape', 'space', 'tab', 'backspace', 'delete', 'insert', 'home', 'end',
    'pageup', 'pagedown', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ];

  const { key: mainKey } = parseShortcut(key);
  return validKeys.includes(mainKey.toLowerCase());
}

import React from 'react';
export default useKeyboardShortcuts;

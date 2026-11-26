import { useCallback } from 'react';
import { effectiveLanguage, useSettings, type UiLanguage } from '../state/settings';
import { en, type MessageKey } from './en';
import { he } from './he';

export type { MessageKey };

const DICTIONARIES: Record<UiLanguage, Record<MessageKey, string>> = { en, he };
export const RTL_LANGUAGES: ReadonlySet<UiLanguage> = new Set(['he']);

export type TranslateVars = Record<string, string | number>;

export function translate(lang: UiLanguage, key: MessageKey, vars?: TranslateVars): string {
  const raw = DICTIONARIES[lang][key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function useLang(): UiLanguage {
  return useSettings((s) => effectiveLanguage(s));
}

export function useT() {
  const lang = useLang();
  return useCallback((key: MessageKey, vars?: TranslateVars) => translate(lang, key, vars), [lang]);
}

export function dirFor(lang: UiLanguage): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

/** Applies lang/dir and accessibility flags to <html>. */
export function applyDocumentSettings(): void {
  const s = useSettings.getState();
  const lang = effectiveLanguage(s);
  const root = document.documentElement;
  root.lang = lang;
  root.dir = dirFor(lang);
  root.dataset.motion = s.reducedMotion ? 'reduced' : 'full';
  root.dataset.contrast = s.highContrast ? 'high' : 'normal';
}

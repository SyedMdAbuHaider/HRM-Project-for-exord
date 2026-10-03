import React, { createContext, useCallback, useContext, useState } from 'react';
export type Language = 'en' | 'bn';
export type TranslationKey = string;
const Context = createContext<any>(null);
const KEY = 'exord-language';
export const loadUserLang = (): Language => { try { return localStorage.getItem(KEY) === 'bn' ? 'bn' : 'en'; } catch { return 'en'; } };
export const saveUserLang = (l: Language) => { try { localStorage.setItem(KEY, l); } catch {} };
export const getGreetingKey = (h: number = new Date().getHours()): TranslationKey => h < 12 ? 'good_morning' : h < 18 ? 'good_afternoon' : 'good_evening';
export const getGreetingEmoji = (h: number = new Date().getHours()) => h < 12 ? '☀️' : h < 18 ? '🌤️' : '🌙';
export const getFirstName = (n: string) => n.trim().split(/\s+/)[0] || n;
export const LanguageProvider = ({ children }: React.PropsWithChildren) => {
  const [lang, setLangState] = useState<Language>(loadUserLang);
  const setLang = useCallback((l: Language) => { setLangState(l); saveUserLang(l); }, []);
  const toggleLang = useCallback(() => setLang(lang === 'en' ? 'bn' : 'en'), [lang, setLang]);
  const t = useCallback((k: TranslationKey) => k, [lang]);
  return React.createElement(Context.Provider, { value: { t, lang, setLang, toggleLang } }, children);
};
export const useLanguage = () => useContext(Context);

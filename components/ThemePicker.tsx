/**
 * ThemePicker.tsx
 * Two-panel theme customisation modal:
 *   - "My Theme"  → personal, per-user, saved to localStorage
 *   - "App Theme" → developer only, global, saved to Supabase → affects everyone
 */

import React, { useState, useEffect } from 'react';
import { X, Check, Palette, Sparkles, Zap, Monitor, Globe, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { PERSONAL_THEMES, FESTIVAL_THEMES, AppTheme } from '../themes';
import { supabase } from '../serverOwnedClient';

interface Props {
  currentPersonalThemeId: string;
  currentGlobalThemeId: string | null;
  isDeveloper: boolean;
  onPersonalSelect: (themeId: string) => void;
  onGlobalSelect: (themeId: string | null) => void;
  onClose: () => void;
}

type Panel = 'personal' | 'global';
type PersonalCat = 'all' | 'classic' | 'genz' | 'modernistic';

const ThemePicker: React.FC<Props> = ({
  currentPersonalThemeId,
  currentGlobalThemeId,
  isDeveloper,
  onPersonalSelect,
  onGlobalSelect,
  onClose,
}) => {
  const [panel, setPanel] = useState<Panel>('personal');
  const [personalCat, setPersonalCat] = useState<PersonalCat>('all');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const personalFiltered = personalCat === 'all'
    ? PERSONAL_THEMES
    : PERSONAL_THEMES.filter(t => t.category === personalCat);

  const handleGlobalSet = async (themeId: string | null) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      if (themeId === null) {
        await supabase.from('system_settings')
          .delete()
          .eq('key', 'app_global_theme');
      } else {
        await supabase.from('system_settings')
          .upsert({ key: 'app_global_theme', value: JSON.stringify(themeId) }, { onConflict: 'key' });
      }
      onGlobalSelect(themeId);
      setSaveMsg(themeId ? '✅ App theme updated for all users.' : '✅ Global theme cleared — users see personal themes.');
    } catch {
      setSaveMsg('❌ Failed to save. Check Supabase connection.');
    }
    setSaving(false);
  };

  const ThemeCard: React.FC<{
    theme: AppTheme;
    isActive: boolean;
    isGlobalActive?: boolean;
    onClick: () => void;
    loading?: boolean;
  }> = ({ theme, isActive, isGlobalActive, onClick, loading }) => (
    <button
      onClick={onClick}
      disabled={loading}
      className={`relative text-left rounded-2xl border-2 p-4 transition-all active:scale-95 disabled:opacity-60 ${
        isActive
          ? 'shadow-lg'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
      }`}
      style={isActive ? { borderColor: theme.primary, boxShadow: `0 4px 20px ${theme.primary}30` } : {}}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl shadow-md flex-shrink-0" style={{ backgroundColor: theme.primary }} />
        <div className="w-4 h-8 rounded-lg flex-shrink-0 opacity-60" style={{ backgroundColor: theme.primaryDark }} />
        {theme.dark && (
          <span className="ml-auto text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg">Dark</span>
        )}
      </div>
      <p className="text-xs font-black text-slate-900 dark:text-white leading-tight mb-0.5">{theme.emoji} {theme.name}</p>
      <p className="text-[9px] font-medium text-slate-400 leading-snug">{theme.vibe}</p>
      {isActive && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: theme.primary }}>
          {loading ? <RefreshCw size={8} className="text-white animate-spin" /> : <Check size={10} className="text-white" strokeWidth={3} />}
        </div>
      )}
      {isGlobalActive && !isActive && (
        <div className="absolute top-2.5 right-2.5">
          <Globe size={12} className="text-slate-400" />
        </div>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6 animate-[fadeIn_0.25s_ease-out]">
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--primary, #E31E24)' }}>
              <Palette size={18} className="text-white" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white text-base">Theme Studio</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                {isDeveloper ? 'Personalise for yourself or set the app-wide theme' : 'Personalise your experience'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Panel switcher — only show if developer */}
        {isDeveloper && (
          <div className="flex px-6 pt-4 gap-2 flex-shrink-0">
            <button
              onClick={() => setPanel('personal')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                panel === 'personal'
                  ? 'text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              style={panel === 'personal' ? { backgroundColor: 'var(--primary, #E31E24)' } : {}}
            >
              <Palette size={13} /> My Theme
            </button>
            <button
              onClick={() => setPanel('global')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                panel === 'global'
                  ? 'text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              style={panel === 'global' ? { backgroundColor: 'var(--primary, #E31E24)' } : {}}
            >
              <Globe size={13} /> App Theme
              {currentGlobalThemeId && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        )}

        {/* ── Personal Panel ── */}
        {panel === 'personal' && (
          <>
            {/* Category tabs */}
            <div className="px-6 pt-4 pb-2 flex gap-2 overflow-x-auto custom-scrollbar flex-shrink-0">
              {(['all', 'classic', 'genz', 'modernistic'] as PersonalCat[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setPersonalCat(cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    personalCat === cat
                      ? 'text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  style={personalCat === cat ? { backgroundColor: 'var(--primary, #E31E24)' } : {}}
                >
                  {cat === 'all' ? '✦ All' : cat === 'genz' ? '⚡ Gen Z' : cat === 'classic' ? '🔴 Classic' : '🔲 Modern'}
                </button>
              ))}
            </div>

            {/* Global theme notice */}
            {currentGlobalThemeId && (
              <div className="mx-6 mt-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex items-start gap-2 flex-shrink-0">
                <Globe size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                  A global app theme is active. Your personal theme will apply once it's cleared by the developer.
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {personalFiltered.map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={theme.id === currentPersonalThemeId}
                    onClick={() => onPersonalSelect(theme.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Global / Festival Panel (Developer only) ── */}
        {panel === 'global' && isDeveloper && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 pt-4 space-y-5">

            {/* Info banner */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
              <Globe size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-0.5">App-wide Theme</p>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  Selecting a theme here overrides everyone's personal theme and applies globally. Perfect for festivals and special occasions. Clear it to let each user's personal theme take effect again.
                </p>
              </div>
            </div>

            {/* Current global status */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Current App Theme</p>
                {currentGlobalThemeId ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-lg" style={{ backgroundColor: FESTIVAL_THEMES.find(t => t.id === currentGlobalThemeId)?.primary || PERSONAL_THEMES.find(t => t.id === currentGlobalThemeId)?.primary || '#E31E24' }} />
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {[...FESTIVAL_THEMES, ...PERSONAL_THEMES].find(t => t.id === currentGlobalThemeId)?.name || currentGlobalThemeId}
                    </p>
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg">Active</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-400 italic">None — users see their personal themes</p>
                )}
              </div>
              {currentGlobalThemeId && (
                <button
                  onClick={() => handleGlobalSet(null)}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-500 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <X size={12} /> Clear Global Theme
                </button>
              )}
            </div>

            {saveMsg && (
              <div className={`p-3 rounded-2xl text-xs font-bold ${saveMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/10 dark:text-rose-400'}`}>
                {saveMsg}
              </div>
            )}

            {/* Festival themes */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Sparkles size={11} /> Festival & Seasonal Themes
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FESTIVAL_THEMES.map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={theme.id === currentGlobalThemeId}
                    onClick={() => handleGlobalSet(theme.id)}
                    loading={saving}
                  />
                ))}
              </div>
            </div>

            {/* All personal themes as global options too */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Zap size={11} /> Or Apply Any Personal Theme App-Wide
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PERSONAL_THEMES.map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={theme.id === currentGlobalThemeId}
                    isGlobalActive={theme.id === currentGlobalThemeId}
                    onClick={() => handleGlobalSet(theme.id)}
                    loading={saving}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <p className="text-[10px] text-slate-400 font-medium text-center">
            {panel === 'personal'
              ? 'Personal theme saved to your browser · only affects your device'
              : 'Global theme stored in database · visible to all users immediately'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThemePicker;

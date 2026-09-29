/**
 * LayoutPicker.tsx
 * Modal for personalising the app's visual layout.
 * Changes apply instantly and persist in localStorage per user.
 */

import React from 'react';
import { X, Layout } from 'lucide-react';
import {
  LayoutSettings, RadiusPreset, DensityPreset, ShadowPreset, FontSizePreset, FontStylePreset,
  RADIUS_OPTIONS, DENSITY_OPTIONS, SHADOW_OPTIONS, FONT_SIZE_OPTIONS, FONT_STYLE_OPTIONS,
} from '../layoutSettings';

interface Props {
  settings: LayoutSettings;
  onChange: (settings: LayoutSettings) => void;
  onClose: () => void;
}

type Section = { title: string; key: keyof LayoutSettings; options: { id: string; label: string; emoji: string; desc: string }[] };

const LayoutPicker: React.FC<Props> = ({ settings, onChange, onClose }) => {

  const sections: Section[] = [
    { title: 'Corner Style',  key: 'radius',    options: RADIUS_OPTIONS     },
    { title: 'Density',       key: 'density',   options: DENSITY_OPTIONS    },
    { title: 'Shadow Depth',  key: 'shadow',    options: SHADOW_OPTIONS     },
    { title: 'Font Size',     key: 'fontSize',  options: FONT_SIZE_OPTIONS  },
    { title: 'Font Style',    key: 'fontStyle', options: FONT_STYLE_OPTIONS },
  ];

  const update = (key: keyof LayoutSettings, value: string) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6 animate-[fadeIn_0.25s_ease-out]">
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-900 dark:bg-white">
              <Layout size={18} className="text-white dark:text-slate-900" />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-white text-base">Layout Style</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Personalise spacing, corners, depth & typography</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-8 pt-4 space-y-8">
          {sections.map(section => (
            <div key={section.key}>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4">
                {section.title}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {section.options.map(opt => {
                  const isActive = settings[section.key] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => update(section.key, opt.id)}
                      className={`relative text-left p-4 transition-all active:scale-95 border-2 ${
                        isActive
                          ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white shadow-xl'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                      style={{ borderRadius: section.key === 'radius' ? getBorderRadiusPreview(opt.id as RadiusPreset) : '1rem' }}
                    >
                      {/* Preview swatch for radius */}
                      {section.key === 'radius' && (
                        <div className="flex gap-1.5 mb-3">
                          {[1, 2, 3].map(i => (
                            <div
                              key={i}
                              className={`h-5 flex-1 transition-all ${isActive ? 'bg-white/30 dark:bg-slate-900/30' : 'bg-slate-200 dark:bg-slate-600'}`}
                              style={{ borderRadius: getBorderRadiusPreview(opt.id as RadiusPreset) }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Preview swatch for density */}
                      {section.key === 'density' && (
                        <div className="flex flex-col gap-1 mb-3">
                          {[1, 2, 3].map(i => (
                            <div
                              key={i}
                              className={`h-1.5 rounded-full transition-all ${isActive ? 'bg-white/40 dark:bg-slate-900/40' : 'bg-slate-200 dark:bg-slate-600'}`}
                              style={{ width: i === 1 ? '90%' : i === 2 ? '70%' : '50%', margin: opt.id === 'compact' ? '0' : opt.id === 'spacious' ? '2px 0' : '1px 0' }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Preview swatch for shadow */}
                      {section.key === 'shadow' && (
                        <div className="mb-3">
                          <div
                            className={`h-6 w-full rounded-lg transition-all ${isActive ? 'bg-white/20 dark:bg-slate-900/20' : 'bg-slate-100 dark:bg-slate-700'}`}
                            style={{ boxShadow: getShadowPreview(opt.id as ShadowPreset) }}
                          />
                        </div>
                      )}

                      {/* Preview for font size */}
                      {section.key === 'fontSize' && (
                        <div className="mb-3 flex items-end gap-1">
                          {[10, 13, 16, 20].map((sz, i) => (
                            <span
                              key={i}
                              className={`font-black leading-none transition-all ${isActive ? 'text-white dark:text-slate-900' : 'text-slate-400'}`}
                              style={{ fontSize: sz }}
                            >Aa</span>
                          ))}
                        </div>
                      )}

                      {/* Preview for font style */}
                      {section.key === 'fontStyle' && (
                        <div className="mb-3">
                          <p
                            className={`text-base font-bold leading-tight transition-all ${isActive ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}
                            style={{ fontFamily: getFontFamilyPreview(opt.id as FontStylePreset) }}
                          >
                            Exord HRM
                          </p>
                        </div>
                      )}

                      <p className={`text-xs font-black mb-0.5 ${isActive ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>
                        {opt.emoji} {opt.label}
                      </p>
                      <p className={`text-[9px] font-medium leading-snug ${isActive ? 'text-white/70 dark:text-slate-900/60' : 'text-slate-400'}`}>
                        {opt.desc}
                      </p>

                      {isActive && (
                        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#E31E24] flex items-center justify-center shadow">
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Reset */}
          <button
            onClick={() => onChange({ radius: 'round', density: 'comfortable', shadow: 'soft', fontSize: 'default', fontStyle: 'inter' })}
            className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl transition-all hover:border-slate-300"
          >
            ↺ Reset to Defaults
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <p className="text-[10px] text-slate-400 font-medium text-center">
            Layout saved to your browser · only affects your device
          </p>
        </div>
      </div>
    </div>
  );
};

// Preview helpers for the swatch buttons
function getBorderRadiusPreview(preset: RadiusPreset): string {
  return { sharp: '4px', soft: '10px', round: '18px', pill: '9999px' }[preset];
}

function getShadowPreview(preset: ShadowPreset): string {
  return {
    none:   'none',
    subtle: '0 1px 4px rgba(0,0,0,0.08)',
    soft:   '0 8px 24px rgba(0,0,0,0.10)',
    deep:   '0 16px 48px rgba(0,0,0,0.22)',
  }[preset];
}

function getFontFamilyPreview(preset: FontStylePreset): string {
  return {
    inter:   "'Inter', sans-serif",
    jakarta: "'Plus Jakarta Sans', sans-serif",
    mono:    "'JetBrains Mono', 'Courier New', monospace",
    serif:   "'Lora', Georgia, serif",
  }[preset];
}

export default LayoutPicker;

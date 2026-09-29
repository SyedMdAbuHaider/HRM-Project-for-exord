/**
 * layoutSettings.ts — Exord Online HRM Layout Customisation
 *
 * Every user can personalise the visual layout of the app:
 *   - Corner radius  (Sharp / Soft / Round / Pill)
 *   - Density        (Compact / Comfortable / Spacious)
 *   - Shadow style   (None / Subtle / Soft / Deep)
 *   - Sidebar width  (Narrow / Default / Wide)
 *
 * Settings are saved to localStorage keyed by userId so each person's
 * preference is preserved across sessions without touching the DB.
 */

export type RadiusPreset = 'sharp' | 'soft' | 'round' | 'pill';
export type DensityPreset = 'compact' | 'comfortable' | 'spacious';
export type ShadowPreset = 'none' | 'subtle' | 'soft' | 'deep';
export type FontSizePreset = 'small' | 'default' | 'large' | 'xlarge';
export type FontStylePreset = 'inter' | 'jakarta' | 'mono' | 'serif';

export interface LayoutSettings {
  radius: RadiusPreset;
  density: DensityPreset;
  shadow: ShadowPreset;
  fontSize: FontSizePreset;
  fontStyle: FontStylePreset;
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  radius: 'round',
  density: 'comfortable',
  shadow: 'soft',
  fontSize: 'default',
  fontStyle: 'inter',
};

const LAYOUT_KEY = (uid: string) => `exord-layout-${uid}`;

export const readLayoutSettings = (uid: string): LayoutSettings => {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY(uid));
    if (!raw) return { ...DEFAULT_LAYOUT };
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_LAYOUT }; }
};

export const writeLayoutSettings = (uid: string, settings: LayoutSettings): void => {
  try { localStorage.setItem(LAYOUT_KEY(uid), JSON.stringify(settings)); } catch {}
};

// ─── Radius values ─────────────────────────────────────────────────────────
// We override the Tailwind rounded-* classes used throughout the app via
// CSS variable --radius-scale and a set of fixed overrides.
const RADIUS: Record<RadiusPreset, { label: string; emoji: string; desc: string; vars: string }> = {
  sharp: {
    label: 'Sharp', emoji: '▪️', desc: 'Clean edges · minimal · technical',
    vars: `
      --r-sm: 4px; --r-md: 6px; --r-lg: 8px;
      --r-xl: 10px; --r-2xl: 12px; --r-3xl: 14px; --r-full: 8px;
    `,
  },
  soft: {
    label: 'Soft', emoji: '🔲', desc: 'Gently rounded · balanced · professional',
    vars: `
      --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
      --r-xl: 20px; --r-2xl: 24px; --r-3xl: 30px; --r-full: 9999px;
    `,
  },
  round: {
    label: 'Round', emoji: '🔵', desc: 'Fully rounded · modern · friendly',
    vars: `
      --r-sm: 12px; --r-md: 18px; --r-lg: 24px;
      --r-xl: 32px; --r-2xl: 40px; --r-3xl: 56px; --r-full: 9999px;
    `,
  },
  pill: {
    label: 'Pill', emoji: '💊', desc: 'Extreme curves · playful · bold',
    vars: `
      --r-sm: 20px; --r-md: 28px; --r-lg: 40px;
      --r-xl: 52px; --r-2xl: 9999px; --r-3xl: 9999px; --r-full: 9999px;
    `,
  },
};

// ─── Density values ────────────────────────────────────────────────────────
const DENSITY: Record<DensityPreset, { label: string; emoji: string; desc: string; vars: string }> = {
  compact: {
    label: 'Compact', emoji: '▤', desc: 'More content · tighter spacing',
    vars: `--space-card: 1.25rem; --space-section: 1.5rem; --text-scale: 0.93;`,
  },
  comfortable: {
    label: 'Comfortable', emoji: '▥', desc: 'Balanced · default spacing',
    vars: `--space-card: 2rem; --space-section: 2.5rem; --text-scale: 1;`,
  },
  spacious: {
    label: 'Spacious', emoji: '▦', desc: 'Breathing room · relaxed',
    vars: `--space-card: 2.75rem; --space-section: 3.5rem; --text-scale: 1.04;`,
  },
};

// ─── Shadow values ─────────────────────────────────────────────────────────
const SHADOW: Record<ShadowPreset, { label: string; emoji: string; desc: string; css: string }> = {
  none: {
    label: 'Flat', emoji: '⬜', desc: 'No shadows · ultra flat',
    css: `.soft-shadow, [class*="shadow"] { box-shadow: none !important; }`,
  },
  subtle: {
    label: 'Subtle', emoji: '🌫', desc: 'Barely there · minimal depth',
    css: `.soft-shadow { box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important; }`,
  },
  soft: {
    label: 'Soft', emoji: '☁️', desc: 'Default soft shadows',
    css: `/* default — no override needed */`,
  },
  deep: {
    label: 'Deep', emoji: '🌑', desc: 'Pronounced depth · dramatic',
    css: `.soft-shadow { box-shadow: 0 20px 60px -10px rgba(0,0,0,0.18), 0 8px 20px -8px rgba(0,0,0,0.12) !important; }
          .dark .soft-shadow { box-shadow: 0 20px 60px -10px rgba(0,0,0,0.7), 0 8px 20px -8px rgba(0,0,0,0.5) !important; }`,
  },
};

// ─── Font size values ──────────────────────────────────────────────────────
const FONT_SIZE: Record<FontSizePreset, { label: string; emoji: string; desc: string; vars: string }> = {
  small: {
    label: 'Small', emoji: 'Aa', desc: 'Compact text · more content visible',
    vars: `--font-base: 13px; --font-scale: 0.9;`,
  },
  default: {
    label: 'Default', emoji: 'Aa', desc: 'Standard size · balanced readability',
    vars: `--font-base: 14px; --font-scale: 1;`,
  },
  large: {
    label: 'Large', emoji: 'Aa', desc: 'Easier to read · slightly larger',
    vars: `--font-base: 15.5px; --font-scale: 1.08;`,
  },
  xlarge: {
    label: 'X-Large', emoji: 'Aa', desc: 'Maximum readability · accessibility',
    vars: `--font-base: 17px; --font-scale: 1.18;`,
  },
};

// ─── Font style values ──────────────────────────────────────────────────────
const FONT_STYLE: Record<FontStylePreset, { label: string; emoji: string; desc: string; family: string }> = {
  inter: {
    label: 'Inter', emoji: '𝗜', desc: 'Default · clean · professional',
    family: `'Inter', sans-serif`,
  },
  jakarta: {
    label: 'Jakarta', emoji: '𝗝', desc: 'Modern · rounded · friendly',
    family: `'Plus Jakarta Sans', sans-serif`,
  },
  mono: {
    label: 'Mono', emoji: '𝙼', desc: 'Monospace · technical · precise',
    family: `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`,
  },
  serif: {
    label: 'Lora', emoji: '𝐋', desc: 'Elegant serif · editorial · refined',
    family: `'Lora', Georgia, serif`,
  },
};

// ─── Exported metadata for the UI picker ──────────────────────────────────
export const RADIUS_OPTIONS = Object.entries(RADIUS).map(([id, v]) => ({ id: id as RadiusPreset, ...v }));
export const DENSITY_OPTIONS = Object.entries(DENSITY).map(([id, v]) => ({ id: id as DensityPreset, ...v }));
export const SHADOW_OPTIONS = Object.entries(SHADOW).map(([id, v]) => ({ id: id as ShadowPreset, ...v }));
export const FONT_SIZE_OPTIONS = Object.entries(FONT_SIZE).map(([id, v]) => ({ id: id as FontSizePreset, ...v }));
export const FONT_STYLE_OPTIONS = Object.entries(FONT_STYLE).map(([id, v]) => ({ id: id as FontStylePreset, ...v }));

// ─── CSS injection ─────────────────────────────────────────────────────────
export const applyLayoutSettings = (settings: LayoutSettings): void => {
  const r = RADIUS[settings.radius];
  const d = DENSITY[settings.density];
  const s = SHADOW[settings.shadow];
  const fs = FONT_SIZE[settings.fontSize || 'default'];
  const ff = FONT_STYLE[settings.fontStyle || 'inter'];

  let el = document.getElementById('exord-layout-overrides') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'exord-layout-overrides';
    document.head.appendChild(el);
  }

  el.textContent = `
    /* ── Exord Layout Settings ── */
    :root {
      ${r.vars}
      ${d.vars}
      ${fs.vars}
      --font-family: ${ff.family};
    }

    /* Font family override — applied globally */
    body, input, button, textarea, select {
      font-family: var(--font-family) !important;
    }

    /* Font size — scale the root so rem-based sizes follow */
    html { font-size: var(--font-base) !important; }

    /* Radius overrides — map Tailwind rounded-* to CSS vars */
    .rounded-sm,  [class*="rounded-sm"]  { border-radius: var(--r-sm)   !important; }
    .rounded,     [class="rounded"]      { border-radius: var(--r-sm)   !important; }
    .rounded-md,  [class*="rounded-md"]  { border-radius: var(--r-md)   !important; }
    .rounded-lg,  [class*="rounded-lg"]  { border-radius: var(--r-lg)   !important; }
    .rounded-xl,  [class*="rounded-xl"]  { border-radius: var(--r-xl)   !important; }
    .rounded-2xl, [class*="rounded-2xl"] { border-radius: var(--r-2xl)  !important; }
    .rounded-3xl, [class*="rounded-3xl"] { border-radius: var(--r-3xl)  !important; }
    .rounded-full,[class*="rounded-full"]{ border-radius: var(--r-full) !important; }

    /* Custom large radii used in the app (e.g. rounded-[2.5rem]) */
    [class*="rounded-[2rem]"]    { border-radius: var(--r-3xl) !important; }
    [class*="rounded-[2.5rem]"]  { border-radius: var(--r-3xl) !important; }
    [class*="rounded-[3rem]"]    { border-radius: var(--r-3xl) !important; }
    [class*="rounded-[3.5rem]"]  { border-radius: var(--r-3xl) !important; }
    [class*="rounded-[1.5rem]"]  { border-radius: var(--r-2xl) !important; }
    [class*="rounded-[1.2rem]"]  { border-radius: var(--r-xl)  !important; }

    /* Shadow overrides */
    ${s.css}
  `;
};

export const resetLayoutSettings = (): void => {
  const el = document.getElementById('exord-layout-overrides');
  if (el) el.remove();
};

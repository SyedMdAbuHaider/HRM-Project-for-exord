/**
 * themes.ts — Exord Online HRM Theme System
 *
 * Tiers:
 *   1. PERSONAL_THEMES  — per-user, localStorage (exord-personal-theme-{userId})
 *   2. FESTIVAL_THEMES  — developer-set globally via Supabase system_settings
 *
 * Login page ALWAYS uses Exord Classic — resetTheme() is called when no user.
 *
 * Festival animations are injected into a dedicated #exord-festival-canvas div
 * (not body::before/after which is hidden behind #root in React apps).
 */

export interface AppTheme {
  id: string;
  name: string;
  emoji: string;
  vibe: string;
  wishText?: string;           // greeting shown in the festival banner
  category: 'classic' | 'genz' | 'modernistic' | 'festival';
  tier: 'personal' | 'global';
  dark?: boolean;
  primary: string;
  primaryDark: string;
  fontBody?: string;
  fontDisplay?: string;
  googleFonts?: string;
  extraCSS?: string;           // injected into #exord-theme-overrides <style>
  festivalCSS?: string;        // injected into #exord-festival-style <style>
  particles?: string;          // emoji/text rendered as floating particles
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal Themes
// ─────────────────────────────────────────────────────────────────────────────
export const PERSONAL_THEMES: AppTheme[] = [
  {
    id: 'exord-classic', name: 'Exord Classic', emoji: '🔴',
    vibe: 'The original — confident red', category: 'classic', tier: 'personal',
    primary: '#E31E24', primaryDark: '#C41217',
    fontBody: "'Inter', sans-serif", fontDisplay: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'brat', name: 'Brat', emoji: '🍏',
    vibe: 'Acid lime · Y2K · unapologetic', category: 'genz', tier: 'personal',
    primary: '#8ACE00', primaryDark: '#6BA000',
    fontBody: "'Space Grotesk', sans-serif", fontDisplay: "'Space Grotesk', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
    extraCSS: `::selection { background: rgba(138,206,0,0.3) !important; }`,
  },
  {
    id: 'cyber-pink', name: 'Cyber Pink', emoji: '🩷',
    vibe: 'Hot pink · neon · digital native', category: 'genz', tier: 'personal', dark: true,
    primary: '#FF2D78', primaryDark: '#D4005E',
    fontBody: "'Outfit', sans-serif", fontDisplay: "'Outfit', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
    extraCSS: `::selection { background: rgba(255,45,120,0.3) !important; }`,
  },
  {
    id: 'coastal', name: 'Coastal Prep', emoji: '🌊',
    vibe: 'Ocean blue · breezy · clean', category: 'genz', tier: 'personal',
    primary: '#0066FF', primaryDark: '#0050CC',
    fontBody: "'DM Sans', sans-serif", fontDisplay: "'DM Sans', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap',
    extraCSS: `::selection { background: rgba(0,102,255,0.2) !important; }`,
  },
  {
    id: 'dark-academia', name: 'Dark Academia', emoji: '📚',
    vibe: 'Vintage burgundy · moody · studious', category: 'genz', tier: 'personal', dark: true,
    primary: '#C0392B', primaryDark: '#922B21',
    fontBody: "'Libre Baskerville', serif", fontDisplay: "'Cormorant Garamond', serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap',
    extraCSS: `::selection { background: rgba(192,57,43,0.25) !important; }`,
  },
  {
    id: 'aurora', name: 'Aurora', emoji: '🌌',
    vibe: 'Cosmic purple · galaxy · dreamy', category: 'genz', tier: 'personal', dark: true,
    primary: '#A855F7', primaryDark: '#9333EA',
    fontBody: "'Nunito', sans-serif", fontDisplay: "'Nunito', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800;900&display=swap',
    extraCSS: `::selection { background: rgba(168,85,247,0.25) !important; }`,
  },
  {
    id: 'obsidian', name: 'Obsidian', emoji: '⚡',
    vibe: 'Electric blue · sharp · premium', category: 'modernistic', tier: 'personal', dark: true,
    primary: '#0EA5E9', primaryDark: '#0284C7',
    fontBody: "'IBM Plex Sans', sans-serif", fontDisplay: "'IBM Plex Sans', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
    extraCSS: `::selection { background: rgba(14,165,233,0.25) !important; }`,
  },
  {
    id: 'ivory', name: 'Ivory Studio', emoji: '🌿',
    vibe: 'Forest green · natural · refined', category: 'modernistic', tier: 'personal',
    primary: '#16A34A', primaryDark: '#15803D',
    fontBody: "'Jost', sans-serif", fontDisplay: "'Jost', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700;800;900&display=swap',
    extraCSS: `::selection { background: rgba(22,163,74,0.2) !important; }`,
  },
  {
    id: 'midnight-gold', name: 'Midnight Gold', emoji: '✨',
    vibe: 'Amber gold · luxe · executive', category: 'modernistic', tier: 'personal', dark: true,
    primary: '#F59E0B', primaryDark: '#D97706',
    fontBody: "'Syne', sans-serif", fontDisplay: "'Syne', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap',
    extraCSS: `::selection { background: rgba(245,158,11,0.25) !important; }`,
  },
  {
    id: 'monochrome', name: 'Monochrome', emoji: '⬛',
    vibe: 'Pure black/white · brutalist · editorial', category: 'modernistic', tier: 'personal', dark: true,
    primary: '#FFFFFF', primaryDark: '#E5E5E5',
    fontBody: "'Space Mono', monospace", fontDisplay: "'Space Mono', monospace",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
    extraCSS: `::selection { background: rgba(255,255,255,0.2) !important; }`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Festival particle animation CSS
// Uses #exord-festival-canvas (a fixed div injected by applyTheme)
// NOT body::before/after — those are hidden behind React's #root div.
// ─────────────────────────────────────────────────────────────────────────────

const FESTIVAL_BASE_CSS = `
  #exord-festival-canvas {
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  }
  .exord-particle {
    position: absolute;
    bottom: -80px;
    font-size: 1.4rem;
    line-height: 1;
    user-select: none;
    pointer-events: none;
    will-change: transform, opacity;
  }
  /* Ambient background glow on #root */
  #root::before {
    content: '';
    position: fixed; inset: 0;
    pointer-events: none;
    z-index: 0;
  }
`;

export const FESTIVAL_THEMES: AppTheme[] = [
  {
    id: 'eid-ul-fitr', name: 'Eid ul-Fitr', emoji: '🌙',
    vibe: 'Teal & gold · crescent moon · celebratory',
    wishText: 'Eid Mubarak! 🌙✨ Wishing you joy, blessings, and peace this Eid ul-Fitr.',
    category: 'festival', tier: 'global',
    primary: '#0D9488', primaryDark: '#0F766E',
    fontBody: "'DM Sans', sans-serif", fontDisplay: "'DM Sans', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap',
    particles: '🌙 ✨ ⭐ 🌙 ✨ ☪️ 🌙 ⭐ ✨ 🌙 ☪️ ✨ 🌙 ⭐',
    extraCSS: `
      ::selection { background: rgba(13,148,136,0.25) !important; }
    `,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes eid-float {
        0%   { transform: translateY(0) rotate(0deg) scale(1);   opacity: 0; }
        8%   { opacity: 1; }
        92%  { opacity: 0.8; }
        100% { transform: translateY(-110vh) rotate(720deg) scale(0.6); opacity: 0; }
      }
      @keyframes eid-sway {
        0%,100% { margin-left: 0; }
        25%  { margin-left: 20px; }
        75%  { margin-left: -20px; }
      }
      @keyframes eid-glow {
        0%,100% { background: radial-gradient(ellipse at 80% 10%, rgba(13,148,136,0.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 90%, rgba(245,158,11,0.05) 0%, transparent 55%); }
        50%     { background: radial-gradient(ellipse at 80% 10%, rgba(13,148,136,0.13) 0%, transparent 55%), radial-gradient(ellipse at 20% 90%, rgba(245,158,11,0.09) 0%, transparent 55%); }
      }
      #exord-glow-layer {
        position: fixed; inset: 0; pointer-events: none; z-index: 0;
        animation: eid-glow 4s ease-in-out infinite;
      }
      .exord-particle { animation: eid-float var(--dur, 9s) ease-in var(--delay, 0s) infinite, eid-sway calc(var(--dur, 9s) / 2) ease-in-out var(--delay, 0s) infinite; }
    `,
  },
  {
    id: 'eid-ul-adha', name: 'Eid ul-Adha', emoji: '🐑',
    vibe: 'Deep green · sacrifice · tradition',
    wishText: 'Eid ul-Adha Mubarak! 🐑🌿 May your sacrifice be accepted and your blessings multiplied.',
    category: 'festival', tier: 'global',
    primary: '#15803D', primaryDark: '#166534',
    fontBody: "'Nunito', sans-serif", fontDisplay: "'Nunito', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap',
    particles: '🌿 ☪️ ⭐ 🌿 🌙 ⭐ 🌿 ☪️ 🌿 ⭐ 🌙 🌿 ☪️',
    extraCSS: `::selection { background: rgba(21,128,61,0.2) !important; }`,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes adha-rise {
        0%   { transform: translateY(0) scale(0.8); opacity: 0; }
        12%  { opacity: 0.85; }
        88%  { opacity: 0.6; }
        100% { transform: translateY(-110vh) scale(1.1); opacity: 0; }
      }
      @keyframes adha-glow {
        0%,100% { background: radial-gradient(ellipse at 30% 20%, rgba(21,128,61,0.07) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(21,128,61,0.05) 0%, transparent 50%); }
        50%     { background: radial-gradient(ellipse at 30% 20%, rgba(21,128,61,0.13) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(21,128,61,0.09) 0%, transparent 50%); }
      }
      #exord-glow-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; animation: adha-glow 5s ease-in-out infinite; }
      .exord-particle { animation: adha-rise var(--dur, 11s) linear var(--delay, 0s) infinite; }
    `,
  },
  {
    id: 'ramadan', name: 'Ramadan', emoji: '☪️',
    vibe: 'Midnight blue · lanterns · sacred',
    wishText: 'Ramadan Mubarak! ☪️🪔 May this holy month bring you peace, reflection, and abundant blessings.',
    category: 'festival', tier: 'global', dark: true,
    primary: '#6366F1', primaryDark: '#4F46E5',
    fontBody: "'DM Sans', sans-serif", fontDisplay: "'DM Sans', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap',
    particles: '🪔 ⭐ 🌙 🪔 ☪️ ⭐ 🌙 🪔 ⭐ ☪️ 🌙 🪔 ⭐',
    extraCSS: `::selection { background: rgba(99,102,241,0.3) !important; }`,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes ramadan-float {
        0%   { transform: translateY(0) rotate(-5deg); opacity: 0; }
        10%  { opacity: 1; }
        50%  { transform: translateY(-55vh) rotate(5deg); }
        90%  { opacity: 0.7; }
        100% { transform: translateY(-110vh) rotate(-5deg); opacity: 0; }
      }
      @keyframes lantern-sway {
        0%,100% { transform: translateX(0) rotate(-3deg); }
        50%     { transform: translateX(15px) rotate(3deg); }
      }
      @keyframes ramadan-glow {
        0%,100% { background: radial-gradient(ellipse at 85% 5%, rgba(99,102,241,0.10) 0%, transparent 45%), radial-gradient(ellipse at 15% 95%, rgba(234,179,8,0.05) 0%, transparent 45%); }
        50%     { background: radial-gradient(ellipse at 85% 5%, rgba(99,102,241,0.18) 0%, transparent 45%), radial-gradient(ellipse at 15% 95%, rgba(234,179,8,0.10) 0%, transparent 45%); }
      }
      #exord-glow-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; animation: ramadan-glow 4s ease-in-out infinite; }
      .exord-particle { animation: ramadan-float var(--dur, 13s) ease-in-out var(--delay, 0s) infinite, lantern-sway 3s ease-in-out var(--delay, 0s) infinite; }
    `,
  },
  {
    id: 'pohela-boishakh', name: 'Pohela Boishakh', emoji: '🌺',
    vibe: 'Red & white · Bengali New Year · vibrant',
    wishText: 'শুভ নববর্ষ! 🌺🎨 Wishing you a joyful and prosperous Bengali New Year!',
    category: 'festival', tier: 'global',
    primary: '#DC2626', primaryDark: '#B91C1C',
    fontBody: "'Outfit', sans-serif", fontDisplay: "'Outfit', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
    particles: '🌺 🎨 🌸 🌺 🎭 🌼 🌺 🎨 🌸 🎭 🌼 🌺 🌸',
    extraCSS: `::selection { background: rgba(220,38,38,0.2) !important; }`,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes boishakh-spin {
        0%   { transform: translateY(0) rotate(0deg) scale(1);  opacity: 0; }
        8%   { opacity: 1; }
        92%  { opacity: 0.7; }
        100% { transform: translateY(-110vh) rotate(540deg) scale(0.7); opacity: 0; }
      }
      @keyframes boishakh-sway {
        0%,100% { margin-left: 0; }
        33%  { margin-left: 18px; }
        66%  { margin-left: -18px; }
      }
      @keyframes boishakh-glow {
        0%,100% { background: radial-gradient(ellipse at 20% 15%, rgba(220,38,38,0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 85%, rgba(220,38,38,0.05) 0%, transparent 50%); }
        50%     { background: radial-gradient(ellipse at 20% 15%, rgba(220,38,38,0.13) 0%, transparent 50%), radial-gradient(ellipse at 80% 85%, rgba(220,38,38,0.09) 0%, transparent 50%); }
      }
      #exord-glow-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; animation: boishakh-glow 3.5s ease-in-out infinite; }
      .exord-particle { animation: boishakh-spin var(--dur, 8s) ease-in var(--delay, 0s) infinite, boishakh-sway calc(var(--dur, 8s) / 2) ease-in-out var(--delay, 0s) infinite; }
    `,
  },
  {
    id: 'victory-day', name: 'Victory Day', emoji: '🇧🇩',
    vibe: 'Green & red · Bangladesh · 16 Dec',
    wishText: 'Happy Victory Day! 🇧🇩🕊️ Honoring the brave souls who gave us freedom. Joy Bangla!',
    category: 'festival', tier: 'global',
    primary: '#006A4E', primaryDark: '#00533D',
    fontBody: "'IBM Plex Sans', sans-serif", fontDisplay: "'IBM Plex Sans', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
    particles: '🇧🇩 ⭐ 🕊️ 🇧🇩 ⭐ 🏅 🇧🇩 🕊️ ⭐ 🏅 🇧🇩 ⭐',
    extraCSS: `::selection { background: rgba(0,106,78,0.2) !important; }`,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes victory-rise {
        0%   { transform: translateY(0) scale(0.9); opacity: 0; }
        12%  { opacity: 0.9; }
        88%  { opacity: 0.65; }
        100% { transform: translateY(-110vh) scale(1.05); opacity: 0; }
      }
      @keyframes victory-wave {
        0%,100% { margin-left: 0; }
        50%     { margin-left: 14px; }
      }
      @keyframes victory-glow {
        0%,100% { background: radial-gradient(ellipse at 25% 25%, rgba(0,106,78,0.08) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(220,38,38,0.06) 0%, transparent 50%); }
        50%     { background: radial-gradient(ellipse at 25% 25%, rgba(0,106,78,0.14) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(220,38,38,0.10) 0%, transparent 50%); }
      }
      #exord-glow-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; animation: victory-glow 5s ease-in-out infinite; }
      .exord-particle { animation: victory-rise var(--dur, 11s) linear var(--delay, 0s) infinite, victory-wave calc(var(--dur, 11s) / 3) ease-in-out var(--delay, 0s) infinite; }
    `,
  },
  {
    id: 'new-year', name: 'New Year', emoji: '🎆',
    vibe: 'Gold & black · countdown · fireworks',
    wishText: 'Happy New Year! 🎆🥂 May this year bring you success, health, and happiness!',
    category: 'festival', tier: 'global', dark: true,
    primary: '#EAB308', primaryDark: '#CA8A04',
    fontBody: "'Syne', sans-serif", fontDisplay: "'Syne', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap',
    particles: '🎆 🎇 ✨ 🥂 🎆 🎉 ✨ 🎇 🎆 🥂 🎉 ✨ 🎆',
    extraCSS: `::selection { background: rgba(234,179,8,0.25) !important; }`,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes firework-up {
        0%   { transform: translateY(0) scale(0.5); opacity: 0; }
        15%  { opacity: 1; transform: translateY(-30vh) scale(1.3); }
        45%  { transform: translateY(-70vh) scale(1.8); opacity: 0.9; }
        75%  { transform: translateY(-95vh) scale(2.2); opacity: 0.5; }
        100% { transform: translateY(-115vh) scale(2.5); opacity: 0; }
      }
      @keyframes ny-glow {
        0%,100% { background: radial-gradient(ellipse at 20% 10%, rgba(234,179,8,0.10) 0%, transparent 45%), radial-gradient(ellipse at 80% 10%, rgba(234,179,8,0.08) 0%, transparent 45%); }
        50%     { background: radial-gradient(ellipse at 20% 10%, rgba(234,179,8,0.18) 0%, transparent 45%), radial-gradient(ellipse at 80% 10%, rgba(234,179,8,0.15) 0%, transparent 45%); }
      }
      #exord-glow-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; animation: ny-glow 2.5s ease-in-out infinite; }
      .exord-particle { animation: firework-up var(--dur, 5s) ease-out var(--delay, 0s) infinite; font-size: 1.6rem; }
    `,
  },
  {
    id: 'independence-day', name: 'Independence Day', emoji: '🏅',
    vibe: 'Green · patriotic · 26 March',
    wishText: 'Happy Independence Day! 🇧🇩🏅 Proud to celebrate the spirit of Bangladesh. Joy Bangla!',
    category: 'festival', tier: 'global',
    primary: '#16A34A', primaryDark: '#15803D',
    fontBody: "'Jost', sans-serif", fontDisplay: "'Jost', sans-serif",
    googleFonts: 'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700;800;900&display=swap',
    particles: '🇧🇩 🌿 🕊️ 🇧🇩 ⭐ 🌿 🇧🇩 🕊️ ⭐ 🌿 🇧🇩 ⭐',
    extraCSS: `::selection { background: rgba(22,163,74,0.2) !important; }`,
    festivalCSS: `
      ${FESTIVAL_BASE_CSS}
      @keyframes indep-float {
        0%   { transform: translateY(0) rotate(-4deg); opacity: 0; }
        10%  { opacity: 0.9; }
        90%  { opacity: 0.65; }
        100% { transform: translateY(-110vh) rotate(4deg); opacity: 0; }
      }
      @keyframes indep-sway {
        0%,100% { margin-left: 0; }
        50%     { margin-left: 16px; }
      }
      @keyframes indep-glow {
        0%,100% { background: radial-gradient(ellipse at 20% 20%, rgba(22,163,74,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(22,163,74,0.06) 0%, transparent 50%); }
        50%     { background: radial-gradient(ellipse at 20% 20%, rgba(22,163,74,0.14) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(22,163,74,0.10) 0%, transparent 50%); }
      }
      #exord-glow-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; animation: indep-glow 4s ease-in-out infinite; }
      .exord-particle { animation: indep-float var(--dur, 10s) linear var(--delay, 0s) infinite, indep-sway calc(var(--dur, 10s) / 2) ease-in-out var(--delay, 0s) infinite; }
    `,
  },
];

export const ALL_THEMES = [...PERSONAL_THEMES, ...FESTIVAL_THEMES];
export const DEFAULT_THEME_ID = 'exord-classic';

export const getThemeById = (id: string): AppTheme =>
  ALL_THEMES.find(t => t.id === id) || PERSONAL_THEMES[0];

// ─────────────────────────────────────────────────────────────────────────────
// Particle engine — spawns animated emoji particles in #exord-festival-canvas
// ─────────────────────────────────────────────────────────────────────────────
let particleInterval: ReturnType<typeof setInterval> | null = null;

function stopParticles() {
  if (particleInterval) { clearInterval(particleInterval); particleInterval = null; }
  const canvas = document.getElementById('exord-festival-canvas');
  if (canvas) canvas.remove();
  const glowLayer = document.getElementById('exord-glow-layer');
  if (glowLayer) glowLayer.remove();
}

function startParticles(theme: AppTheme) {
  stopParticles();
  if (!theme.particles || !theme.festivalCSS) return;

  // Inject glow layer div
  const glow = document.createElement('div');
  glow.id = 'exord-glow-layer';
  document.body.appendChild(glow);

  // Inject canvas div
  const canvas = document.createElement('div');
  canvas.id = 'exord-festival-canvas';
  document.body.appendChild(canvas);

  const emojis = theme.particles.trim().split(/\s+/);

  const spawn = () => {
    const el = document.createElement('span');
    el.className = 'exord-particle';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const left = Math.random() * 95;
    const dur  = 6 + Math.random() * 10;
    const delay = Math.random() * -dur; // start mid-animation for instant coverage
    el.style.cssText = `
      left: ${left}%;
      --dur: ${dur.toFixed(1)}s;
      --delay: ${delay.toFixed(1)}s;
      font-size: ${1.0 + Math.random() * 0.8}rem;
      opacity: 0;
    `;
    canvas.appendChild(el);
    // Remove particle after one cycle to avoid DOM bloat
    setTimeout(() => el.remove(), (dur + Math.abs(delay)) * 1000 + 500);
  };

  // Spawn initial batch
  for (let i = 0; i < 18; i++) setTimeout(spawn, i * 200);
  // Keep spawning
  particleInterval = setInterval(spawn, 600);
}

// ─────────────────────────────────────────────────────────────────────────────
// applyTheme — called whenever the active theme changes
// ─────────────────────────────────────────────────────────────────────────────
export const applyTheme = (theme: AppTheme): void => {
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.primaryDark);
  if (theme.fontBody)    root.style.setProperty('--font-body',    theme.fontBody);
  if (theme.fontDisplay) root.style.setProperty('--font-display', theme.fontDisplay);

  // Main theme overrides
  let styleEl = document.getElementById('exord-theme-overrides') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'exord-theme-overrides';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    /* ── Exord Brand Color Protection ──────────────────────────────────────
       .exord-brand always stays the original Exord red (#E31E24)
       regardless of which theme is active. This keeps "Exord Online"
       looking like the brand everywhere — sidebar, login, loading screen.
    ─────────────────────────────────────────────────────────────────────── */
    .exord-brand {
      color: #E31E24 !important;
    }

    /* ── Theme Color Overrides ─────────────────────────────────────────── */
    [class*="bg-[#E31E24]"],[class*="bg-[#e31e24]"] { background-color: var(--primary) !important; }
    [class*="text-[#E31E24]"],[class*="text-[#e31e24]"] { color: var(--primary) !important; }
    [class*="border-[#E31E24]"],[class*="border-[#e31e24]"] { border-color: var(--primary) !important; }
    [class*="from-[#E31E24]"] { --tw-gradient-from: var(--primary) !important; }
    [class*="to-[#E31E24]"]   { --tw-gradient-to: var(--primary) !important; }
    [class*="bg-[#C41217]"]   { background-color: var(--primary-dark) !important; }
    [class*="text-[#C41217]"] { color: var(--primary-dark) !important; }
    [class*="hover:bg-[#E31E24]"]:hover   { background-color: var(--primary) !important; }
    [class*="hover:bg-[#C41217]"]:hover   { background-color: var(--primary-dark) !important; }
    [class*="hover:bg-red-700"]:hover     { background-color: var(--primary-dark) !important; }
    [class*="hover:text-[#E31E24]"]:hover { color: var(--primary) !important; }
    [class*="hover:border-[#E31E24]"]:hover { border-color: var(--primary) !important; }
    [class*="focus:border-[#E31E24]"]:focus { border-color: var(--primary) !important; }
    [class*="active:bg-[#E31E24]"]:active { background-color: var(--primary) !important; }
    .dark [class*="dark:bg-[#E31E24]"]     { background-color: var(--primary) !important; }
    .dark [class*="dark:text-[#E31E24]"]   { color: var(--primary) !important; }
    .dark [class*="dark:border-[#E31E24]"] { border-color: var(--primary) !important; }
    .dark [class*="dark:hover:bg-[#E31E24]"]:hover { background-color: var(--primary) !important; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--primary) 30%, transparent) !important; }
    body, input, textarea, select, button { font-family: var(--font-body, 'Inter', sans-serif) !important; }
    .font-jakarta, [class*="font-jakarta"] { font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif) !important; }
    .font-brand, [class*="font-brand"] { font-family: var(--font-display, 'Lora', serif) !important; }
    ${theme.extraCSS || ''}

    /* Re-assert brand protection AFTER extraCSS so festival themes can't override it */
    .exord-brand { color: #E31E24 !important; }
  `;

  // Festival animation CSS (keyframes + particle styles)
  let festEl = document.getElementById('exord-festival-style') as HTMLStyleElement | null;
  if (!festEl) {
    festEl = document.createElement('style');
    festEl.id = 'exord-festival-style';
    document.head.appendChild(festEl);
  }
  festEl.textContent = theme.festivalCSS || '';

  // Start/stop particle engine
  if (theme.festivalCSS && theme.particles) {
    startParticles(theme);
  } else {
    stopParticles();
  }

  // Google Fonts
  const existing = document.getElementById('exord-theme-font');
  if (existing) existing.remove();
  if (theme.googleFonts) {
    const link = document.createElement('link');
    link.id = 'exord-theme-font';
    link.rel = 'stylesheet';
    link.href = theme.googleFonts;
    document.head.appendChild(link);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// resetTheme — called on logout / login page
// ─────────────────────────────────────────────────────────────────────────────
export const resetTheme = (): void => {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-dark');
  root.style.removeProperty('--font-body');
  root.style.removeProperty('--font-display');
  // Keep brand color protected even after reset
  let styleEl = document.getElementById('exord-theme-overrides') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'exord-theme-overrides';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `.exord-brand { color: #E31E24 !important; }`;
  const f = document.getElementById('exord-festival-style');
  if (f) f.textContent = '';
  const font = document.getElementById('exord-theme-font');
  if (font) font.remove();
  stopParticles();
};

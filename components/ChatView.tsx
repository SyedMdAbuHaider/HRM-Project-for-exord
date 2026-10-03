/**
 * ChatView.tsx — Exord Online HRM v2
 *
 * NEW:
 *  - Unread persistence fix (markConversationRead + getUnreadCountsV2)
 *  - Browser push notifications (Notification API)
 *  - @mention autocomplete in department/custom channels
 *  - @mention notifications (Supabase notification row per mentioned user)
 *  - Message editing (inline, own messages)
 *  - Typing indicators (Supabase Broadcast)
 *  - Message search (debounced ilike)
 *  - Manager can create public/private custom channels
 *  - Load more messages (pagination)
 *  - Full mobile responsive (CSS-only, no window.innerWidth)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  MessageSquare, Plus, Search, Send, X, Hash,
  ChevronLeft, Loader2, Edit2, Check, Lock, Globe,
  Users, UserPlus, ChevronDown, Mic, StopCircle, CornerUpLeft, Trash2,
  Palette,
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import FileUploadButton from './FileUploadButton';
import {
  Conversation, Message,
  getMyConversations, getMessages, sendMessage,
  getOrCreateDirectConversation, getOrCreateDepartmentConversation,
  markConversationRead, getUnreadCountsV2,
  deleteMessage, editMessage, searchMessages, createCustomChannel,
  subscribeToMessages, subscribeToConversation,
  broadcastTyping, subscribeToTyping, cleanupTypingChannel,
  batchGetConversationMembers, extractMentionIds,
  hideConversationForMe,
} from '../chatService';
import { UploadResult, uploadChatFile } from '../fileService';
import { supabase } from '../serverOwnedClient';

// ── Audio ─────────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
let audioReady = false;

const unlockAudio = () => {
  if (audioReady) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
    audioReady = true;
  } catch { /* ignore */ }
};

const playNotificationSound = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.resume().then(() => {
      const ctx = audioCtx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
    }).catch(() => {});
  } catch { /* blocked before user interaction */ }
};

// ── Browser Push Notifications ────────────────────────────────────────────────
const requestBrowserNotifications = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
};

/**
 * Show an OS-level notification that appears in the device notification panel.
 * Uses ServiceWorker registration when available (required on mobile and for
 * persistent notifications). Falls back to the basic Notification constructor.
 * The `document.hasFocus()` guard is intentionally removed — the user wants
 * device-panel notifications regardless of whether the tab is open.
 */
const showBrowserNotification = async (title: string, body: string, view = 'chat'): Promise<void> => {
  if (typeof Notification === 'undefined') return;

  // Request permission if not yet decided
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { return; }
  }
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `exord-chat-${Date.now()}`, // unique tag = each message shows separately
    silent: false,
    data: { view, url: window.location.origin },
  };

  // Try SW first (required for Android/mobile persistent notifications)
  // Use a timeout so we don't hang if SW is slow
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 1500)),
      ]).catch(() => null) as ServiceWorkerRegistration | null;

      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    } catch {
      // SW failed — fall through to basic Notification
    }
  }

  // Fallback: basic Notification API (works when tab is open, desktop only)
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      // Tell the app to navigate to chat view
      window.dispatchEvent(new CustomEvent('exord-navigate', { detail: { view } }));
      n.close();
    };
    setTimeout(() => n.close(), 8000);
  } catch (err) {
    console.warn('[Notif] Fallback failed:', err);
  }
};

type UnreadMap = Record<string, number>;
type TypingMap = Record<string, { name: string; expiresAt: number }>;

// ── Chat Background Themes ────────────────────────────────────────────────────
export interface ChatTheme {
  id: string;
  name: string;
  category: 'Default' | 'Modern' | 'Cyberpunk' | 'Classic' | 'Nature' | 'Minimal';
  bg: string;          // Tailwind / inline style for the messages container background
  bubbleOwn: string;   // own bubble bg
  bubbleOther: string; // other bubble bg
  textOwn: string;
  textOther: string;
  headerBg: string;
  inputBg: string;
  preview: string;     // preview gradient for the picker
}

export const CHAT_THEMES: ChatTheme[] = [
  // ── Default ──────────────────────────────────────────────────────────────
  {
    id: 'default',        name: 'Default',          category: 'Default',
    bg: '',               bubbleOwn: 'bg-[#E31E24]',   bubbleOther: 'bg-white dark:bg-slate-800',
    textOwn: 'text-white',textOther: 'text-slate-900 dark:text-white',
    headerBg: '',         inputBg: '',
    preview: 'linear-gradient(135deg,#f8fafc 60%,#E31E24 100%)',
  },

  // ── Modern ───────────────────────────────────────────────────────────────
  {
    id: 'modern-midnight',name: 'Midnight Blue',    category: 'Modern',
    bg: 'bg-[#0a0f1e]',
    bubbleOwn: 'bg-blue-600', bubbleOther: 'bg-slate-800',
    textOwn: 'text-white',    textOther: 'text-slate-100',
    headerBg: 'bg-[#0d1428] border-blue-900/40',
    inputBg:  'bg-[#0d1428] border-blue-900/40',
    preview: 'linear-gradient(135deg,#0a0f1e,#1e3a8a)',
  },
  {
    id: 'modern-aurora',  name: 'Aurora',           category: 'Modern',
    bg: 'bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]',
    bubbleOwn: 'bg-violet-600', bubbleOther: 'bg-white/10 backdrop-blur',
    textOwn: 'text-white',      textOther: 'text-white',
    headerBg: 'bg-[#1a1640]/80 backdrop-blur border-violet-900/30',
    inputBg:  'bg-[#1a1640]/80 backdrop-blur border-violet-900/30',
    preview: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
  },
  {
    id: 'modern-forest',  name: 'Forest Glass',     category: 'Modern',
    bg: 'bg-gradient-to-br from-[#0a2e1a] to-[#1a4a2e]',
    bubbleOwn: 'bg-emerald-600',    bubbleOther: 'bg-white/10',
    textOwn: 'text-white',          textOther: 'text-emerald-50',
    headerBg: 'bg-[#0a2e1a]/90 border-emerald-900/30',
    inputBg:  'bg-[#0a2e1a]/90 border-emerald-900/30',
    preview: 'linear-gradient(135deg,#0a2e1a,#1a4a2e,#2d6a4f)',
  },
  {
    id: 'modern-ocean',   name: 'Deep Ocean',       category: 'Modern',
    bg: 'bg-gradient-to-br from-[#03045e] via-[#0077b6] to-[#00b4d8]',
    bubbleOwn: 'bg-cyan-500',       bubbleOther: 'bg-white/15',
    textOwn: 'text-white',          textOther: 'text-cyan-50',
    headerBg: 'bg-[#023e8a]/90 border-cyan-900/30',
    inputBg:  'bg-[#023e8a]/90 border-cyan-900/30',
    preview: 'linear-gradient(135deg,#03045e,#0077b6,#00b4d8)',
  },
  {
    id: 'modern-rose',    name: 'Rose Gold',        category: 'Modern',
    bg: 'bg-gradient-to-br from-[#1a0a0f] to-[#3d1a24]',
    bubbleOwn: 'bg-rose-500',       bubbleOther: 'bg-white/10',
    textOwn: 'text-white',          textOther: 'text-rose-50',
    headerBg: 'bg-[#1a0a0f]/90 border-rose-900/30',
    inputBg:  'bg-[#1a0a0f]/90 border-rose-900/30',
    preview: 'linear-gradient(135deg,#1a0a0f,#9f1239,#fb7185)',
  },

  // ── Cyberpunk ─────────────────────────────────────────────────────────────
  {
    id: 'cyber-neon',     name: 'Neon Grid',        category: 'Cyberpunk',
    bg: 'bg-[#050510]',
    bubbleOwn: 'bg-[#00ff9f]/20 border border-[#00ff9f]/60 text-[#00ff9f]',
    bubbleOther: 'bg-[#ff00ff]/10 border border-[#ff00ff]/40',
    textOwn: 'text-[#00ff9f]',     textOther: 'text-[#ff99ff]',
    headerBg: 'bg-[#050510] border-[#00ff9f]/20',
    inputBg:  'bg-[#050510] border-[#00ff9f]/30',
    preview: 'linear-gradient(135deg,#050510,#001a0f,#00ff9f22)',
  },
  {
    id: 'cyber-matrix',   name: 'Matrix',           category: 'Cyberpunk',
    bg: 'bg-[#000300]',
    bubbleOwn: 'bg-[#003300] border border-[#00ff00]/50',
    bubbleOther: 'bg-[#001100] border border-[#00aa00]/30',
    textOwn: 'text-[#00ff00]',     textOther: 'text-[#00cc00]',
    headerBg: 'bg-[#000300] border-[#00aa00]/30',
    inputBg:  'bg-[#000300] border-[#00ff00]/30',
    preview: 'linear-gradient(135deg,#000300,#003300,#00ff0033)',
  },
  {
    id: 'cyber-vaporwave',name: 'Vaporwave',        category: 'Cyberpunk',
    bg: 'bg-gradient-to-br from-[#0d0221] via-[#1a0533] to-[#0d0221]',
    bubbleOwn: 'bg-gradient-to-r from-[#ff6ec7] to-[#9b5de5] border-0',
    bubbleOther: 'bg-white/10 border border-[#ff6ec7]/30',
    textOwn: 'text-white',         textOther: 'text-[#ff9ee6]',
    headerBg: 'bg-[#0d0221]/90 border-[#9b5de5]/30',
    inputBg:  'bg-[#0d0221]/90 border-[#ff6ec7]/30',
    preview: 'linear-gradient(135deg,#0d0221,#9b5de5,#ff6ec7)',
  },
  {
    id: 'cyber-blade',    name: 'Blade Runner',     category: 'Cyberpunk',
    bg: 'bg-[#0a0500]',
    bubbleOwn: 'bg-[#ff6600]/90 border border-[#ff9900]/60',
    bubbleOther: 'bg-[#1a0a00] border border-[#ff6600]/30',
    textOwn: 'text-white',         textOther: 'text-[#ff9944]',
    headerBg: 'bg-[#0a0500] border-[#ff6600]/20',
    inputBg:  'bg-[#0a0500] border-[#ff6600]/30',
    preview: 'linear-gradient(135deg,#0a0500,#3d1400,#ff660055)',
  },
  {
    id: 'cyber-glitch',   name: 'Glitch City',      category: 'Cyberpunk',
    bg: 'bg-[#05001a]',
    bubbleOwn: 'bg-gradient-to-r from-[#00d2ff] to-[#7b2ff7]',
    bubbleOther: 'bg-[#0d0033] border border-[#7b2ff7]/40',
    textOwn: 'text-white',         textOther: 'text-[#c0a0ff]',
    headerBg: 'bg-[#05001a] border-[#7b2ff7]/30',
    inputBg:  'bg-[#05001a] border-[#00d2ff]/30',
    preview: 'linear-gradient(135deg,#05001a,#7b2ff7,#00d2ff)',
  },

  // ── Classic ───────────────────────────────────────────────────────────────
  {
    id: 'classic-parchment', name: 'Parchment',     category: 'Classic',
    bg: 'bg-[#f5f0e8]',
    bubbleOwn: 'bg-[#8b5e3c] border-0',  bubbleOther: 'bg-[#e8dcc8] border border-[#c8a87a]/40',
    textOwn: 'text-white',               textOther: 'text-[#4a3520]',
    headerBg: 'bg-[#ede4d0] border-[#c8a87a]/40',
    inputBg:  'bg-[#ede4d0] border-[#c8a87a]/40',
    preview: 'linear-gradient(135deg,#f5f0e8,#e8dcc8,#8b5e3c44)',
  },
  {
    id: 'classic-monochrome', name: 'Monochrome',   category: 'Classic',
    bg: 'bg-white',
    bubbleOwn: 'bg-slate-900',           bubbleOther: 'bg-slate-100 border border-slate-200',
    textOwn: 'text-white',               textOther: 'text-slate-800',
    headerBg: 'bg-white border-slate-200',
    inputBg:  'bg-white border-slate-200',
    preview: 'linear-gradient(135deg,#ffffff,#e2e8f0,#1e293b)',
  },
  {
    id: 'classic-telegram',  name: 'Telegram Blue', category: 'Classic',
    bg: 'bg-[#dae5f5]',
    bubbleOwn: 'bg-[#2b8ce6]',           bubbleOther: 'bg-white border border-blue-100',
    textOwn: 'text-white',               textOther: 'text-slate-800',
    headerBg: 'bg-[#527da3] border-blue-400/30',
    inputBg:  'bg-white border-blue-200',
    preview: 'linear-gradient(135deg,#dae5f5,#2b8ce6)',
  },
  {
    id: 'classic-whatsapp',  name: 'WhatsApp Tone', category: 'Classic',
    bg: 'bg-[#e5ddd5]',
    bubbleOwn: 'bg-[#dcf8c6]',           bubbleOther: 'bg-white border border-green-100',
    textOwn: 'text-slate-900',           textOther: 'text-slate-800',
    headerBg: 'bg-[#075e54] border-green-900/30',
    inputBg:  'bg-white border-green-200',
    preview: 'linear-gradient(135deg,#e5ddd5,#dcf8c6,#075e54)',
  },
  {
    id: 'classic-dark',      name: 'Dark Mode',     category: 'Classic',
    bg: 'bg-slate-950',
    bubbleOwn: 'bg-slate-600',           bubbleOther: 'bg-slate-800 border border-slate-700',
    textOwn: 'text-white',               textOther: 'text-slate-200',
    headerBg: 'bg-slate-900 border-slate-800',
    inputBg:  'bg-slate-900 border-slate-800',
    preview: 'linear-gradient(135deg,#020617,#1e293b,#475569)',
  },
  {
    id: 'classic-sepia',     name: 'Sepia Ink',     category: 'Classic',
    bg: 'bg-[#fdf6e3]',
    bubbleOwn: 'bg-[#657b83]',           bubbleOther: 'bg-[#eee8d5] border border-[#93a1a1]/30',
    textOwn: 'text-white',               textOther: 'text-[#586e75]',
    headerBg: 'bg-[#fdf6e3] border-[#93a1a1]/30',
    inputBg:  'bg-[#fdf6e3] border-[#93a1a1]/30',
    preview: 'linear-gradient(135deg,#fdf6e3,#eee8d5,#657b83)',
  },

  // ── Nature ────────────────────────────────────────────────────────────────
  {
    id: 'nature-leaf',       name: 'Leaf & Sky',    category: 'Nature',
    bg: 'bg-gradient-to-b from-[#e8f5e9] to-[#e3f2fd]',
    bubbleOwn: 'bg-green-600',           bubbleOther: 'bg-white border border-green-100',
    textOwn: 'text-white',               textOther: 'text-green-900',
    headerBg: 'bg-white/80 backdrop-blur border-green-200',
    inputBg:  'bg-white/80 border-green-200',
    preview: 'linear-gradient(135deg,#e8f5e9,#a5d6a7,#e3f2fd)',
  },
  {
    id: 'nature-sunset',     name: 'Sunset Dunes',  category: 'Nature',
    bg: 'bg-gradient-to-br from-[#ffecd2] to-[#fcb69f]',
    bubbleOwn: 'bg-[#e07b39]',           bubbleOther: 'bg-white/70 border border-orange-100',
    textOwn: 'text-white',               textOther: 'text-orange-900',
    headerBg: 'bg-[#ffecd2]/80 border-orange-200',
    inputBg:  'bg-white/80 border-orange-200',
    preview: 'linear-gradient(135deg,#ffecd2,#fcb69f,#e07b39)',
  },
  {
    id: 'nature-night',      name: 'Starry Night',  category: 'Nature',
    bg: 'bg-gradient-to-b from-[#0f0c29] via-[#24243e] to-[#1a1a2e]',
    bubbleOwn: 'bg-indigo-600',          bubbleOther: 'bg-white/10 border border-indigo-500/20',
    textOwn: 'text-white',               textOther: 'text-indigo-100',
    headerBg: 'bg-[#0f0c29]/90 border-indigo-900/30',
    inputBg:  'bg-[#0f0c29]/90 border-indigo-900/30',
    preview: 'linear-gradient(135deg,#0f0c29,#24243e,#4338ca55)',
  },

  // ── Minimal ───────────────────────────────────────────────────────────────
  {
    id: 'minimal-cream',     name: 'Cream',         category: 'Minimal',
    bg: 'bg-[#faf8f5]',
    bubbleOwn: 'bg-slate-800',           bubbleOther: 'bg-[#f0ece6] border border-stone-200',
    textOwn: 'text-white',               textOther: 'text-stone-700',
    headerBg: 'bg-[#faf8f5] border-stone-200',
    inputBg:  'bg-[#faf8f5] border-stone-200',
    preview: 'linear-gradient(135deg,#faf8f5,#f0ece6,#1e293b44)',
  },
  {
    id: 'minimal-lavender',  name: 'Lavender',      category: 'Minimal',
    bg: 'bg-[#f5f0ff]',
    bubbleOwn: 'bg-violet-600',          bubbleOther: 'bg-white border border-violet-100',
    textOwn: 'text-white',               textOther: 'text-violet-900',
    headerBg: 'bg-[#f5f0ff] border-violet-100',
    inputBg:  'bg-[#f5f0ff] border-violet-200',
    preview: 'linear-gradient(135deg,#f5f0ff,#ede9fe,#7c3aed44)',
  },
];

const ChatView: React.FC = () => {
  const { users, currentUser, sendNotification } = useHRM();

  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [activeConv, setActiveConv]             = useState<Conversation | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [inputText, setInputText]               = useState('');
  const [pendingFile, setPendingFile]           = useState<UploadResult | null>(null);
  const [loadingConvs, setLoadingConvs]         = useState(true);
  const [loadingMsgs, setLoadingMsgs]           = useState(false);
  const [loadingMore, setLoadingMore]           = useState(false);
  const [hasMore, setHasMore]                   = useState(false);
  const [sending, setSending]                   = useState(false);
  const [search, setSearch]                     = useState('');
  const [showNewChat, setShowNewChat]           = useState(false);
  const [convMembers, setConvMembers]           = useState<string[]>([]);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [unreadMap, setUnreadMap]               = useState<UnreadMap>({});
  const [convCtxMenu, setConvCtxMenu]           = useState<{ x: number; y: number; conv: Conversation } | null>(null);

  // Typing indicators
  const [typingMap, setTypingMap]               = useState<TypingMap>({});
  const typingTimerRef                          = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Message editing
  const [editingMsgId, setEditingMsgId]         = useState<string | null>(null);
  const [editText, setEditText]                 = useState('');
  const [replyTo, setReplyTo]                   = useState<{ id: string; senderName: string; content?: string; fileType?: string } | null>(null);

  // Message search
  const [showSearch, setShowSearch]             = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchResults, setSearchResults]       = useState<Message[]>([]);
  const [searching, setSearching]               = useState(false);
  const searchTimerRef                          = useRef<ReturnType<typeof setTimeout> | null>(null);

  // @mention picker
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery]           = useState('');
  const [mentionCursorStart, setMentionCursorStart] = useState(0);

  // Voice notes
  const [isRecording, setIsRecording]       = useState(false);
  const [recordingSeconds, setRecordingSec] = useState(0);
  const [audioBlob, setAudioBlob]           = useState<Blob | null>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create channel (manager+)
  const [showCreateChannel, setShowCreateChannel]   = useState(false);

  // Chat background theme
  const [chatThemeId, setChatThemeId] = useState<string>(() => {
    try { return localStorage.getItem('exord-chat-theme') || 'default'; } catch { return 'default'; }
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const activeChatTheme = CHAT_THEMES.find(t => t.id === chatThemeId) || CHAT_THEMES[0];

  const applyTheme = (id: string) => {
    setChatThemeId(id);
    try { localStorage.setItem('exord-chat-theme', id); } catch {}
    setShowThemePicker(false);
  };
  const [channelName, setChannelName]               = useState('');
  const [channelPrivate, setChannelPrivate]         = useState(false);
  const [channelMembers, setChannelMembers]         = useState<string[]>([]);
  const [creatingChannel, setCreatingChannel]       = useState(false);

  const bottomRef       = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const editInputRef    = useRef<HTMLTextAreaElement>(null);
  const realtimeSub     = useRef<any>(null);
  const notifSubsRef    = useRef<Record<string, any>>({});
  const activeConvId    = useRef<string | null>(null);

  const canCreateChannel = [UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.MANAGER].includes(currentUser?.role as UserRole);
  const canCreateDeptChannel = [UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER].includes(currentUser?.role as UserRole);

  // ── Mention candidates (members of active conversation) ───────────────────
  const mentionCandidates = useMemo(() => {
    if (!activeConv || activeConv.type === 'DIRECT') return [];
    return users.filter(u => u.id !== currentUser?.id && convMembers.includes(u.id));
  }, [users, currentUser, convMembers, activeConv]);

  const filteredMentionCandidates = useMemo(() => {
    if (!mentionQuery) return mentionCandidates.slice(0, 8);
    return mentionCandidates
      .filter(u => u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      .slice(0, 8);
  }, [mentionCandidates, mentionQuery]);

  // ── Unlock audio + request browser notifications on first interaction ────
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      requestBrowserNotifications();
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    // Also request immediately in case permission was already granted
    requestBrowserNotifications();
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setLoadingConvs(true);
    const convs = await getMyConversations(currentUser.id);
    const allConvIds = convs.map(c => c.id);
    const membersMap = await batchGetConversationMembers(allConvIds);

    const enriched = convs.map(conv => {
      const members = membersMap[conv.id] || [];
      if (conv.type === 'DIRECT') {
        const otherId = members.find((id: string) => id !== currentUser.id);
        const otherUser = users.find(u => u.id === otherId);
        return { ...conv, otherUser, members };
      }
      return { ...conv, members };
    });

    setConversations(enriched);
    setLoadingConvs(false);
  }, [currentUser, users]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Auto-open DM from WorkforceView
  useEffect(() => {
    if (!currentUser) return;
    const targetId = (() => { try { return localStorage.getItem('exord-dm-target'); } catch { return null; } })();
    if (!targetId) return;
    try { localStorage.removeItem('exord-dm-target'); } catch {}
    const timer = setTimeout(() => startDM(targetId), 600);
    return () => clearTimeout(timer);
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh unread counts using v2 (RPC-backed, no row-limit bug) ─────────
  const refreshUnreadCounts = useCallback(async () => {
    if (!currentUser || !conversations.length) return;
    const counts = await getUnreadCountsV2(conversations.map(c => c.id), currentUser.id);
    setUnreadMap(prev => {
      const next = { ...counts };
      // Keep zero for currently open conversation
      if (activeConvId.current) next[activeConvId.current] = 0;
      return next;
    });
  }, [currentUser, conversations]);

  useEffect(() => { refreshUnreadCounts(); }, [refreshUnreadCounts]);

  // ── Per-conversation background notification subscriptions ───────────────
  useEffect(() => {
    if (!currentUser || !conversations.length) return;

    conversations.forEach(conv => {
      if (notifSubsRef.current[conv.id]) return;
      notifSubsRef.current[conv.id] = subscribeToMessages(conv.id, (newMsg) => {
        if (newMsg.sender_id === currentUser.id) return;

        const isActiveConv = newMsg.conversation_id === activeConvId.current;
        const tabVisible = document.visibilityState === 'visible';

        // Always play sound + show OS notification when tab is hidden OR it's a different conversation
        if (!isActiveConv || !tabVisible) {
          playNotificationSound();
          const title = conv.type === 'DIRECT'
            ? `💬 ${newMsg.sender_name}`
            : `💬 ${newMsg.sender_name} in ${conv.name || conv.department}`;
          const body = newMsg.content || '📎 Attachment';
          showBrowserNotification(title, body, 'chat');
        }

        // Always update unread count if not the active conversation
        if (!isActiveConv) {
          setUnreadMap(prev => ({
            ...prev,
            [newMsg.conversation_id]: (prev[newMsg.conversation_id] || 0) + 1,
          }));
        }

        // Re-sort conversations so most recently active floats to top
        setConversations(prev => {
          const updated = prev.map(c =>
            c.id === newMsg.conversation_id ? { ...c, updated_at: newMsg.created_at } : c
          );
          return [...updated].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
      });
    });

    const currentIds = new Set(conversations.map(c => c.id));
    Object.keys(notifSubsRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        supabase.removeChannel(notifSubsRef.current[id]);
        delete notifSubsRef.current[id];
      }
    });

    return () => {
      Object.values(notifSubsRef.current).forEach(ch => supabase.removeChannel(ch));
      notifSubsRef.current = {};
    };
  }, [currentUser, conversations]);

  // ── Typing map expiry ─────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingMap(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(k => {
          if (next[k].expiresAt < now) { delete next[k]; changed = true; }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Open a conversation ───────────────────────────────────────────────────
  const openConversation = useCallback(async (conv: Conversation) => {
    setActiveConv(conv);
    activeConvId.current = conv.id;
    setMessages([]);
    setLoadingMsgs(true);
    setMobileShowThread(true);
    setHasMore(false);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setTypingMap({});
    setEditingMsgId(null);
    setUnreadMap(prev => ({ ...prev, [conv.id]: 0 }));

    // Remove old active subscription
    if (realtimeSub.current) {
      supabase.removeChannel(realtimeSub.current);
      realtimeSub.current = null;
    }
    if (activeConvId.current) cleanupTypingChannel(conv.id);

    const msgs = await getMessages(conv.id, 50);
    setMessages(msgs);
    setHasMore(msgs.length === 50);
    setLoadingMsgs(false);
    setConvMembers((conv as any).members || []);

    // Mark as read (v2: updates last_read_at)
    if (currentUser) {
      await markConversationRead(conv.id, currentUser.id);
      setUnreadMap(prev => ({ ...prev, [conv.id]: 0 }));
    }

    // Subscribe to new messages + edits on active thread
    realtimeSub.current = subscribeToConversation(
      conv.id,
      (newMsg) => {
        // Skip own messages — already added optimistically in handleSend
        if (newMsg.sender_id === currentUser?.id) return;
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        playNotificationSound();
        if (activeConvId.current === conv.id && currentUser) {
          markConversationRead(conv.id, currentUser.id);
        }
      },
      (msgId, newContent, editedAt) => {
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, content: newContent, edited_at: editedAt } : m
        ));
      }
    );

    // Subscribe to typing indicators
    subscribeToTyping(conv.id, (userId, userName, isTyping) => {
      if (userId === currentUser?.id) return;
      setTypingMap(prev => {
        if (!isTyping) {
          const next = { ...prev }; delete next[userId]; return next;
        }
        return { ...prev, [userId]: { name: userName, expiresAt: Date.now() + 4000 } };
      });
    });
  }, [currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingMsgId) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editingMsgId]);

  // ── Load more (older) messages ────────────────────────────────────────────
  const loadMoreMessages = async () => {
    if (!activeConv || !messages.length || loadingMore) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const older = await getMessages(activeConv.id, 50, oldest);
    setMessages(prev => [...older, ...prev]);
    setHasMore(older.length === 50);
    setLoadingMore(false);
  };

  // ── Input handling with @mention + typing broadcast ───────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    // @mention detection
    const cursor = e.target.selectionStart || 0;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@([A-Za-z\s]*)$/);
    if (atMatch && activeConv && activeConv.type !== 'DIRECT') {
      setMentionQuery(atMatch[1].trim());
      setMentionCursorStart(cursor - atMatch[0].length);
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
      setMentionQuery('');
    }

    // Typing broadcast
    if (activeConv && currentUser) {
      broadcastTyping(activeConv.id, currentUser.id, currentUser.name, true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (activeConv && currentUser) {
          broadcastTyping(activeConv.id, currentUser.id, currentUser.name, false);
        }
      }, 2500);
    }
  };

  const insertMention = (user: typeof users[0]) => {
    const before = inputText.slice(0, mentionCursorStart);
    const after = inputText.slice(inputRef.current?.selectionStart || mentionCursorStart + mentionQuery.length + 1);
    setInputText(before + '@' + user.name + ' ' + after);
    setShowMentionPicker(false);
    setMentionQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!activeConv || !currentUser) return;
    if (!inputText.trim() && !pendingFile) return;

    setSending(true);
    const text = inputText.trim();
    setInputText('');
    setShowMentionPicker(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    broadcastTyping(activeConv.id, currentUser.id, currentUser.name, false);

    // Extract mentions
    const mentionIds = activeConv.type !== 'DIRECT'
      ? extractMentionIds(text, mentionCandidates)
      : [];

    const fileData = pendingFile ? {
      file_url: pendingFile.url,
      file_type: pendingFile.type as any,
      file_name: pendingFile.originalName || pendingFile.filename,
      file_size: pendingFile.size,
    } : undefined;
    setPendingFile(null);
    const replyToData = replyTo ? { ...replyTo } : undefined;
    setReplyTo(null);

    const msg = await sendMessage(activeConv.id, currentUser.id, currentUser.name, text || undefined, fileData, mentionIds, replyToData);
    if (msg) setMessages(prev => [...prev, msg]);

    // Notify @mentioned users
    if (mentionIds.length) {
      const convTitle = activeConv.name || activeConv.department || 'a channel';
      for (const uid of mentionIds) {
        if (uid !== currentUser.id) {
          sendNotification(
            uid,
            `${currentUser.name} mentioned you in ${convTitle}`,
            text ? text.slice(0, 100) : '📎 Attachment',
            'SYSTEM',
            { type: 'MENTION', convId: activeConv.id }
          ).catch(() => {});
        }
      }
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPicker && (e.key === 'Escape')) {
      setShowMentionPicker(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Message editing ───────────────────────────────────────────────────────
  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditText(msg.content || '');
  };

  const cancelEdit = () => { setEditingMsgId(null); setEditText(''); };

  const saveEdit = async () => {
    if (!editingMsgId || !currentUser || !editText.trim()) return;
    const ok = await editMessage(editingMsgId, editText.trim(), currentUser.id);
    if (ok) {
      setMessages(prev => prev.map(m =>
        m.id === editingMsgId ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m
      ));
    }
    cancelEdit();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  // ── Delete message ────────────────────────────────────────────────────────
  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser) return;
    const ok = await deleteMessage(msgId, currentUser.id);
    if (ok) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true } : m));
  };

  // ── Message search ────────────────────────────────────────────────────────
  const handleSearchQueryChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      if (!activeConv) return;
      const results = await searchMessages(activeConv.id, val);
      setSearchResults(results);
      setSearching(false);
    }, 400);
  };

  // ── Delete conversation for me only ──────────────────────────────────────
  const handleDeleteConversationForMe = async (conv: Conversation) => {
    if (!currentUser) return;
    const ok = await hideConversationForMe(conv.id, currentUser.id);
    if (ok) {
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (activeConv?.id === conv.id) {
        setActiveConv(null);
        setMessages([]);
        setMobileShowThread(false);
      }
    }
    setConvCtxMenu(null);
  };

  // ── Conversation long-press / right-click ─────────────────────────────────
  const convLongPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleConvTouchStart = (e: React.TouchEvent, conv: Conversation) => {
    const touch = e.touches[0];
    convLongPressTimers.current[conv.id] = setTimeout(() => {
      if ('vibrate' in navigator) navigator.vibrate(30);
      setConvCtxMenu({ x: touch.clientX, y: touch.clientY, conv });
    }, 500);
  };

  const handleConvTouchEnd = (convId: string) => {
    if (convLongPressTimers.current[convId]) {
      clearTimeout(convLongPressTimers.current[convId]);
      delete convLongPressTimers.current[convId];
    }
  };

  const handleConvContextMenu = (e: React.MouseEvent, conv: Conversation) => {
    e.preventDefault();
    setConvCtxMenu({ x: e.clientX, y: e.clientY, conv });
  };

  // ── Start DM ──────────────────────────────────────────────────────────────
  const startDM = async (targetUserId: string) => {
    if (!currentUser) return;
    setShowNewChat(false);
    setLoadingMsgs(true);
    const convId = await getOrCreateDirectConversation(currentUser.id, targetUserId);
    if (!convId) { setLoadingMsgs(false); return; }
    await loadConversations();
    const targetUser = users.find(u => u.id === targetUserId);
    openConversation({
      id: convId, type: 'DIRECT',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      otherUser: targetUser, members: [currentUser.id, targetUserId],
    });
  };

  // ── Start department channel ──────────────────────────────────────────────
  const startDeptChannel = async (dept: string) => {
    if (!currentUser) return;
    setShowNewChat(false);
    const deptMembers = users.filter(u => u.department === dept).map(u => u.id);
    const convId = await getOrCreateDepartmentConversation(dept, deptMembers);
    if (!convId) return;
    await loadConversations();
    openConversation({
      id: convId, type: 'DEPARTMENT', department: dept, name: `${dept} Channel`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      members: deptMembers,
    });
  };

  // ── Create custom channel ─────────────────────────────────────────────────
  const handleCreateChannel = async () => {
    if (!currentUser || !channelName.trim()) return;
    setCreatingChannel(true);
    const convId = await createCustomChannel(channelName.trim(), channelPrivate, currentUser.id, channelMembers);
    if (convId) {
      setShowCreateChannel(false);
      setChannelName(''); setChannelPrivate(false); setChannelMembers([]);
      await loadConversations();
      openConversation({
        id: convId, type: 'CUSTOM', name: channelName.trim(), is_private: channelPrivate,
        created_by: currentUser.id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        members: [...new Set([currentUser.id, ...channelMembers])],
      });
    }
    setCreatingChannel(false);
  };

  // ── Filtered conversations ────────────────────────────────────────────────
  // ── Voice notes ───────────────────────────────────────────────────────────
  const fmtRecSecs = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      // iOS Safari only supports audio/mp4 — check it first
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(250); // collect in 250ms chunks — important for mobile
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSec(0);
      recordingTimerRef.current = setInterval(() => setRecordingSec(s => s + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone in your browser settings.');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;

    // Wrap onstop in a promise so audioBlob state is set before UI re-renders
    mr.onstop = () => {
      const chunks = audioChunksRef.current;
      if (chunks.length === 0) return;
      const mimeType = mr.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      setAudioBlob(blob);
      mr.stream?.getTracks().forEach(t => t.stop());
    };
    mr.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingSec(0);
  };

  const sendVoiceNote = async () => {
    // Use audioBlob state OR reconstruct from chunks ref if state hasn't updated yet
    const blob = audioBlob || (audioChunksRef.current.length > 0
      ? new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' })
      : null);
    if (!blob || !activeConv || !currentUser) return;
    setSending(true);
    try {
      const mimeType = blob.type || 'audio/webm';
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
      const result = await uploadChatFile(file, activeConv.id);
      if (result) {
        const msg = await sendMessage(
          activeConv.id, currentUser.id, currentUser.name,
          undefined,
          { file_url: result.url, file_type: 'audio' as any, file_name: file.name, file_size: file.size }
        );
        if (msg) setMessages(prev => [...prev, msg]);
      }
    } catch (err: any) {
      console.error('[VoiceNote] Send failed:', err);
      alert('Failed to send voice note: ' + (err?.message || 'Unknown error'));
    }
    audioChunksRef.current = [];
    setAudioBlob(null);
    setRecordingSec(0);
    setSending(false);
  };

  const filteredConvs = useMemo(() => {
    if (!search) return conversations;
    return conversations.filter(conv => {
      const name = conv.type === 'DIRECT'
        ? conv.otherUser?.name || '' : conv.name || conv.department || '';
      return name.toLowerCase().includes(search.toLowerCase());
    });
  }, [conversations, search]);

  const dmTargets = useMemo(() => users.filter(u => u.id !== currentUser?.id), [users, currentUser]);
  const departments = useMemo(() => [...new Set(users.map(u => u.department).filter(Boolean))], [users]);

  const getConvTitle = (conv: Conversation) => {
    if (conv.type === 'DIRECT') return conv.otherUser?.name || 'Direct Message';
    return conv.name || conv.department || 'Channel';
  };

  const getConvSubtitle = (conv: Conversation) => {
    if (conv.type === 'DIRECT') return 'Direct Message';
    if (conv.type === 'CUSTOM') return conv.is_private ? '🔒 Private Channel' : '🌐 Public Channel';
    return `# ${conv.department}`;
  };

  const getConvAvatar = (conv: Conversation) => {
    if (conv.type === 'DIRECT') {
      const avatar = conv.otherUser?.avatar;
      if (avatar) return <img src={avatar} alt="" className="w-full h-full object-cover" />;
      return <span className="font-black text-sm">{conv.otherUser?.name?.charAt(0) || '?'}</span>;
    }
    return <Hash size={18} />;
  };

  const typingList = Object.values(typingMap);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    {/* ── Conversation context menu (delete for me) ─────────────────────── */}
    {convCtxMenu && (
      <>
        <div className="fixed inset-0 z-[290]" onClick={() => setConvCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setConvCtxMenu(null); }} />
        <div
          className="fixed z-[300] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden w-52 animate-[fadeIn_0.12s_ease-out]"
          style={{ top: convCtxMenu.y, left: convCtxMenu.x }}
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs font-black text-slate-800 dark:text-white truncate">{getConvTitle(convCtxMenu.conv)}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{convCtxMenu.conv.type === 'DIRECT' ? 'Direct Message' : convCtxMenu.conv.type}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => handleDeleteConversationForMe(convCtxMenu.conv)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:bg-red-100"
            >
              <Trash2 size={16} /> Delete for me
            </button>
          </div>
        </div>
      </>
    )}
    <div className="flex bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden soft-shadow animate-[fadeIn_0.5s_ease-out]"
      style={{ height: 'calc(100dvh - 7rem)', minHeight: 300 }}
    >

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className={`w-full lg:w-80 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col ${mobileShowThread ? 'hidden lg:flex' : 'flex'}`}>

        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Messages</h2>
            <div className="flex items-center gap-1.5">
              {canCreateChannel && (
                <button
                  onClick={() => { setShowCreateChannel(true); setShowNewChat(false); }}
                  className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#E31E24] hover:text-white transition-all"
                  title="Create channel"
                >
                  <Users size={15} />
                </button>
              )}
              <button
                onClick={() => { setShowNewChat(v => !v); setShowCreateChannel(false); }}
                className={`p-2.5 rounded-2xl transition-all ${showNewChat ? 'bg-[#E31E24] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#E31E24] hover:text-white'}`}
                title="New conversation"
              >
                {showNewChat ? <X size={16} /> : <Plus size={16} />}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search conversations..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] transition-all" />
          </div>
        </div>

        {/* Create channel panel */}
        {showCreateChannel && (
          <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">New Channel</p>
            <input
              type="text"
              placeholder="Channel name..."
              value={channelName}
              onChange={e => setChannelName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setChannelPrivate(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase border-2 transition-all ${!channelPrivate ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
              >
                <Globe size={12} /> Public
              </button>
              <button
                onClick={() => setChannelPrivate(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase border-2 transition-all ${channelPrivate ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
              >
                <Lock size={12} /> Private
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Add members</p>
              {dmTargets.map(u => (
                <label key={u.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={channelMembers.includes(u.id)}
                    onChange={e => {
                      if (e.target.checked) setChannelMembers(p => [...p, u.id]);
                      else setChannelMembers(p => p.filter(id => id !== u.id));
                    }}
                    className="accent-[#E31E24]"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{u.name}</span>
                  <span className="text-[9px] text-slate-400 ml-auto">{(u as any).designation || u.role}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreateChannel(false)}
                className="flex-1 py-2 text-[11px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-all">
                Cancel
              </button>
              <button onClick={handleCreateChannel} disabled={!channelName.trim() || creatingChannel}
                className="flex-[2] py-2 text-[11px] font-black uppercase text-white bg-[#E31E24] rounded-xl hover:bg-[#C41217] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {creatingChannel ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Create
              </button>
            </div>
          </div>
        )}

        {/* New chat panel */}
        {showNewChat && (
          <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Direct Message</p>
            {dmTargets.map(u => (
              <button key={u.id} onClick={() => startDM(u.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-700 transition-all text-left">
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-600 dark:text-slate-300 flex-shrink-0 overflow-hidden">
                  {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">{(u as any).designation || u.role}</p>
                </div>
              </button>
            ))}
            {canCreateDeptChannel && (
              <>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 pt-2">Department Channels</p>
                {departments.map(dept => (
                  <button key={dept} onClick={() => startDeptChannel(dept)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-700 transition-all text-left">
                    <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 text-[#E31E24] flex items-center justify-center flex-shrink-0">
                      <Hash size={14} />
                    </div>
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{dept}</p>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          {loadingConvs && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[#E31E24]" />
            </div>
          )}
          {!loadingConvs && filteredConvs.length === 0 && (
            <div className="text-center py-16 px-6">
              <MessageSquare size={32} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-xs text-slate-400 font-bold">No conversations yet.</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Click + to start a new chat.</p>
            </div>
          )}
          {filteredConvs.map(conv => {
            const unreadCount = unreadMap[conv.id] || 0;
            return (
              <button key={conv.id}
                onClick={() => { unlockAudio(); openConversation(conv); }}
                onTouchStart={e => handleConvTouchStart(e, conv)}
                onTouchEnd={() => handleConvTouchEnd(conv.id)}
                onTouchMove={() => handleConvTouchEnd(conv.id)}
                onContextMenu={e => handleConvContextMenu(e, conv)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 ${activeConv?.id === conv.id ? 'bg-red-50 dark:bg-red-900/10 border-r-2 border-[#E31E24]' : ''}`}>
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden font-black text-sm ${conv.type !== 'DIRECT' ? 'bg-red-50 dark:bg-red-900/20 text-[#E31E24]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {getConvAvatar(conv)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className={`text-sm truncate ${unreadCount > 0 ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
                      {getConvTitle(conv)}
                    </p>
                    {conv.is_private && <Lock size={10} className="text-slate-400 flex-shrink-0" />}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate">
                    {getConvSubtitle(conv)}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-[#E31E24] text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className={`flex-1 min-w-0 flex flex-col overflow-hidden ${mobileShowThread ? 'flex' : 'hidden lg:flex'}`}>
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 rounded-[2rem] bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
              <MessageSquare size={36} className="text-[#E31E24]" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Select a conversation</h3>
            <p className="text-sm text-slate-400 font-medium max-w-xs">Choose from the list on the left, or start a new conversation.</p>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button onClick={() => setMobileShowThread(false)} className="lg:hidden p-2 text-slate-400 hover:text-[#E31E24] transition-colors flex-shrink-0">
                <ChevronLeft size={20} />
              </button>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 overflow-hidden ${activeConv.type !== 'DIRECT' ? 'bg-red-50 dark:bg-red-900/20 text-[#E31E24]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                {getConvAvatar(activeConv)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm truncate">{getConvTitle(activeConv)}</h3>
                  {activeConv.is_private && <Lock size={11} className="text-slate-400 flex-shrink-0" />}
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                  {activeConv.type === 'DIRECT' ? (activeConv.otherUser?.department || 'Direct Message') : `${convMembers.length} members`}
                </p>
              </div>

              {/* Search toggle */}
              <button
                onClick={() => { setShowSearch(v => !v); if (showSearch) { setSearchQuery(''); setSearchResults([]); } }}
                className={`flex-shrink-0 p-2.5 rounded-2xl transition-all ${showSearch ? 'bg-[#E31E24] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#E31E24] hover:text-white'}`}
                title="Search messages"
              >
                <Search size={15} />
              </button>

              {/* Theme picker toggle */}
              <button
                onClick={() => setShowThemePicker(v => !v)}
                className={`flex-shrink-0 p-2.5 rounded-2xl transition-all ${showThemePicker ? 'bg-[#E31E24] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#E31E24] hover:text-white'}`}
                title="Chat background theme"
              >
                <Palette size={15} />
              </button>
            </div>

            {/* Message search bar */}
            {showSearch && (
              <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />}
                  <input type="text" placeholder="Search messages in this conversation..." value={searchQuery}
                    onChange={e => handleSearchQueryChange(e.target.value)} autoFocus
                    className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] transition-all" />
                </div>
                {searchQuery && (
                  <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                    {searchResults.length === 0 && !searching && (
                      <p className="text-[11px] text-slate-400 font-bold text-center py-4">No results for "{searchQuery}"</p>
                    )}
                    {searchResults.map(msg => (
                      <div key={msg.id} className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <p className="text-[10px] font-black text-slate-500 mb-1">{msg.sender_name} · {new Date(msg.created_at).toLocaleString()}</p>
                        <p className="text-xs text-slate-800 dark:text-slate-200">
                          {msg.content?.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === searchQuery.toLowerCase()
                              ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-yellow-200 rounded px-0.5">{part}</mark>
                              : part
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Theme picker panel */}
            {showThemePicker && (
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-72 overflow-y-auto custom-scrollbar flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Palette size={11} /> Chat Background Theme
                  </p>
                  {chatThemeId !== 'default' && (
                    <button onClick={() => applyTheme('default')} className="text-[9px] font-black uppercase tracking-widest text-[#E31E24] hover:underline">
                      Reset Default
                    </button>
                  )}
                </div>
                {(['Default','Modern','Cyberpunk','Classic','Nature','Minimal'] as const).map(cat => {
                  const catThemes = CHAT_THEMES.filter(t => t.category === cat);
                  return (
                    <div key={cat} className="mb-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 mb-2">{cat}</p>
                      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                        {catThemes.map(t => (
                          <button key={t.id} onClick={() => applyTheme(t.id)} title={t.name}
                            className={`relative h-10 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${chatThemeId === t.id ? 'border-[#E31E24] shadow-lg ring-2 ring-[#E31E24]/30' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                            style={{ background: t.preview }}>
                            {chatThemeId === t.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="w-4 h-4 bg-white rounded-full shadow flex items-center justify-center">
                                  <div className="w-2 h-2 bg-[#E31E24] rounded-full" />
                                </div>
                              </div>
                            )}
                            <span className="absolute bottom-0 left-0 right-0 text-[7px] font-black text-white bg-black/40 px-0.5 py-0.5 truncate text-center leading-tight">
                              {t.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-4 transition-colors duration-300 ${activeChatTheme.bg}`}>
              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mb-4">
                  <button onClick={loadMoreMessages} disabled={loadingMore}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                    {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                    Load older messages
                  </button>
                </div>
              )}

              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-[#E31E24]" /></div>
              ) : messages.filter(m => !m.is_deleted).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <MessageSquare size={28} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm font-black text-slate-400">No messages yet.</p>
                  <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">Send the first message!</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isOwn = msg.sender_id === currentUser?.id;
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const showSender = activeConv.type !== 'DIRECT' && !isOwn && msg.sender_id !== prevMsg?.sender_id;

                    // Render edit mode inline
                    if (editingMsgId === msg.id && isOwn) {
                      return (
                        <div key={msg.id} className="flex justify-end mb-3">
                          <div className="max-w-[80%] w-full">
                            <textarea ref={editInputRef} value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={handleEditKeyDown} rows={2}
                              className="w-full px-4 py-3 text-sm bg-white dark:bg-slate-800 border-2 border-[#E31E24] rounded-2xl text-slate-900 dark:text-white resize-none focus:outline-none custom-scrollbar" />
                            <div className="flex items-center justify-end gap-2 mt-1.5">
                              <span className="text-[9px] text-slate-400 font-bold">Enter to save · Esc to cancel</span>
                              <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                              <button onClick={saveEdit} disabled={!editText.trim()} className="p-1.5 bg-[#E31E24] text-white rounded-lg disabled:opacity-50 hover:bg-[#C41217] transition-all"><Check size={14} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <MessageBubble key={msg.id} message={msg} isOwn={isOwn}
                        onDelete={isOwn ? handleDeleteMessage : undefined}
                        onEdit={isOwn && !msg.is_deleted ? startEdit : undefined}
                        onReply={(m) => {
                          setReplyTo({
                            id: m.id,
                            senderName: m.sender_name,
                            content: m.content,
                            fileType: m.file_type,
                          });
                          inputRef.current?.focus();
                        }}
                        showSender={showSender}
                        bubbleOwnCls={activeChatTheme.bubbleOwn}
                        bubbleOtherCls={activeChatTheme.bubbleOther}
                        textOwnCls={activeChatTheme.textOwn}
                        textOtherCls={activeChatTheme.textOther}
                      />
                    );
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Typing indicator */}
            {typingList.length > 0 && (
              <div className="px-4 sm:px-6 py-1.5 flex-shrink-0">
                <p className="text-[11px] text-slate-400 font-bold italic">
                  {typingList.length === 1
                    ? `${(typingList as Array<{name:string}>)[0].name} is typing...`
                    : typingList.length === 2
                    ? `${(typingList as Array<{name:string}>)[0].name} and ${(typingList as Array<{name:string}>)[1].name} are typing...`
                    : `${typingList.length} people are typing...`}
                </p>
              </div>
            )}

            {/* Pending file preview */}
            {pendingFile && (
              <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-[#E31E24]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-black text-[#E31E24] uppercase">{pendingFile.type.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 dark:text-white truncate">{pendingFile.originalName || pendingFile.filename}</p>
                  <p className="text-[10px] text-slate-400">{(pendingFile.size / 1024).toFixed(1)} KB · Ready to send</p>
                </div>
                <button onClick={() => setPendingFile(null)} className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"><X size={14} /></button>
              </div>
            )}

            {/* Reply preview bar */}
            {replyTo && (
              <div className="mx-3 sm:mx-4 mb-1 flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-l-4 border-[#E31E24] rounded-r-2xl">
                <CornerUpLeft size={14} className="text-[#E31E24] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-[#E31E24] uppercase tracking-widest truncate">
                    Replying to {replyTo.senderName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {replyTo.fileType ? `📎 ${replyTo.fileType}` : replyTo.content || ''}
                  </p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className={`px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t flex-shrink-0 relative transition-colors duration-300 ${activeChatTheme.inputBg || 'border-slate-100 dark:border-slate-800'}`}>
              {/* @mention picker */}
              {showMentionPicker && filteredMentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-3 sm:left-4 right-3 sm:right-4 mb-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2.5 pb-1">Mention a member</p>
                  {filteredMentionCandidates.map(u => (
                    <button key={u.id} onClick={() => insertMention(u)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                      <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-[11px] text-slate-600 dark:text-slate-300 flex-shrink-0 overflow-hidden">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0)}
                      </div>
                      <span className="text-xs font-black text-slate-800 dark:text-white">{u.name}</span>
                      <span className="text-[9px] text-slate-400 ml-auto font-bold uppercase">{(u as any).designation || u.role}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Voice note preview — shown after recording stops */}
              {audioBlob && !isRecording && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-2xl">
                  <audio controls src={URL.createObjectURL(audioBlob)} className="flex-1 h-9" style={{ minWidth: 0 }} />
                  <button onClick={cancelRecording} title="Cancel"
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0">
                    <X size={16} />
                  </button>
                  <button onClick={sendVoiceNote} disabled={sending} title="Send voice note"
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#E31E24] text-white text-xs font-black rounded-xl hover:bg-[#C41217] disabled:opacity-50 active:scale-95 transition-all flex-shrink-0">
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Send
                  </button>
                </div>
              )}

              {/* Main input row */}
              <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl px-2 py-2 focus-within:border-[#E31E24] transition-all">
                {isRecording ? (
                  /* ── Recording active ── */
                  <>
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse flex-shrink-0 self-center ml-1" />
                    <span className="flex-1 text-sm font-black text-red-600 py-2.5 px-1 select-none tabular-nums">
                      ● {fmtRecSecs(recordingSeconds)}
                    </span>
                    {/* Cancel */}
                    <button type="button"
                      onClick={cancelRecording}
                      className="p-3 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 active:scale-95 transition-all flex-shrink-0">
                      <X size={18} />
                    </button>
                    {/* Stop & preview */}
                    <button type="button"
                      onClick={stopRecording}
                      className="p-3 rounded-2xl bg-[#E31E24] text-white hover:bg-[#C41217] active:scale-95 transition-all flex-shrink-0">
                      <StopCircle size={18} />
                    </button>
                  </>
                ) : (
                  /* ── Normal input ── */
                  <>
                    <FileUploadButton convId={activeConv.id} onUpload={result => setPendingFile(result)} disabled={sending} />
                    <textarea ref={inputRef} value={inputText}
                      onChange={handleInputChange}
                      onFocus={unlockAudio}
                      onKeyDown={handleKeyDown}
                      placeholder={activeConv.type !== 'DIRECT' ? 'Message... (@ to mention)' : 'Type a message...'}
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 resize-none py-2.5 px-1 focus:outline-none max-h-32 overflow-y-auto custom-scrollbar"
                      style={{ minHeight: 40 }}
                      disabled={sending}
                    />
                    {/* Mic — tap once to start recording (mobile-safe onClick) */}
                    {!inputText.trim() && !pendingFile && !audioBlob && (
                      <button type="button"
                        onClick={() => { unlockAudio(); startRecording(); }}
                        disabled={sending}
                        className="p-3 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-[#E31E24] active:scale-95 transition-all flex-shrink-0"
                        title="Record voice note">
                        <Mic size={18} />
                      </button>
                    )}
                    {/* Send — shown when text/file is ready */}
                    {(inputText.trim() || pendingFile) && (
                      <button type="button"
                        onClick={() => { unlockAudio(); handleSend(); }}
                        disabled={sending}
                        className="p-3 rounded-2xl bg-[#E31E24] text-white shadow-lg shadow-red-200 dark:shadow-red-900/30 hover:bg-[#C41217] active:scale-95 transition-all flex-shrink-0">
                        {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-[9px] text-slate-300 dark:text-slate-700 text-center mt-1.5 font-bold uppercase tracking-wider">
                {isRecording ? 'Tap ■ to preview · Tap ✕ to cancel' : 'Enter to send · Shift+Enter for newline · 🎤 voice note'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default ChatView;

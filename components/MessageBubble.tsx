/**
 * MessageBubble.tsx — Exord Online HRM v2
 * Mobile-first redesign:
 *  - Long press (mobile) or right-click (desktop) → context menu
 *  - Context menu: Edit, Delete, React (emoji), Copy
 *  - No hover-only buttons (works on touch screens)
 *  - Image lightbox, audio/video/file rendering unchanged
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '../chatService';
import { formatFileSize } from '../fileService';
import {
  Trash2, Download, FileText, Music, Film,
  Image as ImageIcon, X, ZoomIn, Edit2, Copy, Smile, CornerUpLeft,
} from 'lucide-react';

interface Props {
  message: Message;
  isOwn: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (message: Message) => void;
  onReply?: (message: Message) => void;
  showSender?: boolean;
  // Chat theme classes — optional, fall back to defaults
  bubbleOwnCls?: string;
  bubbleOtherCls?: string;
  textOwnCls?: string;
  textOtherCls?: string;
}

// ── Emoji reactions set ───────────────────────────────────────────────────────
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ── Image lightbox ─────────────────────────────────────────────────────────────
const ImageLightbox: React.FC<{ url: string; name?: string; onClose: () => void }> = ({ url, name, onClose }) => {
  // Render into document.body via portal so it is completely outside
  // the bubble's event tree — prevents any touch events from leaking back
  const el = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)' }}
      onTouchStart={e => { e.stopPropagation(); e.preventDefault(); }}
      onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onClose(); }}
      onTouchMove={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClose(); }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* X button — stops propagation so closing overlay click doesn't double-fire */}
      <button
        type="button"
        style={{ position: 'absolute', top: 20, right: 20, zIndex: 10000, padding: 10, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onTouchStart={e => { e.stopPropagation(); e.preventDefault(); }}
        onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onClose(); }}
        onClick={e => { e.stopPropagation(); onClose(); }}
      >
        <X size={22} color="white" />
      </button>
      {/* Download */}
      <a
        href={url} download={name}
        style={{ position: 'absolute', top: 20, right: 70, zIndex: 10000, padding: 10, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        title="Download"
      >
        <Download size={22} color="white" />
      </a>
      {/* Image — tapping image should NOT close */}
      <img
        src={url} alt={name || 'image'}
        style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      />
      {name && (
        <p style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 'bold', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
      )}
    </div>
  );
  return createPortal(el, document.body);
};

// ── Context menu ───────────────────────────────────────────────────────────────
interface ContextMenuProps {
  isOwn: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOwn, canEdit, onEdit, onDelete, onCopy, onReply, onReact, onClose, position
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Adjust position so menu doesn't go off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (rect.right > vw) menuRef.current.style.left = `${vw - rect.width - 8}px`;
      if (rect.bottom > vh) menuRef.current.style.top = `${vh - rect.height - 8}px`;
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    // Small delay so the long-press touchend doesn't immediately close
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[300] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden w-52 animate-[fadeIn_0.12s_ease-out]"
      style={{ top: position.y, left: position.x }}
      onClick={e => e.stopPropagation()}
    >
      {/* Emoji reactions row */}
      <div className="flex items-center justify-around px-3 py-3 border-b border-slate-100 dark:border-slate-700">
        {QUICK_EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => { onReact(emoji); onClose(); }}
            className="text-xl hover:scale-125 active:scale-110 transition-transform leading-none p-1">
            {emoji}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="py-1">
        <button onClick={() => { onCopy(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:bg-slate-100 dark:active:bg-slate-600">
          <Copy size={16} className="text-slate-400" /> Copy text
        </button>

        <button onClick={() => { onReply(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:bg-slate-100 dark:active:bg-slate-600">
          <CornerUpLeft size={16} className="text-emerald-500" /> Reply
        </button>

        {canEdit && (
          <button onClick={() => { onEdit(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:bg-slate-100 dark:active:bg-slate-600">
            <Edit2 size={16} className="text-blue-500" /> Edit message
          </button>
        )}

        {isOwn && (
          <button onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:bg-red-100">
            <Trash2 size={16} /> Delete message
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const MessageBubble: React.FC<Props> = ({
  message, isOwn, onDelete, onEdit, onReply, showSender = true,
  bubbleOwnCls, bubbleOtherCls, textOwnCls, textOtherCls,
}) => {
  const [imgError, setImgError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightboxJustClosed = React.useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);

  // Long press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTriggered.current = false;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      // Vibrate on supported devices
      if ('vibrate' in navigator) navigator.vibrate(30);
      openContextMenu(touch.clientX, touch.clientY);
    }, 500);
  }, [openContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if finger moves
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Desktop right-click
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY);
  }, [openContextMenu]);

  const handleReact = useCallback((emoji: string) => {
    setReactions(prev => {
      const next = { ...prev };
      // Toggle: if same emoji, remove it
      if (myReaction === emoji) {
        next[emoji] = Math.max(0, (next[emoji] || 1) - 1);
        if (next[emoji] === 0) delete next[emoji];
        setMyReaction(null);
      } else {
        // Remove old reaction
        if (myReaction) {
          next[myReaction] = Math.max(0, (next[myReaction] || 1) - 1);
          if (next[myReaction] === 0) delete next[myReaction];
        }
        next[emoji] = (next[emoji] || 0) + 1;
        setMyReaction(emoji);
      }
      return next;
    });
  }, [myReaction]);

  const handleCopy = useCallback(() => {
    if (message.content) {
      navigator.clipboard?.writeText(message.content).catch(() => {});
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1500);
    }
  }, [message.content]);

  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  if (message.is_deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
        <span className="text-xs text-slate-400 dark:text-slate-600 italic px-4 py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          This message was deleted.
        </span>
      </div>
    );
  }

  const renderFile = () => {
    if (!message.file_url) return null;

    if (message.file_type === 'image' && !imgError) {
      return (
        <>
          <div
            className="mt-2 rounded-2xl overflow-hidden w-full relative group/img cursor-zoom-in"
            onTouchEnd={e => { e.stopPropagation(); if (!lightboxJustClosed.current) { setLightboxOpen(true); } }}
            onClick={e => { e.stopPropagation(); if (!lightboxJustClosed.current) { setLightboxOpen(true); } }}
          >
            <img src={message.file_url} alt={message.file_name || 'image'}
              className="w-full object-cover hover:opacity-95 transition-opacity"
              onError={() => setImgError(true)} />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/20 rounded-2xl">
              <div className="p-2 bg-black/40 rounded-full"><ZoomIn size={18} className="text-white" /></div>
            </div>
          </div>
        </>
      );
    }

    if (message.file_type === 'video') {
      return (
        <div className="mt-2 rounded-2xl overflow-hidden w-full">
          <video controls className="w-full rounded-2xl" style={{ maxHeight: 240 }}>
            <source src={message.file_url} />
          </video>
        </div>
      );
    }

    if (message.file_type === 'audio') {
      return (
        <div
          className={`mt-2 rounded-2xl overflow-hidden ${isOwn ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}
          style={{ width: '100%', maxWidth: '100%' }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <div className={`p-1.5 rounded-xl flex-shrink-0 ${isOwn ? 'bg-white/30' : 'bg-[#E31E24]/10'}`}>
              <Music size={14} className={isOwn ? 'text-white' : 'text-[#E31E24]'} />
            </div>
            <p className={`text-xs font-bold truncate flex-1 min-w-0 ${isOwn ? 'text-white/90' : 'text-slate-700 dark:text-slate-300'}`}>
              {message.file_name || 'Voice note'}
            </p>
          </div>
          {/* Native audio in its own full-width row so it never pushes siblings */}
          <div style={{ width: '100%', padding: '0 8px 8px 8px', boxSizing: 'border-box' }}>
            <audio
              controls
              style={{ width: '100%', height: 36, display: 'block', minWidth: 0 }}
            >
              <source src={message.file_url} />
            </audio>
          </div>
        </div>
      );
    }

    const Icon = imgError ? ImageIcon : message.file_type === 'video' ? Film : message.file_type === 'audio' ? Music : FileText;
    return (
      <a href={message.file_url} target="_blank" rel="noopener noreferrer" download={message.file_name}
        className={`mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl transition-opacity hover:opacity-80 ${isOwn ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}
        onClick={e => e.stopPropagation()}>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${isOwn ? 'bg-white/30' : 'bg-[#E31E24]/10'}`}>
          <Icon size={18} className={isOwn ? 'text-white' : 'text-[#E31E24]'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isOwn ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
            {message.file_name || 'File'}
          </p>
          <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>
            {message.file_size ? formatFileSize(message.file_size) : ''}
          </p>
        </div>
        <Download size={14} className={isOwn ? 'text-white/70' : 'text-slate-400'} />
      </a>
    );
  };

  return (
    <>
      {/* Image lightbox — rendered via portal completely outside bubble event tree */}
      {lightboxOpen && message.file_type === 'image' && message.file_url && (
        <ImageLightbox
          url={message.file_url}
          name={message.file_name}
          onClose={() => {
            lightboxJustClosed.current = true;
            setLightboxOpen(false);
            setTimeout(() => { lightboxJustClosed.current = false; }, 800);
          }}
        />
      )}

      {/* Context menu portal */}
      {contextMenu && (
        <ContextMenu
          isOwn={isOwn}
          canEdit={!!onEdit && !message.is_deleted}
          onEdit={() => onEdit && onEdit(message)}
          onDelete={() => onDelete && onDelete(message.id)}
          onCopy={handleCopy}
          onReply={() => onReply && onReply(message)}
          onReact={handleReact}
          onClose={() => setContextMenu(null)}
          position={contextMenu}
        />
      )}

      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 px-1 w-full min-w-0`}>
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} min-w-0 overflow-hidden`} style={{ maxWidth: '75vw' }}>
          {showSender && !isOwn && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-2">
              {message.sender_name}
            </p>
          )}

          {/* Bubble — long press / right-click to open context menu */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={handleContextMenu}
            className={`
              relative select-none px-4 py-2.5 rounded-3xl cursor-pointer w-full min-w-0 overflow-hidden
              active:scale-[0.98] transition-transform
              ${isOwn
                ? (bubbleOwnCls  || 'bg-[#E31E24] text-white') + ' rounded-br-md'
                : (bubbleOtherCls || 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700') + ' rounded-bl-md'
              }
              ${isOwn ? (textOwnCls || '') : (textOtherCls || 'text-slate-800 dark:text-white')}
              ${copyFlash ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
            `}
          >
            {/* Quoted reply preview */}
            {message.reply_to_id && (
              <div className={`mb-2 px-3 py-2 rounded-2xl border-l-4 border-white/40 ${
                isOwn ? 'bg-black/20' : 'bg-slate-100 dark:bg-slate-700 border-[#E31E24]'
              }`}>
                <p className={`text-[10px] font-black uppercase tracking-widest truncate ${
                  isOwn ? 'text-white/70' : 'text-[#E31E24]'
                }`}>
                  {message.reply_to_sender_name}
                </p>
                <p className={`text-xs truncate mt-0.5 ${
                  isOwn ? 'text-white/60' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {message.reply_to_file_type
                    ? `📎 ${message.reply_to_file_type}`
                    : message.reply_to_content || ''}
                </p>
              </div>
            )}

            {message.content && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
            {renderFile()}

            {/* Emoji reactions — inside bubble, always bounded */}
            {Object.keys(reactions).length > 0 && (
              <div
                className={`flex flex-wrap gap-1 mt-2 -mx-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {Object.entries(reactions).map(([emoji, count]) =>
                  Number(count) > 0 ? (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold border touch-manipulation active:scale-95 transition-all
                        ${myReaction === emoji
                          ? isOwn
                            ? 'bg-white/30 border-white/50 text-white'
                            : 'bg-[#E31E24]/10 border-[#E31E24]/40 text-[#E31E24]'
                          : isOwn
                            ? 'bg-white/15 border-white/20 text-white/80'
                            : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                      <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
                      {Number(count) > 1 && <span className="ml-0.5 tabular-nums">{count}</span>}
                    </button>
                  ) : null
                )}
              </div>
            )}

            {/* Time + edited */}
            <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {message.edited_at && (
                <span className={`text-[9px] italic font-bold ${isOwn ? 'text-white/50' : 'text-slate-400'}`}>
                  edited
                </span>
              )}
              <span className={`text-[9px] font-bold ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>
                {time}
              </span>
            </div>
          </div>


        </div>
      </div>
    </>
  );
};

export default MessageBubble;

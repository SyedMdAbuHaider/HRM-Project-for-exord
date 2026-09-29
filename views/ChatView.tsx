/**
 * ChatView.tsx — Exord HRM v3
 * Rich messenger UI: typing indicators, reply threading, edit, emoji reactions,
 * unread badges, last-message preview, date separators, search, online presence.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  MessageSquare, Plus, Search, Send, X, Hash,
  ChevronLeft, Loader2, Edit2, Trash2,
  Reply, SmilePlus, CheckCheck, FileText,
  Music, Download, ChevronDown, Paperclip,
} from 'lucide-react';
import FileUploadButton from './FileUploadButton';
import {
  Conversation, Message,
  getMyConversations, getMessages, sendMessage,
  getOrCreateDirectConversation, getOrCreateDepartmentConversation,
  markMessagesRead, markConversationRead, deleteMessage,
  subscribeToConversation, getConversationMembers,
  getUnreadCountsV2, editMessage as apiEditMessage,
  broadcastTyping, subscribeToTyping, cleanupTypingChannel,
  getConversationMembersBatch, extractMentionIds,
} from '../chatService';
import { UploadResult } from '../fileService';
import { supabase } from '../supabaseClient';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const fmtFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const fmtLastMsg = (msg?: Message) => {
  if (!msg) return '';
  if (msg.is_deleted) return '🚫 Message deleted';
  if (msg.file_type === 'image') return '📷 Photo';
  if (msg.file_type === 'video') return '🎥 Video';
  if (msg.file_type === 'audio') return '🎵 Audio';
  if (msg.file_type === 'document') return `📎 ${msg.file_name || 'File'}`;
  return msg.content || '';
};

// ── Message Bubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  message: Message;
  isOwn: boolean;
  showSender: boolean;
  senderAvatar?: string;
  onDelete?: (id: string) => void;
  onReply?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  isHighlighted?: boolean;
}

const MessageBubble: React.FC<BubbleProps> = ({ message: msg, isOwn, showSender, senderAvatar, onDelete, onReply, onEdit, isHighlighted }) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState(false);

  const addReaction = (emoji: string) => {
    setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    setShowEmojiPicker(false);
  };

  if (msg.is_deleted) {
    return (
      <div className={`flex mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <span className="text-[11px] text-slate-400 italic px-4 py-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700">
          🚫 Message deleted
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2.5 mb-1 group ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isHighlighted ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl px-2' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {!isOwn && (
        <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-500 self-end mb-1">
          {senderAvatar ? <img src={senderAvatar} alt="" className="w-full h-full object-cover" /> : <span>{msg.sender_name?.charAt(0) || '?'}</span>}
        </div>
      )}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSender && (
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 mb-1 px-1">{msg.sender_name}</span>
        )}

        {msg.reply_to_id && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-4 max-w-full ${isOwn ? 'border-white/40 bg-[#C41217]/30' : 'border-[#E31E24] bg-slate-100 dark:bg-slate-700/60'}`}>
            <p className="text-[10px] font-black text-[#E31E24] truncate">{msg.reply_to_sender_name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {msg.reply_to_file_type ? `📎 ${msg.reply_to_file_type}` : msg.reply_to_content}
            </p>
          </div>
        )}

        <div className={`relative rounded-2xl px-3.5 py-2.5 shadow-sm ${isOwn ? 'bg-[#E31E24] text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-sm'}`}>
          {msg.file_type === 'image' && msg.file_url && (
            <div className="mb-1.5 -mx-1 -mt-1 overflow-hidden rounded-xl cursor-pointer" onClick={() => setLightbox(true)}>
              <img src={msg.file_url} alt={msg.file_name || ''} className="max-w-[240px] max-h-[200px] object-cover w-full" />
            </div>
          )}
          {msg.file_type === 'video' && msg.file_url && (
            <div className="mb-1.5 rounded-xl overflow-hidden">
              <video src={msg.file_url} controls className="max-w-[240px] max-h-[180px] rounded-xl" />
            </div>
          )}
          {msg.file_type === 'audio' && msg.file_url && (
            <div className={`flex items-center gap-2 mb-1 p-2 rounded-xl ${isOwn ? 'bg-white/10' : 'bg-slate-50 dark:bg-slate-700'}`}>
              <Music size={16} className={isOwn ? 'text-white/70' : 'text-[#E31E24]'} />
              <audio src={msg.file_url} controls className="h-7 max-w-[180px]" />
            </div>
          )}
          {msg.file_type === 'document' && msg.file_url && (
            <a href={msg.file_url} target="_blank" rel="noreferrer"
              className={`flex items-center gap-3 p-2.5 rounded-xl mb-1 hover:opacity-80 transition-opacity ${isOwn ? 'bg-white/10' : 'bg-slate-50 dark:bg-slate-700'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-[#E31E24]/10'}`}>
                <FileText size={16} className={isOwn ? 'text-white' : 'text-[#E31E24]'} />
              </div>
              <div className="min-w-0">
                <p className={`text-[11px] font-black truncate max-w-[160px] ${isOwn ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{msg.file_name}</p>
                <p className={`text-[9px] ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>{fmtFileSize(msg.file_size)}</p>
              </div>
              <Download size={14} className={isOwn ? 'text-white/60' : 'text-slate-400'} />
            </a>
          )}
          {msg.content && (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isOwn ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{msg.content}</p>
          )}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[9px] font-bold ${isOwn ? 'text-white/50' : 'text-slate-300 dark:text-slate-600'}`}>
              {fmtTime(msg.created_at)}{msg.edited_at ? ' · edited' : ''}
            </span>
            {isOwn && <CheckCheck size={11} className="text-white/50" />}
          </div>
        </div>

        {Object.entries(reactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactions).map(([emoji, count]) => (
              <button key={emoji} onClick={() => addReaction(emoji)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#E31E24] transition-all shadow-sm">
                {emoji} <span className="font-black text-slate-500 dark:text-slate-400">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`flex items-center self-center gap-0.5 transition-all duration-150 ${showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="relative">
          <button onClick={() => setShowEmojiPicker(v => !v)}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-[#E31E24] hover:border-[#E31E24] transition-all shadow-sm">
            <SmilePlus size={13} />
          </button>
          {showEmojiPicker && (
            <div className={`absolute bottom-9 ${isOwn ? 'right-0' : 'left-0'} flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-2 py-1.5 shadow-xl z-20`}>
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => addReaction(e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
          )}
        </div>
        {onReply && (
          <button onClick={() => onReply(msg)}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-all shadow-sm">
            <Reply size={13} />
          </button>
        )}
        {isOwn && onEdit && msg.content && (
          <button onClick={() => onEdit(msg)}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500 hover:border-amber-400 transition-all shadow-sm">
            <Edit2 size={13} />
          </button>
        )}
        {isOwn && onDelete && (
          <button onClick={() => onDelete(msg.id)}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:border-rose-400 transition-all shadow-sm">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {lightbox && msg.file_url && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={24} /></button>
          <img src={msg.file_url} alt="" className="max-w-full max-h-full object-contain rounded-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white dark:bg-slate-900 px-2">{label}</span>
    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
  </div>
);

const TypingIndicator: React.FC<{ names: string[] }> = ({ names }) => {
  if (!names.length) return null;
  const label = names.length === 1 ? `${names[0]} is typing` : `${names.join(', ')} are typing`;
  return (
    <div className="flex items-center gap-2 px-5 py-2">
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="text-[11px] text-slate-400 font-bold italic">{label}…</span>
    </div>
  );
};

// ── Main ChatView ─────────────────────────────────────────────────────────────
const ChatView: React.FC = () => {
  const { users, currentUser } = useHRM();

  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [activeConv, setActiveConv]             = useState<Conversation | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [inputText, setInputText]               = useState('');
  const [pendingFile, setPendingFile]           = useState<UploadResult | null>(null);
  const [loadingConvs, setLoadingConvs]         = useState(true);
  const [loadingMsgs, setLoadingMsgs]           = useState(false);
  const [sending, setSending]                   = useState(false);
  const [search, setSearch]                     = useState('');
  const [showNewChat, setShowNewChat]           = useState(false);
  const [convMembers, setConvMembers]           = useState<string[]>([]);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [unreadCounts, setUnreadCounts]         = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages]         = useState<Record<string, Message>>({});
  const [typingUsers, setTypingUsers]           = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo]                   = useState<Message | null>(null);
  const [editingMsg, setEditingMsg]             = useState<Message | null>(null);
  const [showScrollBtn, setShowScrollBtn]       = useState(false);
  const [msgSearch, setMsgSearch]               = useState('');
  const [showMsgSearch, setShowMsgSearch]       = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const realtimeSub = useRef<any>(null);
  const typingTimer = useRef<any>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setLoadingConvs(true);
    const convs = await getMyConversations(currentUser.id);
    const convIds = convs.map(c => c.id);

    const [membersMap, unreadMap] = await Promise.all([
      getConversationMembersBatch(convIds),
      getUnreadCountsV2(convIds, currentUser.id),
    ]);

    const lastMsgMap: Record<string, Message> = {};
    await Promise.all(convIds.map(async (cid) => {
      const msgs = await getMessages(cid, 1);
      if (msgs.length) lastMsgMap[cid] = msgs[msgs.length - 1];
    }));

    const enriched = convs.map(conv => {
      const members = membersMap[conv.id] || [];
      if (conv.type === 'DIRECT') {
        const otherId = members.find(id => id !== currentUser.id);
        const otherUser = users.find(u => u.id === otherId);
        return { ...conv, otherUser, members };
      }
      return { ...conv, members };
    });

    enriched.sort((a, b) => {
      const aTime = lastMsgMap[a.id]?.created_at || a.updated_at;
      const bTime = lastMsgMap[b.id]?.created_at || b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setConversations(enriched);
    setUnreadCounts(unreadMap);
    setLastMessages(lastMsgMap);
    setLoadingConvs(false);
  }, [currentUser, users]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!currentUser) return;
    const targetId = (() => { try { return localStorage.getItem('exord-dm-target'); } catch { return null; } })();
    if (!targetId) return;
    try { localStorage.removeItem('exord-dm-target'); } catch {}
    const timer = setTimeout(() => startDM(targetId), 600);
    return () => clearTimeout(timer);
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const openConversation = useCallback(async (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([]);
    setLoadingMsgs(true);
    setMobileShowThread(true);
    setReplyTo(null);
    setEditingMsg(null);
    setInputText('');
    setShowMsgSearch(false);
    setMsgSearch('');
    setTypingUsers({});

    if (realtimeSub.current) supabase.removeChannel(realtimeSub.current);

    const [msgs, members] = await Promise.all([
      getMessages(conv.id, 60),
      getConversationMembers(conv.id),
    ]);

    setMessages(msgs);
    setLoadingMsgs(false);
    setConvMembers(members);

    if (currentUser) {
      const unread = msgs.filter(m => m.sender_id !== currentUser.id).map(m => m.id);
      if (unread.length) {
        await markMessagesRead(unread, currentUser.id);
        await markConversationRead(conv.id, currentUser.id);
      }
      setUnreadCounts(prev => ({ ...prev, [conv.id]: 0 }));
    }

    realtimeSub.current = subscribeToConversation(
      conv.id,
      (newMsg) => {
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setLastMessages(prev => ({ ...prev, [conv.id]: newMsg }));
        if (newMsg.sender_id !== currentUser?.id && currentUser) {
          markMessagesRead([newMsg.id], currentUser.id);
        }
      },
      (msgId, newContent, editedAt) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, edited_at: editedAt } : m));
      }
    );

    subscribeToTyping(conv.id, (userId, _name, isTyping) => {
      if (userId === currentUser?.id) return;
      setTypingUsers(prev => ({ ...prev, [userId]: isTyping }));
    });
  }, [currentUser]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    else setShowScrollBtn(true);
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (!activeConv || !currentUser) return;
    broadcastTyping(activeConv.id, currentUser.id, currentUser.name, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      broadcastTyping(activeConv.id, currentUser.id, currentUser.name, false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!activeConv || !currentUser) return;
    if (!inputText.trim() && !pendingFile) return;

    if (editingMsg) {
      const ok = await apiEditMessage(editingMsg.id, inputText.trim(), currentUser.id);
      if (ok) {
        setMessages(prev => prev.map(m =>
          m.id === editingMsg.id ? { ...m, content: inputText.trim(), edited_at: new Date().toISOString() } : m
        ));
      }
      setEditingMsg(null);
      setInputText('');
      return;
    }

    setSending(true);
    const text = inputText.trim();
    setInputText('');
    const savedReply = replyTo;
    setReplyTo(null);

    const mentionIds = text ? extractMentionIds(text, users) : [];
    const fileData = pendingFile ? {
      file_url: pendingFile.url,
      file_type: pendingFile.type as any,
      file_name: pendingFile.originalName || pendingFile.filename,
      file_size: pendingFile.size,
    } : undefined;
    setPendingFile(null);

    const replyData = savedReply ? {
      id: savedReply.id,
      senderName: savedReply.sender_name,
      content: savedReply.content,
      fileType: savedReply.file_type,
    } : undefined;

    broadcastTyping(activeConv.id, currentUser.id, currentUser.name, false);

    const msg = await sendMessage(activeConv.id, currentUser.id, currentUser.name, text || undefined, fileData, mentionIds, replyData);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setLastMessages(prev => ({ ...prev, [activeConv.id]: msg }));
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { setReplyTo(null); setEditingMsg(null); setInputText(''); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser) return;
    const ok = await deleteMessage(msgId, currentUser.id);
    if (ok) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true } : m));
  };

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setInputText(msg.content || '');
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const startDM = async (targetUserId: string) => {
    if (!currentUser) return;
    setShowNewChat(false);
    setLoadingMsgs(true);
    const convId = await getOrCreateDirectConversation(currentUser.id, targetUserId);
    if (!convId) { setLoadingMsgs(false); return; }
    await loadConversations();
    const targetUser = users.find(u => u.id === targetUserId);
    const conv: Conversation = { id: convId, type: 'DIRECT', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), otherUser: targetUser };
    openConversation(conv);
  };

  const startDeptChannel = async (dept: string) => {
    if (!currentUser) return;
    setShowNewChat(false);
    const deptMembers = users.filter(u => u.department === dept).map(u => u.id);
    const convId = await getOrCreateDepartmentConversation(dept, deptMembers);
    if (!convId) return;
    await loadConversations();
    const conv: Conversation = { id: convId, type: 'DEPARTMENT', department: dept, name: `${dept} Channel`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    openConversation(conv);
  };

  const filteredConvs = useMemo(() => {
    if (!search) return conversations;
    return conversations.filter(conv => {
      const name = conv.type === 'DIRECT' ? conv.otherUser?.name || '' : conv.name || conv.department || '';
      const lastMsgText = fmtLastMsg(lastMessages[conv.id]);
      return name.toLowerCase().includes(search.toLowerCase()) || lastMsgText.toLowerCase().includes(search.toLowerCase());
    });
  }, [conversations, search, lastMessages]);

  const filteredMessages = useMemo(() => {
    if (!msgSearch.trim()) return messages;
    return messages.filter(m => m.content?.toLowerCase().includes(msgSearch.toLowerCase()));
  }, [messages, msgSearch]);

  const dmTargets = useMemo(() => users.filter(u => u.id !== currentUser?.id), [users, currentUser]);
  const departments = useMemo(() => [...new Set(users.map(u => u.department).filter(Boolean))], [users]);

  const typingNames = useMemo(() =>
    Object.entries(typingUsers).filter(([, v]) => v).map(([uid]) => users.find(u => u.id === uid)?.name || 'Someone'),
    [typingUsers, users]);

  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

  const getConvTitle = (conv: Conversation) =>
    conv.type === 'DIRECT' ? conv.otherUser?.name || 'Direct Message' : conv.name || conv.department || 'Channel';

  const getConvAvatar = (conv: Conversation) => {
    if (conv.type === 'DIRECT') {
      const av = conv.otherUser?.avatar;
      if (av) return <img src={av} alt="" className="w-full h-full object-cover" />;
      return <span className="font-black text-sm">{conv.otherUser?.name?.charAt(0) || '?'}</span>;
    }
    return <Hash size={18} />;
  };

  const canCreateChannels = currentUser && [UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR, UserRole.MANAGER, 'DEVELOPER'].includes(currentUser.role as string);

  return (
    <>
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .dark .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
      `}</style>

      <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-[fadeIn_0.4s_ease-out]">

        {/* LEFT PANEL */}
        <div className={`w-full lg:w-[320px] flex-shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col ${mobileShowThread ? 'hidden lg:flex' : 'flex'}`}>
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Messages</h2>
                {totalUnread > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#E31E24] text-white text-[10px] font-black flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
              <button onClick={() => setShowNewChat(v => !v)}
                className={`p-2.5 rounded-2xl transition-all ${showNewChat ? 'bg-[#E31E24] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-[#E31E24] hover:text-white'}`}>
                {showNewChat ? <X size={16} /> : <Plus size={16} />}
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input type="text" placeholder="Search people & messages…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#E31E24] transition-all" />
            </div>
          </div>

          {showNewChat && (
            <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-1 max-h-80 overflow-y-auto chat-scroll">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 pb-1">Direct Message</p>
              {dmTargets.map(u => (
                <button key={u.id} onClick={() => startDM(u.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-700 transition-all text-left">
                  <div className="relative w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-600 flex-shrink-0 overflow-hidden">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0)}
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-white dark:border-slate-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold truncate">{u.department}</p>
                  </div>
                </button>
              ))}
              {canCreateChannels && (
                <>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-1 pt-3 pb-1">Department Channels</p>
                  {departments.map(dept => (
                    <button key={dept} onClick={() => startDeptChannel(dept)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-700 transition-all text-left">
                      <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-[#E31E24] flex items-center justify-center flex-shrink-0">
                        <Hash size={14} />
                      </div>
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{dept}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto chat-scroll">
            {loadingConvs && <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-[#E31E24]" /></div>}
            {!loadingConvs && filteredConvs.length === 0 && (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={24} className="text-slate-200 dark:text-slate-700" />
                </div>
                <p className="text-xs font-black text-slate-400">No conversations</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Tap + to start chatting</p>
              </div>
            )}
            {filteredConvs.map(conv => {
              const unread = unreadCounts[conv.id] || 0;
              const last = lastMessages[conv.id];
              const isActive = activeConv?.id === conv.id;
              return (
                <button key={conv.id} onClick={() => openConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${isActive ? 'bg-red-50 dark:bg-red-900/10 border-r-[3px] border-[#E31E24]' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <div className={`relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden font-black text-sm ${conv.type !== 'DIRECT' ? 'bg-red-50 dark:bg-red-900/20 text-[#E31E24]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {getConvAvatar(conv)}
                    {conv.type === 'DIRECT' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${unread > 0 ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-600 dark:text-slate-300'}`}>
                        {getConvTitle(conv)}
                      </p>
                      {last && <span className="text-[9px] text-slate-400 font-bold flex-shrink-0 ml-2">{fmtTime(last.created_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-400 truncate flex-1">
                        {fmtLastMsg(last) || (conv.type !== 'DIRECT' ? `# ${conv.department}` : 'No messages yet')}
                      </p>
                      {unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E31E24] text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`flex-1 flex flex-col min-w-0 relative ${mobileShowThread || (typeof window !== 'undefined' && window.innerWidth >= 1024) ? 'flex' : 'hidden'}`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 rounded-[2rem] bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-5">
                <MessageSquare size={36} className="text-[#E31E24]" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Your messages</h3>
              <p className="text-sm text-slate-400 font-medium max-w-xs">Select a conversation or tap + to start one.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <button onClick={() => setMobileShowThread(false)} className="lg:hidden p-2 text-slate-400 hover:text-[#E31E24]">
                  <ChevronLeft size={20} />
                </button>
                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 overflow-hidden ${activeConv.type !== 'DIRECT' ? 'bg-red-50 dark:bg-red-900/20 text-[#E31E24]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                  {getConvAvatar(activeConv)}
                  {activeConv.type === 'DIRECT' && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm truncate">{getConvTitle(activeConv)}</h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {activeConv.type !== 'DIRECT' ? `${convMembers.length} members` : activeConv.otherUser?.designation || activeConv.otherUser?.department || 'Direct Message'}
                  </p>
                </div>
                <button onClick={() => { setShowMsgSearch(v => !v); setMsgSearch(''); }}
                  className={`p-2 rounded-xl transition-all ${showMsgSearch ? 'bg-[#E31E24] text-white' : 'text-slate-400 hover:text-[#E31E24]'}`}>
                  <Search size={16} />
                </button>
              </div>

              {showMsgSearch && (
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                  <Search size={13} className="text-slate-400 flex-shrink-0" />
                  <input autoFocus type="text" placeholder="Search in this conversation…" value={msgSearch}
                    onChange={e => setMsgSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none" />
                  {msgSearch && <button onClick={() => setMsgSearch('')}><X size={13} className="text-slate-400" /></button>}
                </div>
              )}

              {/* Messages */}
              <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto chat-scroll px-5 py-4">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-[#E31E24]" /></div>
                ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                      {msgSearch ? <Search size={24} className="text-slate-300" /> : <MessageSquare size={24} className="text-slate-300 dark:text-slate-600" />}
                    </div>
                    <p className="text-sm font-black text-slate-400">{msgSearch ? 'No results' : 'No messages yet'}</p>
                    <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">{msgSearch ? 'Try a different keyword' : 'Send the first message!'}</p>
                  </div>
                ) : (
                  <>
                    {filteredMessages.map((msg, i) => {
                      const isOwn = msg.sender_id === currentUser?.id;
                      const prevMsg = i > 0 ? filteredMessages[i - 1] : null;
                      const showSender = activeConv.type !== 'DIRECT' && !isOwn && msg.sender_id !== prevMsg?.sender_id;
                      const showDate = !prevMsg || fmtDate(msg.created_at) !== fmtDate(prevMsg.created_at);
                      const senderUser = users.find(u => u.id === msg.sender_id);
                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && <DateSeparator label={fmtDate(msg.created_at)} />}
                          <MessageBubble
                            message={msg} isOwn={isOwn} showSender={showSender}
                            senderAvatar={senderUser?.avatar}
                            onDelete={isOwn ? handleDeleteMessage : undefined}
                            onReply={setReplyTo}
                            onEdit={isOwn ? startEdit : undefined}
                            isHighlighted={highlightedMsgId === msg.id}
                          />
                        </React.Fragment>
                      );
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {typingNames.length > 0 && <TypingIndicator names={typingNames} />}

              {showScrollBtn && (
                <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScrollBtn(false); }}
                  className="absolute bottom-28 right-5 w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-500 hover:text-[#E31E24] hover:border-[#E31E24] transition-all z-10">
                  <ChevronDown size={16} />
                </button>
              )}

              {pendingFile && (
                <div className="mx-4 mb-2 flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-2xl flex-shrink-0">
                  <Paperclip size={14} className="text-[#E31E24] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-white truncate">{pendingFile.originalName || pendingFile.filename}</p>
                    <p className="text-[10px] text-slate-400">{fmtFileSize(pendingFile.size)} · Ready to send</p>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
                </div>
              )}

              {(replyTo || editingMsg) && (
                <div className="mx-4 mb-1 flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex-shrink-0">
                  <div className="w-0.5 h-8 rounded-full bg-[#E31E24] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-[#E31E24]">
                      {editingMsg ? '✏️ Editing' : `↩ Replying to ${replyTo?.sender_name}`}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {editingMsg ? editingMsg.content : (replyTo?.content || `📎 ${replyTo?.file_type}`)}
                    </p>
                  </div>
                  <button onClick={() => { setReplyTo(null); setEditingMsg(null); setInputText(''); }}
                    className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-4 pt-1 flex-shrink-0">
                <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl px-3 py-2 focus-within:border-[#E31E24] transition-all">
                  <FileUploadButton convId={activeConv.id} onUpload={setPendingFile} disabled={sending} />
                  <textarea ref={inputRef} value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown}
                    placeholder={editingMsg ? 'Edit message… (Esc to cancel)' : 'Message… (Enter to send)'}
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 resize-none py-2.5 px-1 focus:outline-none max-h-32 overflow-y-auto chat-scroll"
                    style={{ minHeight: 40 }} disabled={sending} />
                  <button onClick={handleSend} disabled={sending || (!inputText.trim() && !pendingFile)}
                    className={`p-2.5 rounded-2xl transition-all flex-shrink-0 ${(inputText.trim() || pendingFile) ? 'bg-[#E31E24] text-white shadow-md hover:bg-[#C41217] active:scale-95' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}>
                    {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatView;

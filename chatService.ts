/**
 * chatService.ts — Exord Online HRM v2
 *
 * NEW in v2:
 *  - markConversationRead: updates last_read_at (fixes unread-after-reload)
 *  - getUnreadCountsV2: single SQL RPC, no 1000-row limit bug
 *  - editMessage, searchMessages
 *  - createCustomChannel (manager public/private groups)
 *  - addMemberToConversation
 *  - subscribeToConversation (INSERT + UPDATE for edits)
 *  - broadcastTyping / subscribeToTyping (Supabase Broadcast)
 *  - extractMentionIds helper
 *  - sendMessage accepts mentionIds[]
 */

import { supabase } from './supabaseClient';
import { User } from './types';

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'DEPARTMENT' | 'CUSTOM';
  department?: string;
  name?: string;
  is_private?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  otherUser?: User;
  lastMessage?: Message;
  unreadCount?: number;
  members?: string[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content?: string;
  file_url?: string;
  file_type?: 'image' | 'video' | 'audio' | 'document';
  file_name?: string;
  file_size?: number;
  is_deleted: boolean;
  created_at: string;
  edited_at?: string;
  mentions?: string[];
  // Reply threading
  reply_to_id?: string | null;
  reply_to_sender_name?: string | null;
  reply_to_content?: string | null;   // text preview of quoted message
  reply_to_file_type?: string | null; // if quoted message was a file
}

// ── Conversations ─────────────────────────────────────────────────────────────

export const getMyConversations = async (userId: string): Promise<Conversation[]> => {
  const { data: memberships } = await supabase
    .from('conversation_members').select('conversation_id')
    .eq('user_id', userId)
    .is('hidden_at', null);   // exclude convs the user deleted for themselves
  if (!memberships?.length) return [];
  const { data: convs } = await supabase
    .from('conversations').select('*')
    .in('id', memberships.map(m => m.conversation_id))
    .order('updated_at', { ascending: false });
  return convs || [];
};

export const getConversationMembersBatch = async (convIds: string[]): Promise<Record<string, string[]>> => {
  if (!convIds.length) return {};
  const { data } = await supabase.from('conversation_members')
    .select('conversation_id, user_id').in('conversation_id', convIds);
  const result: Record<string, string[]> = {};
  (data || []).forEach(row => {
    if (!result[row.conversation_id]) result[row.conversation_id] = [];
    result[row.conversation_id].push(row.user_id);
  });
  return result;
};

export const getConversationMembers = async (convId: string): Promise<string[]> => {
  const { data } = await supabase.from('conversation_members')
    .select('user_id').eq('conversation_id', convId);
  return (data || []).map(m => m.user_id);
};

export const addMemberToConversation = async (convId: string, userId: string): Promise<boolean> => {
  const { error } = await supabase.from('conversation_members')
    .upsert({ conversation_id: convId, user_id: userId },
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });
  return !error;
};

// ── Messages ──────────────────────────────────────────────────────────────────

export const getMessages = async (convId: string, limit = 50, before?: string): Promise<Message[]> => {
  let q = supabase.from('messages').select('*').eq('conversation_id', convId)
    .order('created_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('created_at', before);
  const { data } = await q;
  return (data || []).reverse();
};

export const sendMessage = async (
  convId: string, senderId: string, senderName: string,
  content?: string,
  fileData?: { file_url: string; file_type: 'image'|'video'|'audio'|'document'; file_name: string; file_size: number },
  mentionIds?: string[],
  replyTo?: { id: string; senderName: string; content?: string; fileType?: string }
): Promise<Message | null> => {
  const payload: any = {
    conversation_id: convId, sender_id: senderId, sender_name: senderName,
    content: content || null, is_deleted: false,
    mentions: mentionIds?.length ? mentionIds : [],
    reply_to_id: replyTo?.id || null,
    reply_to_sender_name: replyTo?.senderName || null,
    reply_to_content: replyTo?.content || null,
    reply_to_file_type: replyTo?.fileType || null,
  };
  if (fileData) { payload.file_url = fileData.file_url; payload.file_type = fileData.file_type; payload.file_name = fileData.file_name; payload.file_size = fileData.file_size; }
  const { data, error } = await supabase.from('messages').insert(payload).select().single();
  if (error) { console.error('[sendMessage]', error); return null; }
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
  return data;
};

export const editMessage = async (messageId: string, newContent: string, senderId: string): Promise<boolean> => {
  const { error } = await supabase.from('messages')
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId).eq('sender_id', senderId);
  return !error;
};

export const deleteMessage = async (messageId: string, senderId: string): Promise<boolean> => {
  const { error } = await supabase.from('messages')
    .update({ is_deleted: true }).eq('id', messageId).eq('sender_id', senderId);
  return !error;
};

export const searchMessages = async (convId: string, query: string, limit = 30): Promise<Message[]> => {
  if (!query.trim()) return [];
  const { data } = await supabase.from('messages').select('*')
    .eq('conversation_id', convId).ilike('content', `%${query}%`)
    .eq('is_deleted', false).order('created_at', { ascending: false }).limit(limit);
  return (data || []).reverse();
};

// ── Read Status ───────────────────────────────────────────────────────────────

/** v2: O(1) mark-as-read — updates last_read_at on the membership row. Persists across reloads. */
export const markConversationRead = async (convId: string, userId: string): Promise<void> => {
  await supabase.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', convId).eq('user_id', userId);
};

/** v2: Single RPC query for all unread counts. Falls back to legacy if RPC not deployed. */
export const getUnreadCountsV2 = async (convIds: string[], userId: string): Promise<Record<string, number>> => {
  if (!convIds.length) return {};
  const { data, error } = await supabase.rpc('get_unread_counts_v2', { p_user_id: userId, p_conv_ids: convIds });
  if (!error && data) {
    const result: Record<string, number> = {};
    (data as any[]).forEach(row => { result[row.conversation_id] = Number(row.unread_count); });
    return result;
  }
  return getUnreadCountsForAll(convIds, userId);
};

/** Legacy fallback */
export const getUnreadCountsForAll = async (convIds: string[], userId: string): Promise<Record<string, number>> => {
  if (!convIds.length) return {};
  const { data: msgs } = await supabase.from('messages').select('id, conversation_id')
    .in('conversation_id', convIds).neq('sender_id', userId).eq('is_deleted', false).limit(5000);
  if (!msgs?.length) return {};
  const { data: reads } = await supabase.from('message_reads').select('message_id')
    .in('message_id', msgs.map(m => m.id)).eq('user_id', userId).limit(5000);
  const readIds = new Set((reads || []).map(r => r.message_id));
  const counts: Record<string, number> = {};
  msgs.forEach(msg => { if (!readIds.has(msg.id)) counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1; });
  return counts;
};

export const markMessagesRead = async (messageIds: string[], userId: string): Promise<void> => {
  if (!messageIds.length) return;
  await supabase.from('message_reads').upsert(
    messageIds.map(mid => ({ message_id: mid, user_id: userId })),
    { onConflict: 'message_id,user_id', ignoreDuplicates: true }
  );
};

export const getUnreadCount = async (convId: string, userId: string): Promise<number> => {
  const counts = await getUnreadCountsV2([convId], userId);
  return counts[convId] || 0;
};

// ── Conversation Creation ─────────────────────────────────────────────────────

export const getOrCreateDirectConversation = async (userAId: string, userBId: string): Promise<string | null> => {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_or_create_direct_conversation', { user_a: userAId, user_b: userBId });
  if (!rpcErr && rpcData) return rpcData as string;

  const { data: aM } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userAId);
  const { data: bM } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', userBId);
  if (aM && bM) {
    const aIds = new Set(aM.map(m => m.conversation_id));
    const shared = bM.find(m => aIds.has(m.conversation_id));
    if (shared) {
      const { data: c } = await supabase.from('conversations').select('id,type').eq('id', shared.conversation_id).eq('type','DIRECT').single();
      if (c) return c.id;
    }
  }
  const { data: newConv, error: cErr } = await supabase.from('conversations')
    .insert({ type: 'DIRECT', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
  if (cErr || !newConv) return null;
  await supabase.from('conversation_members').insert([
    { conversation_id: newConv.id, user_id: userAId },
    { conversation_id: newConv.id, user_id: userBId },
  ]);
  return newConv.id;
};

export const getOrCreateDepartmentConversation = async (department: string, memberIds: string[]): Promise<string | null> => {
  const { data: existing } = await supabase.from('conversations').select('id').eq('type','DEPARTMENT').eq('department', department).single();
  if (existing) return existing.id;
  const { data: newConv, error: cErr } = await supabase.from('conversations')
    .insert({ type: 'DEPARTMENT', department, name: `${department} Channel`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
  if (cErr || !newConv) return null;
  await supabase.from('conversation_members').insert(memberIds.map(uid => ({ conversation_id: newConv.id, user_id: uid })));
  return newConv.id;
};

export const createCustomChannel = async (name: string, isPrivate: boolean, creatorId: string, memberIds: string[]): Promise<string | null> => {
  const { data: conv, error } = await supabase.from('conversations')
    .insert({ type: 'CUSTOM', name, is_private: isPrivate, created_by: creatorId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single();
  if (error || !conv) return null;
  const allMembers = [...new Set([creatorId, ...memberIds])];
  await supabase.from('conversation_members').insert(allMembers.map(uid => ({ conversation_id: conv.id, user_id: uid })));
  return conv.id;
};

// ── Realtime Subscriptions ────────────────────────────────────────────────────

/** Background notification subscription (INSERT only) */
export const subscribeToMessages = (convId: string, onMessage: (msg: Message) => void) => {
  return supabase.channel(`messages:${convId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
      (payload) => onMessage(payload.new as Message))
    .subscribe();
};

/** Active thread subscription (INSERT + UPDATE for edits) */
export const subscribeToConversation = (
  convId: string,
  onMessage: (msg: Message) => void,
  onEdit?: (msgId: string, newContent: string, editedAt: string) => void
) => {
  const ch = supabase.channel(`conv:${convId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
      (payload) => onMessage(payload.new as Message));
  if (onEdit) {
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
      (payload) => {
        const msg = payload.new as any;
        if (msg.edited_at && !msg.is_deleted) onEdit(msg.id, msg.content ?? '', msg.edited_at);
      });
  }
  return ch.subscribe();
};

// ── Typing Indicators ────────────────────────────────────────────────────────
// _typingChannels is module-level but bounded: only one channel is kept
// alive at a time (the active conversation). cleanupTypingChannel() is
// called before every conversation switch and on page hide.

const _typingChannels = new Map<string, any>();

const _getTypingChannel = (convId: string) => {
  if (!_typingChannels.has(convId)) {
    const ch = supabase.channel(`typing:${convId}`);
    ch.subscribe();
    _typingChannels.set(convId, ch);
  }
  return _typingChannels.get(convId)!;
};

export const broadcastTyping = (convId: string, userId: string, userName: string, isTyping: boolean): void => {
  try {
    _getTypingChannel(convId).send({ type: 'broadcast', event: 'typing', payload: { userId, userName, isTyping } });
  } catch { /* ignore if channel not ready */ }
};

export const subscribeToTyping = (convId: string, callback: (userId: string, userName: string, isTyping: boolean) => void) => {
  const ch = _getTypingChannel(convId);
  ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
    callback(payload.userId, payload.userName, payload.isTyping);
  });
  return ch;
};

export const cleanupTypingChannel = (convId: string): void => {
  const ch = _typingChannels.get(convId);
  if (ch) { supabase.removeChannel(ch); _typingChannels.delete(convId); }
};

/** Cleans up ALL open typing channels — call on component unmount or page hide. */
export const cleanupAllTypingChannels = (): void => {
  _typingChannels.forEach((ch) => { try { supabase.removeChannel(ch); } catch {} });
  _typingChannels.clear();
};

// Automatically clean up on page hide (tab switch / mobile backgrounding).
// This prevents ghost "X is typing" indicators when the user navigates away.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cleanupAllTypingChannels();
  });
}

// ── Mention Helpers ───────────────────────────────────────────────────────────

export const extractMentionIds = (content: string, users: { id: string; name: string }[]): string[] => {
  const pattern = /@([A-Za-z]+(?:\s[A-Za-z]+)*)/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const mentioned = match[1].toLowerCase();
    const user = users.find(u => u.name.toLowerCase() === mentioned || u.name.toLowerCase().startsWith(mentioned));
    if (user) found.add(user.id);
  }
  return [...found];
};

// ── Hide/Delete conversation (for me only) ───────────────────────────────────
/** Soft-delete: sets hidden_at on the membership row so only this user stops seeing the conv */
export const hideConversationForMe = async (convId: string, userId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('conversation_members')
    .update({ hidden_at: new Date().toISOString() })
    .eq('conversation_id', convId)
    .eq('user_id', userId);
  return !error;
};

// Backward-compat alias
export const batchGetConversationMembers = getConversationMembersBatch;

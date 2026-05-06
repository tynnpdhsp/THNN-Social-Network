import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Send, ArrowLeft, MessageSquare } from 'lucide-react';
import { apiFetch, WS_BASE, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const Messaging = () => {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const msgEndRef = useRef(null);
  const wsRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/messaging/conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // WebSocket
  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_BASE}/messaging/ws?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'new_message') {
        const msg = event.data;
        const senderId = msg.sender_id || msg.senderId;
        const convId = msg.conversation_id || msg.conversationId;

        // If we're viewing this conversation and msg is from someone else, add it
        if (senderId !== user?.id) {
          setMessages(prev => {
            if (prev.length > 0 && prev[0]._convId === convId) {
              return [...prev, { ...msg, _convId: convId }];
            }
            return prev;
          });
        }
        loadConversations();
      }
    };

    return () => { ws.close(); };
  }, [token, user?.id, loadConversations]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = async (conv) => {
    setActiveConv(conv);
    try {
      // Mark as read
      apiFetch(`/messaging/conversations/${conv.id}/read`, { method: 'POST' });
      const res = await apiFetch(`/messaging/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages((data.messages || []).reverse().map(m => ({ ...m, _convId: conv.id })));
      loadConversations();
    } catch { setMessages([]); }
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeConv) return;
    const content = msgInput;
    setMsgInput('');
    try {
      const res = await apiFetch(`/messaging/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, { ...msg, _convId: activeConv.id }]);
        loadConversations();
      }
    } catch { /* ignore */ }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    const res = await apiFetch(`/account/search?query=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data.filter(u => u.id !== user?.id));
  };

  const startNewChat = async (userId, name) => {
    const res = await apiFetch('/messaging/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', participant_ids: [userId] }),
    });
    if (res.ok) {
      const conv = await res.json();
      setSearchResults([]);
      setSearchQuery('');
      loadConversations();
      openChat({ ...conv, chatName: name });
    }
  };

  const getChatName = (conv) => {
    if (conv.chatName) return conv.chatName;
    if (conv.type === 'direct' && conv.other_member) return conv.other_member.full_name;
    return conv.name || 'Cuộc hội thoại';
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div style={s.container}>
      {/* Conversation List */}
      <div style={{ ...s.sidebar, ...(activeConv ? { display: 'none' } : {}), '@media (min-width: 768px)': { display: 'block' } }}>
        <div style={{ padding: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Tin nhắn</h2>

          {/* Search */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Tìm người để trò chuyện..."
              className="input-field"
              style={{ flex: 1, height: 40, fontSize: 13 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            />
            <button className="btn-primary" style={{ padding: '0 16px', fontSize: 12 }} onClick={searchUsers}>Tìm</button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.map(u => (
                <div
                  key={u.id}
                  onClick={() => startNewChat(u.id, u.full_name)}
                  style={s.searchItem}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>NHẮN TIN</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ash)' }}>
              <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>Chưa có cuộc hội thoại</p>
            </div>
          ) : (
            conversations.map(c => {
              const name = getChatName(c);
              const lastMsg = c.last_message || c.lastMessage;
              const member = c.members?.find(m => (m.user_id || m.userId) === user?.id);
              const lastRead = member ? (member.last_read_at || member.lastReadAt) : null;
              const isUnread = lastMsg && (!lastRead || new Date(lastMsg.created_at || lastMsg.createdAt) > new Date(lastRead));

              return (
                <div
                  key={c.id}
                  onClick={() => openChat(c)}
                  style={{
                    ...s.convItem,
                    ...(activeConv?.id === c.id ? { background: 'var(--surface-card)' } : {}),
                    ...(isUnread ? { borderLeft: '3px solid var(--primary)' } : {}),
                    transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-soft)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = activeConv?.id === c.id ? 'var(--surface-card)' : ''; e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <div style={s.convAvatar}>{name?.[0]?.toUpperCase() || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{name}</p>
                    <p style={{ fontSize: 12, color: 'var(--ash)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg?.content || 'Chưa có tin nhắn'}
                    </p>
                  </div>
                  {isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, animation: 'pulse 2s infinite' }} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ ...s.chatArea, ...(activeConv ? {} : { display: 'none' }) }}>
        {activeConv && (
          <>
            {/* Chat Header */}
            <div style={s.chatHeader}>
              <button onClick={() => setActiveConv(null)} style={s.backBtn}>
                <ArrowLeft size={20} />
              </button>
              <div style={{ ...s.convAvatar, width: 40, height: 40, fontSize: 16 }}>
                {getChatName(activeConv)?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{getChatName(activeConv)}</p>
                <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>● Đang hoạt động</p>
              </div>
            </div>

            {/* Messages */}
            <div style={s.messagesArea}>
              {messages.map((m, i) => {
                const senderId = m.sender_id || m.senderId;
                const isMe = senderId === user?.id;
                const createdAt = m.created_at || m.createdAt;
                return (
                  <div key={m.id || i} style={{
                    display: 'flex',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                    marginBottom: 8,
                    animation: `${isMe ? 'slideInRight' : 'slideInLeft'} 0.3s cubic-bezier(0.22, 1, 0.36, 1)`,
                  }}>
                    <div style={{
                      ...s.msgBubble,
                      background: isMe ? 'var(--primary)' : 'white',
                      color: isMe ? 'white' : 'var(--body)',
                      borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      boxShadow: isMe ? '0 2px 12px rgba(230,0,35,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      <p style={{ fontSize: 14, lineHeight: 1.5 }}>{m.content}</p>
                      <p style={{ fontSize: 10, opacity: 0.6, textAlign: 'right', marginTop: 4, fontWeight: 600 }}>
                        {createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Input */}
            <div style={s.chatInputRow}>
              <input
                id="chat-input"
                type="text"
                placeholder="Viết tin nhắn..."
                className="input-field"
                style={{ flex: 1, height: 44, borderRadius: 'var(--rounded-full)' }}
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button className="btn-primary" style={{ width: 44, height: 44, padding: 0, borderRadius: '50%' }} onClick={sendMessage}>
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const s = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 100px)',
    maxWidth: 1000,
    margin: '0 auto',
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    border: '1px solid var(--hairline)',
    overflow: 'hidden',
    marginTop: 16,
  },
  sidebar: {
    width: 360,
    borderRight: '1px solid var(--hairline)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    cursor: 'pointer',
    transition: 'background 0.2s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    borderLeft: '3px solid transparent',
  },
  convAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'var(--surface-card)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 18,
    color: 'var(--mute)',
    flexShrink: 0,
  },
  searchItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'var(--surface-soft)',
    borderRadius: 12,
    cursor: 'pointer',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderBottom: '1px solid var(--hairline)',
    background: 'var(--surface-soft)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--body)',
    padding: 4,
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 20,
    background: '#fafaf8',
  },
  msgBubble: {
    maxWidth: '75%',
    padding: '12px 16px',
    border: '1px solid var(--hairline)',
  },
  chatInputRow: {
    display: 'flex',
    gap: 10,
    padding: 16,
    borderTop: '1px solid var(--hairline)',
    background: 'white',
  },
};

export default Messaging;

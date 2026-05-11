import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Send, ArrowLeft, MessageSquare, Image, Users } from 'lucide-react';
import { apiFetch, WS_BASE, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const Messaging = ({ onViewProfile, preselectedUser }) => {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const msgEndRef = useRef(null);
  const wsRef = useRef(null);
  const activeConvRef = useRef(null);
  const processedPreselect = useRef(false);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  const loadConversations = useCallback(async () => {
    try {
      const [cRes, fRes] = await Promise.all([
        apiFetch('/messaging/conversations'),
        apiFetch('/social/friends')
      ]);
      const cData = await cRes.json();
      setConversations(cData.conversations || []);
      setFriends(await fRes.json());
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
        setMessages(prev => {
          // If message belongs to active conversation
          if (activeConvRef.current?.id === convId) {
            // Check if message already exists (to avoid duplicates from REST response)
            if (!prev.some(m => m.id === msg.id)) {
              return [...prev, { ...msg, _convId: convId }];
            }
          }
          return prev;
        });
        loadConversations();
        window.dispatchEvent(new Event('refreshMsgs'));
      }
    };

    return () => { ws.close(); };
  }, [token, user?.id, loadConversations]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = useCallback(async (conv) => {
    setActiveConv(conv);
    try {
      // Mark as read
      apiFetch(`/messaging/conversations/${conv.id}/read`, { method: 'POST' });
      const res = await apiFetch(`/messaging/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages((data.messages || []).reverse().map(m => ({ ...m, _convId: conv.id })));
      loadConversations();
      window.dispatchEvent(new Event('refreshMsgs'));
    } catch { setMessages([]); }
  }, [loadConversations]);

  const sendMessage = async () => {
    if ((!msgInput.trim() && attachments.length === 0) || !activeConv) return;
    const content = msgInput;
    const currentAttachments = attachments;
    setMsgInput('');
    setAttachments([]);
    try {
      const res = await apiFetch(`/messaging/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, attachments: currentAttachments }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, { ...msg, _convId: activeConv.id }]);
        loadConversations();
      }
    } catch { /* ignore */ }
  };

  const startChat = useCallback(async (targetUser) => {
    if (!targetUser) return;
    // Find existing direct chat
    let conv = conversations.find(c => 
      c.type === 'direct' && 
      (c.other_member?.id === targetUser.id || c.other_member?.userId === targetUser.id)
    );

    if (!conv) {
      try {
        const res = await apiFetch('/messaging/conversations', {
          method: 'POST',
          body: JSON.stringify({ type: 'direct', participant_ids: [targetUser.id] }),
        });
        if (res.ok) {
          conv = await res.json();
          setConversations(prev => [conv, ...prev]);
        }
      } catch {}
    }

    if (conv) openChat(conv);
  }, [conversations, openChat]);

  useEffect(() => {
    if (preselectedUser && conversations.length > 0 && !processedPreselect.current) {
      processedPreselect.current = true;
      startChat(preselectedUser);
    }
  }, [preselectedUser, conversations.length, startChat]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    setUploading(true);
    for (let f of files) {
      const fd = new FormData();
      fd.append('file', f);
      try {
        const res = await apiFetch('/social/media/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          setAttachments(prev => [...prev, data.image_url]);
        }
      } catch {}
    }
    setUploading(false);
    e.target.value = '';
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    const res = await apiFetch(`/account/search?query=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data.filter(u => u.id !== user?.id));
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

          {/* Search New / Filter Existing */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Tìm người hoặc nhóm..."
                className="input-field"
                style={{ width: '100%', height: 40, fontSize: 13, paddingRight: 40 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
              />
              <Search size={16} style={{ position: 'absolute', right: 12, top: 12, color: 'var(--ash)' }} />
            </div>
            <button className="btn-primary" style={{ padding: '0 16px', fontSize: 12 }} onClick={searchUsers}>Tìm</button>
          </div>

          {/* Search Results / New Chat */}
          {searchResults.length > 0 && (
            <div style={{ marginBottom: 16, background: 'var(--surface-soft)', borderRadius: 16, padding: 8, animation: 'fadeInDown 0.3s ease' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ash)', padding: '4px 12px', textTransform: 'uppercase' }}>Kết quả tìm kiếm</p>
              {searchResults.map(u => (
                <div key={u.id} style={s.searchResultItem} onClick={() => { startChat(u); setSearchQuery(''); setSearchResults([]); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={resolveImageUrl(u.avatar_url) || getDefaultAvatar(u.full_name)} alt="" style={s.searchAvatar} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 13 }}>{u.full_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--ash)' }}>@{u.username || 'user'}</p>
                    </div>
                  </div>
                  <MessageSquare size={14} color="var(--primary)" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversations
            .filter(c => {
              if (!searchQuery.trim()) return true;
              const name = getChatName(c).toLowerCase();
              return name.includes(searchQuery.toLowerCase());
            })
            .length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ash)' }}>
              <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 13 }}>Không tìm thấy cuộc trò chuyện</p>
            </div>
          ) : (
            conversations
              .filter(c => {
                if (!searchQuery.trim()) return true;
                const name = getChatName(c).toLowerCase();
                return name.includes(searchQuery.toLowerCase());
              })
              .map(c => {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setActiveConv(null)} style={s.backBtn}>
                  <ArrowLeft size={20} />
                </button>
                <img 
                  src={activeConv.type === 'direct' ? (resolveImageUrl(activeConv.other_member?.avatar_url) || getDefaultAvatar(activeConv.other_member?.full_name)) : getDefaultAvatar(activeConv.name)} 
                  alt="" 
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', cursor: activeConv.type === 'direct' ? 'pointer' : 'default' }} 
                  onClick={() => activeConv.type === 'direct' && onViewProfile?.(activeConv.other_member?.id || activeConv.other_member?.userId)}
                />
                <div>
                  <h3 
                    style={{ fontWeight: 700, fontSize: 16, cursor: activeConv.type === 'direct' ? 'pointer' : 'default' }}
                    onClick={() => activeConv.type === 'direct' && onViewProfile?.(activeConv.other_member?.id || activeConv.other_member?.userId)}
                  >{getChatName(activeConv)}</h3>
                  <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>{activeConv.type === 'direct' ? 'Đang hoạt động' : `${activeConv.members?.length || 0} thành viên`}</p>
                </div>
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
                      {m.attachments?.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {m.attachments.map((at, ati) => (
                            <img key={ati} src={resolveImageUrl(at)} alt="" style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 200 }} />
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                        <p style={{ fontSize: 10, opacity: 0.6, fontWeight: 600 }}>
                          {createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                        {isMe && activeConv.type === 'direct' && (() => {
                          const other = activeConv.members?.find(mem => (mem.user_id || mem.userId) !== user.id);
                          const lastRead = other?.last_read_at || other?.lastReadAt;
                          if (lastRead && new Date(lastRead) >= new Date(createdAt)) {
                            return <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.8 }}>● Đã xem</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '0 16px' }}>
              {attachments.length > 0 && (
                <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
                  {attachments.map((at, ati) => (
                    <div key={ati} style={{ position: 'relative' }}>
                      <img src={resolveImageUrl(at)} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                      <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== ati))} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', color: 'white', border: 'none', fontSize: 10 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.chatInputRow}>
              <label style={{ cursor: 'pointer', color: 'var(--ash)', padding: 8 }}>
                <Image size={20} />
                <input type="file" multiple accept="image/*" hidden onChange={handleUpload} disabled={uploading} />
              </label>
              <input
                id="chat-input"
                type="text"
                placeholder={uploading ? "Đang tải ảnh..." : "Viết tin nhắn..."}
                className="input-field"
                style={{ flex: 1, height: 44, borderRadius: 'var(--rounded-full)' }}
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={uploading}
              />
              <button className="btn-primary" style={{ width: 44, height: 44, padding: 0, borderRadius: '50%' }} onClick={sendMessage} disabled={uploading}>
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
  searchResultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  searchAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid white',
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

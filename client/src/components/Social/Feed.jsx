import React, { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Send, Image, MoreHorizontal, Flag, Ban, UserPlus, Trash2 } from 'lucide-react';
import { apiFetch, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Common/Modal';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newContent, setNewContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Comment modal
  const [commentPostId, setCommentPostId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [replyToName, setReplyToName] = useState('');

  // Report modal
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDesc, setReportDesc] = useState('');

  const loadFeed = useCallback(async () => {
    try {
      const res = await apiFetch('/social/feed');
      const data = await res.json();
      setPosts(data.posts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const handleUploadImages = async (e) => {
    const files = e.target.files;
    for (let f of files) {
      const fd = new FormData();
      fd.append('file', f);
      try {
        const res = await apiFetch('/social/media/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.image_url) setUploadedImages(prev => [...prev, data.image_url]);
      } catch { /* ignore */ }
    }
    e.target.value = '';
  };

  const handleCreatePost = async () => {
    if (!newContent.trim() && uploadedImages.length === 0) return;
    setPosting(true);
    try {
      const body = {
        content: newContent,
        visibility: 'public',
        images: uploadedImages.map((u, i) => ({ image_url: u, display_order: i })),
      };
      const res = await apiFetch('/social/posts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewContent('');
        setUploadedImages([]);
        loadFeed();
      }
    } catch { /* ignore */ }
    setPosting(false);
  };

  const handleLike = async (postId) => {
    await apiFetch(`/social/posts/${postId}/like`, { method: 'POST' });
    loadFeed();
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Xóa bài viết này?')) return;
    await apiFetch(`/social/posts/${postId}`, { method: 'DELETE' });
    loadFeed();
  };

  // Comments
  const openComments = async (postId) => {
    setCommentPostId(postId);
    setReplyToId(null);
    setReplyToName('');
    setCommentText('');
    try {
      const res = await apiFetch(`/social/posts/${postId}/comments`);
      setComments(await res.json());
    } catch { setComments([]); }
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    const res = await apiFetch(`/social/posts/${commentPostId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: commentText, parent_comment_id: replyToId }),
    });
    if (res.ok) {
      setCommentText('');
      setReplyToId(null);
      setReplyToName('');
      openComments(commentPostId);
      loadFeed();
    }
  };

  // Report
  const submitReport = async () => {
    if (!reportTarget) return;
    await apiFetch(`/social/reports/${reportTarget.type}/${reportTarget.id}?reason=${encodeURIComponent(reportReason)}`, {
      method: 'POST',
      body: JSON.stringify({ description: reportDesc }),
    });
    setReportTarget(null);
    setReportDesc('');
  };

  // Block
  const handleBlock = async (userId) => {
    if (!confirm('Chặn người dùng này?')) return;
    await apiFetch(`/social/blocks/${userId}`, { method: 'POST' });
    loadFeed();
  };

  // Add Friend
  const handleAddFriend = async (userId) => {
    await apiFetch(`/social/friends/requests/${userId}`, { method: 'POST' });
  };

  const avatarUrl = user ? (resolveImageUrl(user.avatar_url) || getDefaultAvatar(user.full_name)) : '';

  if (loading) return <div style={s.loadingContainer}><div style={s.spinner} /></div>;

  return (
    <div style={s.container}>
      {/* Animated page entrance */}
      {/* Create Post */}
      <div style={{ ...s.createCard, animation: 'fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div style={s.createHeader}>
          <img src={avatarUrl} alt="" style={s.createAvatar} />
          <textarea
            id="feed-post-input"
            placeholder="Chia sẻ suy nghĩ của bạn..."
            style={s.createTextarea}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
          />
        </div>

        {uploadedImages.length > 0 && (
          <div style={s.previewRow}>
            {uploadedImages.map((img, i) => (
              <div key={i} style={{ ...s.previewItem, animation: 'popIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <img src={resolveImageUrl(img)} alt="" style={s.previewImg} />
                <button
                  onClick={() => setUploadedImages(prev => prev.filter((_, j) => j !== i))}
                  style={s.previewRemove}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div style={s.createActions}>
          <label style={s.mediaBtn}>
            <Image size={18} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mute)' }}>Ảnh/Video</span>
            <input type="file" multiple accept="image/*" hidden onChange={handleUploadImages} />
          </label>
          <button
            id="feed-post-submit"
            className="btn-primary"
            style={{ padding: '10px 28px', fontSize: 14 }}
            onClick={handleCreatePost}
            disabled={posting}
          >
            {posting ? 'Đang đăng...' : 'Đăng bài'}
          </button>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div style={{ ...s.emptyState, animation: 'fadeIn 0.6s ease' }}>
          <p style={{ fontWeight: 700, color: 'var(--mute)' }}>Chưa có bài viết nào</p>
          <p style={{ fontSize: 13, color: 'var(--ash)' }}>Hãy chia sẻ bài viết đầu tiên của bạn!</p>
        </div>
      ) : (
        posts.map((p, idx) => <PostCard
          key={p.id}
          post={p}
          index={idx}
          currentUserId={user?.id}
          onLike={handleLike}
          onComment={openComments}
          onReport={(id, type) => setReportTarget({ id, type })}
          onBlock={handleBlock}
          onAddFriend={handleAddFriend}
          onDelete={handleDeletePost}
        />)
      )}

      {/* Comment Modal */}
      <Modal isOpen={!!commentPostId} onClose={() => setCommentPostId(null)} title="Bình luận" width={520}>
        <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
          {comments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--ash)', padding: 32, fontSize: 13 }}>Chưa có bình luận</p>
          ) : (
            comments.map(c => (
              <div key={c.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <img src={resolveImageUrl(c.user_info?.avatar_url) || getDefaultAvatar(c.user_info?.full_name)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ background: 'var(--surface-card)', padding: '10px 14px', borderRadius: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>{c.user_info?.full_name}</p>
                      <p style={{ fontSize: 14, color: 'var(--body)' }}>{c.content}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, paddingLeft: 8 }}>
                      <button
                        onClick={() => { setReplyToId(c.id); setReplyToName(c.user_info?.full_name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--mute)' }}
                      >TRẢ LỜI</button>
                      <span style={{ fontSize: 11, color: 'var(--ash)' }}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Replies */}
                    {(c.replies || []).map((r, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: 8, marginTop: 10, marginLeft: 16, paddingLeft: 12, borderLeft: '2px solid var(--hairline)' }}>
                        <img src={resolveImageUrl(r.user_info?.avatar_url) || getDefaultAvatar(r.user_info?.full_name)} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        <div style={{ background: 'var(--surface-soft)', padding: '8px 12px', borderRadius: 12, flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--focus-outer)', marginBottom: 1 }}>{r.user_info?.full_name}</p>
                          <p style={{ fontSize: 13, color: 'var(--body)' }}>{r.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {replyToName && (
          <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 8 }}>
            Trả lời {replyToName}
            <button onClick={() => { setReplyToId(null); setReplyToName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)', marginLeft: 8, fontSize: 11 }}>Hủy</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="comment-input"
            type="text"
            placeholder={replyToName ? `Trả lời ${replyToName}...` : 'Viết bình luận...'}
            className="input-field"
            style={{ flex: 1, height: 44 }}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendComment()}
          />
          <button className="btn-primary" style={{ padding: '0 20px' }} onClick={sendComment}>
            <Send size={16} />
          </button>
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal isOpen={!!reportTarget} onClose={() => setReportTarget(null)} title="Báo cáo nội dung" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'block' }}>Lý do</label>
            <select className="input-field" value={reportReason} onChange={(e) => setReportReason(e.target.value)} style={{ height: 44 }}>
              <option value="spam">Spam / Quảng cáo</option>
              <option value="harassment">Quấy rối / Đe dọa</option>
              <option value="hate_speech">Ngôn từ thù ghét</option>
              <option value="inappropriate">Nội dung không phù hợp</option>
              <option value="other">Lý do khác</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: 'block' }}>Chi tiết (không bắt buộc)</label>
            <textarea className="input-field" placeholder="Mô tả thêm..." style={{ height: 80, resize: 'none', padding: '12px 20px' }} value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setReportTarget(null)}>Hủy</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={submitReport}>Gửi báo cáo</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ─── Post Card Component ──────────────────────────────────────────
function PostCard({ post: p, index = 0, currentUserId, onLike, onComment, onReport, onBlock, onAddFriend, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [hovered, setHovered] = useState(false);
  const avatar = resolveImageUrl(p.user_info?.avatar_url) || getDefaultAvatar(p.user_info?.full_name);
  const isOwn = p.user_id === currentUserId;

  const handleLikeClick = (id) => {
    setLikeAnim(true);
    onLike(id);
    setTimeout(() => setLikeAnim(false), 600);
  };

  return (
    <div
      style={{
        ...s.postCard,
        animation: `fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s both`,
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.02)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.postHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={avatar} alt="" style={s.postAvatar} />
          <div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{p.user_info?.full_name}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)' }}>
              {new Date(p.created_at).toLocaleDateString('vi-VN')} • {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(!showMenu)} style={s.menuBtn}>
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowMenu(false)} />
              <div style={{ ...s.menuDropdown, animation: 'fadeInDown 0.2s cubic-bezier(0.22, 1, 0.36, 1)' }}>
              {!isOwn && (
                <>
                  <button onClick={() => { onReport(p.id, 'post'); setShowMenu(false); }} style={s.menuItem}>
                    <Flag size={14} /> Báo cáo
                  </button>
                  <button onClick={() => { onBlock(p.user_id); setShowMenu(false); }} style={s.menuItem}>
                    <Ban size={14} /> Chặn
                  </button>
                  <button onClick={() => { onAddFriend(p.user_id); setShowMenu(false); }} style={s.menuItem}>
                    <UserPlus size={14} /> Kết bạn
                  </button>
                </>
              )}
              {isOwn && (
                <button onClick={() => { onDelete(p.id); setShowMenu(false); }} style={{ ...s.menuItem, color: 'var(--primary)' }}>
                  <Trash2 size={14} /> Xóa bài
                </button>
              )}
              </div>
            </>
          )}
        </div>
      </div>

      <p style={s.postContent}>{p.content}</p>

      {p.images?.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: p.images.length === 1 ? '1fr' : `repeat(${Math.min(p.images.length, 3)}, 1fr)`,
          gap: 4,
          borderRadius: 16,
          overflow: 'hidden',
          marginTop: 12,
        }}>
          {p.images.map((img, i) => (
            <img key={i} src={resolveImageUrl(img.image_url)} alt="" style={{ width: '100%', height: p.images.length === 1 ? 400 : 200, objectFit: 'cover', transition: 'transform 0.4s ease' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'} />
          ))}
        </div>
      )}

      <div style={s.postActions}>
        <button
          onClick={() => handleLikeClick(p.id)}
          style={{
            ...s.actionBtn,
            color: p.liked_by_me ? 'var(--primary)' : 'var(--mute)',
            animation: likeAnim ? 'heartBeat 0.6s ease' : 'none',
          }}
        >
          <Heart size={18} fill={p.liked_by_me ? 'var(--primary)' : 'none'} /> <span>{p.like_count}</span>
        </button>
        <button onClick={() => onComment(p.id)} style={s.actionBtn}>
          <MessageCircle size={18} /> <span>{p.comment_count}</span>
        </button>
      </div>
    </div>
  );
}

const s = {
  container: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: 64,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid var(--hairline)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  createCard: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    padding: 24,
    border: '1px solid var(--hairline)',
  },
  createHeader: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  createAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--surface-card)',
    flexShrink: 0,
  },
  createTextarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: 15,
    fontFamily: 'var(--font-family)',
    color: 'var(--ink)',
    background: 'var(--surface-soft)',
    borderRadius: 16,
    padding: '12px 16px',
  },
  previewRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  previewItem: {
    position: 'relative',
    flexShrink: 0,
  },
  previewImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
    objectFit: 'cover',
  },
  previewRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: 'var(--surface-card)',
    borderRadius: 'var(--rounded-full)',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  emptyState: {
    textAlign: 'center',
    padding: 64,
    background: 'var(--surface-soft)',
    borderRadius: 'var(--rounded-lg)',
    border: '1px dashed var(--hairline)',
  },
  postCard: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    padding: 24,
    border: '1px solid var(--hairline)',
    transition: 'box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  postHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--surface-card)',
  },
  postContent: {
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--body)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  postActions: {
    display: 'flex',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid var(--surface-card)',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--mute)',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 'var(--rounded-full)',
    transition: 'all 0.2s',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ash)',
    padding: 4,
    borderRadius: 8,
  },
  menuDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    background: 'white',
    borderRadius: 'var(--rounded-md)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
    border: '1px solid var(--hairline)',
    padding: 6,
    zIndex: 100,
    minWidth: 160,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--body)',
    width: '100%',
    textAlign: 'left',
    borderRadius: 8,
  },
};

export default Feed;

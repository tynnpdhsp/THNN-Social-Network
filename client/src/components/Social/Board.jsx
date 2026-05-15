import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Send, Heart, MessageCircle, Image, MoreHorizontal, Flag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, resolveImageUrl, getDefaultAvatar } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../Common/Modal';

const Board = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [filterTagId, setFilterTagId] = useState('');
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

  const loadTags = useCallback(async () => {
    try {
      const res = await apiFetch('/board/tags');
      const data = await res.json();
      setTags(data);
      if (data.length > 0 && !selectedTagId) setSelectedTagId(data[0].id);
    } catch { /* ignore */ }
  }, [selectedTagId]);

  const loadPosts = useCallback(async () => {
    try {
      let url = '/board/posts';
      if (filterTagId) url += `?tag_id=${filterTagId}`;
      const res = await apiFetch(url);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterTagId]);

  useEffect(() => { loadTags(); }, [loadTags]);
  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleUploadImages = async (e) => {
    const files = e.target.files;
    const MAX_SIZE = 50 * 1024 * 1024;

    for (let f of files) {
      if (f.size > MAX_SIZE) {
        toast.error(`File "${f.name}" quá lớn (tối đa 50MB)`);
        continue;
      }

      const fd = new FormData();
      fd.append('file', f);
      try {
        const res = await apiFetch('/social/media/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(`Tải lên thất bại: ${err.detail || res.statusText}`);
          continue;
        }
        const data = await res.json();
        if (data.media_url) {
          setUploadedImages(prev => [...prev, { url: data.media_url, type: data.media_type }]);
        }
      } catch (err) {
        toast.error('Không thể tải file. Kiểm tra kết nối server/MinIO.');
        console.error('Upload error:', err);
      }
    }
    e.target.value = '';
  };

  const handleCreatePost = async () => {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      await apiFetch('/board/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: newContent,
          board_tag_id: selectedTagId,
          images: uploadedImages.map((u, i) => ({ 
            image_url: u.url, 
            media_type: u.type,
            display_order: i 
          })),
        }),
      });
      setNewContent('');
      setUploadedImages([]);
      loadPosts();
    } catch { /* ignore */ }
    setPosting(false);
  };

  const handleLike = async (postId) => {
    await apiFetch(`/board/posts/${postId}/like`, { method: 'POST' });
    loadPosts();
  };

  const openComments = async (postId) => {
    setCommentPostId(postId);
    setReplyToId(null);
    setReplyToName('');
    setCommentText('');
    try {
      const res = await apiFetch(`/board/posts/${postId}/comments`);
      setComments(await res.json());
    } catch { setComments([]); }
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    const res = await apiFetch(`/board/posts/${commentPostId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: commentText, parent_comment_id: replyToId }),
    });
    if (res.ok) {
      setCommentText('');
      setReplyToId(null);
      setReplyToName('');
      openComments(commentPostId);
      loadPosts();
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div style={{ width: 32, height: 32, border: '3px solid var(--hairline)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px' }}>
      {/* Create Board Post */}
      <div style={{ ...s.createCard, animation: 'fadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div style={s.createHeader}>
          <Tag size={20} color="var(--primary)" />
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>Đăng tin chung</h3>
        </div>

        {/* Tag Selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {tags.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTagId(t.id)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--rounded-full)',
                border: selectedTagId === t.id ? '2px solid var(--primary)' : '1px solid var(--hairline)',
                background: selectedTagId === t.id ? '#fef2f2' : 'white',
                color: selectedTagId === t.id ? 'var(--primary)' : 'var(--body)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >{t.name}</button>
          ))}
        </div>

        <textarea
          id="board-post-input"
          placeholder="Bạn muốn bán hoặc tìm gì?"
          className="input-field"
          style={{ height: 80, resize: 'none', padding: '12px 20px', marginBottom: 12, width: '100%', borderRadius: 16, background: 'white', border: '1px solid var(--hairline)' }}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />

        {uploadedImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {uploadedImages.map((media, i) => (
              <div key={i} style={{ position: 'relative', animation: 'popIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                {media.type === 'video' ? (
                  <div style={{ width: 64, height: 64, borderRadius: 10, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <video src={resolveImageUrl(media.url)} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  </div>
                ) : (
                  <img src={resolveImageUrl(media.url)} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
                )}
                <button onClick={() => setUploadedImages(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--mute)', fontSize: 13, fontWeight: 600 }}>
              <Image size={16} /> Ảnh/Video
              <input type="file" multiple accept="image/*,video/*" hidden onChange={handleUploadImages} />
            </label>
          </div>
          <button className="btn-primary" style={{ padding: '10px 28px', fontSize: 14 }} onClick={handleCreatePost} disabled={posting}>
            {posting ? 'Đang đăng...' : 'Đăng tin ngay'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          onClick={() => setFilterTagId('')}
          style={{
            ...s.filterBtn,
            ...(filterTagId === '' ? s.filterBtnActive : {}),
          }}
        >Tất cả</button>
        {tags.map(t => (
          <button
            key={t.id}
            onClick={() => setFilterTagId(t.id)}
            style={{
              ...s.filterBtn,
              ...(filterTagId === t.id ? s.filterBtnActive : {}),
            }}
          >{t.name}</button>
        ))}
      </div>

      {/* Board Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--mute)', background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', border: '1px dashed var(--hairline)' }}>
            <p style={{ fontWeight: 700 }}>Chưa có tin đăng nào</p>
          </div>
        ) : (
          posts.map((p, idx) => {
            const av = resolveImageUrl(p.user_info?.avatar_url) || getDefaultAvatar(p.user_info?.full_name);
            return (
              <div key={p.id} style={{
                ...s.postCard,
                animation: `fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 0.07}s both`,
                transition: 'box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1), transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={av} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14 }}>{p.user_info?.full_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--mute)' }}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                  {p.board_tag_id && (
                    <span style={{ padding: '4px 12px', background: '#fef2f2', color: 'var(--primary)', borderRadius: 'var(--rounded-full)', fontSize: 11, fontWeight: 700 }}>
                      {tags.find(t => t.id === p.board_tag_id)?.name || 'Tag'}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--body)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{p.content}</p>

                {p.images?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(p.images.length, 3)}, 1fr)`, gap: 4, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    {p.images.map((img, i) => {
                      const isVideo = img.media_type === 'video';
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--surface-soft)',
                            minHeight: 180,
                            maxHeight: 260,
                          }}
                        >
                          {isVideo ? (
                            <video
                              src={resolveImageUrl(img.image_url)}
                              controls
                              style={{
                                maxWidth: '100%',
                                maxHeight: 220,
                                width: '100%',
                                height: 'auto',
                                borderRadius: 8,
                              }}
                            />
                          ) : (
                            <img
                              src={resolveImageUrl(img.image_url)}
                              alt=""
                              style={{
                                maxWidth: '100%',
                                maxHeight: 220,
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 20, paddingTop: 12, borderTop: '1px solid var(--surface-card)' }}>
                  <button
                    onClick={() => handleLike(p.id)}
                    style={{
                      ...s.actionBtn,
                      color: p.is_liked ? 'var(--primary)' : 'var(--mute)',
                    }}
                  >
                    <Heart size={16} fill={p.is_liked ? 'var(--primary)' : 'none'} /> {p.like_count}
                  </button>
                  <button onClick={() => openComments(p.id)} style={s.actionBtn}>
                    <MessageCircle size={16} /> {p.comment_count}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Comment Modal */}
      <Modal isOpen={!!commentPostId} onClose={() => setCommentPostId(null)} title="Bình luận" width={720}>
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
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{c.user_info?.full_name}</p>
                      <p style={{ fontSize: 14 }}>{c.content}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, paddingLeft: 8 }}>
                      <button onClick={() => { setReplyToId(c.id); setReplyToName(c.user_info?.full_name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--mute)' }}>TRẢ LỜI</button>
                    </div>
                    {(c.replies || []).map((r, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: 8, marginTop: 8, marginLeft: 16, paddingLeft: 12, borderLeft: '2px solid var(--hairline)' }}>
                        <img src={resolveImageUrl(r.user_info?.avatar_url) || getDefaultAvatar(r.user_info?.full_name)} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                        <div style={{ background: 'var(--surface-soft)', padding: '8px 12px', borderRadius: 12, flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--focus-outer)' }}>{r.user_info?.full_name}</p>
                          <p style={{ fontSize: 13 }}>{r.content}</p>
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
            <button onClick={() => { setReplyToId(null); setReplyToName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ash)', marginLeft: 8 }}>Hủy</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Viết bình luận..." className="input-field" style={{ flex: 1, height: 44 }} value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendComment()} />
          <button className="btn-primary" style={{ padding: '0 20px' }} onClick={sendComment}><Send size={16} /></button>
        </div>
      </Modal>
    </div>
  );
};

const s = {
  createCard: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    padding: 24,
    border: '2px dashed var(--hairline)',
    marginBottom: 24,
  },
  createHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  filterBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--rounded-full)',
    border: '1px solid var(--hairline)',
    background: 'white',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
    color: 'var(--body)',
  },
  filterBtnActive: {
    background: 'var(--ink)',
    color: 'white',
    borderColor: 'var(--ink)',
  },
  postCard: {
    background: 'white',
    borderRadius: 'var(--rounded-lg)',
    padding: 20,
    border: '1px solid var(--hairline)',
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
  },
};

export default Board;

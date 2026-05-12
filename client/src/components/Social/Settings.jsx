import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Bell, Lock, Save, Check, X, ChevronDown } from 'lucide-react';
import { apiFetch } from '../../config/api';

const Settings = () => {
  const [privacy, setPrivacy] = useState({ whoCanSeePosts: 'everyone', whoCanMessage: 'everyone', whoCanFriendReq: 'everyone' });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [notifSettings, setNotifSettings] = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [saved, setSaved] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, n, b, o] = await Promise.all([
        apiFetch('/account/me/privacy'), 
        apiFetch('/account/me/notification-settings'), 
        apiFetch('/social/blocks'),
        apiFetch('/account/me/orders'),
      ]);
      if (p.ok) setPrivacy(await p.json());
      if (n.ok) setNotifSettings(await n.json());
      if (b.ok) setBlockedUsers(await b.json());
      if (o.ok) { const d = await o.json(); setOrders(d.orders || []); }
    } catch (err) { console.error('Error loading settings:', err); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePrivacy = async () => {
    await apiFetch('/account/me/privacy', { method: 'PUT', body: JSON.stringify(privacy) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const saveNotif = async () => {
    await apiFetch('/account/me/notification-settings', { method: 'PUT', body: JSON.stringify(notifSettings) });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const unblock = async (id) => { await apiFetch(`/social/blocks/${id}`, { method: 'DELETE' }); load(); };

  const changePw = async () => {
    setPwMsg('');
    const r = await apiFetch('/account/me/password', { method: 'PUT', body: JSON.stringify({ old_password: oldPw, new_password: newPw }) });
    if (r.ok) { setPwMsg('Thành công!'); setOldPw(''); setNewPw(''); }
    else { const d = await r.json(); setPwMsg(d.detail || 'Lỗi'); }
  };

  const toggle = (k) => setNotifSettings(p => ({ ...p, [k]: !p[k] }));

  const c = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };
  const t = { fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 24 }}>Cài đặt</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={c}>
          <h3 style={t}><Shield size={18} color="var(--primary)" /> Quyền riêng tư</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'whoCanSeePosts', label: 'Ai xem bài viết?', opts: [['everyone','Mọi người'],['friends','Bạn bè'],['only_me','Chỉ mình tôi']] },
              { key: 'whoCanMessage', label: 'Ai nhắn tin?', opts: [['everyone','Mọi người'],['friends','Bạn bè'],['only_me','Chỉ mình tôi']] },
              { key: 'whoCanFriendReq', label: 'Ai kết bạn?', opts: [['everyone','Mọi người'],['friends_of_friends','Bạn của bạn bè'],['no_one','Không ai']] },
            ].map(f => {
              const selectedLabel = f.opts.find(o => o[0] === privacy[f.key])?.[1] || '';
              const isOpen = openDropdown === f.key;
              return (
                <div key={f.key} style={{ position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>{f.label}</label>
                  <button 
                    type="button"
                    onClick={() => setOpenDropdown(isOpen ? null : f.key)}
                    className="input-field"
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#ffffff', border: '1px solid var(--hairline)',
                      padding: '0 16px', height: 44, width: '100%', textAlign: 'left',
                      cursor: 'pointer', borderRadius: '16px'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600, color: 'var(--body)' }}>{selectedLabel}</span>
                    <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--mute)' }} />
                  </button>
                  
                  {isOpen && (
                    <div style={{ 
                      position: 'absolute', top: '100%', left: 0, width: '100%', 
                      background: '#ffffff', borderRadius: '16px', 
                      boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 1000,
                      overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)',
                      marginTop: 4
                    }}>
                      {f.opts.map(([v, l]) => (
                        <div 
                          key={v}
                          onClick={() => { setPrivacy(p => ({ ...p, [f.key]: v })); setOpenDropdown(null); }}
                          style={{ 
                            padding: '10px 12px', borderRadius: '12px',
                            cursor: 'pointer', fontSize: 14, fontWeight: privacy[f.key] === v ? 700 : 500,
                            background: privacy[f.key] === v ? 'var(--surface-soft)' : 'transparent',
                            color: privacy[f.key] === v ? 'var(--primary)' : 'var(--body)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = privacy[f.key] === v ? 'var(--surface-soft)' : 'transparent'}
                        >
                          {l}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button className="btn-primary" style={{ width: '100%', height: 44 }} onClick={savePrivacy}>{saved ? <><Check size={16}/> Đã lưu</> : <><Save size={16}/> Lưu</>}</button>
          </div>
        </div>

        <div style={c}>
          <h3 style={t}><Bell size={18} color="var(--focus-outer)" /> Thông báo</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['notifyLike','Thích'],['notifyComment','Bình luận'],['notifyReply','Trả lời'],['notifyFriendReq','Kết bạn'],['notifyMessage','Tin nhắn'],['notifySchedule','Lịch học']].map(([k,l]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{l}</span>
                <button onClick={() => toggle(k)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: notifSettings[k] ? 'var(--primary)' : 'var(--hairline)', position: 'relative', padding: 2, transition: 'background 0.2s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'transform 0.2s', transform: notifSettings[k] ? 'translateX(20px)' : 'translateX(0)' }} />
                </button>
              </div>
            ))}
            <button className="btn-primary" style={{ width: '100%', height: 44, marginTop: 8 }} onClick={saveNotif}><Save size={16}/> Lưu</button>
          </div>
        </div>

        <div style={c}>
          <h3 style={t}><Lock size={18} color="var(--mute)" /> Đổi mật khẩu</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" className="input-field" placeholder="Mật khẩu hiện tại" value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ height: 44, background: '#ffffff', border: '1px solid var(--hairline)', borderRadius: '16px', padding: '0 16px' }} />
            <input type="password" className="input-field" placeholder="Mật khẩu mới" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ height: 44, background: '#ffffff', border: '1px solid var(--hairline)', borderRadius: '16px', padding: '0 16px' }} />
            {pwMsg && <p style={{ fontSize: 13, fontWeight: 600, color: pwMsg === 'Thành công!' ? '#16a34a' : 'var(--primary)' }}>{pwMsg}</p>}
            <button className="btn-primary" style={{ width: '100%', height: 44 }} onClick={changePw}>Đổi mật khẩu</button>
          </div>
        </div>

        <div style={c}>
          <h3 style={t}><X size={18} color="var(--primary)" /> Danh sách chặn</h3>
          {blockedUsers.length === 0 ? <p style={{ fontSize: 13, color: 'var(--ash)', textAlign: 'center', padding: 20 }}>Trống</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
              {blockedUsers.map(u => (
                <div key={u.blocked_id || u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-soft)', padding: '10px 14px', borderRadius: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name}</span>
                  <button onClick={() => unblock(u.blocked_id || u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--focus-outer)', fontSize: 11, fontWeight: 700 }}>BỎ CHẶN</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...c, gridColumn: 'span 2' }}>
          <h3 style={t}><Check size={18} color="var(--focus-outer)" /> Lịch sử thanh toán</h3>
          {orders.length === 0 ? <p style={{ fontSize: 13, color: 'var(--ash)', textAlign: 'center', padding: 20 }}>Chưa có giao dịch nào</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--ash)' }}>Sản phẩm</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--ash)' }}>Số tiền</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--ash)' }}>Trạng thái</th>
                    <th style={{ padding: 12, textAlign: 'left', color: 'var(--ash)' }}>Ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--surface-card)' }}>
                      <td style={{ padding: 12, fontWeight: 600 }}>{o.item_title}</td>
                      <td style={{ padding: 12 }}>{o.amount.toLocaleString('vi-VN')} đ</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: o.status === 'paid' ? '#f0fdf4' : '#fef2f2',
                          color: o.status === 'paid' ? '#16a34a' : 'var(--primary)'
                        }}>
                          {o.status === 'paid' ? 'Đã thanh toán' : o.status}
                        </span>
                      </td>
                      <td style={{ padding: 12, color: 'var(--ash)' }}>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

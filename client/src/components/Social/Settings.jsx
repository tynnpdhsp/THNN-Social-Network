import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Bell, Lock, Save, Check, X } from 'lucide-react';
import { apiFetch } from '../../config/api';

const Settings = () => {
  const [privacy, setPrivacy] = useState({ whoCanSeePosts: 'everyone', whoCanMessage: 'everyone', whoCanFriendReq: 'everyone' });
  const [notifSettings, setNotifSettings] = useState({});
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [saved, setSaved] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, n, b] = await Promise.all([
        apiFetch('/account/me/privacy'), apiFetch('/account/me/notification-settings'), apiFetch('/social/blocks'),
      ]);
      if (p.ok) setPrivacy(await p.json());
      if (n.ok) setNotifSettings(await n.json());
      if (b.ok) setBlockedUsers(await b.json());
    } catch {}
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
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>{f.label}</label>
                <select className="input-field" style={{ height: 44 }} value={privacy[f.key]} onChange={e => setPrivacy(p => ({ ...p, [f.key]: e.target.value }))}>{f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
            ))}
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
            <input type="password" className="input-field" placeholder="Mật khẩu hiện tại" value={oldPw} onChange={e => setOldPw(e.target.value)} style={{ height: 44 }} />
            <input type="password" className="input-field" placeholder="Mật khẩu mới" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ height: 44 }} />
            {pwMsg && <p style={{ fontSize: 13, fontWeight: 600, color: pwMsg === 'Thành công!' ? '#16a34a' : 'var(--primary)' }}>{pwMsg}</p>}
            <button className="btn-primary" style={{ width: '100%', height: 44 }} onClick={changePw}>Đổi mật khẩu</button>
          </div>
        </div>

        <div style={c}>
          <h3 style={t}><X size={18} color="var(--primary)" /> Danh sách chặn</h3>
          {blockedUsers.length === 0 ? <p style={{ fontSize: 13, color: 'var(--ash)', textAlign: 'center', padding: 20 }}>Trống</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
              {blockedUsers.map(u => (
                <div key={u.blocked_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-soft)', padding: '10px 14px', borderRadius: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name}</span>
                  <button onClick={() => unblock(u.blocked_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--focus-outer)', fontSize: 11, fontWeight: 700 }}>BỎ CHẶN</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

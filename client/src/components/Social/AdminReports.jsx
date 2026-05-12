import React, { useState } from 'react';
import { Flag, Eye, EyeOff, Lock, RefreshCw, ChevronDown } from 'lucide-react';

const CustomDropdown = ({ value, options, onChange, style, width = 130, buttonStyle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || '';

  return (
    <div style={{ position: 'relative', width, ...style }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', height: 36, padding: '0 12px',
          background: 'white', border: '1px solid var(--hairline)',
          borderRadius: 'var(--rounded-full)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, fontWeight: 700, color: 'var(--ink)',
          cursor: 'pointer', transition: 'all 0.2s', ...buttonStyle
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 4 }} />
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'white', borderRadius: 'var(--rounded-md)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100,
            overflow: 'hidden', padding: 6, border: '1px solid var(--hairline)',
            animation: 'scaleIn 0.15s ease'
          }}>
            {options.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setIsOpen(false); }}
                style={{
                  padding: '8px 10px', borderRadius: 'var(--rounded-sm)',
                  cursor: 'pointer', fontSize: 12, fontWeight: value === o.value ? 700 : 500,
                  background: value === o.value ? 'var(--surface-soft)' : 'transparent',
                  color: value === o.value ? 'var(--primary)' : 'var(--body)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft)'}
                onMouseLeave={e => e.currentTarget.style.background = value === o.value ? 'var(--surface-soft)' : 'transparent'}
              >
                {o.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const reportOptions = [
  { value: 'pending', label: 'Đang chờ' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'dismissed', label: 'Bỏ qua' },
  { value: '', label: 'Tất cả' },
];

const AdminReports = ({ reports, reportFilter, setReportFilter, loadAll, setResolveId, onViewProfile }) => {
  const card = { background: 'white', borderRadius: 'var(--rounded-lg)', padding: 24, border: '1px solid var(--hairline)' };

  return (
    <div style={{ ...card, animation: 'fadeInUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Flag size={20} color="var(--primary)" /> Báo cáo vi phạm
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <CustomDropdown
            value={reportFilter}
            options={reportOptions}
            onChange={setReportFilter}
            width={140}
          />
          <button onClick={loadAll} className="btn-secondary" style={{ width: 36, height: 36, padding: 0 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--ash)', padding: 32 }}>Không có báo cáo</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface-soft)', padding: 16, borderRadius: 16, border: r.status === 'pending' ? '1px solid var(--primary)' : '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', background: '#fef2f2', color: 'var(--primary)', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                      {r.target_type}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      background: r.status === 'pending' ? '#fffbeb' : r.status === 'resolved' ? '#f0fdf4' : 'var(--surface-card)',
                      color: r.status === 'pending' ? '#f59e0b' : r.status === 'resolved' ? '#16a34a' : 'var(--mute)'
                    }}>
                      {r.status === 'pending' ? 'Đang chờ' : r.status === 'resolved' ? 'Đã xử lý' : 'Bỏ qua'}
                    </span>
                    {r.resolved_action && (
                      <span style={{ padding: '2px 8px', background: 'var(--surface-card)', borderRadius: 6, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {r.resolved_action === 'hide_content' ? <><EyeOff size={10} /> Ẩn nội dung</> : r.resolved_action === 'lock_account' ? <><Lock size={10} /> Khóa TK</> : <><Eye size={10} /> Bỏ qua</>}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: 14, fontWeight: 700 }}>
                    Lý do: <span style={{ color: 'var(--primary)' }}>{r.reason}</span>
                  </p>
                  {r.description && <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>Mô tả: {r.description}</p>}
                  {r.target_preview && (
                    <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6, fontStyle: 'italic', padding: '8px 12px', background: 'white', borderRadius: 8, borderLeft: '3px solid var(--hairline)' }}>
                      "{r.target_preview}"
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--ash)', marginTop: 6 }}>
                    Bởi: <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--focus-outer)' }} onClick={() => onViewProfile?.(r.reporter_id)}>{r.reporter_name}</span> • {new Date(r.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>

                {r.status === 'pending' && (
                  <button onClick={() => setResolveId(r.id)} className="btn-primary" style={{ padding: '6px 16px', fontSize: 11, flexShrink: 0, marginLeft: 12 }}>
                    GIẢI QUYẾT
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReports;

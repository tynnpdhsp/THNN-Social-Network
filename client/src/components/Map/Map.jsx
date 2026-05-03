import React, { useState } from 'react';
import { MapPin, Navigation, Info, Search, Plus, Star, X, User, Send } from 'lucide-react';
import AddLocationModal from './AddLocationModal';

const locationTypes = ['Tất cả', 'Học tập', 'Ăn uống', 'Thể thao', 'Sự kiện', 'Nội trú'];

const initialLocations = [
  { id: 1, name: 'Thư viện Trung tâm', type: 'Học tập', x: 300, y: 200, status: 'Đang mở cửa', rating: 4.8, reviews: 156, description: 'Không gian yên tĩnh, đầy đủ tài liệu và wifi tốc độ cao.', image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=600' },
  { id: 2, name: 'Căn tin Khu A', type: 'Ăn uống', x: 500, y: 350, status: 'Đông đúc', rating: 4.2, reviews: 89, description: 'Đa dạng món ăn, giá cả sinh viên, sạch sẽ.', image: 'https://images.unsplash.com/photo-1567529684892-0f290465500c?auto=format&fit=crop&q=80&w=600' },
  { id: 3, name: 'Sân bóng đá', type: 'Thể thao', x: 150, y: 450, status: 'Trống', rating: 4.5, reviews: 45, description: 'Sân cỏ nhân tạo mới nâng cấp, có đèn chiếu sáng ban đêm.', image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=600' },
  { id: 4, name: 'Hội trường Lớn', type: 'Sự kiện', x: 700, y: 150, status: 'Có sự kiện', rating: 4.0, reviews: 120, description: 'Nơi tổ chức các buổi lễ và hội thảo quy mô lớn.', image: 'https://images.unsplash.com/photo-1505373630562-402923d98a08?auto=format&fit=crop&q=80&w=600' },
  { id: 5, name: 'Ký túc xá B', type: 'Nội trú', x: 850, y: 400, status: 'Đang mở cửa', rating: 4.3, reviews: 67, description: 'An ninh tốt, phòng ốc thoáng mát, đầy đủ tiện nghi.', image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&q=80&w=600' },
];

const Map = () => {
  const [locations, setLocations] = useState(initialLocations);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('Tất cả');
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeType === 'Tất cả' || loc.type === activeType;
    return matchesSearch && matchesType;
  });

  const handleAddLocation = (newLoc) => {
    const added = {
      ...newLoc,
      id: Date.now(),
      x: Math.random() * 800 + 50,
      y: Math.random() * 400 + 50,
      status: 'Mới thêm',
      rating: 5.0,
      reviews: 0,
      image: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=600'
    };
    setLocations([...locations, added]);
  };

  return (
    <div className="container" style={{ paddingTop: 24, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="heading-xl">Bản đồ học đường</h1>
        <div style={{ display: 'flex', gap: 12 }}>
           <div className="search-container" style={{ width: 240 }}>
             <Search size={18} />
             <input 
              type="text" 
              placeholder="Tìm địa điểm..." 
              className="input-field search-bar" 
              style={{ height: 44 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>
           <button className="btn-primary" style={{ gap: 8 }} onClick={() => setShowAddModal(true)}><Plus size={18} /> Thêm địa điểm</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
        {locationTypes.map(type => (
          <button 
            key={type}
            onClick={() => setActiveType(type)}
            style={{ 
              padding: '8px 20px', borderRadius: 'var(--rounded-full)', border: '1px solid var(--hairline)',
              background: activeType === type ? 'var(--ink)' : 'white',
              color: activeType === type ? 'white' : 'var(--body)',
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 24, height: '100%', overflow: 'hidden' }}>
        {/* Map Area */}
        <div style={{ 
          flex: 1, background: '#f0f4f8', borderRadius: 'var(--rounded-lg)', position: 'relative', 
          overflow: 'auto', border: '2px solid var(--hairline)',
        }}>
          <div style={{ 
            width: '100%', height: '100%', minWidth: 1000, minHeight: 600,
            position: 'relative',
            backgroundImage: 'radial-gradient(#d1d9e6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            transition: 'transform 0.3s ease-out'
          }}>
            {filteredLocations.map(loc => (
              <div key={loc.id} 
                onClick={() => setSelectedLocation(loc)}
                style={{
                  position: 'absolute', left: loc.x, top: loc.y, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ 
                  width: 40, height: 40, background: 'white', borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '2px solid var(--primary)'
                }}>
                  <MapPin size={24} color="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                </div>
                <div style={{ 
                  marginTop: 4, background: 'rgba(255,255,255,0.9)', padding: '2px 8px', 
                  borderRadius: 'var(--rounded-full)', fontSize: 11, fontWeight: 700,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap'
                }}>
                  {loc.name}
                </div>
              </div>
            ))}
          </div>

          {/* Zoom Controls Overlay */}
          <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100 }}>
            <button 
              className="btn-secondary" 
              style={{ width: 44, height: 44, padding: 0, borderRadius: '50%', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              onClick={handleZoomIn}
            >
              <Plus size={20} />
            </button>
            <button 
              className="btn-secondary" 
              style={{ width: 44, height: 44, padding: 0, borderRadius: '50%', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              onClick={handleZoomOut}
            >
              <span style={{ fontSize: 24, lineHeight: 0, marginTop: -4 }}>-</span>
            </button>
            <div style={{ 
              background: 'white', padding: '4px 8px', borderRadius: 'var(--rounded-md)', 
              fontSize: 12, fontWeight: 700, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
            }}>
              {Math.round(zoom * 100)}%
            </div>
          </div>
        </div>

        {/* Info Sidebar */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedLocation ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <img src={selectedLocation.image} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="caption-sm" style={{ background: 'var(--surface-card)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{selectedLocation.type}</span>
                    <h2 className="heading-lg" style={{ marginTop: 8 }}>{selectedLocation.name}</h2>
                  </div>
                  <button onClick={() => setSelectedLocation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                   <div style={{ display: 'flex', color: '#ffc107' }}>
                     <Star size={16} fill="#ffc107" />
                   </div>
                   <span style={{ fontWeight: 700 }}>{selectedLocation.rating}</span>
                   <span style={{ color: 'var(--mute)', fontSize: 13 }}>({selectedLocation.reviews} nhận xét)</span>
                </div>

                <p className="body-md" style={{ marginBottom: 24, color: 'var(--body)', opacity: 0.8 }}>{selectedLocation.description}</p>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <button className="btn-primary" style={{ flex: 1, gap: 8 }}><Navigation size={18} /> Chỉ đường</button>
                  <button className="btn-secondary" style={{ width: 48, height: 48, padding: 0 }}><Info size={20} /></button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', marginBottom: 24 }} />
                
                <h3 className="body-strong" style={{ marginBottom: 16 }}>Nhận xét cộng đồng</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                   <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={16} color="var(--mute)" />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>Tuấn Anh</p>
                        <p style={{ fontSize: 13, opacity: 0.7 }}>Địa điểm tuyệt vời để ôn thi!</p>
                      </div>
                   </div>
                   <div style={{ position: 'relative', marginTop: 8 }}>
                     <input type="text" placeholder="Viết nhận xét..." className="input-field" style={{ fontSize: 13, paddingRight: 40 }} />
                     <Send size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', cursor: 'pointer' }} />
                   </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32, color: 'var(--mute)', background: 'var(--surface-soft)', borderRadius: 'var(--rounded-lg)', border: '1px dashed var(--hairline)' }}>
              <MapPin size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <h3 className="heading-md">Chọn một địa điểm</h3>
              <p className="body-sm">Nhấn vào các ghim trên bản đồ để xem thông tin chi tiết và đánh giá.</p>
            </div>
          )}
        </div>
      </div>

      <AddLocationModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onAdd={handleAddLocation}
        locationTypes={locationTypes}
      />
    </div>
  );
};

export default Map;

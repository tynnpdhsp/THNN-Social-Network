import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapPin, Navigation, Info, Search, Plus, Star, X, User, Send, Bookmark } from 'lucide-react';
import AddLocationModal from './AddLocationModal';
import {
  getPlaceCategories,
  getNearbyPlaces,
  createPlace,
  getPlaceReviews,
  createPlaceReview,
  togglePlaceBookmark,
  checkPlaceBookmark,
  uploadPlaceImages
} from '../../services/placeService';
import { toast } from 'react-hot-toast';

const Map = () => {
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  const mapRef = useRef(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cats = await getPlaceCategories();
        setCategories(cats);

        const placesData = await getNearbyPlaces({ lat: 21.0285, lng: 105.8542, radius: 1000 });
        setLocations(placesData.data || []);
      } catch (error) {
        toast.error('Không thể tải dữ liệu bản đồ');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch reviews and bookmark status when a location is selected
  useEffect(() => {
    if (selectedLocation) {
      const fetchDetails = async () => {
        try {
          const reviewsData = await getPlaceReviews(selectedLocation.id);
          setReviews(reviewsData.items || []);

          const bookmarkStatus = await checkPlaceBookmark(selectedLocation.id);
          setIsBookmarked(bookmarkStatus.is_bookmarked);
        } catch (error) {
          console.error('Error fetching details:', error);
          // Don't toast here to avoid spamming if user clicks around fast
        }
      };
      fetchDetails();
    } else {
      setReviews([]);
      setIsBookmarked(false);
    }
  }, [selectedLocation?.id]); // Use ID as dependency to be more stable

  // Keep selected location data in sync with main locations list
  useEffect(() => {
    if (selectedLocation && locations.length > 0) {
      const updated = locations.find(l => l.id === selectedLocation.id);
      if (updated) {
        // Only update if data actually changed (to avoid infinite loops)
        if (JSON.stringify(updated) !== JSON.stringify(selectedLocation)) {
          setSelectedLocation(prev => ({ ...prev, ...updated }));
        }
      }
    }
  }, [locations]);

  // Coordinate normalization for the 1000x600 grid
  const mappedLocations = useMemo(() => {
    if (locations.length === 0) return [];

    // Find bounds
    const lats = locations.map(l => l.latitude).filter(l => l !== undefined);
    const lngs = locations.map(l => l.longitude).filter(l => l !== undefined);

    if (lats.length === 0) return [];

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDiff = maxLat - minLat || 0.00001;
    const lngDiff = maxLng - minLng || 0.00001;

    return locations.map(loc => ({
      ...loc,
      // Map to 50-1950 for X, 50-1150 for Y based on 2000x1200 canvas
      x: 100 + ((loc.longitude - minLng) / lngDiff) * 1800,
      y: 100 + (1 - (loc.latitude - minLat) / latDiff) * 1000
    }));
  }, [locations]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    // Zoom in/out based on wheel direction
    const zoomSpeed = 0.1;
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + zoomSpeed, 3));
    } else {
      setZoom(prev => Math.max(prev - zoomSpeed, 0.5));
    }
  };

  const filteredLocations = mappedLocations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeCategoryId === 'all' || loc.category?.id === activeCategoryId;
    return matchesSearch && matchesType;
  });

  const handleAddLocation = async (newLocData) => {
    try {
      const { files, ...placeData } = newLocData;
      const created = await createPlace(placeData);

      // If there are files, upload them
      if (files && files.length > 0) {
        await uploadPlaceImages(created.id, files);
      }

      // Refresh list to show new place (and potentially its image)
      const updatedPlace = await getNearbyPlaces({ lat: 21.0285, lng: 105.8542, radius: 1000 });
      setLocations(updatedPlace.data || []);

      toast.success('Đã thêm địa điểm mới!');
    } catch (error) {
      toast.error('Lỗi khi thêm địa điểm: ' + error.message);
    }
  };

  const handleToggleBookmark = async () => {
    if (!selectedLocation) return;
    try {
      await togglePlaceBookmark(selectedLocation.id);
      setIsBookmarked(!isBookmarked);
      toast.success(isBookmarked ? 'Đã bỏ lưu' : 'Đã lưu địa điểm');
    } catch (error) {
      toast.error('Lỗi khi xử lý lưu');
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedLocation || !newReview.comment) return;
    try {
      const createdReview = await createPlaceReview(selectedLocation.id, newReview);
      setReviews([createdReview, ...reviews]);
      setNewReview({ rating: 5, comment: '' });
      toast.success('Đã đăng nhận xét');

      // Refresh place data to update rating
      const updatedPlace = await getNearbyPlaces({ lat: 21.0285, lng: 105.8542, radius: 1000 });
      setLocations(updatedPlace.data || []);
    } catch (error) {
      toast.error('Lỗi khi đăng nhận xét');
    }
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
        <button
          onClick={() => setActiveCategoryId('all')}
          style={{
            padding: '8px 20px', borderRadius: 'var(--rounded-full)', border: '1px solid var(--hairline)',
            background: activeCategoryId === 'all' ? 'var(--ink)' : 'white',
            color: activeCategoryId === 'all' ? 'white' : 'var(--body)',
            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
          }}
        >
          Tất cả
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id)}
            style={{
              padding: '8px 20px', borderRadius: 'var(--rounded-full)', border: '1px solid var(--hairline)',
              background: activeCategoryId === cat.id ? 'var(--ink)' : 'white',
              color: activeCategoryId === cat.id ? 'white' : 'var(--body)',
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 24, height: '100%', overflow: 'hidden' }}>
        {/* Map Area */}
        <div
          ref={mapRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            flex: 1, background: '#f0f4f8', borderRadius: 'var(--rounded-lg)', position: 'relative',
            overflow: 'hidden', border: '2px solid var(--hairline)',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
        >
          <div style={{
            width: '100%', height: '100%', minWidth: 2000, minHeight: 1200,
            position: 'relative',
            backgroundImage: 'radial-gradient(#d1d9e6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}>
            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loader">Đang tải bản đồ...</div>
              </div>
            ) : filteredLocations.map(loc => (
              <div key={loc.id}
                onClick={() => setSelectedLocation(loc)}
                style={{
                  position: 'absolute', left: loc.x, top: loc.y, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s',
                  zIndex: selectedLocation?.id === loc.id ? 10 : 1
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{
                  width: 40, height: 40, background: 'white', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: selectedLocation?.id === loc.id ? '3px solid var(--ink)' : '2px solid var(--primary)'
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
            <div className="card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative' }}>
                <img src={selectedLocation.images?.[0]?.imageUrl || 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=600'} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                <button
                  onClick={handleToggleBookmark}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'white', border: 'none', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >
                  <Bookmark size={18} color={isBookmarked ? 'var(--primary)' : 'var(--mute)'} fill={isBookmarked ? 'var(--primary)' : 'none'} />
                </button>
              </div>

              <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="caption-sm" style={{ background: 'var(--surface-card)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{selectedLocation.category?.name}</span>
                    <h2 className="heading-lg" style={{ marginTop: 8 }}>{selectedLocation.name}</h2>
                  </div>
                  <button onClick={() => setSelectedLocation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', color: '#ffc107' }}>
                    <Star size={16} fill="#ffc107" />
                  </div>
                  <span style={{ fontWeight: 700 }}>{selectedLocation.avg_rating?.toFixed(1) || '0.0'}</span>
                  <span style={{ color: 'var(--mute)', fontSize: 13 }}>({selectedLocation.rating_count} nhận xét)</span>
                </div>

                <p className="body-md" style={{ marginBottom: 8, color: 'var(--body)', opacity: 0.8 }}>{selectedLocation.description}</p>
                <p className="caption-sm" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {selectedLocation.address || 'Không có địa chỉ'}</p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <button className="btn-primary" style={{ flex: 1, gap: 8 }}><Navigation size={18} /> Chỉ đường</button>
                  <button className="btn-secondary" style={{ width: 48, height: 48, padding: 0 }}><Info size={20} /></button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--hairline)', marginBottom: 24 }} />

                <h3 className="body-strong" style={{ marginBottom: 16 }}>Nhận xét cộng đồng</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviews.length > 0 ? reviews.map(rev => (
                    <div key={rev.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {rev.user_info?.avatar_url ? <img src={rev.user_info.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={16} color="var(--mute)" />}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>{rev.user_info?.full_name || 'Người dùng'}</p>
                        <div style={{ display: 'flex', color: '#ffc107', marginBottom: 2 }}>
                          {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < rev.rating ? '#ffc107' : 'none'} />)}
                        </div>
                        <p style={{ fontSize: 13, opacity: 0.7 }}>{rev.comment}</p>
                      </div>
                    </div>
                  )) : <p className="body-sm" style={{ textAlign: 'center', opacity: 0.5 }}>Chưa có nhận xét nào.</p>}

                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="Viết nhận xét..."
                      className="input-field"
                      style={{ fontSize: 13, paddingRight: 40 }}
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      onKeyPress={(e) => e.key === 'Enter' && handleSubmitReview()}
                    />
                    <Send
                      size={16}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', cursor: 'pointer' }}
                      onClick={handleSubmitReview}
                    />
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
        categories={categories}
      />
    </div>
  );
};

export default Map;

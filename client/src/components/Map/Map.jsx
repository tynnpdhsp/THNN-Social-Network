import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Info, Search, Plus, Star, X, User, Send, Bookmark, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { MapPin, Navigation, Info, Search, Plus, Star, X, User, Send } from 'lucide-react';
import { resolveImageUrl } from '../../config/api';
import AddLocationModal from './AddLocationModal';
import LocationInfoModal from './LocationInfoModal';
import Modal from '../Common/Modal';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import {
  getPlaceCategories,
  getNearbyPlaces,
  createPlace,
  getPlaceReviews,
  createPlaceReview,
  togglePlaceBookmark,
  checkPlaceBookmark,
  uploadPlaceImages,
  deletePlace,
  getCurrentUser
} from '../../services/placeService';
import { toast } from 'react-hot-toast';

// Fix Leaflet's default icon path issues
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Helper component to smoothly pan map to selected location
function MapUpdater({ selectedLocation }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLocation) {
      map.flyTo([selectedLocation.latitude, selectedLocation.longitude], 16, { duration: 1.5 });
    }
  }, [selectedLocation, map]);
  return null;
}

// Helper component to handle map clicks
function MapEventsHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

const Map = () => {
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  const defaultCenter = [10.762622, 106.660172]; // Saigon

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const cats = await getPlaceCategories();
        setCategories(cats);

        const placesData = await getNearbyPlaces({ lat: defaultCenter[0], lng: defaultCenter[1], radius: 50 });
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
        }
      };
      fetchDetails();
    } else {
      setReviews([]);
      setIsBookmarked(false);
    }
  }, [selectedLocation?.id]);

  // Keep selected location data in sync with main locations list
  useEffect(() => {
    if (selectedLocation && locations.length > 0) {
      const updated = locations.find(l => l.id === selectedLocation.id);
      if (updated) {
        if (JSON.stringify(updated) !== JSON.stringify(selectedLocation)) {
          setSelectedLocation(prev => ({ ...prev, ...updated }));
        }
      }
    }
  }, [locations]);

  const filteredLocations = locations.filter(loc => {
    const name = loc.name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeCategoryId === 'all' || loc.category?.id === activeCategoryId;
    return matchesSearch && matchesType;
  });

  const handleAddLocation = async (newLocData) => {
    try {
      const { files, ...placeData } = newLocData;
      const created = await createPlace(placeData);

      if (files && files.length > 0) {
        await uploadPlaceImages(created.id, files);
      }

      // Refresh list to show new place
      const updatedPlace = await getNearbyPlaces({ lat: defaultCenter[0], lng: defaultCenter[1], radius: 50 });
      setLocations(updatedPlace.data || []);

      toast.success('Đã thêm địa điểm mới!');
    } catch (error) {
      console.error('Error adding location:', error);
      toast.error('Lỗi khi thêm địa điểm: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleDeleteLocation = () => {
    if (!selectedLocation) return;
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!selectedLocation) return;
    try {
      await deletePlace(selectedLocation.id);
      toast.success('Đã xóa địa điểm');
      setShowDeleteConfirm(false);
      setSelectedLocation(null);

      // Refresh map
      const updatedPlace = await getNearbyPlaces({ lat: defaultCenter[0], lng: defaultCenter[1], radius: 50 });
      setLocations(updatedPlace.data || []);
    } catch (error) {
      toast.error('Lỗi khi xóa địa điểm');
      setShowDeleteConfirm(false);
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
      const updatedPlace = await getNearbyPlaces({ lat: defaultCenter[0], lng: defaultCenter[1], radius: 50 });
      setLocations(updatedPlace.data || []);
    } catch (error) {
      toast.error('Lỗi khi đăng nhận xét');
    }
  };

  // Determine if current user can delete
  const currentUser = getCurrentUser();
  const canDelete = selectedLocation && currentUser && (
    currentUser.role === 'admin' ||
    selectedLocation.user_info?.id === currentUser.id
  );

  return (
    <div className="container" style={{ paddingTop: 24, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="heading-xl">Bản đồ học đường</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', transform: 'translateY(55px)' }}>
          <div className="search-container" style={{ width: 240 }}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Tìm địa điểm..."
              className="input-field search-bar"
              style={{ height: 38, fontSize: 14, paddingLeft: 40 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn-primary" style={{ gap: 8, height: 38, padding: '0 16px', fontSize: 14 }} onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Thêm địa điểm
          </button>
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
        {/* Real Leaflet Map Area */}
        <div style={{ flex: 1, borderRadius: 'var(--rounded-lg)', overflow: 'hidden', border: '2px solid var(--hairline)', position: 'relative' }}>
          {loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, background: 'rgba(255,255,255,0.7)' }}>
              <div className="loader">Đang tải bản đồ...</div>
            </div>
          ) : null}
          <MapContainer center={defaultCenter} zoom={13} style={{ width: '100%', height: '100%', zIndex: 0 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapUpdater selectedLocation={selectedLocation} />
            <MapEventsHandler onMapClick={(latlng) => {
              setClickedCoords(latlng);
              setShowAddModal(true);
            }} />

            {filteredLocations.map(loc => (
              <Marker
                key={loc.id}
                position={[loc.latitude, loc.longitude]}
                eventHandlers={{
                  click: () => {
                    setSelectedLocation(loc);
                  },
                }}
              >
                <Popup>
                  <strong>{loc.name}</strong><br />
                  {loc.category?.name}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Info Sidebar */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selectedLocation ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative' }}>
                <img src={selectedLocation.images?.[0]?.image_url || 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=600'} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
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
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <img src={resolveImageUrl(selectedLocation.image_url || selectedLocation.image)} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="caption-sm" style={{ background: 'var(--surface-card)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{selectedLocation.category?.name}</span>
                    <h2 className="heading-lg" style={{ marginTop: 8 }}>{selectedLocation.name}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {canDelete && (
                      <button onClick={handleDeleteLocation} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', display: 'flex', padding: 4 }} title="Xóa địa điểm">
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button onClick={() => setSelectedLocation(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }} title="Đóng">
                      <X size={20} />
                    </button>
                  </div>
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
                  <button className="btn-primary" style={{ flex: 1, gap: 8 }} onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.latitude},${selectedLocation.longitude}`, '_blank')}><Navigation size={18} /> Chỉ đường</button>
                  <button className="btn-secondary" style={{ width: 48, height: 48, padding: 0 }} onClick={() => setShowInfoModal(true)} title="Thông tin chi tiết"><Info size={20} /></button>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Đánh giá của bạn:</span>
                      <div style={{ display: 'flex', gap: 4, cursor: 'pointer' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={18}
                            fill={star <= newReview.rating ? '#ffc107' : 'none'}
                            color={star <= newReview.rating ? '#ffc107' : 'var(--mute)'}
                            onClick={() => setNewReview({ ...newReview, rating: star })}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
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
        onClose={() => { setShowAddModal(false); setClickedCoords(null); }}
        onAdd={handleAddLocation}
        categories={categories}
        initialCoords={clickedCoords}
      />

      <LocationInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        location={selectedLocation}
      />

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Xóa địa điểm" width={400}>
        <p className="body-md" style={{ marginBottom: 24, lineHeight: 1.5 }}>
          Bạn có chắc chắn muốn xóa địa điểm <strong>{selectedLocation?.name}</strong> không? Hành động này sẽ xóa vĩnh viễn địa điểm và toàn bộ đánh giá liên quan.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Hủy bỏ</button>
          <button className="btn-primary" style={{ background: '#ff4d4f', border: 'none' }} onClick={executeDelete}>Xóa ngay</button>
        </div>
      </Modal>
    </div>
  );
};

export default Map;

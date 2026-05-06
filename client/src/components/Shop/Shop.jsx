import React, { useState } from 'react';
import { Heart, Plus, ShoppingBag, Search, Filter, Star, Edit2, Trash2, Tag, Book, PenTool, ChevronDown } from 'lucide-react';
import { resolveImageUrl } from '../../config/api';
import ProductDetailModal from './ProductDetailModal';
import AddProductModal from './AddProductModal';
import CartModal from './CartModal';

const categories = [
  { id: 'all', label: 'Tất cả', icon: <Tag size={16} /> },
  { id: 'docs', label: 'Tài liệu', icon: <Book size={16} /> },
  { id: 'books', label: 'Giáo trình', icon: <Book size={16} /> },
  { id: 'supplies', label: 'Vật dụng học tập', icon: <PenTool size={16} /> },
];

const initialProducts = [
  { id: 1, title: 'Balo học sinh phong cách Preppy', price: 450000, category: 'supplies', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400', height: 400, rating: 4.5, reviews: 12, description: 'Balo chất liệu bền bỉ, nhiều ngăn chứa đồ, phù hợp đi học và đi chơi.' },
  { id: 2, title: 'Sổ tay Planner 2026', price: 120000, category: 'supplies', image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=400', height: 300, rating: 5, reviews: 8, description: 'Sổ tay thiết kế tinh tế, giấy chống lóa, giúp bạn lập kế hoạch hiệu quả.' },
  { id: 3, title: 'Bút marker Pastel (Bộ 12 màu)', price: 210000, category: 'supplies', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=400', height: 500, rating: 4.8, reviews: 24, description: 'Bộ bút màu pastel nhẹ nhàng, mực ra đều, không bị thấm sang trang sau.' },
  { id: 4, title: 'Đèn bàn học chống cận thị', price: 890000, category: 'supplies', image: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&q=80&w=400', height: 450, rating: 4.2, reviews: 15, description: 'Đèn LED bảo vệ mắt, có thể điều chỉnh độ sáng và nhiệt độ màu.' },
  { id: 5, title: 'Tài liệu ôn thi đại học môn Toán', price: 50000, category: 'docs', image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400', height: 350, rating: 4.9, reviews: 45, description: 'Tổng hợp các dạng bài tập hay và khó, có lời giải chi tiết.' },
  { id: 6, title: 'Giáo trình Kinh tế vi mô', price: 150000, category: 'books', image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400', height: 480, rating: 4.0, reviews: 5, description: 'Sách mới 95%, không gạch xóa, đầy đủ các chương học.' },
];

const Shop = () => {
  const [products, setProducts] = useState(initialProducts);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState(2000000); 
  const [sortBy, setSortBy] = useState('popular');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  const sortOptions = [
    { value: 'popular', label: 'Mới nhất' },
    { value: 'rating', label: 'Đánh giá cao' },
    { value: 'price-asc', label: 'Giá tăng dần' },
    { value: 'price-desc', label: 'Giá giảm dần' },
  ];

  const filteredProducts = products
    .filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = p.price <= priceRange;
      return matchesCategory && matchesSearch && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });

  const addToCart = (product) => {
    setCartItems([...cartItems, product]);
  };

  const removeFromCart = (index) => {
    const newCart = [...cartItems];
    newCart.splice(index, 1);
    setCartItems(newCart);
  };

  const addProduct = (newProduct) => {
    const product = {
      ...newProduct,
      id: Date.now(),
      price: parseInt(newProduct.price),
      height: 350,
      rating: 5.0,
      reviews: 0,
      image: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=600'
    };
    setProducts([product, ...products]);
  };

  return (
    <div className="container" style={{ paddingTop: 24, display: 'flex', gap: 32 }}>
      {/* Filter Sidebar */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <button 
          className="btn-primary" 
          style={{ width: '100%', marginBottom: 32, height: 48 }}
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={20} /> Đăng bán vật phẩm
        </button>

        <div style={{ marginBottom: 32 }}>
          <h3 className="heading-md" style={{ marginBottom: 16 }}>Tìm kiếm</h3>
          <div className="search-container">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Nhập từ khóa..." 
              className="input-field search-bar" 
              style={{ height: 44 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h3 className="heading-md" style={{ marginBottom: 16 }}>Danh mục</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  border: 'none', borderRadius: 'var(--rounded-md)', cursor: 'pointer',
                  background: activeCategory === cat.id ? 'var(--surface-card)' : 'transparent',
                  fontWeight: activeCategory === cat.id ? 700 : 500,
                  color: activeCategory === cat.id ? 'var(--primary)' : 'var(--body)',
                  textAlign: 'left'
                }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="heading-md" style={{ marginBottom: 16 }}>Khoảng giá (Dưới {priceRange.toLocaleString()}đ)</h3>
          <input 
            type="range" 
            min="0" 
            max="2000000" 
            step="50000"
            value={priceRange}
            onChange={(e) => setPriceRange(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--mute)' }}>
            <span>0đ</span>
            <span>2.000.000đ</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="heading-xl">Cửa hàng học tập</h1>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="btn-secondary" 
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 8, 
                  background: 'var(--surface-card)', minWidth: 160, 
                  justifyContent: 'space-between', padding: '10px 20px' 
                }}
              >
                {sortOptions.find(o => o.value === sortBy).label}
                <ChevronDown size={18} style={{ transform: isSortOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
              </button>
              
              {isSortOpen && (
                <div style={{ 
                  position: 'absolute', top: '120%', right: 0, width: '100%', 
                  background: 'white', borderRadius: 'var(--rounded-md)', 
                  boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 500,
                  overflow: 'hidden', padding: '8px', border: '1px solid var(--hairline)'
                }}>
                  {sortOptions.map(option => (
                    <div 
                      key={option.value}
                      onClick={() => { setSortBy(option.value); setIsSortOpen(false); }}
                      style={{ 
                        padding: '10px 12px', borderRadius: 'var(--rounded-sm)',
                        cursor: 'pointer', fontSize: 14, fontWeight: sortBy === option.value ? 700 : 500,
                        background: sortBy === option.value ? 'var(--surface-soft)' : 'transparent',
                        color: sortBy === option.value ? 'var(--primary)' : 'var(--body)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = sortBy === option.value ? 'var(--surface-soft)' : 'transparent'}
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button 
              className="btn-secondary" 
              style={{ display: 'flex', gap: 8, border: '1px solid var(--hairline)' }}
              onClick={() => setIsCartModalOpen(true)}
            >
              <ShoppingBag size={20} color="var(--primary)" /> Giỏ hàng ({cartItems.length})
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--mute)' }}>
            <Search size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Không tìm thấy vật phẩm nào phù hợp.</p>
          </div>
        ) : (
          <div style={{ columnCount: 3, columnGap: 16 }}>
            {filteredProducts.map((product) => (
              <div key={product.id} className="pin-card" 
                onClick={() => setSelectedProduct(product)}
                style={{ marginBottom: 16, breakInside: 'avoid', display: 'inline-block', width: '100%' }}
              >
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--rounded-md)' }}>
                  <img src={resolveImageUrl(product.image_url || product.image)} alt={product.title} style={{ width: '100%', height: product.height, objectFit: 'cover' }} />
                  <div className="overlay" style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.2)', opacity: 0, transition: 'opacity 0.2s',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 12
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                  >
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" style={{ width: 36, height: 36, padding: 0, borderRadius: '50%', background: 'white' }} onClick={(e) => { e.stopPropagation(); /* Edit logic */ }}><Edit2 size={16} /></button>
                      <button className="btn-secondary" style={{ width: 36, height: 36, padding: 0, borderRadius: '50%', background: 'white', color: 'var(--primary)' }} onClick={(e) => { e.stopPropagation(); /* Delete logic */ }}><Trash2 size={16} /></button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                       <button 
                        className="btn-primary" 
                        style={{ padding: '8px 16px', fontSize: 14 }}
                        onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                       >
                         Thêm vào giỏ
                       </button>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '12px 4px' }}>
                  <h3 className="body-strong" style={{ fontSize: 15, marginBottom: 4 }}>{product.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <div style={{ display: 'flex', color: '#ffc107' }}>
                      <Star size={12} fill="#ffc107" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{product.rating}</span>
                    <span style={{ fontSize: 12, color: 'var(--mute)' }}>({product.reviews})</span>
                  </div>
                  <p className="body-md" style={{ color: 'var(--primary)', fontWeight: 800 }}>{product.price.toLocaleString()}đ</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductDetailModal 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        product={selectedProduct || {}} 
      />

      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={addProduct}
      />

      <CartModal 
        isOpen={isCartModalOpen} 
        onClose={() => setIsCartModalOpen(false)} 
        cartItems={cartItems}
        onRemove={removeFromCart}
      />
    </div>
  );
};

export default Shop;

import React, { useState, useEffect } from 'react';
import { Heart, Plus, ShoppingBag, Search, Filter, Star, Edit2, Trash2, Tag, Book, PenTool, ChevronDown, Loader } from 'lucide-react';
import ProductDetailModal from './ProductDetailModal';
import AddProductModal from './AddProductModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import * as shopService from '../../services/shopService';

// Mảng các category icon có thể bỏ nếu ta dùng trực tiếp từ backend
const hardcodedCategories = [
  { id: 'all', label: 'Tất cả', icon: <Tag size={16} /> },
  { id: 'docs', label: 'Tài liệu', icon: <Book size={16} /> },
  { id: 'books', label: 'Giáo trình', icon: <Book size={16} /> },
  { id: 'supplies', label: 'Vật dụng học tập', icon: <PenTool size={16} /> },
];



const Shop = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState(100000000); 
  const [sortBy, setSortBy] = useState('popular');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await shopService.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Lỗi khi tải danh mục:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const data = await shopService.getItems({ limit: 100 });
      console.log("Danh sách sản phẩm từ API:", data.items);
      setProducts(data.items || []);
    } catch (error) {
      console.error('Lỗi khi tải sản phẩm:', error);
    } finally {
      setIsLoading(false);
    }
  };



  const sortOptions = [
    { value: 'popular', label: 'Mới nhất' },
    { value: 'rating', label: 'Đánh giá cao' },
    { value: 'price-asc', label: 'Giá tăng dần' },
    { value: 'price-desc', label: 'Giá giảm dần' },
  ];

  const filteredProducts = products
    .filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category_id === activeCategory;
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = p.price <= priceRange;
      return matchesCategory && matchesSearch && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0);
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });

  const buyNow = async (product) => {
    console.log("Bắt đầu mua hàng cho sản phẩm:", product);
    try {
      const orderData = {
        item_id: product.id,
        amount: product.price,
        payment_method: 'vnpay'
      };
      console.log("Dữ liệu đơn hàng gửi đi:", orderData);
      const order = await shopService.createOrder(orderData);
      console.log("Đơn hàng đã tạo:", order);
      
      // Sau khi tạo đơn hàng, lấy link thanh toán VNPAY
      const paymentData = {
        order_id: order.id,
        ip_addr: '127.0.0.1', // Trong thực tế nên lấy IP thật của client
        order_type: 'billpayment'
      };
      
      const vnpayRes = await shopService.createVNPayUrl(paymentData);
      
      if (vnpayRes.payment_url) {
        alert("Đang chuyển hướng đến cổng thanh toán VNPAY...");
        window.location.href = vnpayRes.payment_url;
      } else {
        throw new Error("Không lấy được link thanh toán");
      }
    } catch (error) {
      alert("Lỗi khi thanh toán: " + error.message);
    }
  };

  const addProduct = async (newProduct, images) => {
    try {
      if (productToEdit) {
        // Edit mode
        const itemData = {
          title: newProduct.title,
          price: parseInt(newProduct.price),
          description: newProduct.description,
        };
        await shopService.updateItem(productToEdit.id, itemData);
        alert("Cập nhật thành công");
      } else {
        // Create mode
        let imageUrls = [];
        if (images && images.length > 0) {
          const uploadRes = await shopService.uploadItemImages(images);
          imageUrls = uploadRes.image_urls || [];
        }

        const itemData = {
          title: newProduct.title,
          price: parseInt(newProduct.price),
          category_id: newProduct.category,
          description: newProduct.description,
          image_urls: imageUrls,
          condition: 'new',
          stock: 1
        };

        await shopService.createItem(itemData);
        alert("Đăng bán thành công");
      }
      fetchProducts();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await shopService.deleteItem(productToDelete.id);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      fetchProducts();
      alert("Đã xoá vật phẩm");
    } catch (error) {
      alert("Lỗi xoá vật phẩm: " + error.message);
    }
  };

  const handleEditClick = (product) => {
    setProductToEdit(product);
    setIsAddModalOpen(true);
  };

  return (
    <div className="container" style={{ paddingTop: 24, display: 'flex', gap: 32 }}>
      {/* Filter Sidebar */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <button 
          className="btn-primary" 
          style={{ width: '100%', marginBottom: 32, height: 48 }}
          onClick={() => { setProductToEdit(null); setIsAddModalOpen(true); }}
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
            <button 
                onClick={() => setActiveCategory('all')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  border: 'none', borderRadius: 'var(--rounded-md)', cursor: 'pointer',
                  background: activeCategory === 'all' ? 'var(--surface-card)' : 'transparent',
                  fontWeight: activeCategory === 'all' ? 700 : 500,
                  color: activeCategory === 'all' ? 'var(--primary)' : 'var(--body)',
                  textAlign: 'left'
                }}
              >
                <Tag size={16} /> Tất cả
            </button>
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
                <Tag size={16} /> {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="heading-md" style={{ marginBottom: 16 }}>Khoảng giá (Dưới {priceRange.toLocaleString()}đ)</h3>
          <input 
            type="range" 
            min="0" 
            max="100000000" 
            step="50000"
            value={priceRange}
            onChange={(e) => setPriceRange(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--mute)' }}>
            <span>0đ</span>
            <span>100.000.000đ</span>
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
            <div className="search-container" style={{ display: 'none' }}>
              <ShoppingBag size={20} color="var(--primary)" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '64px 0' }}>
            <Loader className="spin" size={48} color="var(--primary)" />
          </div>
        ) : filteredProducts.length === 0 ? (
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
                  <img src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=600'} alt={product.title} style={{ width: '100%', height: 350, objectFit: 'cover' }} />
                  <div className="overlay" style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.2)', opacity: 0, transition: 'opacity 0.2s',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 12
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
                  >
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn-secondary" style={{ width: 36, height: 36, padding: 0, borderRadius: '50%', background: 'white' }} onClick={(e) => { e.stopPropagation(); handleEditClick(product); }}><Edit2 size={16} /></button>
                      <button className="btn-secondary" style={{ width: 36, height: 36, padding: 0, borderRadius: '50%', background: 'white', color: 'var(--primary)' }} onClick={(e) => { e.stopPropagation(); handleDeleteClick(product); }}><Trash2 size={16} /></button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                       <button 
                        className="btn-primary" 
                        style={{ padding: '8px 16px', fontSize: 14 }}
                        onClick={(e) => { e.stopPropagation(); buyNow(product); }}
                       >
                         Mua ngay
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
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{product.avg_rating || 0}</span>
                    <span style={{ fontSize: 12, color: 'var(--mute)' }}>({product.rating_count || 0})</span>
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
        onBuyNow={buyNow}
      />

      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setProductToEdit(null); }} 
        onAdd={addProduct}
        categories={categories}
        productToEdit={productToEdit}
      />



      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        itemName={productToDelete?.title || ""}
      />
    </div>
  );
};

export default Shop;

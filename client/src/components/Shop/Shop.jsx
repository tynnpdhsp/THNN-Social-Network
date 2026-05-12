import React, { useState, useEffect } from 'react';
import { Heart, Plus, ShoppingBag, Search, Filter, Star, Edit2, Trash2, Tag, Book, PenTool, ChevronDown, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductDetailModal from './ProductDetailModal';
import AddProductModal from './AddProductModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import CartDrawer from './CartDrawer';
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
  const [priceRange, setPriceRange] = useState(10000000); // Max slider value = no filter
  const [sortBy, setSortBy] = useState('popular');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [isCartLoading, setIsCartLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchCart();
  }, []);

  async function fetchCategories() {
    try {
      const data = await shopService.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Lỗi khi tải danh mục:', error);
    }
  };

  async function fetchProducts() {
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

  async function fetchCart() {
    try {
      setIsCartLoading(true);
      const data = await shopService.getCart();
      setCartItems(data.items || []);
    } catch (error) {
      console.error('Lỗi khi tải giỏ hàng:', error);
    } finally {
      setIsCartLoading(false);
    }
  };

  const handleAddToCart = async (product, quantity = 1) => {
    try {
      await shopService.addToCart(product.id, quantity);
      toast.success(`Đã thêm ${product.title} vào giỏ hàng`);
      fetchCart();
    } catch (error) {
      toast.error("Lỗi khi thêm vào giỏ hàng: " + error.message);
    }
  };

  const handleUpdateCartQuantity = async (itemId, quantity) => {
    try {
      await shopService.updateCartItem(itemId, quantity);
      fetchCart();
    } catch (error) {
      toast.error("Lỗi khi cập nhật số lượng");
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    try {
      await shopService.removeFromCart(itemId);
      toast.success("Đã xóa khỏi giỏ hàng");
      fetchCart();
    } catch (error) {
      toast.error("Lỗi khi xóa sản phẩm");
    }
  };

  const handleCartCheckout = async () => {
    if (cartItems.length === 0) return;
    
    // For now, checkout the first item as the backend Order model 
    // only supports one item at a time.
    // In a real app, we'd create a multi-item order.
    try {
      const firstItem = cartItems[0];
      await buyNow(firstItem.item);
      setIsCartOpen(false);
    } catch (error) {
      toast.error("Lỗi khi thanh toán");
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
      if (!p) return false;
      const title = p.title || '';
      const price = p.price || 0;
      const matchesCategory = activeCategory === 'all' || p.category_id === activeCategory;
      const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = priceRange >= 10000000 || price <= priceRange;
      return matchesCategory && matchesSearch && matchesPrice;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      const ratingA = a.avg_rating || 0;
      const ratingB = b.avg_rating || 0;
      if (sortBy === 'rating') return ratingB - ratingA;
      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
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
        toast.loading("Đang chuyển hướng đến cổng thanh toán VNPAY...", { duration: 2000 });
        setTimeout(() => {
          window.location.href = vnpayRes.payment_url;
        }, 1000);
      } else {
        throw new Error("Không lấy được link thanh toán");
      }
    } catch (error) {
      toast.error("Lỗi khi thanh toán: " + error.message);
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
        toast.success("Cập nhật thành công");
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
        toast.success("Đăng bán thành công");
      }
      fetchProducts();
    } catch (error) {
      toast.error("Lỗi: " + error.message);
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
      toast.success("Đã xoá vật phẩm");
    } catch (error) {
      toast.error("Lỗi xoá vật phẩm: " + error.message);
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
              style={{ height: 44, background: 'white', border: '1px solid var(--hairline)' }}
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
          <h3 className="heading-md" style={{ marginBottom: 16 }}>Khoảng giá (Dưới {priceRange.toLocaleString('vi-VN')}đ)</h3>
          <input 
            type="range" 
            min="0" 
            max="10000000" 
            step="50000"
            value={priceRange}
            onChange={(e) => setPriceRange(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--mute)' }}>
            <span>0đ</span>
            <span>10.000.000đ</span>
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
                {sortOptions.find(o => o.value === sortBy)?.label || 'Sắp xếp'}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {filteredProducts.map((product) => (
              <div key={product.id} className="pin-card" 
                onClick={() => setSelectedProduct(product)}
                style={{ width: '100%' }}
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
                     <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                       <button 
                         className="btn-secondary" 
                         style={{ width: 40, height: 40, padding: 0, borderRadius: '50%', background: 'white' }}
                         onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                       >
                         <ShoppingBag size={18} color="var(--primary)" />
                       </button>
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
                  <p className="body-md" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                    {product.price === 0 ? 'Miễn phí' : `${(product.price || 0).toLocaleString('vi-VN')}đ`}
                  </p>
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
        onAddToCart={handleAddToCart}
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

      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCartCheckout}
        isLoading={isCartLoading}
      />

      {/* Floating Cart Button */}
      <div className="cart-icon-floating" onClick={() => setIsCartOpen(true)}>
        <ShoppingBag size={24} color="white" />
        {cartItems.length > 0 && <span className="cart-badge-floating">{cartItems.length}</span>}
      </div>

      <style jsx>{`
        .cart-icon-container {
          position: relative;
          width: 48px;
          height: 48px;
          background: white;
          border: 1px solid var(--hairline);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cart-icon-container:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }

        .cart-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--primary);
          color: white;
          font-size: 10px;
          font-weight: 700;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }

        .cart-badge-inline {
          background: var(--primary);
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .sidebar-cart-list::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-cart-list::-webkit-scrollbar-track {
          background: var(--surface-soft);
        }
        .sidebar-cart-list::-webkit-scrollbar-thumb {
          background: var(--ash);
          border-radius: 2px;
        }

        .cart-icon-floating {
          position: fixed;
          bottom: 32px;
          right: 32px;
          width: 64px;
          height: 64px;
          background: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 12px 32px rgba(230, 0, 35, 0.4);
          z-index: 900;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .cart-icon-floating:hover {
          transform: scale(1.1) translateY(-4px);
          box-shadow: 0 16px 40px rgba(230, 0, 35, 0.5);
        }

        .cart-badge-floating {
          position: absolute;
          top: 0;
          right: 0;
          background: #ff4757;
          color: white;
          font-size: 12px;
          font-weight: 800;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes popIn {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default Shop;

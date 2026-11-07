import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Helper to parse rates formatted like "Nos @ 350" or "sqft @ 450"
function parseRate(ratesStr) {
  if (!ratesStr) return 0;
  const parts = ratesStr.split('@');
  if (parts.length > 1) {
    return parseFloat(parts[1].trim()) || 0;
  }
  return parseFloat(ratesStr) || 0;
}

export function MultiProductDropdown({ onAddProduct }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('product', { ascending: true });

        if (error) throw error;
        if (data) setProducts(data);
      } catch (err) {
        console.error('Error fetching products from Supabase:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p =>
    (p.product || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={15} style={{ position: 'absolute', left: '10px', color: '#888' }} />
        <input
          type="text"
          className="form-control"
          style={{ paddingLeft: '32px' }}
          placeholder="Search products by name or category..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {loading && (
          <Loader2 size={15} className="animate-spin" style={{ position: 'absolute', right: '10px', color: '#888' }} />
        )}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: '#fff',
          border: '1px solid #ced4da',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{ padding: '12px 14px', fontSize: '13px', color: '#6c757d', textAlign: 'center' }}>
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: '13px', color: '#6c757d' }}>
              No products found.
            </div>
          ) : (
            filteredProducts.map((prod, idx) => {
              const numericRate = parseRate(prod.rates);
              const unit = prod.spec || 'Nos';

              return (
                <div
                  key={prod.id || idx}
                  onClick={() => {
                    onAddProduct({
                      description: prod.product,
                      hsn: prod.hsn || '',
                      quantity: 1,
                      rate: numericRate,
                      baseRate: numericRate,
                      per: unit
                    });
                    setQuery('');
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderBottom: idx < filteredProducts.length - 1 ? '1px solid #f1f3f5' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: '#212529' }}>{prod.product}</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>
                      Category: {prod.category} | {prod.rates}
                    </div>
                  </div>
                  <Plus size={14} color="var(--cc-teal)" />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

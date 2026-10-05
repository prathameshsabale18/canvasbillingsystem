import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export function ProductSelectDropdown({ onSelectProduct }) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data || []);
        setFilteredProducts(data || []);
      }
      setLoading(false);
    }
    fetchProducts();

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (!val.trim()) {
      setFilteredProducts(products);
    } else {
      const matches = products.filter(p =>
        p.product?.toLowerCase().includes(val.toLowerCase()) ||
        p.category?.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredProducts(matches);
    }
  };

  const handleSelect = (prod) => {
    setQuery(prod.product);
    setIsOpen(false);
    onSelectProduct(prod);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        onFocus={() => setIsOpen(true)}
        placeholder={loading ? "Loading products..." : "Search product name or category..."}
        className="border p-2 rounded w-full bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isOpen && filteredProducts.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg">
          {filteredProducts.map((prod) => (
            <li
              key={prod.id}
              onClick={() => handleSelect(prod)}
              className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-sm transition-colors"
            >
              <div className="font-medium text-gray-900">{prod.product}</div>
              <div className="text-xs text-gray-500 flex justify-between mt-0.5">
                <span>{prod.category}</span>
                <span className="font-semibold text-blue-600">{prod.rates}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

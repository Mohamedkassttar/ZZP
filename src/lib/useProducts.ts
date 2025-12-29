import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface Product {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  sku: string | null;
  is_active: boolean;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser?.company_id) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyUser.company_id)
        .eq('is_active', true)
        .order('name');

      if (fetchError) {
        setError(fetchError.message);
        console.error('Error loading products:', fetchError);
        return;
      }

      setProducts(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }

  function searchProducts(query: string): Product[] {
    if (!query.trim()) {
      return products;
    }

    const lowerQuery = query.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        (product.description && product.description.toLowerCase().includes(lowerQuery)) ||
        (product.sku && product.sku.toLowerCase().includes(lowerQuery))
    );
  }

  return { products, loading, error, searchProducts, reload: loadProducts };
}

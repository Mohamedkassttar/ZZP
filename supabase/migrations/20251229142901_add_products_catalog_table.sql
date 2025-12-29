/*
  # Product & Services Catalog

  1. New Tables
    - `products`
      - `id` (uuid, primary key) - Unique identifier
      - `created_at` (timestamptz) - Creation timestamp
      - `company_id` (uuid, FK) - Reference to companies table for multi-tenant support
      - `name` (text, required) - Product/service name
      - `description` (text, optional) - Detailed description
      - `price` (numeric, default 0) - Default price
      - `unit` (text, default 'stuk') - Unit type (uur, stuk, project, etc.)
      - `sku` (text, optional) - Stock Keeping Unit / product code
      - `is_active` (boolean, default true) - Soft delete flag
  
  2. Security
    - Enable RLS on `products` table
    - Add policies for authenticated users to manage their own products
  
  3. Indexes
    - Index on company_id for fast lookups
    - Index on name for search functionality
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'stuk',
  sku text,
  is_active boolean DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view products from their companies
CREATE POLICY "Users can view products from their companies"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert products into their companies
CREATE POLICY "Users can insert products into their companies"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to update products in their companies
CREATE POLICY "Users can update products in their companies"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to delete products in their companies
CREATE POLICY "Users can delete products in their companies"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

/*
  # Fix RLS Policies for Time Entries and Products - Allow Anonymous Access

  ## Problem
  - time_entries and products tables still have authenticated-only RLS policies
  - The application has NO auth implementation (no login/signup)
  - All queries are made as "anon" role
  - Result: All queries fail with "No user logged in" error

  ## Solution
  1. Drop existing authenticated-only policies
  2. Create new policies that allow public access
  3. Make user_id nullable in time_entries (optional for single-tenant)

  ## Tables Updated
  - time_entries
  - products
*/

-- ==========================================
-- time_entries: Drop Authenticated Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can delete own time entries" ON time_entries;

-- ==========================================
-- time_entries: Create Public Access Policy
-- ==========================================

CREATE POLICY "Development: Allow public access"
  ON time_entries FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- products: Drop Authenticated Policies
-- ==========================================

DROP POLICY IF EXISTS "Users can view products from their companies" ON products;
DROP POLICY IF EXISTS "Users can insert products into their companies" ON products;
DROP POLICY IF EXISTS "Users can update products in their companies" ON products;
DROP POLICY IF EXISTS "Users can delete products in their companies" ON products;

-- ==========================================
-- products: Create Public Access Policy
-- ==========================================

CREATE POLICY "Development: Allow public access"
  ON products FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- time_entries: Make user_id nullable
-- ==========================================

ALTER TABLE time_entries ALTER COLUMN user_id DROP NOT NULL;

-- ==========================================
-- products: Make company_id nullable
-- ==========================================

ALTER TABLE products ALTER COLUMN company_id DROP NOT NULL;
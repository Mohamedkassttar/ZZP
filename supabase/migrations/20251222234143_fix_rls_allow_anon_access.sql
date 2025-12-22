/*
  # Fix RLS Policies - Allow Anonymous Access
  
  ## Problem
  - Current RLS policies only allow "authenticated" users
  - The application has NO auth implementation (no login/signup)
  - All queries are made as "anon" role
  - Result: All queries return 0 rows (RLS blocks everything)
  
  ## Root Cause
  - RLS policies: `TO authenticated USING (true)`
  - App queries: Made with anon role
  - Mismatch: anon ≠ authenticated → 0 results
  
  ## Solution
  1. Drop existing authenticated-only policies
  2. Create new policies that allow BOTH authenticated AND anon users
  3. Use `TO public` instead of `TO authenticated`
  
  ## Security Note
  - This is appropriate for development/demo environments
  - For production, implement proper authentication
  
  ## Tables Updated
  - accounts
  - journal_entries
  - journal_lines
  - contacts
  - bank_transactions
  - bank_rules
  - fiscal_years
  - documents_inbox
  - purchase_invoices
  - sales_invoices
  - invoices
  - invoice_lines
  - mileage_logs
*/

-- ==========================================
-- STEP 1: Drop Authenticated-Only Policies
-- ==========================================

DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON accounts;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON journal_entries;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON journal_lines;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON contacts;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON bank_transactions;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON bank_rules;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON fiscal_years;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON documents_inbox;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON purchase_invoices;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON sales_invoices;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON invoices;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON invoice_lines;
DROP POLICY IF EXISTS "Single tenant: Allow all authenticated users" ON mileage_logs;

-- ==========================================
-- STEP 2: Create Public Access Policies
-- ==========================================

-- accounts
CREATE POLICY "Development: Allow public access"
  ON accounts FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- journal_entries  
CREATE POLICY "Development: Allow public access"
  ON journal_entries FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- journal_lines
CREATE POLICY "Development: Allow public access"
  ON journal_lines FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- contacts
CREATE POLICY "Development: Allow public access"
  ON contacts FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- bank_transactions
CREATE POLICY "Development: Allow public access"
  ON bank_transactions FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- bank_rules
CREATE POLICY "Development: Allow public access"
  ON bank_rules FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- fiscal_years
CREATE POLICY "Development: Allow public access"
  ON fiscal_years FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- documents_inbox
CREATE POLICY "Development: Allow public access"
  ON documents_inbox FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- purchase_invoices
CREATE POLICY "Development: Allow public access"
  ON purchase_invoices FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- sales_invoices
CREATE POLICY "Development: Allow public access"
  ON sales_invoices FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- invoices
CREATE POLICY "Development: Allow public access"
  ON invoices FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- invoice_lines
CREATE POLICY "Development: Allow public access"
  ON invoice_lines FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- mileage_logs
CREATE POLICY "Development: Allow public access"
  ON mileage_logs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
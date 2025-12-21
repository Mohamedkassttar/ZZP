/*
  # Update RLS Policies for Invoicing and Asset Tables
  
  ## Overview
  Updates the RLS policies for invoices, invoice_lines, fixed_assets, mileage_logs,
  and settings tables to allow both authenticated and anonymous users.
  
  ## Changes
  1. Drop existing restrictive policies for all tables
  2. Create new policies that allow both anon and authenticated roles
  
  ## Security Note
  Appropriate for single-user accounting application using anon key.
*/

-- Update policies for invoices
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON invoices;

CREATE POLICY "Users can view invoices"
  ON invoices FOR SELECT
  USING (true);

CREATE POLICY "Users can insert invoices"
  ON invoices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update invoices"
  ON invoices FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete invoices"
  ON invoices FOR DELETE
  USING (true);

-- Update policies for invoice_lines
DROP POLICY IF EXISTS "Authenticated users can view invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can insert invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can update invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can delete invoice lines" ON invoice_lines;

CREATE POLICY "Users can view invoice lines"
  ON invoice_lines FOR SELECT
  USING (true);

CREATE POLICY "Users can insert invoice lines"
  ON invoice_lines FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update invoice lines"
  ON invoice_lines FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete invoice lines"
  ON invoice_lines FOR DELETE
  USING (true);

-- Update policies for fixed_assets
DROP POLICY IF EXISTS "Authenticated users can view fixed assets" ON fixed_assets;
DROP POLICY IF EXISTS "Authenticated users can insert fixed assets" ON fixed_assets;
DROP POLICY IF EXISTS "Authenticated users can update fixed assets" ON fixed_assets;
DROP POLICY IF EXISTS "Authenticated users can delete fixed assets" ON fixed_assets;

CREATE POLICY "Users can view fixed assets"
  ON fixed_assets FOR SELECT
  USING (true);

CREATE POLICY "Users can insert fixed assets"
  ON fixed_assets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update fixed assets"
  ON fixed_assets FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete fixed assets"
  ON fixed_assets FOR DELETE
  USING (true);

-- Update policies for mileage_logs
DROP POLICY IF EXISTS "Authenticated users can view mileage logs" ON mileage_logs;
DROP POLICY IF EXISTS "Authenticated users can insert mileage logs" ON mileage_logs;
DROP POLICY IF EXISTS "Authenticated users can update mileage logs" ON mileage_logs;
DROP POLICY IF EXISTS "Authenticated users can delete mileage logs" ON mileage_logs;

CREATE POLICY "Users can view mileage logs"
  ON mileage_logs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert mileage logs"
  ON mileage_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update mileage logs"
  ON mileage_logs FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete mileage logs"
  ON mileage_logs FOR DELETE
  USING (true);

-- Update policies for settings
DROP POLICY IF EXISTS "Authenticated users can view settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON settings;

CREATE POLICY "Users can view settings"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert settings"
  ON settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update settings"
  ON settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete settings"
  ON settings FOR DELETE
  USING (true);
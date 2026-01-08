/*
  # Fix Company Settings for Anonymous Access

  1. Changes
    - Make company_id nullable (optional)
    - Drop all existing RLS policies
    - Create simple anonymous access policies
    - Remove unique constraint on company_id

  2. Security
    - Allow full anonymous access like rest of application
    - Single settings record for entire application
*/

-- Make company_id nullable
ALTER TABLE company_settings ALTER COLUMN company_id DROP NOT NULL;

-- Drop the unique constraint
ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_company_id_key;

-- Drop ALL existing RLS policies
DROP POLICY IF EXISTS "Users can view settings for their companies" ON company_settings;
DROP POLICY IF EXISTS "Users can update settings for their companies" ON company_settings;
DROP POLICY IF EXISTS "Users can insert settings for their companies" ON company_settings;
DROP POLICY IF EXISTS "Users can delete settings for their companies" ON company_settings;
DROP POLICY IF EXISTS "Allow anonymous read access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow anonymous write access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow anonymous update access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow anonymous delete access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow authenticated read access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow authenticated update access to company_settings" ON company_settings;

-- Create fresh anonymous access policies
CREATE POLICY "Allow all to read company_settings"
  ON company_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all to insert company_settings"
  ON company_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all to update company_settings"
  ON company_settings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all to delete company_settings"
  ON company_settings
  FOR DELETE
  TO anon, authenticated
  USING (true);
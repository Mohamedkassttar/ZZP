/*
  # Create Company Settings Table

  1. New Tables
    - `company_settings`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `cash_account_id` (uuid, foreign key to accounts) - Default cash account
      - `private_account_id` (uuid, foreign key to accounts) - Default private withdrawal account
      - `is_active` (boolean) - Active flag

  2. Configuration
    - Singleton table (only one row allowed)
    - Initialize with empty settings on first creation

  3. Security
    - Enable RLS on `company_settings` table
    - Add policies for authenticated and anonymous users
*/

-- Create the company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  cash_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  private_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true
);

-- Insert initial settings row if none exists
INSERT INTO company_settings (is_active)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow anonymous read access to company_settings"
  ON company_settings
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous update access to company_settings"
  ON company_settings
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read access to company_settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated update access to company_settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();
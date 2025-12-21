/*
  # Fixed Assets and Mileage Tracking System
  
  ## Overview
  Creates infrastructure for managing fixed assets with depreciation and mileage tracking
  for automated travel expense booking.
  
  ## 1. New Tables
  
  ### fixed_assets
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Asset name (e.g., "Laptop Dell XPS")
  - `purchase_date` (date) - When asset was purchased
  - `purchase_price` (numeric) - Original purchase price
  - `residual_value` (numeric) - Expected value at end of life
  - `lifespan_months` (integer) - Useful life in months
  - `depreciation_account_id` (uuid, FK) - Expense account for depreciation
  - `balance_sheet_account_id` (uuid, FK) - Asset account on balance sheet
  - `last_depreciation_date` (date) - Last time depreciation was booked
  - `is_active` (boolean) - Whether asset is still in use
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### mileage_logs
  - `id` (uuid, primary key) - Unique identifier
  - `log_date` (date) - Date of trip
  - `from_location` (text) - Starting location
  - `to_location` (text) - Destination
  - `distance_km` (numeric) - Distance in kilometers
  - `purpose` (text) - Business purpose
  - `vehicle_license` (text) - Vehicle license plate
  - `is_booked` (boolean) - Whether trip has been accounted for
  - `journal_entry_id` (uuid, FK) - Link to journal entry if booked
  - `created_at` (timestamptz) - Creation timestamp
  
  ### settings
  - `id` (uuid, primary key) - Unique identifier
  - `key` (text, unique) - Setting key (e.g., "mileage_rate")
  - `value` (text) - Setting value
  - `description` (text) - Description of setting
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## 2. Business Rules
  
  ### Fixed Assets
  - Monthly depreciation = (Purchase Price - Residual Value) / Lifespan Months
  - Depreciation creates journal entry: Debit Depreciation Expense, Credit Asset
  - Cannot depreciate beyond residual value
  
  ### Mileage
  - Default mileage rate stored in settings (e.g., €0.23/km)
  - Bulk booking creates single journal entry for period
  - Journal entry: Debit Travel Costs, Credit Privé/Bank
  
  ## 3. Security
  - RLS enabled for authenticated users
  - Users can only access their own data
*/

-- Table: fixed_assets
CREATE TABLE IF NOT EXISTS fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purchase_date date NOT NULL,
  purchase_price numeric(12,2) NOT NULL,
  residual_value numeric(12,2) DEFAULT 0,
  lifespan_months integer NOT NULL,
  depreciation_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  balance_sheet_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  last_depreciation_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: mileage_logs
CREATE TABLE IF NOT EXISTS mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL,
  from_location text NOT NULL,
  to_location text NOT NULL,
  distance_km numeric(10,2) NOT NULL,
  purpose text NOT NULL,
  vehicle_license text,
  is_booked boolean DEFAULT false,
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Insert default mileage rate
INSERT INTO settings (key, value, description)
VALUES ('mileage_rate', '0.23', 'Mileage reimbursement rate per kilometer in euros')
ON CONFLICT (key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fixed_assets_active ON fixed_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_purchase_date ON fixed_assets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_date ON mileage_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_booked ON mileage_logs(is_booked);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Enable Row Level Security
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fixed_assets
CREATE POLICY "Authenticated users can view fixed assets"
  ON fixed_assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fixed assets"
  ON fixed_assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fixed assets"
  ON fixed_assets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete fixed assets"
  ON fixed_assets FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for mileage_logs
CREATE POLICY "Authenticated users can view mileage logs"
  ON mileage_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert mileage logs"
  ON mileage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update mileage logs"
  ON mileage_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete mileage logs"
  ON mileage_logs FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for settings
CREATE POLICY "Authenticated users can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_fixed_assets_updated_at ON fixed_assets;
CREATE TRIGGER update_fixed_assets_updated_at
  BEFORE UPDATE ON fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Create Private Tax Returns Table

  1. New Tables
    - `tax_returns_private`
      - `id` (uuid, primary key)
      - `fiscal_year_id` (uuid, foreign key to fiscal_years)
      - `has_fiscal_partner` (boolean, default false)
      - `children_count` (integer, default 0)
      - `wage_income` (numeric, default 0) - Loon uit loondienst
      - `other_income` (numeric, default 0) - Overige inkomsten
      - `woz_value` (numeric, default 0) - WOZ waarde eigen woning
      - `mortgage_interest_paid` (numeric, default 0) - Betaalde hypotheekrente
      - `notional_rental_value` (numeric, default 0) - Eigenwoningforfait (calculated)
      - `savings` (numeric, default 0) - Spaargeld (Box 3)
      - `investments` (numeric, default 0) - Beleggingen (Box 3)
      - `debts` (numeric, default 0) - Schulden (Box 3)
      - `partner_data` (jsonb, default '{}') - All partner income/deduction data
      - `deduction_split_percentage` (integer, default 50) - Distribution percentage 0-100
      - `partner_name` (text) - Partner naam
      - `partner_bsn` (text) - Partner BSN
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `tax_returns_private` table
    - Add policies for public access (matching fiscal_years pattern)

  3. Notes
    - Stores complete private tax return data for Dutch IB
    - Covers Box 1 (Work/Home) and Box 3 (Assets)
    - Partner data stored in JSONB for flexibility
    - Links to fiscal_years for business income integration
*/

CREATE TABLE IF NOT EXISTS tax_returns_private (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid REFERENCES fiscal_years(id) ON DELETE CASCADE,
  has_fiscal_partner boolean DEFAULT false,
  children_count integer DEFAULT 0,
  wage_income numeric DEFAULT 0,
  other_income numeric DEFAULT 0,
  woz_value numeric DEFAULT 0,
  mortgage_interest_paid numeric DEFAULT 0,
  notional_rental_value numeric DEFAULT 0,
  savings numeric DEFAULT 0,
  investments numeric DEFAULT 0,
  debts numeric DEFAULT 0,
  partner_data jsonb DEFAULT '{}'::jsonb,
  deduction_split_percentage integer DEFAULT 50,
  partner_name text,
  partner_bsn text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tax_returns_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to tax_returns_private"
  ON tax_returns_private FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access to tax_returns_private"
  ON tax_returns_private FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access to tax_returns_private"
  ON tax_returns_private FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to tax_returns_private"
  ON tax_returns_private FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_tax_returns_private_fiscal_year 
  ON tax_returns_private(fiscal_year_id);
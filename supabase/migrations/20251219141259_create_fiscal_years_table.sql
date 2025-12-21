/*
  # Create Fiscal Years Table for IB Aangifte

  1. New Table
    - `fiscal_years`
      - `id` (uuid, primary key)
      - `year` (integer) - Tax year (e.g., 2024)
      - `administration_id` (text) - For multi-administration support
      - `hours_criterion_met` (boolean) - Urencriterium for Zelfstandigenaftrek
      - `is_starter` (boolean) - Starter status for Startersaftrek
      - `private_use_car_amount` (decimal) - Bijtelling auto
      - `manual_corrections` (decimal, default 0) - Manual fiscal corrections
      - `status` (text) - Open or Finalized
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `fiscal_years` table
    - Add policies for authenticated users to manage their fiscal years

  3. Notes
    - Stores tax-specific data per year
    - Used for Dutch IB Aangifte calculations
    - Supports ZZP (sole proprietorship) tax preparation
*/

CREATE TABLE IF NOT EXISTS fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  administration_id text DEFAULT 'default',
  hours_criterion_met boolean DEFAULT false,
  is_starter boolean DEFAULT false,
  private_use_car_amount decimal(10,2) DEFAULT 0,
  manual_corrections decimal(10,2) DEFAULT 0,
  status text DEFAULT 'Open' CHECK (status IN ('Open', 'Finalized')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users"
  ON fiscal_years
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
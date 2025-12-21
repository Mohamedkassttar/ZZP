/*
  # Add Missing Columns to Tax Tables

  1. Changes to `tax_returns_private`
    - Add `fiscal_year` (integer) - Direct year reference (e.g., 2024)
    - This complements the existing `fiscal_year_id` UUID foreign key
    - Used for simple year-based queries without joins

  2. Changes to `fiscal_years`
    - Add `hours_criterion` (boolean) - Alias/alternative to hours_criterion_met
    - Add `investments_total` (numeric) - Total investments for KIA calculation
    - Add `investment_deduction_kia` (numeric) - KIA deduction amount

  3. Data Migration
    - Populate `fiscal_year` in tax_returns_private from linked fiscal_years table
    - Copy `hours_criterion_met` value to `hours_criterion` for existing records

  4. Notes
    - These columns fix 400 Bad Request errors from code expecting different column names
    - Maintains backward compatibility with existing UUID foreign key relationships
*/

-- Add fiscal_year (integer) to tax_returns_private
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_returns_private' AND column_name = 'fiscal_year'
  ) THEN
    ALTER TABLE tax_returns_private ADD COLUMN fiscal_year integer;

    -- Populate fiscal_year from linked fiscal_years table
    UPDATE tax_returns_private trp
    SET fiscal_year = fy.year
    FROM fiscal_years fy
    WHERE trp.fiscal_year_id = fy.id AND trp.fiscal_year IS NULL;

    COMMENT ON COLUMN tax_returns_private.fiscal_year IS 'Direct year reference for simple queries';
  END IF;
END $$;

-- Add hours_criterion (boolean) to fiscal_years
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'hours_criterion'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN hours_criterion boolean DEFAULT false;

    -- Copy existing hours_criterion_met values
    UPDATE fiscal_years
    SET hours_criterion = hours_criterion_met
    WHERE hours_criterion IS NULL;

    COMMENT ON COLUMN fiscal_years.hours_criterion IS 'Urencriterium (1225 hours) for Zelfstandigenaftrek';
  END IF;
END $$;

-- Add investments_total (numeric) to fiscal_years
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'investments_total'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN investments_total numeric(10,2) DEFAULT 0;

    COMMENT ON COLUMN fiscal_years.investments_total IS 'Total investments for KIA (Kleinschaligheidsinvesteringsaftrek) calculation';
  END IF;
END $$;

-- Add investment_deduction_kia (numeric) to fiscal_years
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'investment_deduction_kia'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN investment_deduction_kia numeric(10,2) DEFAULT 0;

    COMMENT ON COLUMN fiscal_years.investment_deduction_kia IS 'Calculated KIA deduction amount';
  END IF;
END $$;

-- Create index on fiscal_year for faster queries
CREATE INDEX IF NOT EXISTS idx_tax_returns_private_fiscal_year 
  ON tax_returns_private(fiscal_year);

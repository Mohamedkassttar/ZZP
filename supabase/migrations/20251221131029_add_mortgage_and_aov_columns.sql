/*
  # Add Additional Missing Columns to tax_returns_private

  1. Changes to `tax_returns_private`
    - Add `mortgage_interest` (numeric) - Alias for mortgage_interest_paid
    - Add `aov_premium` (numeric) - AOV (Arbeidsongeschiktheidsverzekering) premium

  2. Data Migration
    - Copy existing mortgage_interest_paid values to mortgage_interest

  3. Notes
    - Fixes additional 400 Bad Request errors
    - Maintains compatibility with existing mortgage_interest_paid column
*/

-- Add mortgage_interest (numeric) to tax_returns_private
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_returns_private' AND column_name = 'mortgage_interest'
  ) THEN
    ALTER TABLE tax_returns_private ADD COLUMN mortgage_interest numeric DEFAULT 0;

    -- Copy existing mortgage_interest_paid values
    UPDATE tax_returns_private
    SET mortgage_interest = mortgage_interest_paid
    WHERE mortgage_interest IS NULL;

    COMMENT ON COLUMN tax_returns_private.mortgage_interest IS 'Mortgage interest paid (Hypotheekrente)';
  END IF;
END $$;

-- Add aov_premium (numeric) to tax_returns_private
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_returns_private' AND column_name = 'aov_premium'
  ) THEN
    ALTER TABLE tax_returns_private ADD COLUMN aov_premium numeric DEFAULT 0;

    COMMENT ON COLUMN tax_returns_private.aov_premium IS 'AOV (Arbeidsongeschiktheidsverzekering) premium - disability insurance';
  END IF;
END $$;

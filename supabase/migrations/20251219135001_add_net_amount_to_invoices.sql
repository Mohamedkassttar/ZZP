/*
  # Add net_amount column to invoices table
  
  ## Overview
  Adds the missing `net_amount` column to the invoices table to support frontend invoice creation logic.
  
  ## 1. Changes Made
  
  ### invoices table
  - Add `net_amount` (numeric) - Amount excluding VAT, synonymous with subtotal
    - Nullable to support existing records
    - Will be populated for new invoices
  
  ## 2. Notes
  - The `vat_amount` column already exists in the schema
  - `net_amount` serves the same purpose as `subtotal` but is used by frontend code
  - Both columns can coexist for compatibility
*/

-- Add net_amount column to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN net_amount numeric(12,2);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_net_amount ON invoices(net_amount);

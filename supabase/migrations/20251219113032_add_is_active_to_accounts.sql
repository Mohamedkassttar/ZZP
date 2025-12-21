/*
  # Add is_active column to accounts table
  
  ## Overview
  Adds an `is_active` boolean column to the accounts table to support soft deletion.
  Instead of deleting accounts (which breaks historical data), accounts can be deactivated.
  
  ## Changes
  1. Add `is_active` column with default value `true`
  2. Update existing accounts to be active
  3. Update application logic to only show active accounts in dropdowns
  
  ## Business Rules
  - Inactive accounts are hidden from selection dropdowns
  - Inactive accounts still appear in historical reports
  - Cannot delete accounts that have transactions
*/

-- Add is_active column to accounts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE accounts ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Set all existing accounts to active
UPDATE accounts SET is_active = true WHERE is_active IS NULL;
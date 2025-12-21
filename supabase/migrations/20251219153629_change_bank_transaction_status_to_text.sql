/*
  # Change bank_transactions status from ENUM to TEXT

  ## Overview
  Converts the status column from a strict ENUM type to flexible TEXT type.
  This prevents errors when using different status values during development
  and gives the frontend full control over status labels.

  ## Changes
  1. Modify Column Type
    - Change `status` from bank_transaction_status ENUM to TEXT
    - Preserve existing data during conversion
    - Set default value to 'Unmatched'

  ## Important Notes
  - Existing data is preserved during the conversion
  - The old ENUM type is kept for backward compatibility
  - Frontend can now use any status values without database restrictions
*/

-- Convert status column from ENUM to TEXT
DO $$
BEGIN
  -- Change the column type to TEXT, converting existing ENUM values
  ALTER TABLE bank_transactions 
  ALTER COLUMN status TYPE TEXT USING status::TEXT;
  
  -- Set default value for new records
  ALTER TABLE bank_transactions 
  ALTER COLUMN status SET DEFAULT 'Unmatched';
  
END $$;

-- Add helpful comment
COMMENT ON COLUMN bank_transactions.status IS
'Transaction status (e.g., Unmatched, Matched, Booked, Imported). Flexible TEXT field for frontend control.';

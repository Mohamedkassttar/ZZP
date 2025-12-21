/*
  # Add bank_account_id to bank_transactions table

  ## Overview
  Adds a bank_account_id column to the bank_transactions table to link each transaction
  to the specific bank account it belongs to.

  ## Changes
  1. New Columns
    - `bank_account_id` (uuid, nullable, FK to accounts table)
      - Links each transaction to its source bank account
      - Nullable to preserve existing data

  2. Indexes
    - Index on bank_account_id for improved query performance

  ## Important Notes
  - Column is nullable for backward compatibility with existing data
  - Foreign key references the accounts table (bank accounts are stored there)
  - Existing transactions will have NULL bank_account_id until updated
*/

-- Add bank_account_id column to bank_transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions'
    AND column_name = 'bank_account_id'
  ) THEN
    ALTER TABLE bank_transactions
    ADD COLUMN bank_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account
ON bank_transactions(bank_account_id);

-- Add helpful comment
COMMENT ON COLUMN bank_transactions.bank_account_id IS
'Links transaction to the source bank account (references accounts table)';

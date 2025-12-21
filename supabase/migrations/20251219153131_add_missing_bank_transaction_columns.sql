/*
  # Add Missing Standard Banking Columns

  ## Overview
  Adds standard banking fields to ensure complete transaction data capture
  from various bank statement formats (CSV, MT940, CAMT.053).

  ## 1. New Columns
    - `currency` (text, default 'EUR')
      - Currency code for the transaction
      - Defaults to EUR for Dutch banking
    - `transaction_code` (text, nullable)
      - Bank-specific transaction code or type identifier
      - Examples: SEPA, iDEAL, PIN, etc.
    - `transaction_type` (text, nullable)
      - Transaction type: Credit or Debit
      - Useful for quick filtering and reporting

  ## 2. Indexes
    - Index on transaction_type for improved filtering
    - Index on currency for multi-currency support

  ## Important Notes
  - All columns are nullable or have defaults for backward compatibility
  - Existing transactions will have default values
  - Currency defaults to EUR but can be overridden during import
*/

-- Add currency column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions'
    AND column_name = 'currency'
  ) THEN
    ALTER TABLE bank_transactions
    ADD COLUMN currency text DEFAULT 'EUR' NOT NULL;
  END IF;
END $$;

-- Add transaction_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions'
    AND column_name = 'transaction_code'
  ) THEN
    ALTER TABLE bank_transactions
    ADD COLUMN transaction_code text;
  END IF;
END $$;

-- Add transaction_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions'
    AND column_name = 'transaction_type'
  ) THEN
    ALTER TABLE bank_transactions
    ADD COLUMN transaction_type text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_type
ON bank_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_currency
ON bank_transactions(currency);

-- Add helpful comments
COMMENT ON COLUMN bank_transactions.currency IS
'Currency code (ISO 4217) - defaults to EUR';

COMMENT ON COLUMN bank_transactions.transaction_code IS
'Bank-specific transaction code or payment method (e.g., SEPA, iDEAL, PIN)';

COMMENT ON COLUMN bank_transactions.transaction_type IS
'Transaction type: Credit (money in) or Debit (money out)';

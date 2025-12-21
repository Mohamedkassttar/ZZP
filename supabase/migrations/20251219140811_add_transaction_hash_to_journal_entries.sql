/*
  # Add Transaction Hash for Deduplication

  1. Changes
    - Add `transaction_hash` column to `journal_entries` table
      - Type: text (nullable to support existing records)
      - Purpose: Store unique hash of transaction data to prevent duplicates

  2. Index
    - Create UNIQUE index on `transaction_hash` (where not null)
      - Prevents duplicate transactions at database level
      - Serves as final safety net against race conditions

  3. Notes
    - Existing records will have NULL hash (they're already in the system)
    - New imports will always generate and check hash before insertion
    - The unique constraint only applies to non-null values
*/

-- Add transaction_hash column to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'transaction_hash'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN transaction_hash text;
  END IF;
END $$;

-- Create unique index on transaction_hash (excluding NULL values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'journal_entries' AND indexname = 'journal_entries_transaction_hash_unique'
  ) THEN
    CREATE UNIQUE INDEX journal_entries_transaction_hash_unique
    ON journal_entries (transaction_hash)
    WHERE transaction_hash IS NOT NULL;
  END IF;
END $$;
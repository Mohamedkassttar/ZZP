/*
  # Add memoriaal_type column to journal_entries
  
  1. Changes
    - Add 'memoriaal_type' text column to journal_entries table
    - This column stores the type of memorial entry (e.g., 'Verkoopfactuur', 'Inkoopfactuur', 'Bank', 'Memoriaal', 'Afschrijving', etc.)
    - Nullable to maintain compatibility with existing entries
  
  2. Notes
    - This is separate from the old 'journal_type' enum system
    - Provides more flexibility for categorizing different types of journal entries
    - Used by the Portal and other components to filter and display entries appropriately
*/

-- Add memoriaal_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' 
    AND column_name = 'memoriaal_type'
  ) THEN
    ALTER TABLE journal_entries 
    ADD COLUMN memoriaal_type TEXT NULL;
    
    COMMENT ON COLUMN journal_entries.memoriaal_type IS 'Type of memorial/journal entry (e.g., Verkoopfactuur, Inkoopfactuur, Bank, Memoriaal, Afschrijving, Correctie, Prive)';
  END IF;
END $$;

-- Create index for better query performance when filtering by type
CREATE INDEX IF NOT EXISTS idx_journal_entries_memoriaal_type ON journal_entries(memoriaal_type);

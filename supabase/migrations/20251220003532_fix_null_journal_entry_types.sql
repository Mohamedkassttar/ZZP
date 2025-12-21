/*
  # Fix NULL journal entry types

  1. Changes
    - Update all journal entries with NULL type to 'Memoriaal'
    - This ensures all entries have a valid type and can be filtered properly

  2. Notes
    - Entries with NULL type are manual journal entries that were created before the type column existed
    - Bank entries already have type 'Bank' and will not be affected
*/

-- Update all NULL type entries to 'Memoriaal'
UPDATE journal_entries
SET type = 'Memoriaal'
WHERE type IS NULL;

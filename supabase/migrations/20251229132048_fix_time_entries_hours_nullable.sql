/*
  # Fix time_entries hours column to allow NULL for mileage entries

  1. Changes to `time_entries` table
    - Remove NOT NULL constraint from `hours` column to allow NULL for mileage entries
    - This is required for the entry_type check constraint that expects NULL hours for mileage type

  2. Background
    - The original table creation had hours as NOT NULL with CHECK (hours > 0)
    - The mileage support migration added a new CHECK constraint that requires hours to be NULL for mileage entries
    - However, the NOT NULL constraint on the column itself was never removed
    - This causes Error 23502 (not_null_violation) when trying to save mileage entries

  3. Solution
    - Alter the hours column to DROP NOT NULL constraint
    - The CHECK constraint already ensures data integrity:
      - Hours entries must have hours > 0
      - Mileage entries must have hours IS NULL
*/

-- Remove NOT NULL constraint from hours column
ALTER TABLE time_entries ALTER COLUMN hours DROP NOT NULL;

-- Verify the constraint is working correctly
COMMENT ON COLUMN time_entries.hours IS 'Hours worked (required for hours entries, must be NULL for mileage entries)';
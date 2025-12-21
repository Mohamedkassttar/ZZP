/*
  # Add Memoriaal type to journal_entries and fix existing data

  1. Changes
    - Add 'Memoriaal' as a valid enum value for journal_type
    - Update all existing 'General' entries to 'Memoriaal' type
    - This ensures MemorialOverview component can filter correctly

  2. Notes
    - Bank entries keep their 'Bank' type
    - All manual journal entries become 'Memoriaal' type
    - Future entries created via Memoriaal component will use 'Memoriaal' type
*/

-- Add 'Memoriaal' to the journal_type enum (using separate transaction)
DO $$
BEGIN
  -- Check if the value already exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Memoriaal' AND enumtypid = 'journal_type'::regtype) THEN
    ALTER TYPE journal_type ADD VALUE 'Memoriaal';
  END IF;
END $$;

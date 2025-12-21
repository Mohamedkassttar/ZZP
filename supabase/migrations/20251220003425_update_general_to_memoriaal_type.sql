/*
  # Update existing General entries to Memoriaal type

  1. Changes
    - Update all existing 'General' entries to 'Memoriaal' type
    - Set default type for new entries to 'Memoriaal'

  2. Notes
    - This migration must run after the enum value is added
    - Bank entries keep their 'Bank' type
*/

-- Update all existing 'General' entries to 'Memoriaal'
UPDATE journal_entries
SET type = 'Memoriaal'
WHERE type = 'General';

-- Set default to 'Memoriaal' for new manual entries
ALTER TABLE journal_entries 
ALTER COLUMN type SET DEFAULT 'Memoriaal'::journal_type;

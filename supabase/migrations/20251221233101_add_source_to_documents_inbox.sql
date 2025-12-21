/*
  # Add source column to documents_inbox

  1. Changes
    - Add `source` column to `documents_inbox` table
      - Type: text
      - Default: 'email'
      - Purpose: Track whether document came from 'email' or 'portal'

  2. Notes
    - This allows portal uploads to be distinguished from email uploads
    - No security changes needed (existing RLS policies apply)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents_inbox' AND column_name = 'source'
  ) THEN
    ALTER TABLE documents_inbox ADD COLUMN source TEXT DEFAULT 'email';
  END IF;
END $$;
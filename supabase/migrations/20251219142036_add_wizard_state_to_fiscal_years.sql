/*
  # Add Wizard State to Fiscal Years

  1. Changes
    - Add `current_step` column to track wizard progress (integer, default 1)
    - Add `draft_data` column to store form state (jsonb, default '{}')
    - Add `last_updated_at` column to track last modification time (timestamptz)

  2. Purpose
    - Enable auto-save and resume functionality for IB Tax Wizard
    - Users can leave and return to find their progress preserved
    - Store all form inputs including checkboxes, corrections, and selections

  3. Notes
    - `current_step` ranges from 1-4 representing wizard steps
    - `draft_data` stores JSON object with all form field values
    - `last_updated_at` auto-updates on every save for "last saved" display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'current_step'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN current_step integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'draft_data'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN draft_data jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'last_updated_at'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN last_updated_at timestamptz DEFAULT now();
  END IF;
END $$;
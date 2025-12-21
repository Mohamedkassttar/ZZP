/*
  # Add draft_data column to fiscal_years table

  1. Changes
    - Add `draft_data` JSONB column to store wizard form state
    - Add `current_step` integer column to track wizard progress
    
  2. Notes
    - These columns enable auto-save and resume functionality for the tax wizard
    - draft_data stores all form values (revenue, costs, assets, liabilities, etc.)
    - current_step tracks which step the user is on
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'draft_data'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN draft_data jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'current_step'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN current_step integer DEFAULT 1;
  END IF;
END $$;

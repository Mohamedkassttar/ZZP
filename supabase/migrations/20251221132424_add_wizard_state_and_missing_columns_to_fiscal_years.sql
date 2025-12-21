/*
  # Add Missing Columns to fiscal_years Table

  1. Changes
    - Add `wizard_state` JSONB column for storing wizard progress and completion state
    - Add `hours_criterion` boolean column (aliasing hours_criterion_met for consistency)
    - Add `investments_total` decimal column for total investments in the year
    - Add `investment_deduction_kia` decimal column for KIA deduction amount
    
  2. Purpose
    - Enable wizard to save completion state and progress
    - Store investment-related calculations for tax deductions
    - Align database column names with frontend code expectations
    
  3. Notes
    - All columns are nullable to support existing records
    - wizard_state stores JSON object with { currentStep, completed, etc. }
    - investments_total and investment_deduction_kia track KIA calculations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'wizard_state'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN wizard_state jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'hours_criterion'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN hours_criterion boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'investments_total'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN investments_total decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_years' AND column_name = 'investment_deduction_kia'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN investment_deduction_kia decimal(10,2) DEFAULT 0;
  END IF;
END $$;

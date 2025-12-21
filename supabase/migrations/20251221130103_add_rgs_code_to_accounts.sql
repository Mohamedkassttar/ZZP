/*
  # Add RGS Code to Accounts Table

  1. Changes
    - Add `rgs_code` column to accounts table (nullable string)
    - This column stores the RGS (Referentie Grootboekschema) code for each account
    - Used for XML Auditfile export generation (Dutch accounting standard)

  2. Notes
    - Column is nullable to allow gradual implementation
    - Values can be set via:
      1. Automatic best-effort matching (next migration)
      2. Manual entry via Settings UI
    - If empty, XML export will handle gracefully (empty tag or dummy value)
*/

-- Add rgs_code column to accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'rgs_code'
  ) THEN
    ALTER TABLE accounts ADD COLUMN rgs_code text;

    -- Add comment for documentation
    COMMENT ON COLUMN accounts.rgs_code IS 'RGS (Referentie Grootboekschema) code for XML Auditfile export';
  END IF;
END $$;

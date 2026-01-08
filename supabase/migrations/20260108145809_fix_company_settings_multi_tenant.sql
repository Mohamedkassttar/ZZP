/*
  # Fix Company Settings Multi-Tenant Support

  1. Changes
    - Add company_id column to company_settings table
    - Make company_settings unique per company (one settings row per company)
    - Migrate existing settings to be linked to first company
    - Update RLS policies for multi-tenant access

  2. Security
    - Users can only access settings for companies they belong to
    - Settings are company-specific and isolated
*/

-- Add company_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    COMMENT ON COLUMN company_settings.company_id IS 'Reference to the company this settings belongs to';
  END IF;
END $$;

-- If there are any existing settings without company_id, link them to the first company
-- This handles the case where settings were created before multi-tenant support
UPDATE company_settings
SET company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM companies);

-- Make company_id NOT NULL after migrating data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_id') THEN
    ALTER TABLE company_settings ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Add unique constraint to ensure one settings row per company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_settings_company_id_key'
  ) THEN
    ALTER TABLE company_settings ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);
  END IF;
END $$;

-- Drop old RLS policies if they exist
DROP POLICY IF EXISTS "Allow anonymous read access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow anonymous write access to company_settings" ON company_settings;
DROP POLICY IF EXISTS "Allow all operations on company_settings" ON company_settings;

-- Create new multi-tenant RLS policies
CREATE POLICY "Users can view settings for their companies"
  ON company_settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update settings for their companies"
  ON company_settings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert settings for their companies"
  ON company_settings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete settings for their companies"
  ON company_settings
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );
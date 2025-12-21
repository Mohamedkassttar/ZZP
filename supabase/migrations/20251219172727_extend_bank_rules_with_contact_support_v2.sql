/*
  # Extend Bank Rules with Contact Support

  1. Changes
    - Add `contact_id` column to allow rules to auto-assign contacts
    - Add `is_system_rule` flag to distinguish default rules from user rules
    - Make `target_ledger_account_id` nullable (rules can assign just contact or just ledger)
    - Add seed data for common Dutch banking patterns

  2. Notes
    - Existing rules will continue to work (contact_id is nullable)
    - System rules can be used as smart defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_rules' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE bank_rules ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_rules' AND column_name = 'is_system_rule'
  ) THEN
    ALTER TABLE bank_rules ADD COLUMN is_system_rule boolean DEFAULT false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_rules'
    AND column_name = 'target_ledger_account_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bank_rules ALTER COLUMN target_ledger_account_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_rules_contact_id ON bank_rules(contact_id);
CREATE INDEX IF NOT EXISTS idx_bank_rules_system ON bank_rules(is_system_rule);

DO $$
DECLARE
  private_withdrawal_account_id uuid;
  tax_office_contact_id uuid;
BEGIN
  SELECT id INTO private_withdrawal_account_id
  FROM accounts
  WHERE code = '1900' OR name ILIKE '%privé%onttrek%'
  ORDER BY code
  LIMIT 1;

  IF private_withdrawal_account_id IS NULL THEN
    SELECT id INTO private_withdrawal_account_id
    FROM accounts
    WHERE type = 'Equity' AND (name ILIKE '%onttrek%' OR name ILIKE '%privé%')
    ORDER BY code
    LIMIT 1;
  END IF;

  SELECT id INTO tax_office_contact_id
  FROM contacts
  WHERE company_name ILIKE '%belasting%'
  LIMIT 1;

  IF tax_office_contact_id IS NULL THEN
    INSERT INTO contacts (company_name, relation_type, is_active)
    VALUES ('Belastingdienst', 'Supplier', true)
    RETURNING id INTO tax_office_contact_id;
  END IF;

  IF private_withdrawal_account_id IS NOT NULL THEN
    INSERT INTO bank_rules (
      keyword,
      match_type,
      target_ledger_account_id,
      is_system_rule,
      priority,
      is_active
    ) VALUES
    ('Geldautomaat', 'Contains', private_withdrawal_account_id, true, 100, true),
    ('ATM', 'Contains', private_withdrawal_account_id, true, 100, true),
    ('Kruidvat', 'Contains', private_withdrawal_account_id, true, 50, true),
    ('Albert Heijn', 'Contains', private_withdrawal_account_id, true, 50, true),
    ('Jumbo', 'Contains', private_withdrawal_account_id, true, 50, true),
    ('Lidl', 'Contains', private_withdrawal_account_id, true, 50, true),
    ('Aldi', 'Contains', private_withdrawal_account_id, true, 50, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF tax_office_contact_id IS NOT NULL THEN
    INSERT INTO bank_rules (
      keyword,
      match_type,
      contact_id,
      is_system_rule,
      priority,
      is_active
    ) VALUES
    ('Belastingdienst', 'Contains', tax_office_contact_id, true, 90, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

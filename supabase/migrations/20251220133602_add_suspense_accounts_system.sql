/*
  # Add Suspense Account System for Bridge Accounting

  ## Overview
  Implements the "Nog te ontvangen/verzenden facturen" methodology for cleaner
  cutoff management. Bank transactions are first booked to suspense accounts,
  then cleared when matched to invoices.

  ## Changes
  
  1. Schema Updates
    - Add `system_protected` field to accounts table
    - Accounts marked as system_protected cannot be deleted by users
  
  2. New System Accounts
    - **1300**: Nog te vorderen verkoopfacturen (Asset/Activa)
      - Used when bank receives payment before sales invoice is matched
    - **2300**: Nog te ontvangen inkoopfacturen (Liability/Passiva)
      - Used when bank pays before purchase invoice is matched
  
  ## Accounting Flow
  
  ### Purchase Flow (Expenses)
  1. **Bank Payment**: Debit 2300 (Suspense) / Credit 1xxx (Bank)
  2. **Invoice Entry**: Debit Cost / Credit Creditor
  3. **Settlement**: Debit Creditor / Credit 2300 (Suspense)
  
  ### Sales Flow (Income)
  1. **Bank Receipt**: Debit 1xxx (Bank) / Credit 1300 (Suspense)
  2. **Invoice Entry**: Debit Debtor / Credit Revenue
  3. **Settlement**: Debit 1300 (Suspense) / Credit Debtor
  
  ## Security
  - System accounts cannot be deleted or deactivated
  - Only insertable if they don't exist (idempotent)
*/

-- Add system_protected field to accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'system_protected'
  ) THEN
    ALTER TABLE accounts ADD COLUMN system_protected boolean DEFAULT false;
  END IF;
END $$;

-- Create index for system_protected accounts
CREATE INDEX IF NOT EXISTS idx_accounts_system_protected 
  ON accounts(system_protected) 
  WHERE system_protected = true;

-- Insert suspense account 1300 (Asset - Receivables Suspense)
INSERT INTO accounts (
  code,
  name,
  type,
  is_active,
  system_protected,
  tax_category,
  description
)
VALUES (
  '1300',
  'Nog te vorderen verkoopfacturen',
  'Asset',
  true,
  true,
  'Vorderingen',
  'Suspense account for bank receipts awaiting sales invoice matching'
)
ON CONFLICT (code) DO UPDATE SET
  system_protected = true,
  is_active = true,
  description = EXCLUDED.description;

-- Insert suspense account 2300 (Liability - Payables Suspense)
INSERT INTO accounts (
  code,
  name,
  type,
  is_active,
  system_protected,
  tax_category,
  description
)
VALUES (
  '2300',
  'Nog te ontvangen inkoopfacturen',
  'Liability',
  true,
  true,
  'Kortlopende schulden',
  'Suspense account for bank payments awaiting purchase invoice matching'
)
ON CONFLICT (code) DO UPDATE SET
  system_protected = true,
  is_active = true,
  description = EXCLUDED.description;

-- Add comment explaining the suspense accounts
COMMENT ON COLUMN accounts.system_protected IS 
  'System-protected accounts cannot be deleted or deactivated by users. Used for critical accounting functions like suspense accounts.';

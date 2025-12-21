/*
  # Add Default Ledger Account to Contacts

  ## Overview
  Enables contacts to have a default ledger account assignment for automatic
  transaction categorization. This supports Balance Sheet entries (Assets, 
  Liabilities, Equity) in addition to P&L accounts (Revenue, Expenses).

  ## Changes
  1. Modify Contacts Table
    - Add `default_ledger_account_id` (UUID, nullable)
    - Foreign key constraint to `accounts(id)`
    - Set ON DELETE SET NULL to preserve contact if account is deleted
  
  ## Use Cases
  - Tax Authority contact → Default to Tax Liability account
  - Owner contact → Default to Equity/Private account
  - Supplier/Customer → Default to their typical category
  - Empty default → Falls back to AI prediction

  ## Important Notes
  - Field is OPTIONAL - users can leave it empty
  - When set, this OVERRIDES AI predictions during bank import
  - Supports ANY account type (not limited to expenses)
*/

-- Add default ledger account column to contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'default_ledger_account_id'
  ) THEN
    ALTER TABLE contacts 
    ADD COLUMN default_ledger_account_id UUID,
    ADD CONSTRAINT fk_contacts_default_ledger_account 
      FOREIGN KEY (default_ledger_account_id) 
      REFERENCES accounts(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN contacts.default_ledger_account_id IS
'Optional default ledger account for automatic transaction categorization. Overrides AI predictions when set. Supports all account types (Assets, Liabilities, Equity, Revenue, Expenses).';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_default_ledger_account 
ON contacts(default_ledger_account_id) 
WHERE default_ledger_account_id IS NOT NULL;

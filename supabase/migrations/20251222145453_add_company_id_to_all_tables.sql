/*
  # Company ID toevoegen aan alle transactionele tabellen

  ## 1. Kolommen Toevoegen
    Voegt `company_id` kolom toe aan alle belangrijke tabellen:
    - accounts
    - contacts
    - bank_transactions
    - documents_inbox
    - sales_invoices
    - purchase_invoices
    - journal_entries
    - bank_rules
    - fiscal_years
    - tax_returns_private
    - assets
    - mileage_logs

  ## 2. Foreign Key Constraints
    - Koppelt alle company_id kolommen aan companies tabel
    - ON DELETE CASCADE voor data-integriteit

  ## 3. Indexes
    - Voegt indexes toe voor snelle filtering op company_id

  ## 4. Data Migratie
    - Koppelt alle bestaande data aan Demo Bedrijf
*/

-- HAAL DEMO COMPANY ID OP
DO $$
DECLARE
  demo_company_id uuid;
BEGIN
  SELECT id INTO demo_company_id FROM companies WHERE name = 'Demo Bedrijf' LIMIT 1;

  -- 1. ACCOUNTS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE accounts ADD COLUMN company_id uuid;
    ALTER TABLE accounts ADD CONSTRAINT fk_accounts_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_accounts_company_id ON accounts(company_id);
    
    -- Koppel bestaande data
    UPDATE accounts SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 2. CONTACTS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN company_id uuid;
    ALTER TABLE contacts ADD CONSTRAINT fk_contacts_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_contacts_company_id ON contacts(company_id);
    
    UPDATE contacts SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 3. BANK_TRANSACTIONS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN company_id uuid;
    ALTER TABLE bank_transactions ADD CONSTRAINT fk_bank_transactions_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_bank_transactions_company_id ON bank_transactions(company_id);
    
    UPDATE bank_transactions SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 4. DOCUMENTS_INBOX
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents_inbox' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE documents_inbox ADD COLUMN company_id uuid;
    ALTER TABLE documents_inbox ADD CONSTRAINT fk_documents_inbox_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_documents_inbox_company_id ON documents_inbox(company_id);
    
    UPDATE documents_inbox SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 5. SALES_INVOICES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_invoices' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE sales_invoices ADD COLUMN company_id uuid;
    ALTER TABLE sales_invoices ADD CONSTRAINT fk_sales_invoices_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_sales_invoices_company_id ON sales_invoices(company_id);
    
    UPDATE sales_invoices SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 6. PURCHASE_INVOICES (als deze bestaat)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_invoices') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'purchase_invoices' AND column_name = 'company_id'
    ) THEN
      ALTER TABLE purchase_invoices ADD COLUMN company_id uuid;
      ALTER TABLE purchase_invoices ADD CONSTRAINT fk_purchase_invoices_company 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      CREATE INDEX idx_purchase_invoices_company_id ON purchase_invoices(company_id);
      
      UPDATE purchase_invoices SET company_id = demo_company_id WHERE company_id IS NULL;
    END IF;
  END IF;

  -- 7. JOURNAL_ENTRIES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN company_id uuid;
    ALTER TABLE journal_entries ADD CONSTRAINT fk_journal_entries_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
    
    UPDATE journal_entries SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 8. BANK_RULES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_rules' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE bank_rules ADD COLUMN company_id uuid;
    ALTER TABLE bank_rules ADD CONSTRAINT fk_bank_rules_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_bank_rules_company_id ON bank_rules(company_id);
    
    UPDATE bank_rules SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 9. FISCAL_YEARS
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fiscal_years' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE fiscal_years ADD COLUMN company_id uuid;
    ALTER TABLE fiscal_years ADD CONSTRAINT fk_fiscal_years_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_fiscal_years_company_id ON fiscal_years(company_id);
    
    UPDATE fiscal_years SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 10. TAX_RETURNS_PRIVATE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tax_returns_private' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE tax_returns_private ADD COLUMN company_id uuid;
    ALTER TABLE tax_returns_private ADD CONSTRAINT fk_tax_returns_private_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX idx_tax_returns_private_company_id ON tax_returns_private(company_id);
    
    UPDATE tax_returns_private SET company_id = demo_company_id WHERE company_id IS NULL;
  END IF;

  -- 11. ASSETS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'company_id'
    ) THEN
      ALTER TABLE assets ADD COLUMN company_id uuid;
      ALTER TABLE assets ADD CONSTRAINT fk_assets_company 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      CREATE INDEX idx_assets_company_id ON assets(company_id);
      
      UPDATE assets SET company_id = demo_company_id WHERE company_id IS NULL;
    END IF;
  END IF;

  -- 12. MILEAGE_LOGS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mileage_logs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'mileage_logs' AND column_name = 'company_id'
    ) THEN
      ALTER TABLE mileage_logs ADD COLUMN company_id uuid;
      ALTER TABLE mileage_logs ADD CONSTRAINT fk_mileage_logs_company 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
      CREATE INDEX idx_mileage_logs_company_id ON mileage_logs(company_id);
      
      UPDATE mileage_logs SET company_id = demo_company_id WHERE company_id IS NULL;
    END IF;
  END IF;

  RAISE NOTICE 'Company ID toegevoegd aan alle tabellen en bestaande data gekoppeld aan Demo Bedrijf';
END $$;
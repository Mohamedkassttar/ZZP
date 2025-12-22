/*
  # Update RLS Policies voor Multi-Tenant

  ## 1. Updates
    - Alle SELECT policies filteren nu op company_id
    - Users kunnen alleen data zien van companies waar ze toegang toe hebben
    - INSERT/UPDATE/DELETE operaties controleren company toegang

  ## 2. Veiligheid
    - Clients kunnen alleen hun eigen company data zien
    - Experts kunnen meerdere companies beheren
    - Geen cross-company data lekkage

  ## 3. Tabellen
    Updates policies voor:
    - accounts
    - contacts
    - bank_transactions
    - documents_inbox
    - sales_invoices
    - purchase_invoices
    - journal_entries
    - journal_lines
    - bank_rules
    - fiscal_years
*/

-- DROP OUDE POLICIES EN MAAK NIEUWE AAN

-- 1. ACCOUNTS
DROP POLICY IF EXISTS "Anyone can view active accounts" ON accounts;
DROP POLICY IF EXISTS "Anyone can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Anyone can update accounts" ON accounts;
DROP POLICY IF EXISTS "Anyone can delete accounts" ON accounts;

CREATE POLICY "Users can view accounts of their companies"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert accounts in their companies"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update accounts in their companies"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete accounts in their companies"
  ON accounts FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 2. CONTACTS
DROP POLICY IF EXISTS "Anyone can view active contacts" ON contacts;
DROP POLICY IF EXISTS "Anyone can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Anyone can update contacts" ON contacts;
DROP POLICY IF EXISTS "Anyone can delete contacts" ON contacts;

CREATE POLICY "Users can view contacts of their companies"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts in their companies"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts in their companies"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contacts in their companies"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 3. BANK_TRANSACTIONS
DROP POLICY IF EXISTS "Anyone can view bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Anyone can insert bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Anyone can update bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Anyone can delete bank transactions" ON bank_transactions;

CREATE POLICY "Users can view bank transactions of their companies"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bank transactions in their companies"
  ON bank_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bank transactions in their companies"
  ON bank_transactions FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete bank transactions in their companies"
  ON bank_transactions FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 4. DOCUMENTS_INBOX
DROP POLICY IF EXISTS "Anyone can view documents" ON documents_inbox;
DROP POLICY IF EXISTS "Anyone can insert documents" ON documents_inbox;
DROP POLICY IF EXISTS "Anyone can update documents" ON documents_inbox;
DROP POLICY IF EXISTS "Anyone can delete documents" ON documents_inbox;

CREATE POLICY "Users can view documents of their companies"
  ON documents_inbox FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents in their companies"
  ON documents_inbox FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update documents in their companies"
  ON documents_inbox FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents in their companies"
  ON documents_inbox FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 5. JOURNAL_ENTRIES
DROP POLICY IF EXISTS "Anyone can view journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Anyone can insert journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Anyone can update journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Anyone can delete journal entries" ON journal_entries;

CREATE POLICY "Users can view journal entries of their companies"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert journal entries in their companies"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update journal entries in their companies"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete journal entries in their companies"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 6. JOURNAL_LINES (volgt journal_entry company)
DROP POLICY IF EXISTS "Anyone can view journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Anyone can insert journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Anyone can update journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Anyone can delete journal lines" ON journal_lines;

CREATE POLICY "Users can view journal lines of their companies"
  ON journal_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert journal lines in their companies"
  ON journal_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update journal lines in their companies"
  ON journal_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete journal lines in their companies"
  ON journal_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- 7. BANK_RULES
DROP POLICY IF EXISTS "Anyone can view bank rules" ON bank_rules;
DROP POLICY IF EXISTS "Anyone can insert bank rules" ON bank_rules;
DROP POLICY IF EXISTS "Anyone can update bank rules" ON bank_rules;
DROP POLICY IF EXISTS "Anyone can delete bank rules" ON bank_rules;

CREATE POLICY "Users can view bank rules of their companies"
  ON bank_rules FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bank rules in their companies"
  ON bank_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bank rules in their companies"
  ON bank_rules FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete bank rules in their companies"
  ON bank_rules FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 8. FISCAL_YEARS
DROP POLICY IF EXISTS "Anyone can view fiscal years" ON fiscal_years;
DROP POLICY IF EXISTS "Anyone can insert fiscal years" ON fiscal_years;
DROP POLICY IF EXISTS "Anyone can update fiscal years" ON fiscal_years;
DROP POLICY IF EXISTS "Anyone can delete fiscal years" ON fiscal_years;

CREATE POLICY "Users can view fiscal years of their companies"
  ON fiscal_years FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert fiscal years in their companies"
  ON fiscal_years FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update fiscal years in their companies"
  ON fiscal_years FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete fiscal years in their companies"
  ON fiscal_years FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 9. SALES_INVOICES
DROP POLICY IF EXISTS "Anyone can view sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Anyone can insert sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Anyone can update sales invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Anyone can delete sales invoices" ON sales_invoices;

CREATE POLICY "Users can view sales invoices of their companies"
  ON sales_invoices FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sales invoices in their companies"
  ON sales_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sales invoices in their companies"
  ON sales_invoices FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sales invoices in their companies"
  ON sales_invoices FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- 10. PURCHASE_INVOICES (als deze bestaat)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_invoices') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view purchase invoices" ON purchase_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert purchase invoices" ON purchase_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update purchase invoices" ON purchase_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete purchase invoices" ON purchase_invoices';

    EXECUTE 'CREATE POLICY "Users can view purchase invoices of their companies"
      ON purchase_invoices FOR SELECT
      TO authenticated
      USING (
        company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
        )
      )';

    EXECUTE 'CREATE POLICY "Users can insert purchase invoices in their companies"
      ON purchase_invoices FOR INSERT
      TO authenticated
      WITH CHECK (
        company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
        )
      )';

    EXECUTE 'CREATE POLICY "Users can update purchase invoices in their companies"
      ON purchase_invoices FOR UPDATE
      TO authenticated
      USING (
        company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
        )
      )';

    EXECUTE 'CREATE POLICY "Users can delete purchase invoices in their companies"
      ON purchase_invoices FOR DELETE
      TO authenticated
      USING (
        company_id IN (
          SELECT company_id FROM company_users
          WHERE user_id = auth.uid()
        )
      )';
  END IF;
END $$;
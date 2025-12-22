/*
  # Update Alle RLS Policies om Helper Functie te Gebruiken

  ## Wijziging
    Vervangt alle:
      company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
    Met:
      company_id IN (SELECT get_user_company_ids(auth.uid()))

  ## Voordeel
    - Geen recursie meer
    - SECURITY DEFINER functie bypassed RLS
    - Simpeler en sneller

  ## Tabellen
    - accounts
    - contacts  
    - bank_transactions
    - documents_inbox
    - journal_entries
    - bank_rules
    - fiscal_years
    - sales_invoices
    - purchase_invoices
*/

-- 1. ACCOUNTS
DROP POLICY IF EXISTS "Users can view accounts of their companies" ON accounts;
DROP POLICY IF EXISTS "Users can insert accounts in their companies" ON accounts;
DROP POLICY IF EXISTS "Users can update accounts in their companies" ON accounts;
DROP POLICY IF EXISTS "Users can delete accounts in their companies" ON accounts;

CREATE POLICY "Users can view accounts of their companies"
  ON accounts FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert accounts in their companies"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update accounts in their companies"
  ON accounts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete accounts in their companies"
  ON accounts FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 2. CONTACTS
DROP POLICY IF EXISTS "Users can view contacts of their companies" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their companies" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their companies" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their companies" ON contacts;

CREATE POLICY "Users can view contacts of their companies"
  ON contacts FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert contacts in their companies"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update contacts in their companies"
  ON contacts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete contacts in their companies"
  ON contacts FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 3. BANK_TRANSACTIONS
DROP POLICY IF EXISTS "Users can view bank transactions of their companies" ON bank_transactions;
DROP POLICY IF EXISTS "Users can insert bank transactions in their companies" ON bank_transactions;
DROP POLICY IF EXISTS "Users can update bank transactions in their companies" ON bank_transactions;
DROP POLICY IF EXISTS "Users can delete bank transactions in their companies" ON bank_transactions;

CREATE POLICY "Users can view bank transactions of their companies"
  ON bank_transactions FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert bank transactions in their companies"
  ON bank_transactions FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update bank transactions in their companies"
  ON bank_transactions FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete bank transactions in their companies"
  ON bank_transactions FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 4. DOCUMENTS_INBOX
DROP POLICY IF EXISTS "Users can view documents of their companies" ON documents_inbox;
DROP POLICY IF EXISTS "Users can insert documents in their companies" ON documents_inbox;
DROP POLICY IF EXISTS "Users can update documents in their companies" ON documents_inbox;
DROP POLICY IF EXISTS "Users can delete documents in their companies" ON documents_inbox;

CREATE POLICY "Users can view documents of their companies"
  ON documents_inbox FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert documents in their companies"
  ON documents_inbox FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update documents in their companies"
  ON documents_inbox FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete documents in their companies"
  ON documents_inbox FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 5. JOURNAL_ENTRIES
DROP POLICY IF EXISTS "Users can view journal entries of their companies" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries in their companies" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries in their companies" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries in their companies" ON journal_entries;

CREATE POLICY "Users can view journal entries of their companies"
  ON journal_entries FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert journal entries in their companies"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update journal entries in their companies"
  ON journal_entries FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete journal entries in their companies"
  ON journal_entries FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 6. JOURNAL_LINES (via journal_entries)
DROP POLICY IF EXISTS "Users can view journal lines of their companies" ON journal_lines;
DROP POLICY IF EXISTS "Users can insert journal lines in their companies" ON journal_lines;
DROP POLICY IF EXISTS "Users can update journal lines in their companies" ON journal_lines;
DROP POLICY IF EXISTS "Users can delete journal lines in their companies" ON journal_lines;

CREATE POLICY "Users can view journal lines of their companies"
  ON journal_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (SELECT get_user_company_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can insert journal lines in their companies"
  ON journal_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (SELECT get_user_company_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can update journal lines in their companies"
  ON journal_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (SELECT get_user_company_ids(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (SELECT get_user_company_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete journal lines in their companies"
  ON journal_lines FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_lines.journal_entry_id
      AND je.company_id IN (SELECT get_user_company_ids(auth.uid()))
    )
  );

-- 7. BANK_RULES
DROP POLICY IF EXISTS "Users can view bank rules of their companies" ON bank_rules;
DROP POLICY IF EXISTS "Users can insert bank rules in their companies" ON bank_rules;
DROP POLICY IF EXISTS "Users can update bank rules in their companies" ON bank_rules;
DROP POLICY IF EXISTS "Users can delete bank rules in their companies" ON bank_rules;

CREATE POLICY "Users can view bank rules of their companies"
  ON bank_rules FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert bank rules in their companies"
  ON bank_rules FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update bank rules in their companies"
  ON bank_rules FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete bank rules in their companies"
  ON bank_rules FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 8. FISCAL_YEARS
DROP POLICY IF EXISTS "Users can view fiscal years of their companies" ON fiscal_years;
DROP POLICY IF EXISTS "Users can insert fiscal years in their companies" ON fiscal_years;
DROP POLICY IF EXISTS "Users can update fiscal years in their companies" ON fiscal_years;
DROP POLICY IF EXISTS "Users can delete fiscal years in their companies" ON fiscal_years;

CREATE POLICY "Users can view fiscal years of their companies"
  ON fiscal_years FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert fiscal years in their companies"
  ON fiscal_years FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update fiscal years in their companies"
  ON fiscal_years FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete fiscal years in their companies"
  ON fiscal_years FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 9. SALES_INVOICES
DROP POLICY IF EXISTS "Users can view sales invoices of their companies" ON sales_invoices;
DROP POLICY IF EXISTS "Users can insert sales invoices in their companies" ON sales_invoices;
DROP POLICY IF EXISTS "Users can update sales invoices in their companies" ON sales_invoices;
DROP POLICY IF EXISTS "Users can delete sales invoices in their companies" ON sales_invoices;

CREATE POLICY "Users can view sales invoices of their companies"
  ON sales_invoices FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can insert sales invoices in their companies"
  ON sales_invoices FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can update sales invoices in their companies"
  ON sales_invoices FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Users can delete sales invoices in their companies"
  ON sales_invoices FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 10. PURCHASE_INVOICES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_invoices') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view purchase invoices of their companies" ON purchase_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert purchase invoices in their companies" ON purchase_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update purchase invoices in their companies" ON purchase_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete purchase invoices in their companies" ON purchase_invoices';

    EXECUTE 'CREATE POLICY "Users can view purchase invoices of their companies"
      ON purchase_invoices FOR SELECT TO authenticated
      USING (company_id IN (SELECT get_user_company_ids(auth.uid())))';

    EXECUTE 'CREATE POLICY "Users can insert purchase invoices in their companies"
      ON purchase_invoices FOR INSERT TO authenticated
      WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())))';

    EXECUTE 'CREATE POLICY "Users can update purchase invoices in their companies"
      ON purchase_invoices FOR UPDATE TO authenticated
      USING (company_id IN (SELECT get_user_company_ids(auth.uid())))
      WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())))';

    EXECUTE 'CREATE POLICY "Users can delete purchase invoices in their companies"
      ON purchase_invoices FOR DELETE TO authenticated
      USING (company_id IN (SELECT get_user_company_ids(auth.uid())))';
  END IF;
END $$;

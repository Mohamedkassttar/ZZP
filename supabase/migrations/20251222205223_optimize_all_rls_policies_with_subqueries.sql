/*
  # Optimize All RLS Policies with Subqueries
  
  This migration optimizes ALL Row Level Security policies by replacing direct auth.uid() calls
  with (select auth.uid()). This prevents the auth function from being re-evaluated for each row,
  significantly improving query performance at scale.
  
  ## Changes
  - Creates a helper function to get user company IDs with optimized auth call
  - This function will be called by all RLS policies
  - Performance improvement: auth.uid() evaluated once per query instead of once per row
  
  ## Tables Updated
  All tables with company-based access control
*/

-- Create optimized helper function
CREATE OR REPLACE FUNCTION get_user_company_ids_optimized()
RETURNS TABLE(company_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM company_users 
  WHERE user_id = (select auth.uid())
$$;

-- Update accounts policies
DROP POLICY IF EXISTS "Users can view accounts of their companies" ON accounts;
DROP POLICY IF EXISTS "Users can insert accounts in their companies" ON accounts;
DROP POLICY IF EXISTS "Users can update accounts in their companies" ON accounts;
DROP POLICY IF EXISTS "Users can delete accounts in their companies" ON accounts;

CREATE POLICY "Users can view accounts of their companies"
  ON accounts FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert accounts in their companies"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update accounts in their companies"
  ON accounts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete accounts in their companies"
  ON accounts FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update contacts policies
DROP POLICY IF EXISTS "Users can view contacts of their companies" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their companies" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their companies" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their companies" ON contacts;

CREATE POLICY "Users can view contacts of their companies"
  ON contacts FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert contacts in their companies"
  ON contacts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update contacts in their companies"
  ON contacts FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete contacts in their companies"
  ON contacts FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update journal_entries policies
DROP POLICY IF EXISTS "Users can view journal entries of their companies" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries in their companies" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries in their companies" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries in their companies" ON journal_entries;

CREATE POLICY "Users can view journal entries of their companies"
  ON journal_entries FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert journal entries in their companies"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update journal entries in their companies"
  ON journal_entries FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete journal entries in their companies"
  ON journal_entries FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update journal_lines policies (via journal_entries)
DROP POLICY IF EXISTS "Users can view journal lines of their companies" ON journal_lines;
DROP POLICY IF EXISTS "Users can insert journal lines in their companies" ON journal_lines;
DROP POLICY IF EXISTS "Users can update journal lines in their companies" ON journal_lines;
DROP POLICY IF EXISTS "Users can delete journal lines in their companies" ON journal_lines;

CREATE POLICY "Users can view journal lines of their companies"
  ON journal_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.company_id IN (SELECT get_user_company_ids_optimized())
  ));

CREATE POLICY "Users can insert journal lines in their companies"
  ON journal_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.company_id IN (SELECT get_user_company_ids_optimized())
  ));

CREATE POLICY "Users can update journal lines in their companies"
  ON journal_lines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.company_id IN (SELECT get_user_company_ids_optimized())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.company_id IN (SELECT get_user_company_ids_optimized())
  ));

CREATE POLICY "Users can delete journal lines in their companies"
  ON journal_lines FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = journal_entry_id 
    AND je.company_id IN (SELECT get_user_company_ids_optimized())
  ));

-- Update documents_inbox policies
DROP POLICY IF EXISTS "Users can view documents of their companies" ON documents_inbox;
DROP POLICY IF EXISTS "Users can insert documents in their companies" ON documents_inbox;
DROP POLICY IF EXISTS "Users can update documents in their companies" ON documents_inbox;
DROP POLICY IF EXISTS "Users can delete documents in their companies" ON documents_inbox;

CREATE POLICY "Users can view documents of their companies"
  ON documents_inbox FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert documents in their companies"
  ON documents_inbox FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update documents in their companies"
  ON documents_inbox FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete documents in their companies"
  ON documents_inbox FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update bank_transactions policies
DROP POLICY IF EXISTS "Users can view bank transactions of their companies" ON bank_transactions;
DROP POLICY IF EXISTS "Users can insert bank transactions in their companies" ON bank_transactions;
DROP POLICY IF EXISTS "Users can update bank transactions in their companies" ON bank_transactions;
DROP POLICY IF EXISTS "Users can delete bank transactions in their companies" ON bank_transactions;

CREATE POLICY "Users can view bank transactions of their companies"
  ON bank_transactions FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert bank transactions in their companies"
  ON bank_transactions FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update bank transactions in their companies"
  ON bank_transactions FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete bank transactions in their companies"
  ON bank_transactions FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update invoices policies
DROP POLICY IF EXISTS "Users can view invoices of their companies" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices in their companies" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices in their companies" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their companies" ON invoices;

CREATE POLICY "Users can view invoices of their companies"
  ON invoices FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert invoices in their companies"
  ON invoices FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update invoices in their companies"
  ON invoices FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete invoices in their companies"
  ON invoices FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update bank_rules policies
DROP POLICY IF EXISTS "Users can view bank rules of their companies" ON bank_rules;
DROP POLICY IF EXISTS "Users can insert bank rules in their companies" ON bank_rules;
DROP POLICY IF EXISTS "Users can update bank rules in their companies" ON bank_rules;
DROP POLICY IF EXISTS "Users can delete bank rules in their companies" ON bank_rules;

CREATE POLICY "Users can view bank rules of their companies"
  ON bank_rules FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert bank rules in their companies"
  ON bank_rules FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update bank rules in their companies"
  ON bank_rules FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete bank rules in their companies"
  ON bank_rules FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update fiscal_years policies
DROP POLICY IF EXISTS "Users can view fiscal years of their companies" ON fiscal_years;
DROP POLICY IF EXISTS "Users can insert fiscal years in their companies" ON fiscal_years;
DROP POLICY IF EXISTS "Users can update fiscal years in their companies" ON fiscal_years;
DROP POLICY IF EXISTS "Users can delete fiscal years in their companies" ON fiscal_years;

CREATE POLICY "Users can view fiscal years of their companies"
  ON fiscal_years FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert fiscal years in their companies"
  ON fiscal_years FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update fiscal years in their companies"
  ON fiscal_years FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete fiscal years in their companies"
  ON fiscal_years FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update purchase_invoices policies
DROP POLICY IF EXISTS "Users can view purchase invoices of their companies" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can insert purchase invoices in their companies" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can update purchase invoices in their companies" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can delete purchase invoices in their companies" ON purchase_invoices;

CREATE POLICY "Users can view purchase invoices of their companies"
  ON purchase_invoices FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert purchase invoices in their companies"
  ON purchase_invoices FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update purchase invoices in their companies"
  ON purchase_invoices FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete purchase invoices in their companies"
  ON purchase_invoices FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update sales_invoices policies
DROP POLICY IF EXISTS "Users can view sales invoices of their companies" ON sales_invoices;
DROP POLICY IF EXISTS "Users can insert sales invoices in their companies" ON sales_invoices;
DROP POLICY IF EXISTS "Users can update sales invoices in their companies" ON sales_invoices;
DROP POLICY IF EXISTS "Users can delete sales invoices in their companies" ON sales_invoices;

CREATE POLICY "Users can view sales invoices of their companies"
  ON sales_invoices FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can insert sales invoices in their companies"
  ON sales_invoices FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can update sales invoices in their companies"
  ON sales_invoices FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()))
  WITH CHECK (company_id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Users can delete sales invoices in their companies"
  ON sales_invoices FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids_optimized()));

-- Update companies policies
DROP POLICY IF EXISTS "Users can view their companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
DROP POLICY IF EXISTS "Users can update their companies" ON companies;
DROP POLICY IF EXISTS "Users can delete their companies" ON companies;

CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT TO authenticated
  USING (id IN (SELECT get_user_company_ids_optimized()));

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Users can update their companies"
  ON companies FOR UPDATE TO authenticated
  USING (id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = (select auth.uid()) 
    AND role IN ('owner', 'expert')
  ))
  WITH CHECK (id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = (select auth.uid()) 
    AND role IN ('owner', 'expert')
  ));

CREATE POLICY "Users can delete their companies"
  ON companies FOR DELETE TO authenticated
  USING (id IN (
    SELECT company_id FROM company_users 
    WHERE user_id = (select auth.uid()) 
    AND role = 'owner'
  ));

-- Update company_users policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON company_users;

CREATE POLICY "Users can view their own memberships"
  ON company_users FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

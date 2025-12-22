/*
  # CRITICAL SECURITY FIX - Remove Data Leakage via Insecure RLS Policies

  ## Problem
  Multiple tables have duplicate RLS policies:
  - Old {public}/{anon} policies with USING(true) and WITH CHECK(true)
  - New {authenticated} policies with proper company_id checks
  
  The old policies allow ANYONE to view/modify ALL data regardless of company_id,
  causing severe data leakage between companies.

  ## Solution
  Remove ALL insecure {public} and {anon} policies that use "true" conditions.
  Keep ONLY the {authenticated} policies that properly check company_id via get_user_company_ids().

  ## Tables Fixed
  - journal_entries
  - journal_lines
  - documents_inbox
  - bank_transactions
  - accounts
  - contacts
  - purchase_invoices
  - sales_invoices

  ## Security Impact
  After this migration:
  - Users can ONLY see data from companies they belong to
  - No cross-company data leakage
  - Multi-tenant security properly enforced
*/

-- JOURNAL ENTRIES: Remove insecure policies
DROP POLICY IF EXISTS "Users can view journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries" ON journal_entries;

-- JOURNAL LINES: Remove insecure policies
DROP POLICY IF EXISTS "Users can view journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Users can insert journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Users can update journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Users can delete journal lines" ON journal_lines;

-- DOCUMENTS INBOX: Remove insecure policies
DROP POLICY IF EXISTS "Users can view documents" ON documents_inbox;
DROP POLICY IF EXISTS "Users can insert documents" ON documents_inbox;
DROP POLICY IF EXISTS "Users can update documents" ON documents_inbox;
DROP POLICY IF EXISTS "Users can delete documents" ON documents_inbox;

-- BANK TRANSACTIONS: Remove insecure policies
DROP POLICY IF EXISTS "Users can view bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Users can insert bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Users can update bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Users can delete bank transactions" ON bank_transactions;

-- ACCOUNTS: Remove insecure policies
DROP POLICY IF EXISTS "Users can view accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete accounts" ON accounts;

-- CONTACTS: Remove insecure policies
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON contacts;

-- PURCHASE INVOICES: Remove insecure policies
DROP POLICY IF EXISTS "Allow anon to read purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow anon to insert purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow anon to update purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow anon to delete purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated to read purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated to insert purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated to update purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated to delete purchase_invoices" ON purchase_invoices;

-- SALES INVOICES: Remove insecure policies
DROP POLICY IF EXISTS "Allow anon read access to sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow anon insert access to sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow anon update access to sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow anon delete access to sales_invoices" ON sales_invoices;

-- Verify: All remaining policies should now use get_user_company_ids() for security
-- Only {authenticated} users with proper company membership can access data
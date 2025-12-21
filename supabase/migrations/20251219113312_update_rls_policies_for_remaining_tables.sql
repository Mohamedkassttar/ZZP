/*
  # Update RLS Policies for Documents and Bank Transactions
  
  ## Overview
  Updates the RLS policies for documents_inbox and bank_transactions tables to allow
  both authenticated and anonymous users to access the data.
  
  ## Changes
  1. Drop existing restrictive policies for documents_inbox
  2. Drop existing restrictive policies for bank_transactions
  3. Create new policies that allow both roles
  
  ## Security Note
  Appropriate for single-user accounting application using anon key.
*/

-- Update policies for documents_inbox
DROP POLICY IF EXISTS "Authenticated users can view their documents" ON documents_inbox;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON documents_inbox;
DROP POLICY IF EXISTS "Authenticated users can update their documents" ON documents_inbox;
DROP POLICY IF EXISTS "Authenticated users can delete their documents" ON documents_inbox;

CREATE POLICY "Users can view documents"
  ON documents_inbox FOR SELECT
  USING (true);

CREATE POLICY "Users can insert documents"
  ON documents_inbox FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update documents"
  ON documents_inbox FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete documents"
  ON documents_inbox FOR DELETE
  USING (true);

-- Update policies for bank_transactions
DROP POLICY IF EXISTS "Authenticated users can view bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can update bank transactions" ON bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete bank transactions" ON bank_transactions;

CREATE POLICY "Users can view bank transactions"
  ON bank_transactions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert bank transactions"
  ON bank_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update bank transactions"
  ON bank_transactions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete bank transactions"
  ON bank_transactions FOR DELETE
  USING (true);
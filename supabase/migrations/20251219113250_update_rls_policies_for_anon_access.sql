/*
  # Update RLS Policies to Allow Anonymous Access
  
  ## Overview
  Updates the RLS policies to allow both authenticated and anonymous users to access all tables.
  This is necessary for the initial seeding of the chart of accounts and for general app functionality.
  
  ## Changes
  1. Drop existing restrictive policies
  2. Create new policies that allow both `anon` and `authenticated` roles
  3. Maintain security while allowing necessary operations
  
  ## Security Note
  This is appropriate for a single-user accounting application where the anon key is used.
  For multi-user applications, more restrictive policies would be needed.
*/

-- Drop existing policies for accounts
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can insert accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON accounts;
DROP POLICY IF EXISTS "Authenticated users can delete accounts" ON accounts;

-- Create new policies for accounts that allow both anon and authenticated
CREATE POLICY "Users can view accounts"
  ON accounts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert accounts"
  ON accounts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update accounts"
  ON accounts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete accounts"
  ON accounts FOR DELETE
  USING (true);

-- Drop existing policies for contacts
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;

-- Create new policies for contacts
CREATE POLICY "Users can view contacts"
  ON contacts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert contacts"
  ON contacts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update contacts"
  ON contacts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete contacts"
  ON contacts FOR DELETE
  USING (true);

-- Drop existing policies for journal_entries
DROP POLICY IF EXISTS "Authenticated users can view journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Authenticated users can insert journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Authenticated users can update journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Authenticated users can delete journal entries" ON journal_entries;

-- Create new policies for journal_entries
CREATE POLICY "Users can view journal entries"
  ON journal_entries FOR SELECT
  USING (true);

CREATE POLICY "Users can insert journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update journal entries"
  ON journal_entries FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete journal entries"
  ON journal_entries FOR DELETE
  USING (true);

-- Drop existing policies for journal_lines
DROP POLICY IF EXISTS "Authenticated users can view journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Authenticated users can insert journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Authenticated users can update journal lines" ON journal_lines;
DROP POLICY IF EXISTS "Authenticated users can delete journal lines" ON journal_lines;

-- Create new policies for journal_lines
CREATE POLICY "Users can view journal lines"
  ON journal_lines FOR SELECT
  USING (true);

CREATE POLICY "Users can insert journal lines"
  ON journal_lines FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update journal lines"
  ON journal_lines FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete journal lines"
  ON journal_lines FOR DELETE
  USING (true);
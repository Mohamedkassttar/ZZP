/*
  # Create Bank Allocation Rules Table

  1. New Tables
    - `bank_rules`
      - `id` (uuid, primary key)
      - `keyword` (text) - The keyword to match in transaction descriptions
      - `match_type` (enum) - Either 'Contains' or 'Exact'
      - `target_ledger_account_id` (uuid) - The account to book transactions to
      - `description_template` (text, nullable) - Optional override for journal entry description
      - `priority` (integer) - Higher priority rules are checked first
      - `is_active` (boolean) - Whether the rule is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `bank_rules` table
    - Add policy for anonymous access (consistent with other tables)

  3. Notes
    - Rules with higher priority numbers are checked first
    - match_type determines if we use exact match or substring match
*/

-- Create match_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_type') THEN
    CREATE TYPE match_type AS ENUM ('Contains', 'Exact');
  END IF;
END $$;

-- Create bank_rules table
CREATE TABLE IF NOT EXISTS bank_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  match_type match_type NOT NULL DEFAULT 'Contains',
  target_ledger_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description_template text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bank_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "Allow anonymous to read bank rules"
  ON bank_rules
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous to insert bank rules"
  ON bank_rules
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to update bank rules"
  ON bank_rules
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous to delete bank rules"
  ON bank_rules
  FOR DELETE
  TO anon
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_rules_active_priority ON bank_rules(is_active, priority DESC);

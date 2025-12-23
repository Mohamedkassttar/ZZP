/*
  # Create time entries table for time tracking

  1. New Tables
    - `time_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `contact_id` (uuid, references contacts)
      - `date` (date, when work was performed)
      - `hours` (decimal, hours worked)
      - `description` (text, work description)
      - `status` (text, 'open' or 'billed')
      - `invoice_id` (uuid, nullable, references sales_invoices when billed)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `time_entries` table
    - Add policy for users to manage their own time entries (user_id = auth.uid())

  3. Indexes
    - Index on user_id for fast lookups
    - Index on contact_id for filtering by client
    - Index on status for filtering unbilled hours
*/

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  hours numeric(5,2) NOT NULL CHECK (hours > 0),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'billed')),
  invoice_id uuid DEFAULT NULL REFERENCES sales_invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own time entries
CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can insert their own time entries
CREATE POLICY "Users can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own time entries
CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own time entries
CREATE POLICY "Users can delete own time entries"
  ON time_entries FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_contact_id ON time_entries(contact_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);

-- Add comment
COMMENT ON TABLE time_entries IS 'Time tracking entries for billable hours. Can be converted to invoices.';

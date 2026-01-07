/*
  # Quotations and Notifications System

  1. New Tables
    - `quotations`
      - `id` (uuid, primary key)
      - `company_id` (uuid, FK to companies)
      - `contact_id` (uuid, FK to contacts)
      - `quote_number` (text, unique)
      - `date` (date)
      - `valid_until` (date)
      - `status` (text: draft, sent, accepted, rejected, expired)
      - `items` (jsonb - array of line items)
      - `subtotal` (numeric)
      - `vat_amount` (numeric)
      - `total_amount` (numeric)
      - `notes` (text)
      - `terms` (text)
      - `public_token` (uuid, unique - for public approval)
      - `accepted_at` (timestamptz)
      - `sent_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `company_id` (uuid, FK to companies)
      - `type` (text: quote_accepted, quote_rejected, system, etc.)
      - `title` (text)
      - `message` (text)
      - `reference_id` (uuid - link to quotation/invoice ID)
      - `reference_type` (text: quotation, invoice, etc.)
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    - Add policy for public quote approval (anon users with valid token)
*/

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  quote_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  terms text,
  public_token uuid UNIQUE DEFAULT gen_random_uuid(),
  accepted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, quote_number)
);

-- Create index on public_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotations_public_token ON quotations(public_token);
CREATE INDEX IF NOT EXISTS idx_quotations_company_id ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_contact_id ON quotations(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid,
  reference_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Quotations policies for authenticated users
CREATE POLICY "Users can view quotations in their company"
  ON quotations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert quotations in their company"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotations in their company"
  ON quotations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quotations in their company"
  ON quotations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Public access policy for quote approval (anon users with valid token)
CREATE POLICY "Public can view quotations with valid token"
  ON quotations FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);

CREATE POLICY "Public can update quotation status with valid token"
  ON quotations FOR UPDATE
  TO anon
  USING (public_token IS NOT NULL)
  WITH CHECK (
    public_token IS NOT NULL 
    AND status IN ('accepted', 'rejected')
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert notifications in their company"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow system to create notifications (for triggers)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO anon
  WITH CHECK (true);

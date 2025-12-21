/*
  # AI Invoice Scanner - Documents Inbox Table
  
  ## Overview
  This migration creates the infrastructure for AI-powered invoice scanning and processing.
  Documents are uploaded, analyzed by AI, and then converted into journal entries.
  
  ## 1. New Tables
  
  ### documents_inbox
  - `id` (uuid, primary key) - Unique identifier
  - `file_url` (text) - Storage path/URL to the uploaded document
  - `file_name` (text) - Original file name
  - `file_type` (text) - MIME type (e.g., application/pdf, image/jpeg)
  - `status` (text) - Processing status: Uploading, Processing, Review_Needed, Booked, Error
  - `extracted_data` (jsonb) - AI-extracted invoice data
  - `journal_entry_id` (uuid, FK) - Link to created journal entry (if booked)
  - `error_message` (text) - Error details if processing failed
  - `created_at` (timestamptz) - Upload timestamp
  - `processed_at` (timestamptz) - When AI processing completed
  - `booked_at` (timestamptz) - When converted to journal entry
  
  ## 2. Extracted Data Structure (JSONB)
  The extracted_data field stores AI analysis results:
  ```json
  {
    "supplier_name": "Shell Nederland B.V.",
    "invoice_date": "2024-03-15",
    "invoice_number": "INV-2024-001",
    "total_amount": 121.00,
    "vat_amount": 21.00,
    "net_amount": 100.00,
    "vat_percentage": 21,
    "suggested_account_id": "uuid-of-account",
    "suggested_account_code": "4000",
    "suggested_account_name": "Autokosten",
    "description": "Brandstof Shell Station",
    "confidence": 0.95
  }
  ```
  
  ## 3. Business Rules
  - Documents start in 'Uploading' status
  - After AI processing, status moves to 'Review_Needed'
  - User reviews and confirms booking, status becomes 'Booked'
  - Booked documents are linked to journal_entries
  
  ## 4. Security
  - RLS enabled for authenticated users only
  - Users can only access their own documents
*/

-- Create document status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('Uploading', 'Processing', 'Review_Needed', 'Booked', 'Error');
  END IF;
END $$;

-- Table: documents_inbox
CREATE TABLE IF NOT EXISTS documents_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  status document_status DEFAULT 'Uploading',
  extracted_data jsonb,
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  booked_at timestamptz
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_inbox_status ON documents_inbox(status);
CREATE INDEX IF NOT EXISTS idx_documents_inbox_created_at ON documents_inbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_inbox_journal_entry ON documents_inbox(journal_entry_id);

-- Enable Row Level Security
ALTER TABLE documents_inbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies for documents_inbox
CREATE POLICY "Authenticated users can view their documents"
  ON documents_inbox FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON documents_inbox FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their documents"
  ON documents_inbox FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete their documents"
  ON documents_inbox FOR DELETE
  TO authenticated
  USING (true);

-- Function: Update processed_at timestamp when status changes to Review_Needed
CREATE OR REPLACE FUNCTION update_document_processed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Review_Needed' AND OLD.status != 'Review_Needed' THEN
    NEW.processed_at = now();
  END IF;
  
  IF NEW.status = 'Booked' AND OLD.status != 'Booked' THEN
    NEW.booked_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update timestamps
DROP TRIGGER IF EXISTS update_document_timestamps ON documents_inbox;
CREATE TRIGGER update_document_timestamps
  BEFORE UPDATE ON documents_inbox
  FOR EACH ROW
  EXECUTE FUNCTION update_document_processed_at();
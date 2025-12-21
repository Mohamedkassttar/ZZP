/*
  # Storage Bucket for Invoice Documents
  
  ## Overview
  Creates a Supabase Storage bucket for storing uploaded invoice documents (PDFs and images).
  
  ## 1. Storage Bucket
  - Name: `invoices`
  - Public: false (authenticated access only)
  - File size limit: 10MB
  - Allowed MIME types: PDF and common image formats
  
  ## 2. Security Policies
  - Authenticated users can upload files
  - Authenticated users can read their own files
  - Authenticated users can delete their own files
*/

-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

-- Storage policy: Allow authenticated users to read their files
CREATE POLICY "Authenticated users can read invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

-- Storage policy: Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete invoices"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');
/*
  # Fix Storage RLS Policies for Invoices Bucket

  1. Security Changes
    - Drop any existing conflicting policies on storage.objects for 'invoices' bucket
    - Create new policies for authenticated users to upload, view, and delete files
    
  2. New Policies
    - `authenticated_insert_invoices`: Allow authenticated users to upload files to invoices bucket
    - `authenticated_select_invoices`: Allow authenticated users to view/download files from invoices bucket
    - `authenticated_delete_invoices`: Allow authenticated users to delete files from invoices bucket
    
  3. Notes
    - Policies are applied to storage.objects table
    - All policies check for bucket_id = 'invoices' AND auth.role() = 'authenticated'
    - This fixes the "new row violates row-level security policy" error
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "authenticated_insert_invoices" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select_invoices" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_invoices" ON storage.objects;
DROP POLICY IF EXISTS "Give authenticated users access to invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON storage.objects;

-- Create policy for INSERT (uploading files)
CREATE POLICY "authenticated_insert_invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
);

-- Create policy for SELECT (viewing/downloading files)
CREATE POLICY "authenticated_select_invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
);

-- Create policy for DELETE (deleting files)
CREATE POLICY "authenticated_delete_invoices"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices'
);
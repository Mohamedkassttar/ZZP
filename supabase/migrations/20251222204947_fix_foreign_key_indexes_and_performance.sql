/*
  # Fix Foreign Key Indexes and Performance Issues
  
  This migration addresses critical performance and security issues:
  
  ## 1. Foreign Key Indexes
  Adds missing indexes on foreign key columns to improve query performance:
  - bank_transactions.journal_entry_id
  - companies.created_by
  - company_settings (cash_account_id, private_account_id)
  - documents_inbox.journal_entry_id
  - invoice_lines.invoice_id
  - invoices (company_id, contact_id)
  - journal_lines.journal_entry_id
  - purchase_invoices.document_id
  
  ## 2. Notes
  - These indexes will significantly improve JOIN performance
  - Particularly important for multi-tenant queries filtering by company_id
  - Essential for maintaining good performance as data grows
*/

-- Add index for bank_transactions.journal_entry_id
CREATE INDEX IF NOT EXISTS idx_bank_transactions_journal_entry_id 
  ON bank_transactions(journal_entry_id);

-- Add index for companies.created_by
CREATE INDEX IF NOT EXISTS idx_companies_created_by 
  ON companies(created_by);

-- Add indexes for company_settings foreign keys
CREATE INDEX IF NOT EXISTS idx_company_settings_cash_account_id 
  ON company_settings(cash_account_id);

CREATE INDEX IF NOT EXISTS idx_company_settings_private_account_id 
  ON company_settings(private_account_id);

-- Add index for documents_inbox.journal_entry_id
CREATE INDEX IF NOT EXISTS idx_documents_inbox_journal_entry_id 
  ON documents_inbox(journal_entry_id);

-- Add index for invoice_lines.invoice_id
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id 
  ON invoice_lines(invoice_id);

-- Add index for invoices.company_id (if not already covered by compound index)
CREATE INDEX IF NOT EXISTS idx_invoices_company_id 
  ON invoices(company_id);

-- Add index for invoices.contact_id
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id 
  ON invoices(contact_id);

-- Add index for journal_lines.journal_entry_id
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry_id 
  ON journal_lines(journal_entry_id);

-- Add index for purchase_invoices.document_id
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_document_id 
  ON purchase_invoices(document_id);

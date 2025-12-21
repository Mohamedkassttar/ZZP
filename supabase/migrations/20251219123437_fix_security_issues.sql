/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes on Foreign Keys
    - Add index on bank_rules.target_ledger_account_id
    - Add index on fixed_assets.balance_sheet_account_id
    - Add index on fixed_assets.depreciation_account_id
    - Add index on invoice_lines.ledger_account_id
    - Add index on invoices.journal_entry_id
    - Add index on journal_entries.contact_id
    - Add index on mileage_logs.journal_entry_id

  2. Remove Unused Indexes
    - Drops all indexes that are not being actively used to reduce storage overhead
    - Includes indexes on bank_transactions, fixed_assets, mileage_logs, journal entries, settings, invoices, invoice_lines, bank_rules, and documents_inbox

  3. Fix Function Security (Search Path)
    - Recreates all database functions with explicit search_path set to public
    - Prevents search_path injection attacks
    - Functions updated: validate_journal_entry_balance, update_invoice_finalized_at, update_updated_at_column, update_document_processed_at, update_bank_transaction_reconciled_at

  Notes:
    - Auth DB Connection Strategy must be configured manually in Supabase dashboard
    - Unused indexes are safe to drop as they only add maintenance overhead
*/

-- =====================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bank_rules_target_ledger_account 
  ON bank_rules(target_ledger_account_id);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_balance_sheet_account 
  ON fixed_assets(balance_sheet_account_id);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_depreciation_account 
  ON fixed_assets(depreciation_account_id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_ledger_account 
  ON invoice_lines(ledger_account_id);

CREATE INDEX IF NOT EXISTS idx_invoices_journal_entry 
  ON invoices(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_contact 
  ON journal_entries(contact_id);

CREATE INDEX IF NOT EXISTS idx_mileage_logs_journal_entry 
  ON mileage_logs(journal_entry_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_bank_transactions_status;
DROP INDEX IF EXISTS idx_bank_transactions_amount;
DROP INDEX IF EXISTS idx_bank_transactions_journal_entry;
DROP INDEX IF EXISTS idx_fixed_assets_active;
DROP INDEX IF EXISTS idx_mileage_logs_booked;
DROP INDEX IF EXISTS idx_journal_entries_date;
DROP INDEX IF EXISTS idx_journal_lines_entry_id;
DROP INDEX IF EXISTS idx_settings_key;
DROP INDEX IF EXISTS idx_invoices_contact;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_date;
DROP INDEX IF EXISTS idx_invoices_number;
DROP INDEX IF EXISTS idx_invoice_lines_invoice;
DROP INDEX IF EXISTS idx_bank_rules_active_priority;
DROP INDEX IF EXISTS idx_documents_inbox_status;
DROP INDEX IF EXISTS idx_documents_inbox_journal_entry;

-- =====================================================
-- 3. FIX FUNCTION SECURITY - SET EXPLICIT SEARCH_PATH
-- =====================================================

-- Fix: validate_journal_entry_balance function
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  IF NEW.status = 'Final' THEN
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM journal_lines
    WHERE journal_entry_id = NEW.id;
    
    IF total_debit != total_credit THEN
      RAISE EXCEPTION 'Cannot finalize journal entry: Debits (%) do not equal Credits (%)', 
        total_debit, total_credit;
    END IF;
    
    IF total_debit = 0 AND total_credit = 0 THEN
      RAISE EXCEPTION 'Cannot finalize journal entry: No journal lines exist';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix: update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix: update_document_processed_at function
CREATE OR REPLACE FUNCTION update_document_processed_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Review_Needed' AND OLD.status != 'Review_Needed' THEN
    NEW.processed_at = now();
  END IF;
  
  IF NEW.status = 'Booked' AND OLD.status != 'Booked' THEN
    NEW.booked_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix: update_bank_transaction_reconciled_at function
CREATE OR REPLACE FUNCTION update_bank_transaction_reconciled_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('Matched', 'Booked') AND OLD.status = 'Unmatched' THEN
    NEW.reconciled_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix: update_invoice_finalized_at function
CREATE OR REPLACE FUNCTION update_invoice_finalized_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != 'Draft' AND OLD.status = 'Draft' THEN
    NEW.finalized_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;
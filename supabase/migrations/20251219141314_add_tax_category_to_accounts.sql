/*
  # Add Tax Category to Accounts

  1. Changes
    - Add `tax_category` column to `accounts` table
      - Type: text (nullable)
      - Purpose: Map accounts to tax report categories for IB Aangifte

  2. Valid Tax Categories
    - "Materiële Vaste Activa" (Tangible Fixed Assets)
    - "Financiële Vaste Activa" (Financial Fixed Assets)
    - "Voorraden" (Inventory)
    - "Vorderingen" (Receivables)
    - "Liquide Middelen" (Cash and Bank)
    - "Ondernemingsvermogen" (Equity)
    - "Langlopende Schulden" (Long-term Liabilities)
    - "Kortlopende Schulden" (Current Liabilities)

  3. Notes
    - Used for Dutch tax balance sheet reporting
    - Helps map chart of accounts to Belastingdienst categories
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'tax_category'
  ) THEN
    ALTER TABLE accounts ADD COLUMN tax_category text;
  END IF;
END $$;
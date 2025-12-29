/*
  # Add VAT percentage to products table

  1. Changes
    - Add `vat_percentage` column to products table
      - Default value: 21 (standard NL BTW tarief)
      - Common values: 0 (geen BTW), 9 (laag tarief), 21 (hoog tarief)
    
  2. Notes
    - Allows flexible VAT rates per product
    - Default set to 21% (most common in Netherlands)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'vat_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN vat_percentage numeric(5,2) DEFAULT 21 NOT NULL;
  END IF;
END $$;

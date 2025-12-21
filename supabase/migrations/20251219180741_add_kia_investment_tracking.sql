/*
  # Add KIA Investment Tracking to Fiscal Years
  
  1. Changes
    - Add `investments_total` column to track total investment amount (excl. VAT)
    - Add `investment_deduction_kia` column to track the calculated/manual KIA deduction
  
  2. Purpose
    - Enable tracking of small-scale investment deduction (KIA) in tax calculations
    - Store both the raw investment amount and the calculated deduction
    - Allow manual override of calculated deduction for specific tax year rules
  
  3. Default Values
    - Both columns default to 0 for existing records
*/

-- Add investment tracking columns to fiscal_years
ALTER TABLE fiscal_years 
ADD COLUMN IF NOT EXISTS investments_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_deduction_kia NUMERIC DEFAULT 0;
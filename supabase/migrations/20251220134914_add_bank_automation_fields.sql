/*
  # Add Bank Automation Fields

  1. Changes
    - Add `auto_booked` boolean column to track automatically processed transactions
    - Add `confidence_score` numeric column to store AI confidence level (0-100)
    - Add `ai_suggestion` jsonb column to store complete suggestion data
    - These fields support the High-Intelligence Automation Engine

  2. Purpose
    - Enable self-learning bank rule system
    - Track auto-booking decisions and confidence levels
    - Store AI suggestions for user review
    - Support feedback loop and continuous improvement
*/

-- Add automation tracking columns to bank_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'auto_booked'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN auto_booked boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN confidence_score numeric(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_transactions' AND column_name = 'ai_suggestion'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN ai_suggestion jsonb;
  END IF;
END $$;

-- Add index for querying auto-booked transactions
CREATE INDEX IF NOT EXISTS idx_bank_transactions_auto_booked
  ON bank_transactions(auto_booked)
  WHERE auto_booked = true;

-- Add index for querying by confidence score
CREATE INDEX IF NOT EXISTS idx_bank_transactions_confidence
  ON bank_transactions(confidence_score)
  WHERE confidence_score IS NOT NULL;

-- Add use_count and last_used to bank_rules for self-learning
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_rules' AND column_name = 'use_count'
  ) THEN
    ALTER TABLE bank_rules ADD COLUMN use_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_rules' AND column_name = 'last_used'
  ) THEN
    ALTER TABLE bank_rules ADD COLUMN last_used timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN bank_transactions.auto_booked IS 'Indicates if transaction was automatically booked by AI (confidence >= 80%)';
COMMENT ON COLUMN bank_transactions.confidence_score IS 'AI confidence score (0-100) for booking suggestion';
COMMENT ON COLUMN bank_transactions.ai_suggestion IS 'Complete AI suggestion data including mode, accounts, and reasoning';
COMMENT ON COLUMN bank_rules.use_count IS 'Number of times this rule has been used (self-learning metric)';
COMMENT ON COLUMN bank_rules.last_used IS 'Timestamp of last rule usage (self-learning metric)';

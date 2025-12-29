/*
  # Add Mileage Tracking Support to Time Entries

  1. Changes to `contacts` table
    - Add `mileage_rate` column (decimal, nullable) - Rate per kilometer for mileage compensation

  2. Changes to `time_entries` table
    - Add `entry_type` column (text, default 'hours') - Type of entry: 'hours' or 'mileage'
    - Add `distance` column (decimal, nullable) - Distance in kilometers for mileage entries
    - Update CHECK constraint on hours to allow NULL for mileage entries
    - Add CHECK constraint to ensure:
      - Hours entries have hours > 0 and distance IS NULL
      - Mileage entries have distance > 0 and hours IS NULL

  3. Notes
    - Existing entries will be migrated to 'hours' type automatically
    - Hours and distance are mutually exclusive based on entry_type
    - Mileage rate can be set per contact/client
*/

-- Add mileage_rate to contacts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'mileage_rate'
  ) THEN
    ALTER TABLE contacts ADD COLUMN mileage_rate numeric(5,2) DEFAULT NULL CHECK (mileage_rate IS NULL OR mileage_rate >= 0);
    COMMENT ON COLUMN contacts.mileage_rate IS 'Kilometer vergoeding (rate per kilometer)';
  END IF;
END $$;

-- Add entry_type to time_entries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'entry_type'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN entry_type text NOT NULL DEFAULT 'hours' CHECK (entry_type IN ('hours', 'mileage'));
    COMMENT ON COLUMN time_entries.entry_type IS 'Type van entry: hours (uren) of mileage (kilometers)';
  END IF;
END $$;

-- Add distance to time_entries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'distance'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN distance numeric(6,2) DEFAULT NULL CHECK (distance IS NULL OR distance > 0);
    COMMENT ON COLUMN time_entries.distance IS 'Afstand in kilometers (alleen voor mileage entries)';
  END IF;
END $$;

-- Drop existing hours constraint and add new one that allows NULL for mileage entries
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_hours_check;

  -- Add new constraint that allows NULL hours for mileage entries
  ALTER TABLE time_entries ADD CONSTRAINT time_entries_hours_check
    CHECK (
      (entry_type = 'hours' AND hours > 0 AND distance IS NULL) OR
      (entry_type = 'mileage' AND distance > 0 AND hours IS NULL)
    );
END $$;

-- Create index on entry_type for filtering
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_type ON time_entries(entry_type);

-- Update existing entries to ensure they meet new constraints (set default hours if NULL)
UPDATE time_entries SET hours = 0.01 WHERE hours IS NULL OR hours = 0;
-- Add nullable end_date (timestamptz) and meta (jsonb) columns to events and archived_events
-- Safe to run against a live DB: columns are nullable and won't affect existing rows

ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS end_date timestamptz,
  ADD COLUMN IF NOT EXISTS meta jsonb;

ALTER TABLE IF EXISTS archived_events
  ADD COLUMN IF NOT EXISTS end_date timestamptz,
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- Optional: create indexes if you plan to query metadata fields often (commented out)
-- CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);

-- End of script

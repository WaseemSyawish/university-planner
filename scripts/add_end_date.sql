-- Safe SQL to add end_date and meta to the events table (Postgres)
-- Runs non-destructively and won't affect existing rows.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meta JSONB;

-- Ensure index on date exists (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (date);

-- Add end_date to events table
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP;

-- Add end_date to archived_events table  
ALTER TABLE "archived_events" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP;
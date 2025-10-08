-- Adds archived column to events table
ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

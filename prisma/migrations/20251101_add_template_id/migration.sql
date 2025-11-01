-- Migration: add template_id to events and archived_events with indexes
-- File: prisma/migrations/20251101_add_template_id/migration.sql

BEGIN;

-- Add template_id column to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS template_id uuid;

-- Add indexes to speed lookups/updates by template_id
CREATE INDEX IF NOT EXISTS idx_events_template_id ON public.events (template_id);
CREATE INDEX IF NOT EXISTS idx_events_template_date ON public.events (template_id, date);

-- Add template_id column to archived_events
ALTER TABLE public.archived_events
  ADD COLUMN IF NOT EXISTS template_id uuid;

-- Add indexes for archived_events
CREATE INDEX IF NOT EXISTS idx_archived_events_template_id ON public.archived_events (template_id);
CREATE INDEX IF NOT EXISTS idx_archived_events_template_date ON public.archived_events (template_id, date);

COMMIT;

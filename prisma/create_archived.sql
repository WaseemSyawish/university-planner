-- create_archived.sql
CREATE TABLE IF NOT EXISTS public.archived_events (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  original_event_id text UNIQUE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'assignment',
  archived boolean NOT NULL DEFAULT true,
  course_id text,
  date timestamptz NOT NULL,
  time text,
  description text,
  completed boolean NOT NULL DEFAULT false,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for course if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_archived_course'
  ) THEN
    ALTER TABLE public.archived_events
      ADD CONSTRAINT fk_archived_course FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END$$;

-- Add foreign key constraint for user if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_archived_user'
  ) THEN
    ALTER TABLE public.archived_events
      ADD CONSTRAINT fk_archived_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_archived_events_date ON public.archived_events(date);
CREATE INDEX IF NOT EXISTS idx_archived_events_user ON public.archived_events(user_id);

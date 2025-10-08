Prisma migration and test instructions

1. Set DATABASE_URL in your environment (Postgres)
   - On Windows PowerShell:
     $env:DATABASE_URL = "postgresql://user:pass@localhost:5432/dbname?schema=public"

2. Install dependencies and generate Prisma client:
   npm install
   npx prisma generate

3. Create and apply a migration (development):
   npx prisma migrate dev --name add-events-model

4. Start Next.js dev server:
   npm run dev

5. Smoke test the events API (example):
   node test-events-api.js

Notes:
- The calendar frontend currently posts events with a placeholder userId = 'demo-user'. Replace with real auth user id.
- If you see permission or connection errors, verify your Postgres is running and DATABASE_URL is correct.

Adding EventTemplate model and linking Events to templates
--------------------------------------------------------

This workspace now includes an `EventTemplate` model and an optional `template_id` column on `Event`.

To apply the schema changes locally (development, SQLite or Postgres):

1. Regenerate Prisma client:
   npx prisma generate

2. Create and apply migration (SQLite dev):
   npx prisma migrate dev --name add-event-template

3. Inspect the migration SQL in `prisma/migrations` and review before applying to production databases.

Rollback: If you need to revert the migration in development, you can reset the database (data will be lost):
   npx prisma migrate reset

Important: For production environments, create a careful migration plan and backups before applying schema changes. Consider a two-step migration if you need zero-downtime: (a) add nullable column, (b) backfill data, (c) enforce constraints.

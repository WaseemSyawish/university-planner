README: Safe manual migration to add `template_id` and backfill values

Overview

This project had an issue where "Update All" failed to update all materialized occurrences in a recurring series. The fix is to add a canonical `template_id` column to the `events` and `archived_events` tables, index it, backfill values from existing `meta`/`[META]` blocks, and let the server use `template_id` for efficient updateMany operations.

Files created
- prisma/migrations/20251101_add_template_id/migration.sql  -- SQL to alter tables and add indexes
- prisma/migrations/20251101_add_template_id/README.md     -- instructions for applying the SQL
- scripts/backfill-template-id.js                          -- Node/Prisma script to populate template_id from meta/description

Steps (recommended)
1) Backup your DB (do not skip for production)

2) Apply the SQL migration

Using psql (replace <DATABASE_URL> with your connection string or ensure .env is set):

```powershell
psql "$env:DATABASE_URL" -f prisma/migrations/20251101_add_template_id/migration.sql
```

Or use your DB provider UI to run the SQL in `prisma/migrations/20251101_add_template_id/migration.sql`.

3) Regenerate Prisma client

```powershell
npx prisma generate
```

4) Run the backfill script (staging first)

```powershell
node .\scripts\backfill-template-id.js
```

The script attempts to discover `template_id` inside `meta` JSON or `[META]...` blocks in `description`. It updates rows where a template id is found and logs progress.

5) Verify changes
- Use the preview API to inspect candidate matches:

```powershell
$body = @{ title = "Tentative" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/events/{id}?scope=all&preview=true" -Method Patch -ContentType 'application/json' -Body $body
```

- After preview looks correct, apply the update:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/events/{id}?scope=all" -Method Patch -ContentType 'application/json' -Body $body
```

If you'd like, I can run the backfill on this machine after you confirm the migration was applied. Reply "run backfill" when ready, or if you prefer I can generate a one-line SQL for your DBA to run.
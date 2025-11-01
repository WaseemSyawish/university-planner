Apply this migration to your PostgreSQL database.

Important: Run these steps on a staging copy or during a maintenance window for production. Take a DB backup first.

Using psql (local or via SSH tunnel):

```bash
# from project root
psql "${DATABASE_URL}" -f prisma/migrations/20251101_add_template_id/migration.sql
```

Using Railway CLI (if you use Railway):

```bash
railway run psql "${DATABASE_URL}" -f prisma/migrations/20251101_add_template_id/migration.sql
```

After applying the SQL migration, regenerate Prisma client:

```bash
npx prisma generate
```

Then run the backfill script to populate discovered template_id values:

```bash
node scripts/backfill-template-id.js
```

If you prefer to apply via your DB provider UI, open the SQL file and run its contents in the SQL editor.

If you want me to run the backfill here after you confirm the migration applied, reply "run backfill" and I'll execute it and report results.

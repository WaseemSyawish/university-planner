Local setup for Prisma + Postgres (Windows PowerShell)

This document shows the minimal steps to run a local Postgres container, configure your env, push the Prisma schema, generate the client, and open Prisma Studio.

1) Start Postgres (Docker)

# Run a local Postgres container (exposes on localhost:5432)
docker run -d --name uni-planner-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=university_planner -p 5432:5432 postgres:15

2) Create .env from example

# In PowerShell
copy .env.example .env

3) Push Prisma schema and generate client

npx prisma db push
npx prisma generate

4) Open Prisma Studio

npx prisma studio

Notes
- If you don't have Docker installed, install Docker Desktop for Windows.
- If port 5432 is in use, stop the conflicting service or change the mapped port and update DATABASE_URL accordingly.
- If Prisma Studio fails, check DATABASE_URL, ensure Postgres is running, and check firewall rules.

SQLite fallback (no Docker)
--------------------------------
If you cannot run Docker locally, you can use SQLite for a quick local Prisma Studio experience.

1) Copy the example env and enable the sqlite URL

```powershell
copy .env.example .env
# then edit .env and ensure DATABASE_URL_SQLITE is set to file:./dev.db
```

2) Use the sqlite Prisma schema and push/generate

```powershell
# Point prisma to the sqlite schema
npx prisma --schema=prisma/schema.sqlite.prisma db push
npx prisma --schema=prisma/schema.sqlite.prisma generate

# Open Studio connected to the sqlite DB
npx prisma --schema=prisma/schema.sqlite.prisma studio
```

This will create `dev.db` in the repository root and open Prisma Studio against it. It's a lightweight option for exploring models and records.

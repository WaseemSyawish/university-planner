-- CreateTable
CREATE TABLE "event_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "course_id" TEXT,
    "repeat_option" TEXT,
    "start_date" DATETIME,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'assignment',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "course_id" TEXT,
    "template_id" TEXT,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "events_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "event_templates" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_events" ("archived", "completed", "course_id", "created_at", "date", "description", "id", "time", "title", "type", "updated_at", "user_id") SELECT "archived", "completed", "course_id", "created_at", "date", "description", "id", "time", "title", "type", "updated_at", "user_id" FROM "events";
DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";
CREATE INDEX "idx_events_date" ON "events"("date");
CREATE INDEX "idx_events_user" ON "events"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

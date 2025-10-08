-- CreateEnum
CREATE TYPE "public"."attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'HOLIDAY', 'EXCUSED', 'LATE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "settings" JSONB,
    "password_hash" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."courses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "credits" INTEGER DEFAULT 3,
    "color" TEXT,
    "semester" TEXT,
    "instructor" TEXT,
    "description" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attendance_sessions" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "public"."attendance_status" NOT NULL,
    "points" INTEGER DEFAULT 0,
    "notes" TEXT,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'assignment',
    "location" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "course_id" TEXT,
    "template_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "end_date" TIMESTAMP(3),
    "description" TEXT,
    "meta" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."event_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "course_id" TEXT,
    "repeat_option" TEXT,
    "start_date" TIMESTAMP(3),
    "payload" JSONB,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."archived_events" (
    "id" TEXT NOT NULL,
    "original_event_id" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'assignment',
    "archived" BOOLEAN NOT NULL DEFAULT true,
    "course_id" TEXT,
    "location" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "description" TEXT,
    "meta" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "idx_attendance_date" ON "public"."attendance_sessions"("date");

-- CreateIndex
CREATE INDEX "idx_attendance_user_course" ON "public"."attendance_sessions"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "idx_events_date" ON "public"."events"("date");

-- CreateIndex
CREATE INDEX "idx_events_user" ON "public"."events"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "archived_events_original_event_id_key" ON "public"."archived_events"("original_event_id");

-- CreateIndex
CREATE INDEX "idx_archived_events_date" ON "public"."archived_events"("date");

-- CreateIndex
CREATE INDEX "idx_archived_events_user" ON "public"."archived_events"("user_id");

-- AddForeignKey
ALTER TABLE "public"."courses" ADD CONSTRAINT "courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."event_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."archived_events" ADD CONSTRAINT "archived_events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."archived_events" ADD CONSTRAINT "archived_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

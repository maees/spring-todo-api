-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "carriedOver" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "todo_days" ADD COLUMN     "reviewNote" VARCHAR(500);

-- AlterTable
ALTER TABLE "routines" ADD COLUMN     "intervalDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "startDate" VARCHAR(10);

-- Existing routines start their interval from the day they were created.
UPDATE "routines"
SET "startDate" = to_char("createdAt", 'YYYY-MM-DD')
WHERE "startDate" IS NULL;

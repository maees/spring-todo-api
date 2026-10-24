CREATE TABLE "todo_days" (
    "date" DATE NOT NULL,
    CONSTRAINT "todo_days_pkey" PRIMARY KEY ("date")
);

ALTER TABLE "todos" ADD COLUMN "day" DATE;

UPDATE "todos"
SET "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
WHERE "day" IS NULL;

INSERT INTO "todo_days" ("date")
SELECT DISTINCT "day" FROM "todos"
ON CONFLICT ("date") DO NOTHING;

INSERT INTO "todo_days" ("date")
VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date)
ON CONFLICT ("date") DO NOTHING;

ALTER TABLE "todos" ALTER COLUMN "day" SET NOT NULL;
ALTER TABLE "todos" ALTER COLUMN "done" SET DEFAULT false;

ALTER TABLE "todos"
ADD CONSTRAINT "todos_day_fkey"
FOREIGN KEY ("day") REFERENCES "todo_days"("date")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "todos_day_done_id_idx" ON "todos"("day", "done", "id");
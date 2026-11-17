-- Accommodate an existing experimental, nullable tags column without deleting data.
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "tagMode" TEXT NOT NULL DEFAULT 'auto';
UPDATE "todos" SET "tags" = ARRAY[]::TEXT[] WHERE "tags" IS NULL;
UPDATE "todos" SET "tagMode" = 'manual' WHERE cardinality("tags") > 0;
ALTER TABLE "todos" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "routines" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "tagMode" TEXT NOT NULL DEFAULT 'auto';

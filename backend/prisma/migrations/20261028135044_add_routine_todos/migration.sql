-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daysOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_history" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "dateKey" VARCHAR(10) NOT NULL,
    "todoId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routine_history_dateKey_idx" ON "routine_history"("dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "routine_history_routineId_dateKey_key" ON "routine_history"("routineId", "dateKey");

-- AddForeignKey
ALTER TABLE "routine_history" ADD CONSTRAINT "routine_history_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

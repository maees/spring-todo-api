-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "todos_deletedAt_idx" ON "todos"("deletedAt");

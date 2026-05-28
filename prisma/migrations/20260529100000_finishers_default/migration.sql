-- AlterTable: give finishers a default empty array so course creation doesn't fail
ALTER TABLE "Course" ALTER COLUMN "finishers" SET DEFAULT '{}';

-- Add finishers array to Course for storing race results (top 5 in order).
ALTER TABLE "Course" ADD COLUMN "finishers" INTEGER[] NOT NULL DEFAULT '{}';

/*
  Warnings:

  - You are about to drop the column `label` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `meeting` on the `Course` table. All the data in the column will be lost.
  - Added the required column `hippodrome` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('ATTELE', 'MONTE', 'PLAT');

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "label",
DROP COLUMN "meeting",
ADD COLUMN     "discipline" "Discipline" NOT NULL DEFAULT 'ATTELE',
ADD COLUMN     "distanceMeters" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "hippodrome" TEXT NOT NULL,
ADD COLUMN     "nocturne" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prizeMoney" INTEGER,
ADD COLUMN     "prizeName" TEXT;

-- CreateTable
CREATE TABLE "Runner" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "driver" TEXT,
    "trainer" TEXT,
    "owner" TEXT,
    "sexAge" TEXT,
    "chrono" TEXT,
    "recentForm" TEXT,
    "gains" INTEGER,
    "odds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Runner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Runner_courseId_number_key" ON "Runner"("courseId", "number");

-- AddForeignKey
ALTER TABLE "Runner" ADD CONSTRAINT "Runner_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

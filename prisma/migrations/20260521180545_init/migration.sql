-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PLACED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentNetwork" AS ENUM ('ORANGE', 'MOOV');

-- CreateEnum
CREATE TYPE "BetResult" AS ENUM ('PENDING', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "meeting" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "cutoffTime" TIMESTAMP(3) NOT NULL,
    "runnerCount" INTEGER NOT NULL DEFAULT 16,
    "status" "CourseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "horsesToSelect" INTEGER NOT NULL,
    "ordered" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBetOffer" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "betTypeId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseBetOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentRef" TEXT,
    "paymentPhone" TEXT,
    "paymentNetwork" "PaymentNetwork",
    "paidAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "selections" INTEGER[],
    "price" INTEGER NOT NULL,
    "result" "BetResult" NOT NULL DEFAULT 'PENDING',
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPhoto" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSms" (
    "id" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "amount" INTEGER,
    "sender" TEXT,
    "txnId" TEXT,
    "network" "PaymentNetwork",
    "matchedOrderId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_date_idx" ON "Course"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BetType_name_key" ON "BetType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BetType_code_key" ON "BetType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBetOffer_courseId_betTypeId_key" ON "CourseBetOffer"("courseId", "betTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");

-- AddForeignKey
ALTER TABLE "CourseBetOffer" ADD CONSTRAINT "CourseBetOffer_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBetOffer" ADD CONSTRAINT "CourseBetOffer_betTypeId_fkey" FOREIGN KEY ("betTypeId") REFERENCES "BetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CourseBetOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPhoto" ADD CONSTRAINT "TicketPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

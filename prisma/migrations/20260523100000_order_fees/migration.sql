-- Add fee breakdown columns to Order (existing orders keep 0 fees)
ALTER TABLE "Order" ADD COLUMN "subtotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "transactionFee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "platformFee" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing orders: subtotal = total (no fees were charged before)
UPDATE "Order" SET "subtotal" = "total";

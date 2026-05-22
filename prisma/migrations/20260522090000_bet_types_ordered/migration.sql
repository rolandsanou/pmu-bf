-- Data migration: preserve customer selection order for Report 4+1 bets.
UPDATE "BetType" SET "ordered" = true WHERE "code" LIKE 'R41_%';

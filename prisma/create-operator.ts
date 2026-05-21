import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

// Usage: tsx prisma/create-operator.ts <username> <password> [displayName]
// Reads DATABASE_URL from the environment. Idempotent (upsert by username).
const prisma = new PrismaClient();

async function main() {
  const [, , username, password, displayName] = process.argv;
  if (!username || !password) {
    console.error(
      "Usage: tsx prisma/create-operator.ts <username> <password> [displayName]"
    );
    process.exit(1);
  }
  const uname = username.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const rec = await prisma.operatorUser.upsert({
    where: { username: uname },
    update: { passwordHash, displayName: displayName ?? null },
    create: { username: uname, passwordHash, displayName: displayName ?? null },
  });
  console.log(`Opérateur prêt: ${rec.username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

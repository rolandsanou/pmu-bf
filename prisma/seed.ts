import { PrismaClient, CourseStatus, Discipline } from "@prisma/client";

const prisma = new PrismaClient();

// Report 4+1 "carnet" formules: you pick N horses, price is fixed per N.
// (Price = number of 5-horse combinations among your N picks × 300 F.)
const BET_TYPES = [
  { code: "R41_5", name: "4+1 — 5 chevaux", horsesToSelect: 5, ordered: false, price: 300, description: "Pari de base" },
  { code: "R41_6", name: "4+1 — 6 chevaux", horsesToSelect: 6, ordered: false, price: 1800, description: "Grand carnet" },
  { code: "R41_7", name: "4+1 — 7 chevaux", horsesToSelect: 7, ordered: false, price: 6300, description: "Grand carnet" },
  { code: "R41_8", name: "4+1 — 8 chevaux", horsesToSelect: 8, ordered: false, price: 16800, description: "Grand carnet" },
];

// Featured race from the PMU'B journal of 22/05/2026.
const RUNNERS = [
  { number: 1, name: "ILIO MANNETOT", driver: "F. NIVARD", trainer: "E. SZIRMAY", owner: "M. FILLIE", sexAge: "H.8", chrono: "1.11.40", recentForm: "4.A.9.6.5", gains: 216620, odds: "24/1" },
  { number: 2, name: "JAIN MAB", driver: "B. ROCHARD", trainer: "A. BUISSON", owner: "J. COTTEL", sexAge: "F.7", chrono: "1.12.00", recentForm: "5.3.0.2.3", gains: 218990, odds: "14/1" },
  { number: 3, name: "JIMINY CRICKET", driver: "J.PH. MONCLIN", trainer: "J.PH. MONCLIN", owner: "L. MONCLIN", sexAge: "H.7", chrono: "1.13.00", recentForm: "1.1.7.4.2", gains: 220260, odds: "13/1" },
  { number: 4, name: "IOUPY TOLLEVILLE", driver: "E. SZIRMAY", trainer: "E. SZIRMAY", owner: "E. SZIRMAY", sexAge: "H.8", chrono: "1.12.00", recentForm: "6.5.3.0.7", gains: 222695, odds: "46/1" },
  { number: 5, name: "JACOMO BELLO", driver: "TH. LEVESQUE", trainer: "TH. LEVESQUE", owner: "EC. Thomas LEVESQUE", sexAge: "H.7", chrono: "1.09.70", recentForm: "6.5.3.2.3", gains: 224850, odds: "16/1" },
  { number: 6, name: "JIZOU D'ETANG", driver: "D. THOMAIN", trainer: "CH. BIGEON", owner: "ELEV. DE L'ETANG", sexAge: "H.7", chrono: "1.10.50", recentForm: "D.D.1.5.9", gains: 238010, odds: "7/1" },
  { number: 7, name: "JAPAROV LIRE", driver: "A. COLLETTE", trainer: "L. ROELENS", owner: "G. DAVID", sexAge: "H.7", chrono: "1.11.50", recentForm: "9.0.1.2.D", gains: 239880, odds: "24/1" },
  { number: 8, name: "JANKO HAUFOR", driver: "D. BONNE", trainer: "CH. BIGEON", owner: "EC. Christian BIGEON", sexAge: "H.7", chrono: "1.11.40", recentForm: "4.2.0.1.2", gains: 240100, odds: "11/1" },
  { number: 9, name: "IMELDA", driver: "E. RAFFIN", trainer: "P. LEVESQUE", owner: "N. DORDAIN", sexAge: "F.8", chrono: "1.11.20", recentForm: "1.4.4.6.2", gains: 255525, odds: "22/1" },
  { number: 10, name: "HIGH FIRE DAIRPET", driver: "E. ALLARD", trainer: "B. MARIE", owner: "EC. Marcel GELEOC", sexAge: "H.9", chrono: "1.12.30", recentForm: "0.0.D.9.0", gains: 255560, odds: "84/1" },
  { number: 11, name: "IRIS DES ROSEAUX", driver: "CL. DUVALDESTIN", trainer: "TH. DUVALDESTIN", owner: "M. ELINE", sexAge: "H.8", chrono: "1.11.40", recentForm: "9.D.2.2.2", gains: 256770, odds: "10/1" },
  { number: 12, name: "HERCULE DE LEAU", driver: "E. DE JESUS", trainer: "A. DE JESUS", owner: "FL. FRACAS", sexAge: "H.9", chrono: "1.11.60", recentForm: "8.3.9.0.0", gains: 256970, odds: "34/1" },
  { number: 13, name: "JOLIVERT DU GERS", driver: "J.M. BAZIRE", trainer: "M. ABRIVARD", owner: "EC. J.P.BRAGATO", sexAge: "H.7", chrono: "1.10.50", recentForm: "5.4.1.3.7", gains: 259495, odds: "6/1" },
  { number: 14, name: "GOLD D'ECROVILLE", driver: "P.PH. PLOQUIN", trainer: "B. MARIE", owner: "R. JEAN", sexAge: "H.10", chrono: "1.11.10", recentForm: "6.6.D.D.4", gains: 262130, odds: "28/1" },
  { number: 15, name: "ICARE WILLIAMS", driver: "M. ABRIVARD", trainer: "M. ABRIVARD", owner: "EC. LEOMY", sexAge: "H.8", chrono: "1.10.40", recentForm: "2.0.2.1.5", gains: 263861, odds: "9/1" },
];

async function main() {
  // Reset demo data in FK-safe order (dev only).
  await prisma.ticketPhoto.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.order.deleteMany();
  await prisma.paymentSms.deleteMany();
  await prisma.courseBetOffer.deleteMany();
  await prisma.runner.deleteMany();
  await prisma.course.deleteMany();
  await prisma.betType.deleteMany();

  const typeIdByCode: Record<string, string> = {};
  for (const bt of BET_TYPES) {
    const { price: _price, ...typeData } = bt;
    void _price;
    const rec = await prisma.betType.create({ data: typeData });
    typeIdByCode[bt.code] = rec.id;
  }

  // Bets close at 18:00 UTC (Burkina Faso is UTC, so the hour maps directly).
  // The race day is the next day whose 18:00 cutoff is still ahead.
  const now = new Date();
  let cutoffTime = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0, 0)
  );
  if (cutoffTime.getTime() <= now.getTime()) {
    cutoffTime = new Date(cutoffTime.getTime() + 24 * 60 * 60 * 1000);
  }
  const startTime = cutoffTime; // displayed post time = the 18:00 UTC cutoff
  const day = new Date(
    Date.UTC(
      cutoffTime.getUTCFullYear(),
      cutoffTime.getUTCMonth(),
      cutoffTime.getUTCDate()
    )
  );

  const course = await prisma.course.create({
    data: {
      hippodrome: "Paris-Vincennes",
      number: 4,
      prizeName: "Prix Sirrah",
      discipline: Discipline.ATTELE,
      distanceMeters: 2700,
      prizeMoney: 44500000,
      nocturne: true,
      date: day,
      startTime,
      cutoffTime,
      runnerCount: RUNNERS.length,
      status: CourseStatus.OPEN,
      runners: { create: RUNNERS },
    },
  });

  for (const bt of BET_TYPES) {
    await prisma.courseBetOffer.create({
      data: {
        courseId: course.id,
        betTypeId: typeIdByCode[bt.code],
        price: bt.price,
      },
    });
  }

  console.log(
    `Seed terminé: 4+1 avec ${BET_TYPES.length} formules, course ${course.prizeName} (${RUNNERS.length} partants).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

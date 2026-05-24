"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { generateOrderCode } from "./orders";
import { loginOperator, logoutOperator, requireOperator } from "./auth";
import { notifyCustomerTicketPlaced, notifyOperatorNewOrder } from "./notify";
import { saveTicketPhoto } from "./storage";
import type { CreateOrderResult, NewOrderInput } from "./order-types";
import { parseJournalPdf, type ParsedCourse } from "./journal-parser";
import { getNextRaceDayCutoff } from "./race-days";
import { decryptId, encryptId } from "./id-cipher";

export async function createOrder(
  input: NewOrderInput
): Promise<CreateOrderResult> {
  const customerName = input.customerName?.trim();
  const customerPhone = input.customerPhone?.trim();
  const paymentPhone = input.paymentPhone?.trim();
  const paymentRef = input.paymentRef?.trim();

  // Check global betting pause
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.bettingClosed)
    return { ok: false, error: settings.closedMessage || "Les paris sont suspendus." };

  if (!customerName) return { ok: false, error: "Le nom est requis." };
  if (!customerPhone) return { ok: false, error: "Le téléphone est requis." };
  if (!paymentRef)
    return { ok: false, error: "La référence de paiement est requise." };
  if (input.paymentNetwork !== "ORANGE" && input.paymentNetwork !== "MOOV")
    return { ok: false, error: "Réseau de paiement invalide." };
  if (!input.items?.length)
    return { ok: false, error: "Aucun pari sélectionné." };

  // Decrypt encrypted offer IDs from the client
  const offerIds = input.items.map((i) => {
    const decrypted = decryptId(i.offerId);
    return decrypted ?? i.offerId; // fallback to raw if not encrypted (shouldn't happen)
  });
  const offers = await prisma.courseBetOffer.findMany({
    where: { id: { in: offerIds }, active: true },
    include: { betType: true, course: true },
  });
  const offerById = new Map(offers.map((o) => [o.id, o]));

  const now = new Date();
  const betsData: {
    offerId: string;
    courseId: string;
    selections: number[];
    price: number;
  }[] = [];
  let total = 0;

  for (const item of input.items) {
    const decryptedOfferId = decryptId(item.offerId) ?? item.offerId;
    const offer = offerById.get(decryptedOfferId);
    if (!offer) return { ok: false, error: "Pari indisponible." };
    if (offer.course.status !== "OPEN" || offer.course.cutoffTime <= now)
      return {
        ok: false,
        error: `Les paris sont fermés pour ${offer.course.hippodrome} C${offer.course.number}.`,
      };
    if (offer.course.bettingOpensAt && now < offer.course.bettingOpensAt)
      return {
        ok: false,
        error: `Les paris ne sont pas encore ouverts pour ${offer.course.hippodrome} C${offer.course.number}. Ouverture à ${offer.course.bettingOpensAt.getUTCHours()}h${String(offer.course.bettingOpensAt.getUTCMinutes()).padStart(2, "0")}.`,
      };

    const need = offer.betType.horsesToSelect;
    const sels = item.selections ?? [];
    const unique = new Set(sels);
    if (sels.length !== need || unique.size !== need)
      return {
        ok: false,
        error: `${offer.betType.name}: choisissez ${need} cheval(aux) distinct(s).`,
      };
    if (sels.some((n) => !Number.isInteger(n) || n < 1 || n > offer.course.runnerCount))
      return { ok: false, error: `${offer.betType.name}: numéro de cheval invalide.` };

    betsData.push({
      offerId: offer.id,
      courseId: offer.courseId,
      selections: sels,
      price: offer.price,
    });
    total += offer.price;
  }

  // Calculate fees
  const subtotal = total;
  const transactionFee = Math.ceil(subtotal * 0.01); // 1% rounded up
  const platformFee = 15; // fixed 15 FCFA
  const grandTotal = subtotal + transactionFee + platformFee;

  // Create the order, retrying on the rare order-code collision.
  let created;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateOrderCode();
    try {
      created = await prisma.order.create({
        data: {
          code,
          customerName,
          customerPhone,
          paymentPhone: paymentPhone || null,
          paymentRef,
          paymentNetwork: input.paymentNetwork,
          subtotal,
          transactionFee,
          platformFee,
          total: grandTotal,
          bets: { create: betsData },
        },
      });
      break;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
  if (!created) return { ok: false, error: "Erreur, veuillez réessayer." };

  await notifyOperatorNewOrder({
    code: created.code,
    customerName,
    customerPhone,
    total: grandTotal,
    betCount: betsData.length,
  });

  return { ok: true, code: created.code };
}

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const ok = await loginOperator(username, password);
  redirect(ok ? "/operateur" : "/operateur/login?error=1");
}

export async function logoutAction(): Promise<void> {
  await logoutOperator();
  redirect("/operateur/login");
}

export async function verifyPayment(encryptedOrderId: string): Promise<void> {
  await requireOperator();
  const orderId = decryptId(encryptedOrderId);
  if (!orderId) throw new Error("ID invalide.");
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidatePath("/operateur");
  revalidatePath(`/operateur/commande`);
}

export async function cancelOrder(encryptedOrderId: string): Promise<void> {
  await requireOperator();
  const orderId = decryptId(encryptedOrderId);
  if (!orderId) throw new Error("ID invalide.");
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/operateur");
  revalidatePath(`/operateur/commande`);
}

export async function placeOrderWithPhoto(formData: FormData): Promise<void> {
  await requireOperator();
  const encryptedId = String(formData.get("orderId") || "");
  if (!encryptedId) throw new Error("Commande introuvable.");
  const orderId = decryptId(encryptedId);
  if (!orderId) throw new Error("ID invalide.");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Commande introuvable.");

  const files = formData
    .getAll("photo")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const photoPaths: string[] = [];
  let i = 0;
  for (const file of files) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await saveTicketPhoto(bytes, ext, `${orderId}-${Date.now()}-${i++}`);
    photoPaths.push(url);
    await prisma.ticketPhoto.create({ data: { orderId, url } });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "PLACED", placedAt: new Date() },
  });

  if (photoPaths.length > 0) {
    await notifyCustomerTicketPlaced(order.customerPhone, order.code, photoPaths);
  }

  revalidatePath("/operateur");
  revalidatePath(`/operateur/commande`);
  redirect(`/operateur/commande/${encryptedId}`);
}

// ── Result entry ──────────────────────────────────────────────────────────

/**
 * Settle a course: store the top-5 finishers and auto-grade every bet.
 */
export async function settleResults(
  encryptedCourseId: string,
  finishers: number[]
): Promise<{ ok: boolean; error?: string }> {
  await requireOperator();

  const courseId = decryptId(encryptedCourseId);
  if (!courseId) return { ok: false, error: "ID invalide." };

  if (finishers.length !== 5) return { ok: false, error: "Il faut 5 arrivants." };
  if (new Set(finishers).size !== 5)
    return { ok: false, error: "Les 5 arrivants doivent être différents." };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { runners: true },
  });
  if (!course) return { ok: false, error: "Course introuvable." };

  const validNums = new Set(course.runners.map((r) => r.number));
  for (const n of finishers) {
    if (!validNums.has(n))
      return { ok: false, error: `Le n°${n} n'est pas un partant de cette course.` };
  }

  // 1. Store finishers + close the course.
  await prisma.course.update({
    where: { id: courseId },
    data: { finishers, status: "SETTLED" },
  });

  // 2. Grade every bet on this course.
  const bets = await prisma.bet.findMany({ where: { courseId } });
  const finisherSet = new Set(finishers);

  for (const bet of bets) {
    // How many of the customer's picks are in the top 5?
    const matching = bet.selections.filter((s) => finisherSet.has(s));
    const won = matching.length >= 5;

    await prisma.bet.update({
      where: { id: bet.id },
      data: { result: won ? "WON" : "LOST" },
    });
  }

  // 3. Settle orders: if ALL bets of an order are graded, mark SETTLED.
  const affectedOrderIds = [...new Set(bets.map((b) => b.orderId))];
  for (const orderId of affectedOrderIds) {
    const orderBets = await prisma.bet.findMany({ where: { orderId } });
    const allGraded = orderBets.every((b) => b.result !== "PENDING");
    if (allGraded) {
      // Only move to SETTLED if the order was PLACED (don't override CANCELLED).
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order && order.status === "PLACED") {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "SETTLED" },
        });
      }
    }
  }

  revalidatePath("/operateur");
  revalidatePath("/operateur/resultats");
  return { ok: true };
}

/**
 * Set the payout amount for an individual bet (operator enters manually).
 */
export async function updateBetPayout(
  encryptedBetId: string,
  payout: number
): Promise<void> {
  await requireOperator();
  const betId = decryptId(encryptedBetId);
  if (!betId) throw new Error("ID invalide.");
  if (payout < 0) throw new Error("Le gain ne peut pas être négatif.");
  await prisma.bet.update({
    where: { id: betId },
    data: { payout },
  });
  revalidatePath(`/operateur/commande`);
}

// ── Journal PDF import ────────────────────────────────────────────────

/**
 * Parse a PMU'B journal PDF and return structured data for review.
 */
export async function parseJournal(
  formData: FormData
): Promise<{ ok: true; course: ParsedCourse } | { ok: false; error: string }> {
  await requireOperator();

  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Aucun fichier PDF." };
  if (file.size > 10 * 1024 * 1024)
    return { ok: false, error: "Fichier trop volumineux (max 10 Mo)." };

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseJournalPdf(bytes);
    if (parsed.runners.length === 0) {
      return {
        ok: false,
        error:
          "Aucun cheval trouvé dans le PDF. Le format n'est peut-être pas reconnu. Vous pouvez saisir la course manuellement.",
      };
    }
    return { ok: true, course: parsed };
  } catch {
    return { ok: false, error: "Erreur de lecture du PDF." };
  }
}

/**
 * Create a course from parsed journal data (after operator review).
 * The operator sets the betting window and prices manually.
 */
export async function importCourse(input: {
  hippodrome: string;
  number: number;
  prizeName: string;
  discipline: "ATTELE" | "MONTE" | "PLAT";
  distanceMeters: number;
  prizeMoney: number;
  bettingOpensAt: string; // ISO datetime string (GMT)
  bettingClosesAt: string; // ISO datetime string (GMT)
  prices: Record<string, number>; // betType code → price override (0 = use default)
  runners: {
    number: number;
    name: string;
    driver: string;
    trainer: string;
    owner: string;
    sexAge: string;
    chrono: string;
    recentForm: string;
    gains: number;
    odds: string;
  }[];
}): Promise<{ ok: true; courseId: string } | { ok: false; error: string }> {
  await requireOperator();

  if (!input.hippodrome.trim())
    return { ok: false, error: "L'hippodrome est requis." };
  if (input.runners.length === 0)
    return { ok: false, error: "Il faut au moins un cheval." };

  const opensAt = new Date(input.bettingOpensAt);
  const closesAt = new Date(input.bettingClosesAt);
  if (isNaN(opensAt.getTime()) || isNaN(closesAt.getTime()))
    return { ok: false, error: "Les dates d'ouverture/fermeture sont invalides." };
  if (closesAt <= opensAt)
    return { ok: false, error: "L'heure de fermeture doit être après l'ouverture." };

  const day = new Date(
    Date.UTC(closesAt.getUTCFullYear(), closesAt.getUTCMonth(), closesAt.getUTCDate())
  );

  // Create course + runners.
  const course = await prisma.course.create({
    data: {
      hippodrome: input.hippodrome.trim(),
      number: input.number,
      prizeName: input.prizeName.trim() || null,
      discipline: input.discipline,
      distanceMeters: input.distanceMeters,
      prizeMoney: input.prizeMoney || null,
      date: day,
      startTime: closesAt,
      bettingOpensAt: opensAt,
      cutoffTime: closesAt,
      runnerCount: input.runners.length,
      status: "OPEN",
      runners: {
        create: input.runners.map((r) => ({
          number: r.number,
          name: r.name,
          driver: r.driver || null,
          trainer: r.trainer || null,
          owner: r.owner || null,
          sexAge: r.sexAge || null,
          chrono: r.chrono || null,
          recentForm: r.recentForm || null,
          gains: r.gains || null,
          odds: r.odds || null,
        })),
      },
    },
  });

  // Auto-create the 4 Report 4+1 bet offers (5/6/7/8 chevaux).
  const betTypes = await prisma.betType.findMany({
    where: { code: { startsWith: "R41_" }, active: true },
  });

  for (const bt of betTypes) {
    // Use operator's custom price if set, otherwise default formula.
    const customPrice = input.prices[bt.code];
    let price: number;
    if (customPrice && customPrice > 0) {
      price = customPrice;
    } else {
      const n = bt.horsesToSelect;
      const combos = factorial(n) / (factorial(5) * factorial(n - 5));
      price = combos * 300;
    }

    await prisma.courseBetOffer.create({
      data: {
        courseId: course.id,
        betTypeId: bt.id,
        price,
        active: true,
      },
    });
  }

  revalidatePath("/jouer");
  revalidatePath("/operateur");
  return { ok: true, courseId: course.id };
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ── Site settings (betting pause) ────────────────────────────────

/** Read the singleton site settings row (creates it if missing). */
export async function getSiteSettings() {
  const row = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  if (row) return row;
  return prisma.siteSettings.create({ data: { id: "singleton" } });
}

/** Operator toggles the betting-closed state with a custom message. */
export async function toggleBettingClosed(
  closed: boolean,
  message: string
): Promise<void> {
  await requireOperator();
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: { bettingClosed: closed, closedMessage: message },
    create: { id: "singleton", bettingClosed: closed, closedMessage: message },
  });
  revalidatePath("/jouer");
  revalidatePath("/operateur");
}

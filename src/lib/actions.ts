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

export async function createOrder(
  input: NewOrderInput
): Promise<CreateOrderResult> {
  const customerName = input.customerName?.trim();
  const customerPhone = input.customerPhone?.trim();
  const paymentPhone = input.paymentPhone?.trim();
  const paymentRef = input.paymentRef?.trim();

  if (!customerName) return { ok: false, error: "Le nom est requis." };
  if (!customerPhone) return { ok: false, error: "Le téléphone est requis." };
  if (!paymentRef)
    return { ok: false, error: "La référence de paiement est requise." };
  if (input.paymentNetwork !== "ORANGE" && input.paymentNetwork !== "MOOV")
    return { ok: false, error: "Réseau de paiement invalide." };
  if (!input.items?.length)
    return { ok: false, error: "Aucun pari sélectionné." };

  const offerIds = input.items.map((i) => i.offerId);
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
    const offer = offerById.get(item.offerId);
    if (!offer) return { ok: false, error: "Pari indisponible." };
    if (offer.course.status !== "OPEN" || offer.course.cutoffTime <= now)
      return {
        ok: false,
        error: `Les paris sont fermés pour ${offer.course.hippodrome} C${offer.course.number}.`,
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
          total,
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
    total,
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

export async function verifyPayment(orderId: string): Promise<void> {
  await requireOperator();
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidatePath("/operateur");
  revalidatePath(`/operateur/commande/${orderId}`);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await requireOperator();
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/operateur");
  revalidatePath(`/operateur/commande/${orderId}`);
}

export async function placeOrderWithPhoto(formData: FormData): Promise<void> {
  await requireOperator();
  const orderId = String(formData.get("orderId") || "");
  if (!orderId) throw new Error("Commande introuvable.");

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
  revalidatePath(`/operateur/commande/${orderId}`);
  redirect(`/operateur/commande/${orderId}`);
}

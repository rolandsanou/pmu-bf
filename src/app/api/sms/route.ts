import { prisma } from "@/lib/db";

/**
 * Phase 2 — payment reconciliation webhook.
 *
 * An SMS-forwarder app on the operator's phone POSTs each Orange/Moov payment
 * confirmation here. We store it and try to match it to a pending order by
 * transaction reference. Auto-verification stays off for now (the operator
 * confirms), but the match is surfaced to speed her up.
 */
export async function POST(req: Request) {
  let payload: {
    raw?: string;
    amount?: number;
    sender?: string;
    txnId?: string;
    network?: "ORANGE" | "MOOV";
  };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }

  const sms = await prisma.paymentSms.create({
    data: {
      raw: payload.raw ?? "",
      amount: payload.amount ?? null,
      sender: payload.sender ?? null,
      txnId: payload.txnId ?? null,
      network: payload.network ?? null,
    },
  });

  let matchedOrderId: string | null = null;
  if (payload.txnId) {
    const match = await prisma.order.findFirst({
      where: { status: "PENDING_PAYMENT", paymentRef: payload.txnId },
    });
    if (match) {
      matchedOrderId = match.id;
      await prisma.paymentSms.update({
        where: { id: sms.id },
        data: { matchedOrderId },
      });
    }
  }

  return Response.json({ ok: true, matchedOrderId });
}

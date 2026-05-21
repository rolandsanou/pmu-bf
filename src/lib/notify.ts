/**
 * Outbound notifications (WhatsApp / SMS).
 *
 * Phase 1: messages are logged to the server console so the flow is testable
 * end to end without external accounts.
 *
 * Phase 2: implement `sendWhatsApp` against the WhatsApp Business Cloud API
 * (pre-approved templates + media). This is the ONLY function that needs to
 * change — the rest of the app calls the `notify*` helpers below.
 */

import { formatFCFA } from "./format";

type WhatsAppMessage = {
  to: string;
  body: string;
  mediaUrl?: string;
};

async function sendWhatsApp({ to, body, mediaUrl }: WhatsAppMessage): Promise<void> {
  // TODO(phase-2): POST to WhatsApp Business Cloud API with an approved template.
  console.log(
    `[whatsapp] -> ${to}\n${body}${mediaUrl ? `\n[media] ${mediaUrl}` : ""}\n`
  );
}

function operatorNumber(): string | undefined {
  return process.env.OPERATOR_WHATSAPP;
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export type OrderForNotify = {
  code: string;
  customerName: string;
  customerPhone: string;
  total: number;
  betCount: number;
};

export async function notifyOperatorNewOrder(order: OrderForNotify): Promise<void> {
  const to = operatorNumber();
  if (!to) {
    console.log("[whatsapp] OPERATOR_WHATSAPP non défini — notification ignorée");
    return;
  }
  await sendWhatsApp({
    to,
    body:
      `Nouvelle commande ${order.code}\n` +
      `Client: ${order.customerName} (${order.customerPhone})\n` +
      `${order.betCount} pari(s) — ${formatFCFA(order.total)}\n` +
      `${appUrl()}/operateur`,
  });
}

export async function notifyCustomerTicketPlaced(
  customerPhone: string,
  orderCode: string,
  photoPaths: string[]
): Promise<void> {
  const base = appUrl();
  await sendWhatsApp({
    to: customerPhone,
    body: `Votre pari ${orderCode} a été placé. Voici votre ticket. Bonne chance !`,
    mediaUrl: photoPaths[0] ? `${base}${photoPaths[0]}` : undefined,
  });
}

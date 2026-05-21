import { prisma } from "@/lib/db";
import { ORDER_STATUS_LABEL, formatSelections } from "@/lib/format";
import { generateOrderReceiptPdf } from "@/lib/pdf";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const order = await prisma.order.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      bets: {
        include: { offer: { include: { betType: true } }, course: true },
      },
    },
  });

  if (!order) {
    return new Response("Commande introuvable", { status: 404 });
  }

  const pdf = await generateOrderReceiptPdf({
    businessName,
    code: order.code,
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    statusLabel: ORDER_STATUS_LABEL[order.status],
    paymentNetwork: order.paymentNetwork,
    paymentRef: order.paymentRef,
    total: order.total,
    bets: order.bets.map((bet) => ({
      courseLabel: `${bet.course.hippodrome} C${bet.course.number}`,
      betTypeName: bet.offer.betType.name,
      selections: formatSelections(bet.selections, bet.offer.betType.ordered),
      price: bet.price,
    })),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recu-${order.code}.pdf"`,
    },
  });
}

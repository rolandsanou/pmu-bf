import { prisma } from "@/lib/db";
import { isOperatorAuthed } from "@/lib/auth";
import { formatSelections } from "@/lib/format";
import { generatePlacementSheetPdf } from "@/lib/pdf";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export async function GET(req: Request) {
  if (!(await isOperatorAuthed())) {
    return Response.redirect(new URL("/operateur/login", req.url), 302);
  }

  const orders = await prisma.order.findMany({
    where: { status: { in: ["PAID", "PLACED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { bets: { include: { offer: { include: { betType: true } } } } },
  });

  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);

  const pdf = await generatePlacementSheetPdf({
    businessName,
    title: "Feuille de placement",
    generatedAt: new Date(),
    grandTotal,
    orders: orders.map((o) => ({
      code: o.code,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      total: o.total,
      placed: o.status === "PLACED",
      bets: o.bets.map((b) => ({
        label: b.offer.betType.name,
        selections: formatSelections(b.selections, b.offer.betType.ordered),
      })),
    })),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="feuille-placement.pdf"`,
    },
  });
}

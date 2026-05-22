import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatFCFA,
  formatDateTime,
  formatSelectionsWithNames,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

const STEPS = [
  { key: "PENDING_PAYMENT", label: "Paiement à vérifier" },
  { key: "PAID", label: "Payé" },
  { key: "PLACED", label: "Ticket prêt" },
];

export default async function OrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await prisma.order.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      bets: {
        include: {
          offer: { include: { betType: true } },
          course: { include: { runners: true } },
        },
      },
      ticketPhotos: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return (
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-slate-900">
              🏇 {businessName}
            </Link>
            <Link href="/jouer" className="text-sm text-emerald-700 font-medium">
              Nouveau pari
            </Link>
          </div>
        </header>
        <div className="max-w-md w-full mx-auto px-4 py-12 text-center">
          <p className="text-4xl">🔍</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            Commande introuvable
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Le code <span className="font-semibold">{code.toUpperCase()}</span>{" "}
            ne correspond à aucune commande. Vérifiez le code et réessayez.
          </p>
          <Link
            href="/suivi"
            className="mt-5 inline-block rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Réessayer
          </Link>
        </div>
      </main>
    );
  }

  const currentStep = STEPS.findIndex((s) => s.key === order.status);

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-900">
            🏇 {businessName}
          </Link>
          <Link href="/jouer" className="text-sm text-emerald-700 font-medium">
            Nouveau pari
          </Link>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Commande</p>
              <p className="text-2xl font-bold tracking-wide">{order.code}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${ORDER_STATUS_COLOR[order.status]}`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>

          {/* Progress */}
          {order.status !== "CANCELLED" && (
            <div className="mt-4 flex gap-2">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      i <= currentStep ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                  <p
                    className={`mt-1 text-[11px] ${
                      i <= currentStep ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Client</dt>
            <dd className="text-right">{order.customerName}</dd>
            <dt className="text-slate-500">Téléphone</dt>
            <dd className="text-right">{order.customerPhone}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd className="text-right">{formatDateTime(order.createdAt)}</dd>
            {order.paymentRef && (
              <>
                <dt className="text-slate-500">Référence</dt>
                <dd className="text-right">{order.paymentRef}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Bets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Mes paris</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {order.bets.map((bet) => (
              <li key={bet.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {bet.offer.betType.name}{" "}
                    <span className="text-slate-400">
                      · {bet.course.hippodrome} C{bet.course.number}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatSelectionsWithNames(
                      bet.selections,
                      bet.offer.betType.ordered,
                      bet.course.runners
                    )}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatFCFA(bet.price)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-emerald-700">
              {formatFCFA(order.total)}
            </span>
          </div>
        </div>

        {/* Ticket photos */}
        {order.ticketPhotos.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Mon ticket</h2>
            <p className="text-xs text-slate-500 mb-2">
              Preuve du pari placé.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {order.ticketPhotos.map((p, i) => {
                const dl = p.url.startsWith("/api/tickets/")
                  ? `${p.url}?dl=1`
                  : p.url;
                return (
                  <div key={p.id} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Ticket ${i + 1}`}
                      className="w-full rounded-lg border border-slate-200"
                    />
                    <a
                      href={dl}
                      download
                      className="block rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Télécharger
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <a
          href={`/commande/${order.code}/recu`}
          className="block rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
        >
          Télécharger le reçu (PDF)
        </a>
      </div>
    </main>
  );
}

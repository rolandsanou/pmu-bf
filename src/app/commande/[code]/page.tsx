import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatFCFA,
  formatDateTime,
  formatSelectionsWithNames,
} from "@/lib/format";
import GoodLuckBanner from "./GoodLuckBanner";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

const STEPS = [
  { key: "PENDING_PAYMENT", label: "Paiement à vérifier" },
  { key: "PAID", label: "Payé" },
  { key: "PLACED", label: "Ticket prêt" },
  { key: "SETTLED", label: "Résultat" },
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
  const isSettled = order.status === "SETTLED";
  const totalPayout = order.bets.reduce((sum, b) => sum + b.payout, 0);

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
        <Suspense>
          <GoodLuckBanner />
        </Suspense>

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

        {/* Official results card (only when settled) */}
        {isSettled && (() => {
          // Collect unique courses with finishers.
          const settledCourses = new Map<string, {
            label: string;
            finishers: number[];
            runners: { number: number; name: string }[];
          }>();
          for (const bet of order.bets) {
            if (bet.course.finishers.length > 0 && !settledCourses.has(bet.courseId)) {
              settledCourses.set(bet.courseId, {
                label: bet.course.prizeName
                  ? `${bet.course.prizeName} — ${bet.course.hippodrome} C${bet.course.number}`
                  : `${bet.course.hippodrome} C${bet.course.number}`,
                finishers: bet.course.finishers,
                runners: bet.course.runners,
              });
            }
          }
          const byNum = (runners: { number: number; name: string }[]) =>
            new Map(runners.map((r) => [r.number, r.name]));

          return [...settledCourses.values()].map((sc, i) => {
            const nameMap = byNum(sc.runners);
            return (
              <div
                key={i}
                className="rounded-xl border border-violet-200 bg-violet-50 p-4"
              >
                <h2 className="font-semibold text-violet-900">
                  Arrivée officielle
                </h2>
                <p className="text-xs text-violet-600 mb-2">{sc.label}</p>
                <ol className="space-y-1">
                  {sc.finishers.map((num, pos) => (
                    <li
                      key={num}
                      className="flex items-center gap-2 text-sm font-medium text-violet-800"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-200 text-xs font-bold">
                        {pos + 1}
                      </span>
                      <span>
                        N°{num} {nameMap.get(num) ?? ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          });
        })()}

        {/* Bets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Mes paris</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {order.bets.map((bet) => {
              const finishers = bet.course.finishers ?? [];
              const finisherSet = new Set(finishers);
              const isGraded = bet.result !== "PENDING";
              const won = bet.result === "WON";

              // "Ordre" check: filter picks to finishers (preserving pick order)
              // and compare to finishers order.
              let isOrdre = false;
              if (won && finishers.length === 5) {
                const matching = bet.selections.filter((s) =>
                  finisherSet.has(s)
                );
                isOrdre = matching.every((p, i) => p === finishers[i]);
              }

              const byNum = new Map(
                bet.course.runners.map((r) => [r.number, r.name])
              );

              return (
                <li key={bet.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {bet.offer.betType.name}{" "}
                        <span className="text-slate-400">
                          &middot; {bet.course.hippodrome} C
                          {bet.course.number}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isGraded && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            won
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {won
                            ? isOrdre
                              ? "GAGNÉ · Ordre"
                              : "GAGNÉ · Désordre"
                            : "PERDU"}
                        </span>
                      )}
                      <span className="text-sm font-semibold">
                        {formatFCFA(bet.price)}
                      </span>
                    </div>
                  </div>

                  {/* Horse selection with highlighting */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {bet.selections.map((num) => {
                      const inTop5 = finisherSet.has(num);
                      const pos = inTop5
                        ? finishers.indexOf(num) + 1
                        : null;
                      return (
                        <span
                          key={num}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                            isGraded
                              ? inTop5
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-400"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {pos && (
                            <span className="font-bold text-emerald-600">
                              {pos}e
                            </span>
                          )}
                          {num} {byNum.get(num) ?? ""}
                        </span>
                      );
                    })}
                  </div>

                  {/* Payout */}
                  {won && bet.payout > 0 && (
                    <p className="mt-1.5 text-sm font-bold text-emerald-700">
                      Gain : {formatFCFA(bet.payout)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
            {order.subtotal > 0 && order.subtotal !== order.total && (
              <>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Sous-total</span>
                  <span>{formatFCFA(order.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Frais</span>
                  <span>{formatFCFA(order.transactionFee + order.platformFee)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-emerald-700">
                {formatFCFA(order.total)}
              </span>
            </div>
          </div>
          {isSettled && totalPayout > 0 && (
            <div className="flex items-center justify-between border-t border-emerald-100 pt-3 mt-2">
              <span className="font-semibold text-emerald-700">Total gains</span>
              <span className="font-bold text-emerald-700 text-lg">
                {formatFCFA(totalPayout)}
              </span>
            </div>
          )}
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

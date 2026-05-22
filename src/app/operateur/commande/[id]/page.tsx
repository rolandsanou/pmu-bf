import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isOperatorAuthed } from "@/lib/auth";
import { cancelOrder, verifyPayment, updateBetPayout } from "@/lib/actions";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatFCFA,
  formatDateTime,
  formatSelectionsWithNames,
} from "@/lib/format";
import TicketUpload from "./TicketUpload";
import PayoutInput from "./PayoutInput";

export const dynamic = "force-dynamic";

export default async function OperatorOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isOperatorAuthed())) redirect("/operateur/login");

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
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

  if (!order) notFound();

  const canCancel = order.status !== "CANCELLED" && order.status !== "SETTLED";

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/operateur" className="text-sm text-slate-500">
            ← Commandes
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${ORDER_STATUS_COLOR[order.status]}`}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold tracking-wide">{order.code}</p>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Client</dt>
            <dd className="text-right">{order.customerName}</dd>
            <dt className="text-slate-500">Téléphone</dt>
            <dd className="text-right">{order.customerPhone}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd className="text-right">{formatDateTime(order.createdAt)}</dd>
            <dt className="text-slate-500">Réseau</dt>
            <dd className="text-right">{order.paymentNetwork ?? "—"}</dd>
            <dt className="text-slate-500">Payé depuis</dt>
            <dd className="text-right">{order.paymentPhone ?? "—"}</dd>
            <dt className="text-slate-500">Référence</dt>
            <dd className="text-right font-medium">{order.paymentRef ?? "—"}</dd>
          </dl>
        </div>

        {/* Bets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Paris</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {order.bets.map((bet) => {
              const isGraded = bet.result !== "PENDING";
              const won = bet.result === "WON";
              return (
                <li key={bet.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {bet.offer.betType.name}{" "}
                        <span className="text-slate-400">
                          &middot; {bet.course.hippodrome} C{bet.course.number}
                        </span>
                        {isGraded && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                              won
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {won ? "GAGNÉ" : "PERDU"}
                          </span>
                        )}
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
                  </div>
                  {/* Payout entry for won bets */}
                  {won && (
                    <PayoutInput betId={bet.id} currentPayout={bet.payout} />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-emerald-700">
              {formatFCFA(order.total)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="font-semibold text-slate-900">Actions</h2>

          {order.status === "PENDING_PAYMENT" && (
            <form action={verifyPayment.bind(null, order.id)}>
              <button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700">
                Confirmer le paiement reçu
              </button>
            </form>
          )}

          {order.status === "PAID" && (
            <TicketUpload
              orderId={order.id}
              cta="Marquer placé + envoyer le ticket"
              expectedCount={order.bets.length}
            />
          )}

          {order.status === "PLACED" && (
            <TicketUpload
              orderId={order.id}
              cta="Envoyer d'autres photos"
              expectedCount={order.bets.length}
            />
          )}

          {canCancel && (
            <form action={cancelOrder.bind(null, order.id)}>
              <button className="w-full rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                Annuler la commande
              </button>
            </form>
          )}
        </div>

        {/* Ticket photos */}
        {order.ticketPhotos.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Tickets envoyés</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {order.ticketPhotos.map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={p.id}
                  src={p.url}
                  alt="Ticket"
                  className="rounded-lg border border-slate-200"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

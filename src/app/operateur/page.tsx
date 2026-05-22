import Link from "next/link";
import { redirect } from "next/navigation";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOperator } from "@/lib/auth";
import { logoutAction, verifyPayment } from "@/lib/actions";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatFCFA,
  formatDateTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

const FILTERS: { key: string; label: string; count?: boolean }[] = [
  { key: "ALL", label: "Toutes" },
  { key: "PENDING_PAYMENT", label: "A vérifier", count: true },
  { key: "PAID", label: "Payées" },
  { key: "PLACED", label: "Placées" },
  { key: "SETTLED", label: "Terminées" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const operator = await getOperator();
  if (!operator) redirect("/operateur/login");

  const { status } = await searchParams;
  const active = status && status !== "ALL" ? (status as OrderStatus) : null;
  const where: Prisma.OrderWhereInput = active ? { status: active } : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bets: true } } },
    take: 100,
  });

  const pendingCount = await prisma.order.count({
    where: { status: "PENDING_PAYMENT" },
  });

  // Sales stats (all non-cancelled orders)
  const allOrders = await prisma.order.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { total: true, status: true },
  });
  const totalSales = allOrders.reduce((sum, o) => sum + o.total, 0);
  const paidOrders = allOrders.filter(
    (o) => o.status !== "PENDING_PAYMENT"
  );
  const confirmedSales = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const placedCount = allOrders.filter((o) => o.status === "PLACED").length;

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-bold text-slate-900">{businessName}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 capitalize">{operator}</span>
            <form action={logoutAction}>
              <button className="text-sm text-slate-400 hover:text-slate-700">
                Quitter
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto px-4 py-5 space-y-4">

        {/* ── Urgent alert: pending payments ──────────────────────── */}
        {pendingCount > 0 && (
          <Link
            href="/operateur?status=PENDING_PAYMENT"
            className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 transition hover:bg-amber-100"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-sm font-bold">
                {pendingCount}
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Paiements en attente
                </p>
                <p className="text-xs text-amber-700">
                  A vérifier avant de placer
                </p>
              </div>
            </div>
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ── Stats row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Confirmé
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {formatFCFA(confirmedSales)}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Déclaré
            </p>
            <p className="mt-1 text-xl font-bold text-slate-700">
              {formatFCFA(totalSales)}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              A placer
            </p>
            <p className="mt-1 text-xl font-bold text-blue-600">
              {placedCount > 0 ? placedCount : allOrders.filter((o) => o.status === "PAID").length}
            </p>
          </div>
        </div>

        {/* ── Quick actions (secondary, not primary) ─────────────── */}
        <div className="flex gap-2">
          <Link
            href="/operateur/importer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle course
          </Link>
          <a
            href="/operateur/feuille"
            target="_blank"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Feuille PDF
          </a>
          <Link
            href="/operateur/resultats"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Résultats
          </Link>
        </div>

        {/* ── Filter tabs ────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-lg bg-white border border-slate-200 p-1">
          {FILTERS.map((f) => {
            const isActive =
              (active ?? "ALL") === f.key ||
              (!active && f.key === "ALL");
            return (
              <Link
                key={f.key}
                href={`/operateur?status=${f.key}`}
                className={`flex-1 rounded-md px-2 py-1.5 text-center text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {f.label}
                {f.count && pendingCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Orders list ────────────────────────────────────────── */}
        <div className="space-y-2">
          {orders.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-400">Aucune commande.</p>
            </div>
          )}

          {orders.map((order) => {
            const isPending = order.status === "PENDING_PAYMENT";
            return (
              <div
                key={order.id}
                className={`rounded-xl border bg-white transition hover:shadow-sm ${
                  isPending
                    ? "border-amber-200 border-l-4 border-l-amber-400"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3 p-4">
                  <Link
                    href={`/operateur/commande/${order.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold tracking-wider text-slate-900">
                        {order.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_COLOR[order.status]}`}
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {order.customerName}
                      <span className="mx-1.5 text-slate-300">|</span>
                      <span className="text-slate-400">{order.customerPhone}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {order._count.bets} pari(s) &middot; {formatDateTime(order.createdAt)}
                    </p>
                  </Link>

                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-slate-900">
                      {formatFCFA(order.total)}
                    </p>
                    {isPending && (
                      <form action={verifyPayment.bind(null, order.id)}>
                        <button className="mt-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition">
                          Valider
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

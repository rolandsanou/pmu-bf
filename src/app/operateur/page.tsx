import Link from "next/link";
import { redirect } from "next/navigation";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isOperatorAuthed } from "@/lib/auth";
import { logoutAction, verifyPayment } from "@/lib/actions";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  formatFCFA,
  formatDateTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

const FILTERS: { key: string; label: string }[] = [
  { key: "ALL", label: "Toutes" },
  { key: "PENDING_PAYMENT", label: "À vérifier" },
  { key: "PAID", label: "Payées" },
  { key: "PLACED", label: "Placées" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isOperatorAuthed())) redirect("/operateur/login");

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

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="font-bold text-slate-900">
            🏇 {businessName} — Gérante
          </span>
          <form action={logoutAction}>
            <button className="text-sm text-slate-500 hover:text-slate-800">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Commandes</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              {pendingCount} à vérifier
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = (active ?? "ALL") === f.key;
            return (
              <Link
                key={f.key}
                href={`/operateur?status=${f.key}`}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          {orders.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Aucune commande.
            </p>
          )}
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/operateur/commande/${order.id}`}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-wide">{order.code}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLOR[order.status]}`}
                    >
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {order.customerName} · {order.customerPhone}
                  </p>
                  <p className="text-xs text-slate-400">
                    {order._count.bets} pari(s) · {formatDateTime(order.createdAt)}
                  </p>
                </Link>
                <div className="text-right">
                  <p className="font-semibold">{formatFCFA(order.total)}</p>
                  {order.status === "PENDING_PAYMENT" && (
                    <form action={verifyPayment.bind(null, order.id)}>
                      <button className="mt-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                        Valider paiement
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

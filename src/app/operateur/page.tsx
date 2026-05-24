import Link from "next/link";
import { redirect } from "next/navigation";
import type { OrderStatus, CourseStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getOperator } from "@/lib/auth";
import { logoutAction, verifyPayment } from "@/lib/actions";
import { encryptId, decryptId } from "@/lib/id-cipher";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  DISCIPLINE_LABEL,
  formatFCFA,
  formatDateTime,
  formatCourseLabel,
} from "@/lib/format";
import { getSiteSettings } from "@/lib/actions";
import BettingToggle from "./BettingToggle";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  OPEN: "En cours",
  CLOSED: "Fermée",
  SETTLED: "Terminée",
};

const COURSE_STATUS_COLOR: Record<CourseStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-amber-100 text-amber-800",
  SETTLED: "bg-violet-100 text-violet-800",
};

const FILTERS: { key: string; label: string; count?: boolean }[] = [
  { key: "ALL", label: "Toutes" },
  { key: "PENDING_PAYMENT", label: "A vérifier", count: true },
  { key: "PAID", label: "Payées" },
  { key: "PLACED", label: "Placées" },
  { key: "SETTLED", label: "Terminées" },
];

function formatDateShort(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; course?: string }>;
}) {
  const operator = await getOperator();
  if (!operator) redirect("/operateur/login");

  const siteSettings = await getSiteSettings();
  const { status, course: courseToken } = await searchParams;

  // ── Fetch all courses (most recent first) ──────────────────────
  const courses = await prisma.course.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { bets: true } },
      offers: { select: { id: true } },
    },
    take: 20,
  });

  // Decrypt course ID from URL token
  const decryptedCourseId = courseToken ? decryptId(courseToken) : null;
  const activeCourseId = decryptedCourseId || (courses.length > 0 ? courses[0].id : null);
  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0] ?? null;

  // ── Orders query: filter by course if a course is selected ─────
  const active = status && status !== "ALL" ? (status as OrderStatus) : null;
  const orderWhere: Prisma.OrderWhereInput = {
    ...(active ? { status: active } : {}),
    ...(activeCourseId ? { bets: { some: { courseId: activeCourseId } } } : {}),
  };

  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bets: true } } },
    take: 100,
  });

  const pendingCount = await prisma.order.count({
    where: {
      status: "PENDING_PAYMENT",
      ...(activeCourseId ? { bets: { some: { courseId: activeCourseId } } } : {}),
    },
  });

  // Sales stats scoped to active course
  const statsWhere: Prisma.OrderWhereInput = {
    status: { not: "CANCELLED" },
    ...(activeCourseId ? { bets: { some: { courseId: activeCourseId } } } : {}),
  };
  const allOrders = await prisma.order.findMany({
    where: statsWhere,
    select: { total: true, subtotal: true, transactionFee: true, platformFee: true, status: true },
  });
  const totalSales = allOrders.reduce((sum, o) => sum + o.total, 0);
  const totalTransactionFees = allOrders.reduce((sum, o) => sum + o.transactionFee, 0);
  const totalPlatformFees = allOrders.reduce((sum, o) => sum + o.platformFee, 0);
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

        {/* ── Course selector ────────────────────────────────────── */}
        {courses.length > 0 && (
          <div className="space-y-3">
            {/* Course tabs - horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {courses.map((c) => {
                const isActive = c.id === activeCourseId;
                return (
                  <Link
                    key={c.id}
                    href={`/operateur?course=${encryptId(c.id)}${status ? `&status=${status}` : ""}`}
                    className={`shrink-0 rounded-xl border px-4 py-3 transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isActive ? "text-white" : "text-slate-900"}`}>
                        {c.hippodrome} C{c.number}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isActive
                            ? c.status === "OPEN"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : c.status === "CLOSED"
                              ? "bg-amber-500/20 text-amber-200"
                              : "bg-violet-500/20 text-violet-200"
                            : COURSE_STATUS_COLOR[c.status]
                        }`}
                      >
                        {COURSE_STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 capitalize ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                      {formatDateShort(c.date)}
                    </p>
                  </Link>
                );
              })}
            </div>

            {/* Active course detail card */}
            {activeCourse && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-900">
                        {activeCourse.hippodrome} — Course {activeCourse.number}
                      </h2>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COURSE_STATUS_COLOR[activeCourse.status]}`}>
                        {COURSE_STATUS_LABEL[activeCourse.status]}
                      </span>
                    </div>
                    {activeCourse.prizeName && (
                      <p className="text-sm text-slate-500 mt-0.5">{activeCourse.prizeName}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{DISCIPLINE_LABEL[activeCourse.discipline]}</span>
                      <span>{activeCourse.distanceMeters} m</span>
                      <span>{activeCourse.runnerCount} partants</span>
                      <span>{activeCourse._count.bets} pari(s)</span>
                    </div>
                  </div>
                  {activeCourse.status === "SETTLED" && activeCourse.finishers.length > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide">Arrivée</p>
                      <p className="text-sm font-mono font-bold text-violet-700 mt-0.5">
                        {activeCourse.finishers.join(" - ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick actions for this course */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  {activeCourse.status !== "SETTLED" && (
                    <Link
                      href={`/operateur/resultats/${encryptId(activeCourse.id)}`}
                      className="text-xs font-medium text-violet-600 hover:text-violet-800 transition"
                    >
                      Saisir résultats
                    </Link>
                  )}
                  {activeCourse.status === "SETTLED" && (
                    <Link
                      href={`/operateur/resultats/${encryptId(activeCourse.id)}`}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 transition"
                    >
                      Voir résultats
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Urgent alert: pending payments ──────────────────────── */}
        {pendingCount > 0 && (
          <Link
            href={`/operateur?status=PENDING_PAYMENT${activeCourseId ? `&course=${encryptId(activeCourseId)}` : ""}`}
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

        {/* ── Fee breakdown ─────────────────────────────────────── */}
        {(totalTransactionFees > 0 || totalPlatformFees > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Frais transaction
              </p>
              <p className="mt-1 text-lg font-bold text-orange-600">
                {formatFCFA(totalTransactionFees)}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Frais plateforme
              </p>
              <p className="mt-1 text-lg font-bold text-orange-600">
                {formatFCFA(totalPlatformFees)}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-orange-200 px-4 py-3">
              <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">
                Total frais
              </p>
              <p className="mt-1 text-lg font-bold text-orange-700">
                {formatFCFA(totalTransactionFees + totalPlatformFees)}
              </p>
            </div>
          </div>
        )}

        {/* ── Betting toggle ────────────────────────────────────── */}
        <BettingToggle
          closed={siteSettings.bettingClosed}
          currentMessage={siteSettings.closedMessage}
        />

        {/* ── Quick actions (secondary, not primary) ─────────────── */}
        <div className="flex gap-2 flex-wrap">
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
            const courseParam = activeCourseId ? `&course=${encryptId(activeCourseId)}` : "";
            return (
              <Link
                key={f.key}
                href={`/operateur?status=${f.key}${courseParam}`}
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
                    href={`/operateur/commande/${encryptId(order.id)}`}
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
                      <form action={verifyPayment.bind(null, encryptId(order.id))}>
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

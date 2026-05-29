import Link from "next/link";
import { prisma } from "@/lib/db";
import { DISCIPLINE_LABEL, formatDistance, formatTime } from "@/lib/format";
import { getNextRaceDay, RACE_DAY_NAMES } from "@/lib/race-days";
import { encryptId } from "@/lib/id-cipher";
import { getSiteSettings } from "@/lib/actions";
import BetBuilder, { type ClientCourse } from "./BetBuilder";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export default async function JouerPage() {
  const now = new Date();

  // Check global betting pause
  const settings = await getSiteSettings();
  if (settings.bettingClosed) {
    return (
      <main className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="font-bold text-slate-900">🏇 {businessName}</span>
            <Link href="/suivi" className="text-sm text-emerald-700 font-medium">
              Suivre une commande
            </Link>
          </div>
        </header>
        <div className="max-w-2xl w-full mx-auto px-4 py-12 text-center">
          <p className="text-5xl">⏸️</p>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Paris suspendus
          </h1>
          {settings.closedMessage && (
            <p className="mt-3 text-base text-slate-600 whitespace-pre-line">
              {settings.closedMessage}
            </p>
          )}
          <Link
            href="/suivi"
            className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Suivre une commande existante
          </Link>
        </div>
      </main>
    );
  }

  // Fetch all OPEN courses whose cutoff hasn't passed yet (includes future race days)
  const courses = await prisma.course.findMany({
    where: { status: "OPEN", cutoffTime: { gt: now } },
    orderBy: { startTime: "asc" },
    include: {
      runners: { orderBy: { number: "asc" } },
      offers: { where: { active: true }, include: { betType: true } },
    },
  });

  // No open courses → show "Pas de course" with next race day info
  if (courses.length === 0) {
    const next = getNextRaceDay(now);
    const dayName = RACE_DAY_NAMES[next.getUTCDay()];
    const formatted = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(next);

    return (
      <main className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="font-bold text-slate-900">🏇 {businessName}</span>
            <Link href="/suivi" className="text-sm text-emerald-700 font-medium">
              Suivre une commande
            </Link>
          </div>
        </header>
        <div className="max-w-2xl w-full mx-auto px-4 py-12 text-center">
          <p className="text-5xl">📅</p>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Pas de course pour le moment
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Les paris sont disponibles le <strong>vendredi</strong> et le{" "}
            <strong>dimanche</strong>.
          </p>
          <p className="mt-4 text-base font-medium text-emerald-700">
            Prochaine course : {dayName} {formatted}
          </p>
          <Link
            href="/suivi"
            className="mt-6 inline-block rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Suivre une commande existante
          </Link>
        </div>
      </main>
    );
  }

  // Build client-side course data (may include preview courses)
  const clientCourses: ClientCourse[] = courses.map((c) => ({
    id: c.id,
    hippodrome: c.hippodrome,
    number: c.number,
    prizeName: c.prizeName,
    subtitle: `${DISCIPLINE_LABEL[c.discipline]} · ${formatDistance(
      c.distanceMeters
    )} · ${c.runnerCount} partants`,
    startLabel: c.bettingOpensAt
      ? `${formatTime(c.bettingOpensAt)} → ${formatTime(c.cutoffTime)} GMT`
      : `${formatTime(c.cutoffTime)} GMT`,
    cutoffISO: c.cutoffTime.toISOString(),
    bettingOpensISO: c.bettingOpensAt?.toISOString() ?? null,
    runnerCount: c.runnerCount,
    runners: c.runners.map((r) => ({
      number: r.number,
      name: r.name,
      odds: r.odds,
    })),
    formules: c.offers
      .map((o) => ({
        offerId: encryptId(o.id),
        horsesToSelect: o.betType.horsesToSelect,
        price: o.price,
        hint: o.betType.description,
      }))
      .sort((a, b) => a.horsesToSelect - b.horsesToSelect),
  }));

  return (
    <main className="flex-1 flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-bold text-slate-900">🏇 {businessName}</span>
          <Link href="/suivi" className="text-sm text-emerald-700 font-medium">
            Suivre une commande
          </Link>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6">
        <BetBuilder courses={clientCourses} />
      </div>
    </main>
  );
}

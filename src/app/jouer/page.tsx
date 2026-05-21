import Link from "next/link";
import { prisma } from "@/lib/db";
import { DISCIPLINE_LABEL, formatDistance, formatTime } from "@/lib/format";
import BetBuilder, { type ClientCourse } from "./BetBuilder";

export const dynamic = "force-dynamic";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export default async function JouerPage() {
  const now = new Date();
  const courses = await prisma.course.findMany({
    where: { status: "OPEN", cutoffTime: { gt: now } },
    orderBy: { startTime: "asc" },
    include: {
      runners: { orderBy: { number: "asc" } },
      offers: { where: { active: true }, include: { betType: true } },
    },
  });

  const clientCourses: ClientCourse[] = courses.map((c) => ({
    id: c.id,
    hippodrome: c.hippodrome,
    number: c.number,
    prizeName: c.prizeName,
    subtitle: `${DISCIPLINE_LABEL[c.discipline]} · ${formatDistance(
      c.distanceMeters
    )} · ${c.runnerCount} partants`,
    startLabel: formatTime(c.startTime),
    cutoffISO: c.cutoffTime.toISOString(),
    runnerCount: c.runnerCount,
    runners: c.runners.map((r) => ({
      number: r.number,
      name: r.name,
      odds: r.odds,
    })),
    formules: c.offers
      .map((o) => ({
        offerId: o.id,
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
        {clientCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Aucune course ouverte pour le moment. Revenez plus tard.
          </div>
        ) : (
          <BetBuilder courses={clientCourses} />
        )}
      </div>
    </main>
  );
}

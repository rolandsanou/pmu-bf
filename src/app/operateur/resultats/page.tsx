import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isOperatorAuthed } from "@/lib/auth";
import { formatDateTime, DISCIPLINE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ResultatsPage() {
  if (!(await isOperatorAuthed())) redirect("/operateur/login");

  // Show courses whose cutoff has passed (ready for results) — both unsettled and settled.
  const now = new Date();
  const courses = await prisma.course.findMany({
    where: { cutoffTime: { lte: now } },
    orderBy: { date: "desc" },
    include: { _count: { select: { bets: true } } },
    take: 30,
  });

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/operateur" className="text-sm text-slate-500">
            &larr; Commandes
          </Link>
          <h1 className="font-bold text-slate-900">Résultats</h1>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6 space-y-3">
        {courses.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            Aucune course terminée.
          </p>
        )}

        {courses.map((c) => {
          const settled = c.status === "SETTLED";
          return (
            <Link
              key={c.id}
              href={`/operateur/resultats/${c.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {c.prizeName ?? `${c.hippodrome} C${c.number}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.hippodrome} C{c.number} &middot;{" "}
                    {DISCIPLINE_LABEL[c.discipline]} &middot;{" "}
                    {formatDateTime(c.date)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c._count.bets} pari(s)
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    settled
                      ? "bg-violet-100 text-violet-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {settled ? "Résultat saisi" : "En attente"}
                </span>
              </div>
              {settled && c.finishers.length > 0 && (
                <p className="mt-2 text-sm text-slate-600">
                  Arrivée : {c.finishers.join(" - ")}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}

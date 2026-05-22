import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isOperatorAuthed } from "@/lib/auth";
import { formatDateTime, DISCIPLINE_LABEL, formatDistance } from "@/lib/format";
import ResultForm from "./ResultForm";

export const dynamic = "force-dynamic";

export default async function ResultEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isOperatorAuthed())) redirect("/operateur/login");
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      runners: { orderBy: { number: "asc" } },
      _count: { select: { bets: true } },
    },
  });
  if (!course) notFound();

  const settled = course.status === "SETTLED";

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/operateur/resultats" className="text-sm text-slate-500">
            &larr; Résultats
          </Link>
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
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Course info */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h1 className="text-lg font-bold text-slate-900">
            {course.prizeName ?? `${course.hippodrome} C${course.number}`}
          </h1>
          <p className="text-xs text-slate-500">
            {course.hippodrome} C{course.number} &middot;{" "}
            {DISCIPLINE_LABEL[course.discipline]} &middot;{" "}
            {formatDistance(course.distanceMeters)} &middot;{" "}
            {course.runnerCount} partants
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {formatDateTime(course.date)} &middot; {course._count.bets} pari(s)
          </p>
        </div>

        {/* Result form */}
        <ResultForm
          courseId={course.id}
          runners={course.runners.map((r) => ({
            number: r.number,
            name: r.name,
          }))}
          existingFinishers={course.finishers}
          settled={settled}
        />
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOperator } from "@/lib/auth";
import { decryptId, encryptId } from "@/lib/id-cipher";
import { DISCIPLINE_LABEL, formatFCFA } from "@/lib/format";
import EditCourseForm from "./EditCourseForm";

export const dynamic = "force-dynamic";

/** Format a Date to "YYYY-MM-DDThh:mm" for datetime-local inputs (in UTC) */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await getOperator();
  if (!operator) redirect("/operateur/login");

  const { id: token } = await params;
  const courseId = decryptId(token) ?? token;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      runners: { orderBy: { number: "asc" } },
      offers: { include: { betType: true } },
    },
  });

  if (!course) notFound();

  const prices: Record<string, number> = {};
  for (const o of course.offers) {
    prices[o.betType.code] = o.price;
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/operateur"
            className="text-sm text-slate-400 hover:text-slate-700"
          >
            &larr; Retour
          </Link>
          <h1 className="font-bold text-slate-900">
            Modifier — {course.hippodrome} C{course.number}
          </h1>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-5">
        {/* Course info */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4">
          <p className="text-sm text-slate-500">
            {course.prizeName && <span className="font-medium text-slate-700">{course.prizeName} — </span>}
            {DISCIPLINE_LABEL[course.discipline]} · {course.distanceMeters} m · {course.runnerCount} partants
          </p>
        </div>

        <EditCourseForm
          courseId={course.id}
          bettingOpens={course.bettingOpensAt ? toLocalInput(course.bettingOpensAt) : ""}
          bettingCloses={toLocalInput(course.cutoffTime)}
          prices={prices}
          hippodrome={course.hippodrome}
          courseNumber={course.number}
          prizeName={course.prizeName ?? ""}
        />
      </div>
    </main>
  );
}

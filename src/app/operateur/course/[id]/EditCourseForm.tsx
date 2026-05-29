"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCourse } from "@/lib/actions";
import { formatFCFA } from "@/lib/format";

const FORMULES = [
  { code: "R41_5", horses: 5, label: "5 chevaux" },
  { code: "R41_6", horses: 6, label: "6 chevaux" },
  { code: "R41_7", horses: 7, label: "7 chevaux" },
  { code: "R41_8", horses: 8, label: "8 chevaux" },
];

export default function EditCourseForm({
  courseId,
  bettingOpens,
  bettingCloses,
  prices: initialPrices,
  hippodrome: initHippodrome,
  courseNumber: initNumber,
  prizeName: initPrize,
}: {
  courseId: string;
  bettingOpens: string;
  bettingCloses: string;
  prices: Record<string, number>;
  hippodrome: string;
  courseNumber: number;
  prizeName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [opens, setOpens] = useState(bettingOpens);
  const [closes, setCloses] = useState(bettingCloses);
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);
  const [hippodrome, setHippodrome] = useState(initHippodrome);
  const [courseNumber, setCourseNumber] = useState(initNumber);
  const [prizeName, setPrizeName] = useState(initPrize);

  function save() {
    setError(null);
    setSuccess(false);

    if (!opens || !closes) {
      setError("Les horaires d'ouverture et de fermeture sont requis.");
      return;
    }

    const opensISO = opens.endsWith("Z") ? opens : opens + "Z";
    const closesISO = closes.endsWith("Z") ? closes : closes + "Z";

    startTransition(async () => {
      try {
        const res = await updateCourse({
          courseId,
          hippodrome: hippodrome.trim(),
          number: courseNumber,
          prizeName: prizeName.trim(),
          bettingOpensAt: new Date(opensISO).toISOString(),
          bettingClosesAt: new Date(closesISO).toISOString(),
          prices,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSuccess(true);
        setTimeout(() => router.push("/operateur"), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur serveur.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Course info edit */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Informations</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Hippodrome
            </label>
            <input
              type="text"
              value={hippodrome}
              onChange={(e) => setHippodrome(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              N° course
            </label>
            <input
              type="number"
              value={courseNumber}
              onChange={(e) => setCourseNumber(parseInt(e.target.value) || 1)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Nom du prix
            </label>
            <input
              type="text"
              value={prizeName}
              onChange={(e) => setPrizeName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Betting window */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Horaires des paris (GMT)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Ouverture
            </label>
            <input
              type="datetime-local"
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Fermeture
            </label>
            <input
              type="datetime-local"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Prices */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Prix par formule
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {FORMULES.map((f) => (
            <div key={f.code}>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {f.label}
              </label>
              <input
                type="number"
                value={prices[f.code] || ""}
                onChange={(e) =>
                  setPrices((p) => ({
                    ...p,
                    [f.code]: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder={`${formatFCFA(prices[f.code] || 0)}`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Error / success */}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
          Modifications enregistrées !
        </div>
      )}

      {/* Submit */}
      <button
        onClick={save}
        disabled={pending}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
      >
        {pending ? "Enregistrement..." : "Enregistrer les modifications"}
      </button>
    </div>
  );
}

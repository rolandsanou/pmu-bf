"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleResults } from "@/lib/actions";

type Runner = { number: number; name: string };

export default function ResultForm({
  courseId,
  runners,
  existingFinishers,
  settled,
}: {
  courseId: string;
  runners: Runner[];
  existingFinishers: number[];
  settled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 5 slots for 1st–5th finisher.
  const [picks, setPicks] = useState<(number | null)[]>(
    settled && existingFinishers.length === 5
      ? existingFinishers
      : [null, null, null, null, null]
  );

  const labels = ["1er", "2ème", "3ème", "4ème", "5ème"];

  function setPick(index: number, value: number | null) {
    setPicks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  // Runners already picked in another slot (prevent duplicates).
  function isUsed(num: number, exceptIndex: number): boolean {
    return picks.some((p, i) => i !== exceptIndex && p === num);
  }

  function submit() {
    setError(null);
    const finishers = picks.filter((p): p is number => p !== null);
    if (finishers.length !== 5) {
      setError("Sélectionnez les 5 arrivants.");
      return;
    }

    startTransition(async () => {
      const res = await settleResults(courseId, finishers);
      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(res.error ?? "Erreur inconnue.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">
        {settled ? "Arrivée officielle" : "Saisir l'arrivée"}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Sélectionnez les 5 premiers chevaux dans l&apos;ordre d&apos;arrivée.
      </p>

      <div className="mt-4 space-y-3">
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-12 text-right text-sm font-bold text-slate-600">
              {label}
            </span>
            <select
              value={picks[i] ?? ""}
              onChange={(e) =>
                setPick(i, e.target.value ? Number(e.target.value) : null)
              }
              disabled={settled}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-600"
            >
              <option value="">— Choisir —</option>
              {runners.map((r) => (
                <option
                  key={r.number}
                  value={r.number}
                  disabled={isUsed(r.number, i)}
                >
                  {r.number} — {r.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
          Résultats enregistrés. Tous les paris ont été notés.
        </p>
      )}

      {!settled && (
        <button
          onClick={submit}
          disabled={pending || picks.some((p) => p === null)}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {pending ? "Enregistrement…" : "Enregistrer les résultats"}
        </button>
      )}
    </div>
  );
}

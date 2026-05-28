"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseJournal, importCourse } from "@/lib/actions";
import { formatFCFA } from "@/lib/format";
import type { ParsedCourse } from "@/lib/journal-parser";

type Runner = ParsedCourse["runners"][number];

/** Default price = C(n,5) × 300 */
function defaultPrice(n: number): number {
  const f = (x: number) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; };
  return (f(n) / (f(5) * f(n - 5))) * 300;
}

/** Format a Date to "YYYY-MM-DDThh:mm" for datetime-local inputs (in UTC) */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const FORMULES = [
  { code: "R41_5", horses: 5, label: "5 chevaux" },
  { code: "R41_6", horses: 6, label: "6 chevaux" },
  { code: "R41_7", horses: 7, label: "7 chevaux" },
  { code: "R41_8", horses: 8, label: "8 chevaux" },
];

export default function ImportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");

  // Parsed + editable data
  const [hippodrome, setHippodrome] = useState("");
  const [courseNumber, setCourseNumber] = useState(1);
  const [prizeName, setPrizeName] = useState("");
  const [discipline, setDiscipline] = useState<"ATTELE" | "MONTE" | "PLAT">(
    "ATTELE"
  );
  const [distance, setDistance] = useState(2000);
  const [prizeMoney, setPrizeMoney] = useState(0);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  // Betting window (operator sets manually, in GMT/UTC)
  const [bettingOpens, setBettingOpens] = useState("");
  const [bettingCloses, setBettingCloses] = useState("");

  // Prices per formule (0 = use default)
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Pre-fill reasonable defaults for opens/closes on mount
  useEffect(() => {
    if (!bettingOpens) {
      // Default: tomorrow at 07:00 GMT
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(7, 0, 0, 0);
      setBettingOpens(toLocalInput(d));
    }
    if (!bettingCloses) {
      // Default: tomorrow at 13:00 GMT
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(13, 0, 0, 0);
      setBettingCloses(toLocalInput(d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await parseJournal(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const c = res.course;
      setHippodrome(c.hippodrome);
      setCourseNumber(c.number);
      setPrizeName(c.prizeName);
      setDiscipline(c.discipline);
      setDistance(c.distanceMeters);
      setPrizeMoney(c.prizeMoney);
      setRunners(c.runners);
      setRawText(c.rawText);
      setStep("review");
    });
  }

  function updateRunner(idx: number, field: keyof Runner, value: string) {
    setRunners((prev) => {
      const next = [...prev];
      const r = { ...next[idx] };
      if (field === "number" || field === "gains") {
        (r as Record<string, unknown>)[field] = parseInt(value, 10) || 0;
      } else {
        (r as Record<string, unknown>)[field] = value;
      }
      next[idx] = r;
      return next;
    });
  }

  function removeRunner(idx: number) {
    setRunners((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRunner() {
    const maxNum = runners.reduce((m, r) => Math.max(m, r.number), 0);
    setRunners((prev) => [
      ...prev,
      {
        number: maxNum + 1,
        name: "",
        driver: "",
        trainer: "",
        owner: "",
        sexAge: "",
        chrono: "",
        recentForm: "",
        gains: 0,
        odds: "",
      },
    ]);
  }

  function save() {
    setError(null);
    if (!hippodrome.trim()) {
      setError("L'hippodrome est requis.");
      return;
    }
    if (runners.length === 0) {
      setError("Ajoutez au moins un cheval.");
      return;
    }
    if (!bettingOpens || !bettingCloses) {
      setError("Les horaires d'ouverture et de fermeture des paris sont requis.");
      return;
    }

    // datetime-local gives "YYYY-MM-DDThh:mm" or "YYYY-MM-DDThh:mm:ss"
    // Append "Z" to treat as UTC (GMT)
    const opensISO = bettingOpens.endsWith("Z") ? bettingOpens : bettingOpens + "Z";
    const closesISO = bettingCloses.endsWith("Z") ? bettingCloses : bettingCloses + "Z";

    startTransition(async () => {
      try {
        const res = await importCourse({
          hippodrome,
          number: courseNumber,
          prizeName,
          discipline,
          distanceMeters: distance,
          prizeMoney,
          bettingOpensAt: new Date(opensISO).toISOString(),
          bettingClosesAt: new Date(closesISO).toISOString(),
          prices,
          runners,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setStep("done");
        setTimeout(() => router.push("/operateur"), 2000);
      } catch {
        setError("Erreur serveur. Vérifiez les horaires et réessayez.");
      }
    });
  }

  // ── Upload step ──────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">
            Importer le journal PMU&apos;B (PDF)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Uploadez le fichier PDF du journal hippique. Le système va extraire
            les informations de la course et des chevaux automatiquement.
          </p>

          <form onSubmit={handleUpload} className="mt-4 space-y-3">
            <input
              type="file"
              name="pdf"
              accept=".pdf"
              required
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Analyse en cours…" : "Analyser le PDF"}
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
          <p className="text-sm text-slate-500">
            Vous pouvez aussi{" "}
            <button
              onClick={() => {
                setRunners([]);
                setStep("review");
              }}
              className="font-semibold text-emerald-700 underline"
            >
              saisir manuellement
            </button>{" "}
            sans PDF.
          </p>
        </div>
      </div>
    );
  }

  // ── Done step ────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="mt-2 text-lg font-bold text-emerald-800">
          Course créée avec succès !
        </h2>
        <p className="mt-1 text-sm text-emerald-600">
          La course est maintenant visible sur le site. Redirection…
        </p>
      </div>
    );
  }

  // ── Review + edit step ───────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Course metadata */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Détails de la course</h2>
        <p className="text-xs text-slate-500 mb-3">
          Vérifiez et corrigez les informations si nécessaire.
        </p>

        <div className="grid gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Hippodrome</span>
            <input
              value={hippodrome}
              onChange={(e) => setHippodrome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-slate-600">N° course</span>
              <input
                type="number"
                min={1}
                value={courseNumber}
                onChange={(e) => setCourseNumber(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Discipline</span>
              <select
                value={discipline}
                onChange={(e) =>
                  setDiscipline(e.target.value as typeof discipline)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="ATTELE">Attelé</option>
                <option value="MONTE">Monté</option>
                <option value="PLAT">Plat</option>
              </select>
            </label>
          </div>

          <label className="text-sm">
            <span className="text-slate-600">Nom du prix</span>
            <input
              value={prizeName}
              onChange={(e) => setPrizeName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Ex: Prix Sirrah"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-slate-600">Distance (m)</span>
              <input
                type="number"
                min={800}
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value) || 2000)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Dotation (FCFA)</span>
              <input
                type="number"
                min={0}
                value={prizeMoney}
                onChange={(e) => setPrizeMoney(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Betting window */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h2 className="font-semibold text-blue-900">Horaires des paris (GMT)</h2>
        <p className="text-xs text-blue-600 mb-3">
          Définissez quand les clients peuvent parier sur cette course.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-blue-700 font-medium">Ouverture</span>
            <input
              type="datetime-local"
              value={bettingOpens}
              onChange={(e) => setBettingOpens(e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-blue-700 font-medium">Fermeture</span>
            <input
              type="datetime-local"
              value={bettingCloses}
              onChange={(e) => setBettingCloses(e.target.value)}
              className="mt-1 w-full rounded-lg border border-blue-300 px-3 py-2"
            />
          </label>
        </div>
      </div>

      {/* Prices per formule */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-semibold text-amber-900">Tarifs des formules</h2>
        <p className="text-xs text-amber-600 mb-3">
          Laissez vide ou à 0 pour garder le prix par défaut.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FORMULES.map((f) => {
            const def = defaultPrice(f.horses);
            return (
              <label key={f.code} className="text-sm">
                <span className="text-amber-800 font-medium">{f.label}</span>
                <span className="ml-1 text-xs text-amber-500">
                  (défaut : {formatFCFA(def)})
                </span>
                <input
                  type="number"
                  min={0}
                  value={prices[f.code] || ""}
                  onChange={(e) =>
                    setPrices((p) => ({
                      ...p,
                      [f.code]: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder={String(def)}
                  className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Runners table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            Partants ({runners.length})
          </h2>
          <button
            onClick={addRunner}
            className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            + Ajouter
          </button>
        </div>

        <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {runners.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-sm font-bold">
                  {r.number}
                </span>
                <button
                  onClick={() => removeRunner(i)}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Retirer
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs col-span-2">
                  <span className="text-slate-500">N°</span>
                  <input
                    type="number"
                    min={1}
                    value={r.number}
                    onChange={(e) => updateRunner(i, "number", e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs col-span-2">
                  <span className="text-slate-500">Nom du cheval</span>
                  <input
                    value={r.name}
                    onChange={(e) => updateRunner(i, "name", e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm font-medium"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">Driver</span>
                  <input
                    value={r.driver}
                    onChange={(e) => updateRunner(i, "driver", e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">Entraîneur</span>
                  <input
                    value={r.trainer}
                    onChange={(e) => updateRunner(i, "trainer", e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">Cotes</span>
                  <input
                    value={r.odds}
                    onChange={(e) => updateRunner(i, "odds", e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Ex: 24/1"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">Sexe/Âge</span>
                  <input
                    value={r.sexAge}
                    onChange={(e) => updateRunner(i, "sexAge", e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Ex: H.8"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw text toggle (debug) */}
      {rawText && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-slate-500 underline"
          >
            {showRaw ? "Masquer le texte brut" : "Voir le texte brut du PDF"}
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-wrap">
              {rawText}
            </pre>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Création en cours…" : "Créer la course"}
      </button>
    </div>
  );
}

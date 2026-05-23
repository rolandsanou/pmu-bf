"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "@/lib/actions";
import { formatFCFA } from "@/lib/format";
import type { NewOrderInput } from "@/lib/order-types";

export type ClientFormule = {
  offerId: string;
  horsesToSelect: number;
  price: number;
  hint: string | null;
};

export type ClientRunner = {
  number: number;
  name: string;
  odds: string | null;
};

export type ClientCourse = {
  id: string;
  hippodrome: string;
  number: number;
  prizeName: string | null;
  subtitle: string;
  startLabel: string;
  cutoffISO: string;
  runnerCount: number;
  runners: ClientRunner[];
  formules: ClientFormule[];
};

type CartItem = {
  id: string;
  courseId: string;
  courseTitle: string;
  offerId: string;
  betTypeName: string;
  horses: number[];
  price: number;
};

const ORANGE = process.env.NEXT_PUBLIC_PAYMENT_ORANGE || "—";
const MOOV = process.env.NEXT_PUBLIC_PAYMENT_MOOV || "—";
const PAYMENT_NAME = process.env.NEXT_PUBLIC_PAYMENT_NAME || "";

export default function BetBuilder({ courses }: { courses: ClientCourse[] }) {
  const router = useRouter();
  const first = courses[0];

  const [selectedCourseId, setSelectedCourseId] = useState(first?.id ?? "");
  const [offerId, setOfferId] = useState<string | null>(
    first?.formules[0]?.offerId ?? null
  );
  const [horses, setHorses] = useState<number[]>([]);
  const [flash, setFlash] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<"ORANGE" | "MOOV">("ORANGE");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const course = courses.find((c) => c.id === selectedCourseId) ?? first;
  const formule =
    course?.formules.find((f) => f.offerId === offerId) ?? course?.formules[0] ?? null;
  const need = formule?.horsesToSelect ?? 0;
  const subtotal = cart.reduce((sum, i) => sum + i.price, 0);
  const transactionFee = Math.ceil(subtotal * 0.01);
  const platformFee = subtotal > 0 ? 15 : 0;
  const fees = transactionFee + platformFee;
  const total = subtotal + fees;

  function courseTitle(c: ClientCourse) {
    return c.prizeName ?? `${c.hippodrome} C${c.number}`;
  }

  function changeCourse(id: string) {
    const c = courses.find((x) => x.id === id) ?? first;
    setSelectedCourseId(id);
    setOfferId(c?.formules[0]?.offerId ?? null);
    setHorses([]);
  }

  function selectFormule(id: string) {
    setOfferId(id);
    setHorses([]);
  }

  function toggleHorse(n: number) {
    setHorses((cur) => {
      if (cur.includes(n)) return cur.filter((x) => x !== n);
      if (cur.length >= need) return cur;
      return [...cur, n];
    });
  }

  function addToTicket() {
    if (!course || !formule) return;
    if (horses.length !== need) return;
    setCart((c) => [
      ...c,
      {
        id: crypto.randomUUID(),
        courseId: course.id,
        courseTitle: courseTitle(course),
        offerId: formule.offerId,
        betTypeName: `4+1 · ${need} chevaux`,
        horses,
        price: formule.price,
      },
    ]);
    setHorses([]);
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
  }

  function removeFromCart(id: string) {
    setCart((c) => c.filter((i) => i.id !== id));
  }

  function displayHorses(item: CartItem) {
    const c = courses.find((x) => x.id === item.courseId);
    const byNum = new Map((c?.runners ?? []).map((r) => [r.number, r.name]));
    return item.horses.map((n) => `${n} ${byNum.get(n) ?? ""}`.trim()).join(", ");
  }

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Entrez votre nom complet.");
    if (!phone.trim()) return setError("Entrez votre numéro de téléphone.");
    if (!paymentRef.trim())
      return setError("Entrez la référence du paiement (ID de transaction).");

    const input: NewOrderInput = {
      customerName: name.trim(),
      customerPhone: phone.trim(),
      paymentNetwork: network,
      paymentPhone: paymentPhone.trim(),
      paymentRef: paymentRef.trim(),
      items: cart.map((i) => ({ offerId: i.offerId, selections: i.horses })),
    };

    startTransition(async () => {
      const res = await createOrder(input);
      if (res.ok) {
        router.push(`/commande/${res.code}`);
      } else {
        setError(res.error);
      }
    });
  }

  const payNumber = network === "ORANGE" ? ORANGE : MOOV;

  if (!course) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Aucune course disponible.
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Course header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {courses.length > 1 && (
          <select
            value={selectedCourseId}
            onChange={(e) => changeCourse(e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {courseTitle(c)} — {c.hippodrome} C{c.number}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {courseTitle(course)}
            </h1>
            <p className="text-xs text-slate-500">
              {course.prizeName
                ? `${course.hippodrome} C${course.number} · ${course.subtitle}`
                : course.subtitle}
            </p>
          </div>
          <span className="shrink-0 text-xs text-slate-500">
            Départ {course.startLabel}
          </span>
        </div>
      </div>

      {/* Composer */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold text-slate-900">Report 4+1</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Choisissez une formule, puis vos chevaux dans l&apos;ordre souhaité.
        </p>

        {/* Formule selector */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {course.formules.map((f) => {
            const active = f.offerId === formule?.offerId;
            return (
              <button
                key={f.offerId}
                type="button"
                onClick={() => selectFormule(f.offerId)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-300 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">
                  {f.horsesToSelect} chevaux
                </span>
                <span className="block text-sm font-bold text-emerald-700">
                  {formatFCFA(f.price)}
                </span>
                {f.hint && (
                  <span className="block text-[11px] text-slate-400">
                    {f.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Runner picker */}
        {formule && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-800">
              Choisissez {need} chevaux ({horses.length}/{need})
            </p>
            <div className="mt-2 space-y-1.5">
              {course.runners.map((r) => {
                const picked = horses.includes(r.number);
                return (
                  <button
                    key={r.number}
                    onClick={() => toggleHorse(r.number)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                      picked
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                          picked ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.number}
                      </span>
                      <span className="truncate text-sm font-medium text-slate-800">
                        {r.name}
                      </span>
                    </span>
                    {r.odds && (
                      <span className="shrink-0 text-xs text-slate-400">
                        {r.odds}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={addToTicket}
              disabled={horses.length !== need}
              className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Ajouter au ticket — {formatFCFA(formule.price)}
            </button>
            {flash && (
              <p className="mt-2 text-center text-sm font-medium text-emerald-700">
                Ajouté au ticket ✓ — vous pouvez en ajouter un autre.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ticket */}
      {cart.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Mon ticket</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {cart.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {item.betTypeName}{" "}
                    <span className="text-slate-400">· {item.courseTitle}</span>
                  </p>
                  <p className="text-sm text-slate-500">{displayHorses(item)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">
                    {formatFCFA(item.price)}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-rose-500 text-sm hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Sous-total</span>
              <span>{formatFCFA(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Frais</span>
              <span>{formatFCFA(fees)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-emerald-700">{formatFCFA(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Checkout */}
      {checkoutOpen && cart.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Paiement</h2>

          <div className="mt-3 grid gap-3">
            <label className="text-sm">
              <span className="text-slate-600">Nom complet</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ex: Awa Ouédraogo"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Votre téléphone (WhatsApp)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ex: 70 00 00 00"
              />
            </label>

            <div className="text-sm">
              <span className="text-slate-600">Réseau</span>
              <div className="mt-1 flex gap-2">
                {(["ORANGE", "MOOV"] as const).map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setNetwork(net)}
                    className={`flex-1 rounded-lg border px-3 py-2 font-medium transition ${
                      network === net
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {net === "ORANGE" ? "Orange Money" : "Moov Money"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              Envoyez <strong>{formatFCFA(total)}</strong> au numéro{" "}
              <strong>{payNumber}</strong>
              {PAYMENT_NAME ? ` (${PAYMENT_NAME})` : ""}, puis saisissez la
              référence ci-dessous.
            </div>

            <label className="text-sm">
              <span className="text-slate-600">Numéro utilisé pour payer</span>
              <input
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                inputMode="tel"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ex: 70 00 00 00"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">
                Référence du paiement (ID de transaction)
              </span>
              <input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ex: PP240521.1530.A12345"
              />
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" defaultChecked className="mt-0.5" />
              <span>
                J&apos;accepte de recevoir mon reçu et mon ticket par WhatsApp.
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Validation…" : "Valider et obtenir mon reçu"}
            </button>
          </div>
        </div>
      )}

      {/* Sticky bottom bar */}
      {cart.length > 0 && !checkoutOpen && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">{cart.length} pari(s)</span>
              <span className="text-slate-500"> · {formatFCFA(total)}</span>
            </div>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700"
            >
              Continuer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

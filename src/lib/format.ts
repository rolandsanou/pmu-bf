import type { Discipline, OrderStatus } from "@prisma/client";

const fcfa = new Intl.NumberFormat("fr-FR");

export function formatFCFA(n: number): string {
  return `${fcfa.format(n)} FCFA`;
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(d);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Paiement à vérifier",
  PAID: "Payé",
  PLACED: "Pari placé",
  SETTLED: "Résultat connu",
  CANCELLED: "Annulé",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-blue-100 text-blue-800",
  PLACED: "bg-emerald-100 text-emerald-800",
  SETTLED: "bg-violet-100 text-violet-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

export function formatSelections(selections: number[], ordered: boolean): string {
  const list = ordered ? selections : [...selections].sort((a, b) => a - b);
  return list.join(" - ");
}

export function formatSelectionsWithNames(
  selections: number[],
  ordered: boolean,
  runners: { number: number; name: string }[]
): string {
  const list = ordered ? selections : [...selections].sort((a, b) => a - b);
  const byNum = new Map(runners.map((r) => [r.number, r.name]));
  return list.map((n) => `${n} ${byNum.get(n) ?? ""}`.trim()).join(", ");
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ATTELE: "Attelé",
  MONTE: "Monté",
  PLAT: "Plat",
};

export function formatCourseLabel(c: {
  hippodrome: string;
  number: number;
  prizeName?: string | null;
}): string {
  const base = `${c.hippodrome} C${c.number}`;
  return c.prizeName ? `${base} — ${c.prizeName}` : base;
}

export function formatDistance(meters: number): string {
  return `${fcfa.format(meters)} m`;
}

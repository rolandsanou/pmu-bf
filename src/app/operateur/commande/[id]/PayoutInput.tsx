"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBetPayout } from "@/lib/actions";

export default function PayoutInput({
  betId,
  currentPayout,
}: {
  betId: string;
  currentPayout: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentPayout > 0 ? String(currentPayout) : "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    const amount = Number(value) || 0;
    if (amount < 0) return;
    startTransition(async () => {
      await updateBetPayout(betId, amount);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <label className="text-xs text-slate-500">Gain (FCFA) :</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
        placeholder="0"
      />
      <button
        onClick={save}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "…" : saved ? "✓" : "OK"}
      </button>
    </div>
  );
}

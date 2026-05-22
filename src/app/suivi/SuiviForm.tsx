"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SuiviForm() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/commande/${encodeURIComponent(c)}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Ex: A7K9P2"
        autoCapitalize="characters"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-wider"
      />
      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
      >
        Voir
      </button>
    </form>
  );
}

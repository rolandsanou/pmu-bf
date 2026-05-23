"use client";

import { useSearchParams } from "next/navigation";

export default function GoodLuckBanner() {
  const params = useSearchParams();
  if (params.get("new") !== "1") return null;

  return (
    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 text-center">
      <p className="text-3xl">🍀</p>
      <h2 className="mt-1 text-lg font-bold text-emerald-800">
        Bonne chance !
      </h2>
      <p className="mt-1 text-sm text-emerald-600">
        Votre ticket a bien été enregistré. Nous vous souhaitons la meilleure
        des chances pour cette course !
      </p>
    </div>
  );
}

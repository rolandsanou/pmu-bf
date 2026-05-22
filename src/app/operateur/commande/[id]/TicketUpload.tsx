"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { placeOrderWithPhoto } from "@/lib/actions";

function SubmitButton({ cta, disabled }: { cta: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
    >
      {pending ? "Envoi en cours…" : cta}
    </button>
  );
}

export default function TicketUpload({
  orderId,
  cta,
}: {
  orderId: string;
  cta: string;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setCount(files.length);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  return (
    <form action={placeOrderWithPhoto} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-6 text-center transition hover:bg-emerald-100">
        <span className="block text-3xl">📷</span>
        <span className="mt-1 block text-sm font-semibold text-emerald-800">
          Prendre / choisir les photos du ticket
        </span>
        <span className="mt-0.5 block text-xs text-emerald-700/70">
          Vous pouvez sélectionner plusieurs photos
        </span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          multiple
          required
          onChange={onChange}
          className="hidden"
        />
      </label>

      {count > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            {count} photo{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={src}
                src={src}
                alt="Aperçu"
                className="h-24 w-full rounded-lg border border-slate-200 object-cover"
              />
            ))}
          </div>
        </div>
      )}

      <SubmitButton cta={cta} disabled={count === 0} />
    </form>
  );
}

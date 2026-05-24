"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleBettingClosed } from "@/lib/actions";

export default function BettingToggle({
  closed,
  currentMessage,
}: {
  closed: boolean;
  currentMessage: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState(currentMessage);

  function handleClose() {
    if (!message.trim()) return;
    startTransition(async () => {
      await toggleBettingClosed(true, message.trim());
      setShowForm(false);
      router.refresh();
    });
  }

  function handleReopen() {
    startTransition(async () => {
      await toggleBettingClosed(false, "");
      router.refresh();
    });
  }

  if (closed) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-rose-800">
              Paris suspendus
            </p>
            {currentMessage && (
              <p className="mt-1 text-xs text-rose-600 whitespace-pre-line">
                {currentMessage}
              </p>
            )}
          </div>
          <button
            onClick={handleReopen}
            disabled={pending}
            className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "..." : "Rouvrir les paris"}
          </button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800 mb-2">
          Suspendre les paris
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Message pour les clients (ex: Paris suspendus pour raisons personnelles. Rendez-vous mercredi !)"
          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setShowForm(false)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
          >
            Annuler
          </button>
          <button
            onClick={handleClose}
            disabled={pending || !message.trim()}
            className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {pending ? "..." : "Confirmer la suspension"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Suspendre les paris
    </button>
  );
}

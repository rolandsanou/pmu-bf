"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteCourse, closeCourse, reopenCourse } from "@/lib/actions";

export default function CourseActions({
  courseId,
  courseToken,
  courseStatus,
}: {
  courseId: string;
  courseToken: string;
  courseStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "close" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirm(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCourse(courseId);
      if (!res.ok) {
        setError(res.error);
        setConfirm(null);
        return;
      }
      setOpen(false);
      setConfirm(null);
      router.push("/operateur");
      router.refresh();
    });
  }

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const res = await closeCourse(courseId);
      if (!res.ok) {
        setError(res.error);
        setConfirm(null);
        return;
      }
      setOpen(false);
      setConfirm(null);
      router.refresh();
    });
  }

  function handleReopen() {
    setError(null);
    startTransition(async () => {
      const res = await reopenCourse(courseId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const isClosed = courseStatus === "CLOSED";
  const isSettled = courseStatus === "SETTLED";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setConfirm(null); setError(null); }}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.065A1 1 0 015 17.403V6.597a1 1 0 011.036-.832l5.384 3.065a1 1 0 010 1.696zM16.5 12h.01M19.5 12h.01M13.5 12h.01" />
        </svg>
        Modifier
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {/* Modifier */}
          {!isSettled && (
            <a
              href={`/operateur/course/${courseToken}`}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </a>
          )}

          {/* Suspendre / Rouvrir */}
          {!isSettled && (
            isClosed ? (
              <button
                onClick={handleReopen}
                disabled={pending}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition"
              >
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {pending ? "..." : "Rouvrir les paris"}
              </button>
            ) : (
              <button
                onClick={() => setConfirm("close")}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition"
              >
                <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Suspendre
              </button>
            )
          )}

          {/* Separator */}
          {!isSettled && <hr className="border-slate-100" />}

          {/* Supprimer */}
          <button
            onClick={() => setConfirm("delete")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
          >
            <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Supprimer
          </button>

          {/* Confirmation overlay */}
          {confirm && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-700 mb-2">
                {confirm === "delete"
                  ? "Supprimer cette course ?"
                  : "Suspendre les paris pour cette course ?"}
              </p>
              {error && (
                <p className="text-xs text-rose-600 mb-2">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirm(null); setError(null); }}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Annuler
                </button>
                <button
                  onClick={confirm === "delete" ? handleDelete : handleClose}
                  disabled={pending}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                    confirm === "delete"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {pending ? "..." : "Confirmer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="text-5xl mb-4">🏇</span>
        <h1 className="text-3xl font-bold text-slate-900">{businessName}</h1>
        <p className="mt-3 max-w-md text-slate-600">
          Placez vos paris PMU en quelques clics, payez par Orange Money ou Moov
          Money, et recevez votre ticket sur WhatsApp.
        </p>

        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/jouer"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-white font-semibold shadow-sm hover:bg-emerald-700 transition"
          >
            Parier maintenant
          </Link>
          <Link
            href="/suivi"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Suivre ma commande
          </Link>
          <Link
            href="/aide"
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            Comment ça marche ?
          </Link>
        </div>
      </div>
    </main>
  );
}

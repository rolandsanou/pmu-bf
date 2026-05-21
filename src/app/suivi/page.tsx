import Link from "next/link";
import { redirect } from "next/navigation";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export default function SuiviPage() {
  async function go(formData: FormData) {
    "use server";
    const code = String(formData.get("code") || "")
      .trim()
      .toUpperCase();
    if (code) redirect(`/commande/${code}`);
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-900">
            🏇 {businessName}
          </Link>
          <Link href="/jouer" className="text-sm text-emerald-700 font-medium">
            Nouveau pari
          </Link>
        </div>
      </header>

      <div className="max-w-md w-full mx-auto px-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">Suivre ma commande</h1>
        <p className="text-sm text-slate-500 mb-4">
          Entrez le code reçu lors de votre pari.
        </p>
        <form action={go} className="flex gap-2">
          <input
            name="code"
            placeholder="Ex: A7K9P2"
            autoCapitalize="characters"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-wider"
          />
          <button className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700">
            Voir
          </button>
        </form>
      </div>
    </main>
  );
}

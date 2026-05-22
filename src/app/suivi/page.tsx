import Link from "next/link";
import SuiviForm from "./SuiviForm";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export default function SuiviPage() {
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
        <SuiviForm />
      </div>
    </main>
  );
}

import { loginAction } from "@/lib/actions";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6"
      >
        <h1 className="text-lg font-bold text-slate-900">
          🏇 {businessName} — Espace gérante
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Entrez votre mot de passe pour continuer.
        </p>

        <input
          type="text"
          name="username"
          placeholder="Nom d'utilisateur"
          autoCapitalize="none"
          autoFocus
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />

        {error && (
          <p className="mt-2 text-sm text-rose-600">Mot de passe incorrect.</p>
        )}

        <button className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800">
          Se connecter
        </button>
      </form>
    </main>
  );
}

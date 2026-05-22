import Link from "next/link";
import { redirect } from "next/navigation";
import { isOperatorAuthed } from "@/lib/auth";
import ImportForm from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImporterPage() {
  if (!(await isOperatorAuthed())) redirect("/operateur/login");

  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/operateur" className="text-sm text-slate-500">
            &larr; Commandes
          </Link>
          <h1 className="font-bold text-slate-900">Importer un journal</h1>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6">
        <ImportForm />
      </div>
    </main>
  );
}

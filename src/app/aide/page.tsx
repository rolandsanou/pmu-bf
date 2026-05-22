import Link from "next/link";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Pari Express";
const ORANGE = process.env.NEXT_PUBLIC_PAYMENT_ORANGE || "—";
const MOOV = process.env.NEXT_PUBLIC_PAYMENT_MOOV || "—";
const PAYMENT_NAME = process.env.NEXT_PUBLIC_PAYMENT_NAME || "";

type Step = {
  icon: string;
  title: string;
  what: string;
  how: string[];
};

const STEPS: Step[] = [
  {
    icon: "▶️",
    title: "Ouvrir le site",
    what: "Sur la page d'accueil, lancez un nouveau pari.",
    how: [
      "Appuyez sur le bouton vert « Parier maintenant ».",
      "Vous arrivez sur la course du jour (ex : Prix Sirrah, Paris-Vincennes).",
    ],
  },
  {
    icon: "🎯",
    title: "Choisir votre formule (Report 4+1)",
    what: "La formule, c'est le nombre de chevaux que vous jouez. Le prix dépend du nombre.",
    how: [
      "5 chevaux = 300 F · 6 chevaux = 1 800 F · 7 chevaux = 6 300 F · 8 chevaux = 16 800 F.",
      "Appuyez sur la case de la formule voulue (elle devient verte).",
      "Pas d'ordre ni désordre : le résultat est vu à l'arrivée.",
    ],
  },
  {
    icon: "🐎",
    title: "Choisir vos chevaux",
    what: "Sélectionnez exactement le nombre de chevaux de votre formule.",
    how: [
      "Appuyez sur les chevaux dans la liste (numéro + nom + cote).",
      "Le compteur « (x / y) » indique combien il vous reste à choisir.",
      "Un cheval sélectionné devient vert. Appuyez à nouveau pour le retirer.",
    ],
  },
  {
    icon: "🧾",
    title: "Ajouter au ticket",
    what: "Mettez votre combinaison dans le ticket. Vous pouvez en jouer plusieurs.",
    how: [
      "Appuyez sur « Ajouter au ticket — (prix) ».",
      "Le message « Ajouté au ticket ✓ » confirme.",
      "Pour jouer une autre combinaison, refaites les étapes 2 et 3.",
    ],
  },
  {
    icon: "💳",
    title: "Payer par mobile money",
    what: "Envoyez l'argent, puis renseignez votre paiement.",
    how: [
      "Appuyez sur « Continuer » (barre verte en bas).",
      "Entrez votre nom complet et votre numéro WhatsApp.",
      "Choisissez Orange Money ou Moov Money.",
      `Envoyez le montant affiché au numéro indiqué${
        PAYMENT_NAME ? ` (${PAYMENT_NAME})` : ""
      } — Orange ${ORANGE} / Moov ${MOOV}.`,
      "Saisissez le numéro qui a payé et la référence (ID de transaction reçu par SMS).",
    ],
  },
  {
    icon: "✅",
    title: "Valider et garder votre reçu",
    what: "Vous obtenez un code de commande et un reçu PDF.",
    how: [
      "Appuyez sur « Valider et obtenir mon reçu ».",
      "Notez votre code (ex : A7K9P2) — il sert à suivre votre pari.",
      "Appuyez sur « Télécharger le reçu (PDF) » pour le garder.",
    ],
  },
  {
    icon: "📲",
    title: "Recevoir votre ticket",
    what: "Une fois le pari placé, vous recevez la photo du ticket.",
    how: [
      "La gérante vérifie le paiement puis place le pari au point PMU.",
      "Vous recevez la photo du ticket sur WhatsApp.",
      "Vous pouvez aussi la voir et la télécharger sur la page de votre commande.",
    ],
  },
  {
    icon: "🔎",
    title: "Suivre votre commande",
    what: "À tout moment, vérifiez l'état de votre pari avec votre code.",
    how: [
      "Page d'accueil → « Suivre ma commande ».",
      "Entrez votre code, appuyez sur « Voir ».",
      "Vous voyez : Paiement à vérifier → Payé → Ticket prêt.",
    ],
  },
];

export default function AidePage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-900">
            🏇 {businessName}
          </Link>
          <Link href="/jouer" className="text-sm text-emerald-700 font-medium">
            Parier
          </Link>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Comment parier ?</h1>
        <p className="mt-1 text-slate-600">
          Suivez ces étapes pour placer votre pari Report 4+1 en quelques minutes.
        </p>

        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          ⏰ Les paris ferment à <strong>18h00 (heure de Ouaga)</strong>. Pensez à
          jouer avant.
        </div>

        <a
          href="/guide-pari-express.pdf"
          download
          className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          📄 Télécharger le guide en PDF (avec images)
        </a>

        <ol className="mt-5 space-y-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">
                    {s.icon} {s.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">{s.what}</p>
                  <ul className="mt-2 space-y-1">
                    {s.how.map((h, j) => (
                      <li
                        key={j}
                        className="flex gap-2 text-sm text-slate-700"
                      >
                        <span className="text-emerald-600">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Link
          href="/jouer"
          className="mt-6 block rounded-xl bg-emerald-600 px-6 py-3 text-center font-semibold text-white hover:bg-emerald-700"
        >
          Parier maintenant
        </Link>
      </div>
    </main>
  );
}

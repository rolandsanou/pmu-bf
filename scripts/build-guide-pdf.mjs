import { readFileSync, writeFileSync } from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SHOTS = "scripts/guide-shots";
const OUT = "public/guide-pari-express.pdf";

const NAVY = rgb(0.05, 0.11, 0.27);
const GREEN = rgb(0.04, 0.43, 0.31);
const GREY = rgb(0.4, 0.4, 0.4);
const MARGIN = 45;
const A4 = [595.28, 841.89];

// WinAnsi can't encode some chars — keep captions safe.
const S = (s) => s.replace(/[  ]/g, " ").replace(/[“”]/g, '"');

const STEPS = [
  { img: "01-accueil", title: "Etape 1 — Ouvrir le site", lines: ["Sur la page d'accueil, appuyez sur le bouton vert « Parier maintenant »."] },
  { img: "02-course", title: "Etape 2 — Choisir la formule (Report 4+1)", lines: ["Le prix depend du nombre de chevaux :", "5 = 300 F · 6 = 1 800 F · 7 = 6 300 F · 8 = 16 800 F. Pas d'ordre."] },
  { img: "03-chevaux", title: "Etape 3 — Choisir vos chevaux", lines: ["Appuyez sur les chevaux dans la liste (compteur x/y),", "puis « Ajouter au ticket ». Vous pouvez ajouter plusieurs paris."] },
  { img: "04-paiement", title: "Etape 4 — Payer par mobile money", lines: ["Nom + numero WhatsApp, choisissez Orange ou Moov,", "envoyez le montant au numero affiche (KY Diane),", "puis saisissez la reference (ID de transaction)."] },
  { img: "05-recu", title: "Etape 5 — Recu et code", lines: ["Vous obtenez un code de commande et un recu PDF.", "Gardez bien votre code."] },
  { img: "06-suivi", title: "Etape 6 — Suivre votre commande", lines: ["« Suivre ma commande » + votre code = statut en direct.", "Vous recevez la photo du ticket une fois le pari place."] },
];

function wrap(text, font, size, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW) {
      if (line) lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H] = A4;

  // Cover
  const cover = doc.addPage(A4);
  cover.drawText(S("Pari Express"), { x: MARGIN, y: H - 120, size: 34, font: bold, color: NAVY });
  cover.drawText(S("Guide du joueur — comment parier au Report 4+1"), { x: MARGIN, y: H - 150, size: 14, font, color: GREY });
  cover.drawText(S("En 6 etapes simples, depuis votre telephone."), { x: MARGIN, y: H - 175, size: 12, font, color: rgb(0.2,0.2,0.2) });
  cover.drawRectangle({ x: MARGIN, y: H - 240, width: W - 2 * MARGIN, height: 40, color: rgb(0.99, 0.95, 0.82) });
  cover.drawText(S("Important : les paris ferment a 18h00 (heure de Ouaga)."), { x: MARGIN + 12, y: H - 225, size: 12, font: bold, color: rgb(0.6, 0.4, 0) });
  cover.drawText(S("pari-express.onrender.com"), { x: MARGIN, y: 60, size: 12, font: bold, color: GREEN });

  for (const step of STEPS) {
    const page = doc.addPage(A4);
    let y = H - MARGIN;
    page.drawText(S(step.title), { x: MARGIN, y, size: 15, font: bold, color: NAVY });
    y -= 22;
    for (const l of step.lines) {
      for (const wl of wrap(S(l), font, 11, W - 2 * MARGIN)) {
        page.drawText(wl, { x: MARGIN, y, size: 11, font, color: rgb(0.25, 0.25, 0.25) });
        y -= 15;
      }
    }
    y -= 10;

    const png = await doc.embedPng(readFileSync(`${SHOTS}/${step.img}.png`));
    const maxW = W - 2 * MARGIN;
    const maxH = y - MARGIN;
    const scale = Math.min(maxW / png.width, maxH / png.height);
    const w = png.width * scale;
    const h = png.height * scale;
    page.drawImage(png, { x: (W - w) / 2, y: y - h, width: w, height: h });
  }

  writeFileSync(OUT, await doc.save());
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

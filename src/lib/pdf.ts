import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatFCFA, formatDateTime } from "./format";

export type ReceiptBet = {
  courseLabel: string;
  betTypeName: string;
  selections: string;
  price: number;
};

export type ReceiptData = {
  businessName: string;
  code: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  statusLabel: string;
  paymentNetwork?: string | null;
  paymentRef?: string | null;
  total: number;
  bets: ReceiptBet[];
};

const MARGIN = 50;
const NAVY = rgb(0.05, 0.11, 0.27);
const GREY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.93, 0.95, 0.98);

// Helvetica/WinAnsi cannot encode the narrow/no-break spaces that fr-FR number
// and date formatting emit (U+202F, U+00A0) — normalize them to a plain space.
const S = (s: string) => s.replace(/\s/g, (ch) => (ch === "\n" ? "\n" : " "));

export async function generateOrderReceiptPdf(
  data: ReceiptData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  let y = height - MARGIN;

  const text = (
    s: string,
    x: number,
    size = 11,
    f: PDFFont = font,
    color = rgb(0, 0, 0)
  ) => page.drawText(S(s), { x, y, size, font: f, color });

  // Header
  text(data.businessName, MARGIN, 20, bold, NAVY);
  y -= 22;
  text("Reçu de commande", MARGIN, 12, font, GREY);

  const codeLabel = S(`Code: ${data.code}`);
  page.drawText(codeLabel, {
    x: width - MARGIN - bold.widthOfTextAtSize(codeLabel, 13),
    y: height - MARGIN,
    size: 13,
    font: bold,
    color: NAVY,
  });

  y -= 28;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 1,
    color: LIGHT,
  });
  y -= 24;

  const metaLine = (label: string, value: string) => {
    text(label, MARGIN, 10, bold, GREY);
    text(value, MARGIN + 110, 11, font);
    y -= 18;
  };
  metaLine("Client", data.customerName);
  metaLine("Téléphone", data.customerPhone);
  metaLine("Date", formatDateTime(data.createdAt));
  metaLine("Statut", data.statusLabel);
  if (data.paymentNetwork) metaLine("Paiement", data.paymentNetwork);
  if (data.paymentRef) metaLine("Référence", data.paymentRef);

  y -= 10;

  drawTableHeader(page, bold, y);
  y -= 22;

  const col = { course: MARGIN, type: 220, sel: 360, price: width - MARGIN };
  for (const bet of data.bets) {
    if (y < 120) break; // single-page receipt
    page.drawText(
      truncate(S(bet.courseLabel), font, 11, col.type - col.course - 8),
      { x: col.course, y, size: 11, font }
    );
    page.drawText(
      truncate(S(bet.betTypeName), font, 11, col.sel - col.type - 8),
      { x: col.type, y, size: 11, font }
    );
    page.drawText(S(bet.selections), { x: col.sel, y, size: 11, font });
    const priceStr = S(formatFCFA(bet.price));
    page.drawText(priceStr, {
      x: col.price - font.widthOfTextAtSize(priceStr, 11),
      y,
      size: 11,
      font,
    });
    y -= 18;
  }

  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 1,
    color: LIGHT,
  });
  y -= 22;

  const totalLabel = "TOTAL";
  const totalValue = S(formatFCFA(data.total));
  page.drawText(totalLabel, { x: width - MARGIN - 220, y, size: 13, font: bold });
  page.drawText(totalValue, {
    x: width - MARGIN - bold.widthOfTextAtSize(totalValue, 13),
    y,
    size: 13,
    font: bold,
    color: NAVY,
  });

  const note =
    "Ce recu confirme votre commande. La preuve du pari place est la photo du ticket envoyee sur WhatsApp.";
  page.drawText(S(wrap(note, font, 9, width - 2 * MARGIN)), {
    x: MARGIN,
    y: 70,
    size: 9,
    font,
    color: GREY,
    lineHeight: 12,
  });

  return doc.save();
}

export type PlacementBet = { label: string; selections: string };
export type PlacementOrder = {
  code: string;
  customerName: string;
  customerPhone: string;
  total: number;
  placed: boolean;
  bets: PlacementBet[];
};
export type PlacementData = {
  businessName: string;
  title: string;
  generatedAt: Date;
  orders: PlacementOrder[];
};

// Operator worksheet: every bettor + their bets, to place manually at the PMU
// counter. Paginates automatically.
export async function generatePlacementSheetPdf(
  data: PlacementData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const SIZE: [number, number] = [595.28, 841.89];
  let page = doc.addPage(SIZE);
  const width = page.getSize().width;
  let y = page.getSize().height - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage(SIZE);
      y = page.getSize().height - MARGIN;
    }
  };

  page.drawText(S(data.businessName), { x: MARGIN, y, size: 16, font: bold, color: NAVY });
  y -= 18;
  page.drawText(S(data.title), { x: MARGIN, y, size: 11, font, color: GREY });
  y -= 13;
  page.drawText(
    S(`Généré le ${formatDateTime(data.generatedAt)} — ${data.orders.length} commande(s)`),
    { x: MARGIN, y, size: 9, font, color: GREY }
  );
  y -= 16;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 1, color: LIGHT });
  y -= 18;

  if (data.orders.length === 0) {
    page.drawText(S("Aucune commande à placer."), { x: MARGIN, y, size: 11, font, color: GREY });
  }

  for (const o of data.orders) {
    ensure(34 + o.bets.length * 13);
    const head = `${o.placed ? "[x]" : "[ ]"} ${o.code}   ${o.customerName}   ${o.customerPhone}`;
    page.drawText(S(head), { x: MARGIN, y, size: 11, font: bold, color: o.placed ? GREY : NAVY });
    const tag = o.placed ? "PLACÉ" : "À PLACER";
    const tagW = bold.widthOfTextAtSize(tag, 9);
    page.drawText(S(tag), {
      x: width - MARGIN - tagW,
      y,
      size: 9,
      font: bold,
      color: o.placed ? rgb(0.15, 0.5, 0.25) : rgb(0.7, 0.35, 0),
    });
    y -= 14;
    for (const b of o.bets) {
      ensure(13);
      page.drawText(S(`   - ${b.label} : ${b.selections}`), { x: MARGIN, y, size: 10, font });
      y -= 13;
    }
    const totalStr = S(`Total: ${formatFCFA(o.total)}`);
    page.drawText(totalStr, {
      x: width - MARGIN - font.widthOfTextAtSize(totalStr, 9),
      y,
      size: 9,
      font,
      color: GREY,
    });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 0.5, color: LIGHT });
    y -= 12;
  }

  return doc.save();
}

function drawTableHeader(page: PDFPage, bold: PDFFont, y: number) {
  const { width } = page.getSize();
  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: width - 2 * MARGIN,
    height: 20,
    color: LIGHT,
  });
  page.drawText("Course", { x: MARGIN + 4, y, size: 10, font: bold, color: NAVY });
  page.drawText("Type", { x: 220 + 4, y, size: 10, font: bold, color: NAVY });
  page.drawText("Selection", { x: 360 + 4, y, size: 10, font: bold, color: NAVY });
  const priceHead = "Prix";
  page.drawText(priceHead, {
    x: width - MARGIN - 4 - bold.widthOfTextAtSize(priceHead, 10),
    y,
    size: 10,
    font: bold,
    color: NAVY,
  });
}

function truncate(s: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(out + "...", size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "...";
}

function wrap(s: string, font: PDFFont, size: number, maxWidth: number): string {
  const words = s.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/**
 * Parser for PMU'B weekly journal PDFs.
 *
 * The journal contains one featured race per day with:
 *  - Course meta: hippodrome, course number, prize name, discipline, distance, prize money, partants
 *  - Runners table: n° · name · driver · trainer · owner · sexAge · chrono · recentForm · gains · odds
 *
 * Text extraction can produce encoding issues (é→□), so we sanitize aggressively.
 */

// pdf-parse v1 index.js tries to load a test PDF on import (!).
// Require the inner module directly to avoid the ENOENT.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse");

export type ParsedRunner = {
  number: number;
  name: string;
  driver: string;
  trainer: string;
  owner: string;
  sexAge: string;
  chrono: string;
  recentForm: string;
  gains: number;
  odds: string;
};

export type ParsedCourse = {
  hippodrome: string;
  number: number;
  prizeName: string;
  discipline: "ATTELE" | "MONTE" | "PLAT";
  distanceMeters: number;
  prizeMoney: number;
  runnerCount: number;
  runners: ParsedRunner[];
  rawText: string; // full extracted text for debugging
};

/** Sanitize encoding issues from PDF text extraction. */
function sanitize(text: string): string {
  return text
    .replace(/[  ]/g, " ") // narrow/non-breaking spaces → regular
    .replace(/�/g, "") // replacement char
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/** Try to detect discipline from text. */
function parseDiscipline(text: string): "ATTELE" | "MONTE" | "PLAT" {
  const lower = text.toLowerCase();
  if (lower.includes("attel")) return "ATTELE";
  if (lower.includes("mont")) return "MONTE";
  if (lower.includes("plat")) return "PLAT";
  return "ATTELE"; // default
}

/**
 * Parse the full PDF buffer into structured course + runners data.
 * Returns a best-effort result — the operator reviews before saving.
 */
export async function parseJournalPdf(
  buffer: Buffer
): Promise<ParsedCourse> {
  const data = await pdfParse(buffer);
  const raw = sanitize(data.text as string);
  const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);

  // ── Extract course metadata ──────────────────────────────────────────

  let hippodrome = "";
  let courseNumber = 0;
  let prizeName = "";
  let discipline: "ATTELE" | "MONTE" | "PLAT" = "ATTELE";
  let distanceMeters = 2000;
  let prizeMoney = 0;

  for (const line of lines) {
    // Hippodrome: look for "HIPPODROME DE ..." or "Hippodrome de ..."
    const hippoMatch = line.match(/hippodrome\s+(?:de\s+)?(.+)/i);
    if (hippoMatch && !hippodrome) {
      hippodrome = hippoMatch[1].replace(/[-–—]+$/, "").trim();
    }

    // Course number: "Course N° 4" or "Course n°4" or "COURSE 4" or "C.4" or "4ème course"
    const courseMatch =
      line.match(/course\s+n[°o]?\s*(\d+)/i) ||
      line.match(/(\d+)\s*[eè]me\s+course/i) ||
      line.match(/^C\.?\s*(\d+)\b/);
    if (courseMatch && !courseNumber) {
      courseNumber = parseInt(courseMatch[1], 10);
    }

    // Prize name: "PRIX ..." or "Prix ..."
    const prizeMatch = line.match(/^prix\s+(.+)/i);
    if (prizeMatch && !prizeName) {
      prizeName = prizeMatch[1].trim();
    }

    // Discipline
    if (/attel[eé]/i.test(line)) discipline = "ATTELE";
    else if (/mont[eé]/i.test(line)) discipline = "MONTE";
    else if (/\bplat\b/i.test(line)) discipline = "PLAT";

    // Distance: "2 700m" or "2700 m" or "Distance : 2700"
    const distMatch = line.match(/(\d[\d\s]*)\s*m(?:\s|$|[èe])/i);
    if (distMatch) {
      const d = parseInt(distMatch[1].replace(/\s/g, ""), 10);
      if (d >= 800 && d <= 5000) distanceMeters = d;
    }

    // Prize money: "44 500 000" or large number patterns
    const moneyMatch = line.match(
      /(?:allocation|dotation|prix\s*:?)\s*([\d\s]+)/i
    );
    if (moneyMatch) {
      const m = parseInt(moneyMatch[1].replace(/\s/g, ""), 10);
      if (m > 100000) prizeMoney = m;
    }
  }

  // ── Extract runners table ────────────────────────────────────────────

  const runners: ParsedRunner[] = [];

  // Strategy: find lines that start with a number (horse number) followed by
  // an uppercase name. The table is typically:
  // N° | NOM | DRIVER | ENTRAINEUR | PROPRIETAIRE | S/A | CHRONO | PERF | GAINS | COTES
  //
  // Since PDF text extraction flattens columns, we try multiple patterns.

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: "1 ILIO MANNETOT F. NIVARD ..."
    // A line starting with 1-2 digit number followed by an uppercase horse name
    const runnerMatch = line.match(
      /^(\d{1,2})\s+([A-Z][A-Z\s'.\-]{2,})/
    );

    if (runnerMatch) {
      const num = parseInt(runnerMatch[1], 10);
      if (num < 1 || num > 20) continue;

      // Already parsed this number?
      if (runners.some((r) => r.number === num)) continue;

      const horseName = runnerMatch[2].trim();

      // Try to extract remaining fields from the rest of the line
      const rest = line.slice(runnerMatch[0].length).trim();

      // Try to find driver name (usually "X. LASTNAME" pattern)
      const namePattern = /([A-Z][A-Za-z]*\.?\s+[A-Z][A-Z\s]+)/g;
      const names = [...rest.matchAll(namePattern)].map((m) => m[1].trim());

      // Try to find chrono (pattern like "1.11.40" or "1'11\"40")
      const chronoMatch = rest.match(/(\d['.]?\d{2}['".]?\d{2})/);

      // Try to find sex/age (pattern like "H.8" or "F.7")
      const sexAgeMatch = rest.match(/([HFM])\s*[.]\s*(\d{1,2})/);

      // Try to find performance (pattern like "4.A.9.6.5" or "4.2.0.1.2")
      const perfMatch = rest.match(
        /(\d[.][A-Z0-9][.][A-Z0-9][.][A-Z0-9][.][A-Z0-9])/
      );

      // Try to find gains (large number near end)
      const gainsMatches = [...rest.matchAll(/(\d[\d\s]{3,})/g)];
      let gains = 0;
      for (const gm of gainsMatches) {
        const v = parseInt(gm[1].replace(/\s/g, ""), 10);
        if (v > 10000 && v < 10000000) {
          gains = v;
        }
      }

      // Try to find odds (pattern like "24/1" or "9/1")
      const oddsMatch = rest.match(/(\d+)\s*[/]\s*(\d+)/);

      runners.push({
        number: num,
        name: horseName.replace(/\s{2,}/g, " "),
        driver: names[0] ?? "",
        trainer: names[1] ?? names[0] ?? "",
        owner: names[2] ?? "",
        sexAge: sexAgeMatch ? `${sexAgeMatch[1]}.${sexAgeMatch[2]}` : "",
        chrono: chronoMatch?.[1] ?? "",
        recentForm: perfMatch?.[1] ?? "",
        gains,
        odds: oddsMatch ? `${oddsMatch[1]}/${oddsMatch[2]}` : "",
      });
    }
  }

  // Sort runners by number
  runners.sort((a, b) => a.number - b.number);

  return {
    hippodrome: hippodrome || "Inconnu",
    number: courseNumber || 1,
    prizeName,
    discipline,
    distanceMeters,
    prizeMoney,
    runnerCount: runners.length,
    runners,
    rawText: raw,
  };
}

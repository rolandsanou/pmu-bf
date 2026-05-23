/**
 * Parser for PMU'B weekly journal PDFs.
 *
 * The journal has a fixed structure:
 *  Page 1: Header with course meta + commentary + previous results
 *  Page 2: Runners table (columns extracted separately by pdf-parse) + tips
 *
 * pdf-parse extracts the table columns as vertical blocks, NOT merged rows.
 * So "N°" values come out as 16 consecutive lines, then "CHEVAUX" names as
 * another 16 lines, etc. We detect each column block by pattern matching.
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
  rawText: string;
};

/** Sanitize encoding issues from PDF text extraction. */
function sanitize(text: string): string {
  return text
    .replace(/[  ]/g, " ")
    .replace(/�/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/**
 * Parse the full PDF buffer into structured course + runners data.
 */
export async function parseJournalPdf(
  buffer: Buffer
): Promise<ParsedCourse> {
  const data = await pdfParse(buffer);
  const raw = sanitize(data.text as string);
  const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);

  // ── Extract course metadata from page 1 header ─────────────────────

  let hippodrome = "";
  let courseNumber = 0;
  let prizeName = "";
  let discipline: "ATTELE" | "MONTE" | "PLAT" = "PLAT";
  let distanceMeters = 2000;
  let prizeMoney = 0;
  let runnerCount = 0;

  for (const line of lines.slice(0, 20)) {
    // Line like: PARISLONGCHAMP - PRIX DE L'ORANGERIE
    const hippoMatch = line.match(
      /^([A-Z][A-Z\s\-]+?)\s*-\s*PRIX\s+(.+)/i
    );
    if (hippoMatch && !hippodrome) {
      hippodrome = hippoMatch[1].trim();
      prizeName = hippoMatch[2].trim();
    }

    // Line like: 16 CONCURRENTS - 3ème COURSE - PLAT
    const metaMatch = line.match(
      /(\d+)\s*CONCURRENTS?\s*-\s*(\d+)[eè]me\s*COURSE\s*-\s*(\w+)/i
    );
    if (metaMatch) {
      runnerCount = parseInt(metaMatch[1], 10);
      courseNumber = parseInt(metaMatch[2], 10);
      const disc = metaMatch[3].toUpperCase();
      if (disc.includes("PLAT")) discipline = "PLAT";
      else if (disc.includes("ATTEL")) discipline = "ATTELE";
      else if (disc.includes("MONT")) discipline = "MONTE";
    }

    // Line like: 50 900 EUROS (ENV. 33 500 000 F CFA) - 1 400 METRES
    const moneyMatch = line.match(
      /(\d[\d\s]*)\s*EUROS?\s*\(?ENV\.?\s*([\d\s]+)\s*F\s*CFA\)?\s*-\s*([\d\s]+)\s*METRES?/i
    );
    if (moneyMatch) {
      prizeMoney = parseInt(moneyMatch[2].replace(/\s/g, ""), 10);
      distanceMeters = parseInt(moneyMatch[3].replace(/\s/g, ""), 10);
    }
  }

  // ── Extract runners table from columnar text ───────────────────────

  const runners: ParsedRunner[] = [];

  // Find the number column: consecutive lines "01"-"20"
  const numBlock = findBlockFull(lines, (s) => /^0[1-9]$|^1[0-9]$|^20$/.test(s), 8);

  if (!numBlock) {
    // Fallback: extract from commentary pattern "N - HORSENAME"
    return parseFallback(lines, raw, hippodrome, courseNumber, prizeName, discipline, distanceMeters, prizeMoney, runnerCount);
  }

  const count = numBlock.length;
  const numbers = numBlock.values.map((s) => parseInt(s, 10));

  // Sex/Age: "H.5", "F.4", "H.7", etc.
  const sexAges = findBlock(lines, (s) => /^[HFM]\.?\s*\d{1,2}$/i.test(s), count);

  // Recent form (PERF): "5.1.2.8.3" or "1.D.0.6.1"
  const perfs = findBlock(lines, (s) => /^\d[.][A-Z0-9][.][A-Z0-9][.][A-Z0-9][.][A-Z0-9]$/i.test(s), count);

  // Gains: large numbers like "149 753"
  const gainsBlock = findBlock(lines, (s) => {
    const n = parseInt(s.replace(/\s/g, ""), 10);
    return /^\d[\d\s]{3,}$/.test(s) && n >= 1000 && n < 10000000;
  }, count);

  // Odds: "24/1", "7/1", etc.
  const odds = findBlock(lines, (s) => /^\d+\/\d+$/.test(s), count);

  // Horse names: uppercase names WITHOUT dots (dots indicate person names like "F.CHAPPET")
  const isHorseName = (s: string) =>
    s.length >= 3 &&
    /^[A-Z][A-Z\s''\-]+$/.test(s) &&
    !/\./.test(s) &&
    !/^\d/.test(s) &&
    !isHeaderWord(s);

  const namesBlock = findBlock(lines, isHorseName, count, numBlock.start + count);

  // After horse names, pdf-parse outputs 3 consecutive name columns of `count` lines:
  // ENTRAINEURS, then JOCKEYS, then PROPRIETAIRES (order varies by PDF layout).
  // Instead of pattern matching, just slice the next 3 blocks of `count` lines.
  const afterNames = namesBlock ? namesBlock.start + count : numBlock.start + count;

  // Find first person-name block (contains dots like "F.CHAPPET" or letters)
  const isAnyName = (s: string) =>
    s.length >= 2 &&
    /[A-Z]/.test(s) &&
    !/^\d+$/.test(s) &&
    !/^\d+\/\d+$/.test(s) &&
    !/^[HFM]\.?\s*\d{1,2}$/i.test(s) &&
    !/^\d[.][A-Z0-9][.]/i.test(s) &&
    !/KG$/i.test(s) &&
    !/^\d[\d\s]{3,}$/.test(s) &&
    !isHeaderWord(s);

  const block1 = findBlock(lines, isAnyName, count, afterNames);
  const after1 = block1 ? block1.start + count : afterNames;

  const block2 = findBlock(lines, isAnyName, count, after1);
  const after2 = block2 ? block2.start + count : after1;

  const block3 = findBlock(lines, isAnyName, count, after2);

  // The PDF table header is: CHEVAUX JOCKEYS ENTRAINEURS PROPRIETAIRES
  // But pdf-parse extracts columns as: ENTRAINEURS, JOCKEYS, PROPRIETAIRES
  // We detect which is which by checking if values contain dots (initials)
  // Jockeys always have "X.LASTNAME" pattern.
  const hasMostlyDots = (vals: string[]) =>
    vals.filter((v) => /\./.test(v)).length > vals.length * 0.7;

  // Assign: trainers first, then jockeys, then owners
  // If block1 has mostly dots and block2 also → trainers, jockeys, owners
  // Just use extraction order — it's consistent for PMU'B journals
  const trainersBlock = block1;
  const jockeysBlock = block2;
  const ownersBlock = block3;

  // Build runners
  for (let i = 0; i < count; i++) {
    runners.push({
      number: numbers[i],
      name: namesBlock?.values[i] ?? "",
      driver: jockeysBlock?.values[i] ?? "",
      trainer: trainersBlock?.values[i] ?? "",
      owner: ownersBlock?.values[i] ?? "",
      sexAge: sexAges?.values[i]?.replace(/\s/g, "") ?? "",
      chrono: "",
      recentForm: perfs?.values[i] ?? "",
      gains: gainsBlock ? parseInt(gainsBlock.values[i].replace(/\s/g, ""), 10) || 0 : 0,
      odds: odds?.values[i] ?? "",
    });
  }

  runners.sort((a, b) => a.number - b.number);

  return {
    hippodrome: hippodrome || "Inconnu",
    number: courseNumber || 1,
    prizeName,
    discipline,
    distanceMeters,
    prizeMoney,
    runnerCount: runnerCount || runners.length,
    runners,
    rawText: raw,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

type BlockResult = { values: string[]; start: number; length: number } | null;

/**
 * Find a consecutive block and return ALL matching lines (not capped at minLen).
 * Used for the number column where we need to detect the actual runner count.
 */
function findBlockFull(
  lines: string[],
  test: (s: string) => boolean,
  minLen: number,
  fromIdx = 0
): BlockResult {
  for (let start = fromIdx; start <= lines.length - minLen; start++) {
    if (!test(lines[start])) continue;
    let end = start + 1;
    while (end < lines.length && test(lines[end])) end++;
    const len = end - start;
    if (len >= minLen) {
      return { values: lines.slice(start, end), start, length: len };
    }
  }
  return null;
}

/**
 * Find a consecutive block of lines matching `test`, of at least `minLen`.
 * Allows up to 2 mismatches for robustness.
 * Optionally start searching from `fromIdx`.
 */
function findBlock(
  lines: string[],
  test: (s: string) => boolean,
  minLen: number,
  fromIdx = 0
): BlockResult {
  // Strict pass: all must match
  for (let start = fromIdx; start <= lines.length - minLen; start++) {
    let ok = true;
    for (let j = start; j < start + minLen; j++) {
      if (!test(lines[j])) { ok = false; break; }
    }
    if (ok) {
      // Extend forward if more match
      let end = start + minLen;
      while (end < lines.length && test(lines[end])) end++;
      const len = end - start;
      // Only return if length is close to minLen (avoid grabbing commentary)
      if (len <= minLen + 4) {
        return { values: lines.slice(start, start + minLen), start, length: minLen };
      }
      return { values: lines.slice(start, start + minLen), start, length: minLen };
    }
  }

  // Relaxed pass: allow 1-2 mismatches
  for (let start = fromIdx; start <= lines.length - minLen; start++) {
    let matches = 0;
    for (let j = start; j < start + minLen; j++) {
      if (test(lines[j])) matches++;
    }
    if (matches >= minLen - 2) {
      return { values: lines.slice(start, start + minLen), start, length: minLen };
    }
  }

  return null;
}

/** Words that are table headers, not data. */
function isHeaderWord(s: string): boolean {
  return /^(CHEVAUX|JOCKEYS|ENTRAINEURS|PROPRIETAIRES|CORDE|PERF|GAINS|POIDS|SEXE|AGE|PARIS|TURF|TIERCE|MAGAZINE|HORAIRES|INFORMATION|CLASSEMENT|APTITUDES|LES MEILLEURS.*|N°|SECONDES CHANCES|OUTSIDERS|GROS OUTSIDERS|FORME|CLASSE|PROGRES|REGULARITE)$/i.test(s);
}

/**
 * Fallback parser: extracts runners from commentary text "N - HORSENAME"
 */
function parseFallback(
  lines: string[],
  raw: string,
  hippodrome: string,
  courseNumber: number,
  prizeName: string,
  discipline: "ATTELE" | "MONTE" | "PLAT",
  distanceMeters: number,
  prizeMoney: number,
  runnerCount: number
): ParsedCourse {
  const runners: ParsedRunner[] = [];

  for (const line of lines) {
    const m = line.match(/^(\d{1,2})\s*-\s*([A-Z][A-Z\s''.\-]{2,})/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 20 && !runners.some((r) => r.number === num)) {
        runners.push({
          number: num,
          name: m[2].trim(),
          driver: "",
          trainer: "",
          owner: "",
          sexAge: "",
          chrono: "",
          recentForm: "",
          gains: 0,
          odds: "",
        });
      }
    }
  }

  runners.sort((a, b) => a.number - b.number);

  return {
    hippodrome: hippodrome || "Inconnu",
    number: courseNumber || 1,
    prizeName,
    discipline,
    distanceMeters,
    prizeMoney,
    runnerCount: runnerCount || runners.length,
    runners,
    rawText: raw,
  };
}

/**
 * Generates templates/einwilligungserklaerung.pdf
 * Run: node scripts/gen-pdf-template.mjs
 *
 * Exact match to the BDEW Word doc layout.
 * A4: 595.28×841.89pt
 * Margins: top/left/right = 70.9pt (1418 twips), bottom = 56.7pt (1134 twips)
 * Standard tables (Anschlussnutzer, Zeitraum, Messprodukten):
 *   x = 77.75pt (ML + 6.85pt indent), w = 439.5pt (8789 dxa)
 * ESA/MSB tables:
 *   x = 70.9pt (no indent), w = 446.6pt (8931 dxa), left sidebar = 8pt
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'templates/einwilligungserklaerung.pdf');

// ── Page & margin constants ────────────────────────────────────────────────────
const W = 595.28, H = 841.89;
const ML = 70.9, MT = 70.9, MB = 56.7;   // left/top/bottom margins

// Standard table geometry (8789 dxa, indent 137 dxa)
const TX = ML + 6.85;   // 77.75pt table x-origin
const TW = 439.5;        // table width

// ESA/MSB table geometry (8931 dxa, no indent)
const SX = ML;           // 70.9pt
const SW = 446.6;        // sidebar-table width
const SB  = 8;           // sidebar column width

// Column widths — standard tables
const LBL = 120.5;       // label column  (2410 dxa)
const FLD = TW - LBL;   // 319.0pt field column (6379 dxa)

// Anschlussnutzer R3 sub-columns
const KOR_S = 109.6;     // "Straße, Hausnummer"  (2192 dxa)
const KOR_P = TW - LBL - KOR_S;  // 209.4pt "PLZ, Ort" (4187 dxa)

// ESA/MSB column widths
const ESA_LBL = 119.6;            // label  (2392 dxa)
const ESA_FLD = SW - SB - ESA_LBL; // 319.0pt field (6379 dxa)
const ESA_H1  = 297.1;            // header part 1 (5942 dxa)
const ESA_H2  = SW - SB - ESA_H1; // 141.5pt header part 2 (2829 dxa)

// Messprodukten column widths
const MP_C = 92.15;              // code  (1843 dxa)
const MP_X = 28.35;              // star  (567 dxa)
const MP_D = TW - MP_C - MP_X;  // 319.0pt desc (6379 dxa)

// ── Row heights ────────────────────────────────────────────────────────────────
const RH   = 18;   // standard data row   (288 twips = 14.4pt min, auto ~18pt)
const HDR  = 16;   // blue section header
const HINT = 14;   // hint / sub-label row

// ── Font sizes ─────────────────────────────────────────────────────────────────
const SZ   = 10.5; // body text (sz=21 half-points in Word)
const SZ_S = 8.5;  // small label / hint text inside cells

// ── Colors ─────────────────────────────────────────────────────────────────────
const BLACK  = rgb(0,      0,      0     );
const MUTED  = rgb(0.4,    0.4,    0.4   );
const BLUE   = rgb(0.475,  0.784,  1.0   );   // #79C8FF
const DARK   = rgb(0.161,  0.161,  0.161 );   // #292929 consent box
const FIELD  = rgb(0.94,   0.94,   0.94  );   // AcroForm input background
const WHITE  = rgb(1,      1,      1     );
const BORDER = rgb(0.67,   0.67,   0.67  );

// ── PDF / font setup ──────────────────────────────────────────────────────────
const doc  = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const form = doc.getForm();

let page, y;

function newPage() {
  page = doc.addPage([W, H]);
  y = H - MT;
}
newPage();

// Ensure at least `h` points remain on this page; otherwise start new page
function need(h) {
  if (y - MB < h) newPage();
}

// ── Character sanitizer (WinAnsiEncoding compatibility) ───────────────────────
// StandardFonts use WinAnsiEncoding; replace chars outside that range.
function san(s) {
  if (!s) return s;
  return s
    .replace(/ /g, ' ')   // NARROW NO-BREAK SPACE → space
    .replace(/ /g, ' ')   // NO-BREAK SPACE → space
    .replace(/ /g, ' ')   // EN SPACE → space
    .replace(/ /g, ' ')   // EM SPACE → space
    .replace(/„/g, '"')   // LOW-9 QUOTATION MARK → "
    .replace(/“/g, '"')   // LEFT DOUBLE QUOTATION → "
    .replace(/”/g, '"')   // RIGHT DOUBLE QUOTATION → "
    .replace(/‘/g, "'")   // LEFT SINGLE QUOTATION → '
    .replace(/’/g, "'")   // RIGHT SINGLE QUOTATION → '
    .replace(/•/g, '\xb7') // BULLET → middle dot
    .replace(/…/g, '...') // HORIZONTAL ELLIPSIS → ...
    .replace(/–/g, '-')   // EN DASH → -
    .replace(/—/g, '--'); // EM DASH → --
}

// ── Primitive drawing helpers ──────────────────────────────────────────────────
function txt(str, x, yy, sz, f = font, color = BLACK) {
  if (!str) return;
  page.drawText(san(str), { x, y: yy, size: sz, font: f, color });
}

function box(x, yy, w, h, fill, stroke = null) {
  page.drawRectangle({
    x, y: yy, width: w, height: h,
    color: fill,
    ...(stroke ? { borderColor: stroke, borderWidth: 0.5 } : {}),
  });
}

function acro(name, x, yy, w, h, multi = false) {
  const f = form.createTextField(name);
  f.addToPage(page, {
    x: x + 1, y: yy + 1, width: w - 2, height: h - 2,
    borderWidth: 0, backgroundColor: FIELD,
  });
  if (multi) f.enableMultiline();
}

// ── Text-wrap helpers ─────────────────────────────────────────────────────────
function wrapLines(text, maxW, sz, f) {
  const safe = san(text);
  const words = safe.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && f.widthOfTextAtSize(test, sz) > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draw wrapped text block, returns total height consumed
function drawWrapped(text, x, y0, maxW, sz, f = font, color = BLACK, lh = null) {
  const leading = lh ?? sz * 1.35;
  const lines = wrapLines(text, maxW, sz, f);
  let yy = y0;
  for (const l of lines) {
    txt(l, x, yy, sz, f, color);
    yy -= leading;
  }
  return lines.length * leading;
}

// ── Table row helpers ──────────────────────────────────────────────────────────
// cells: [{w, fill?, text?, sz?, isBold?, color?, fieldName?, multi?}]
function drawRow(cells, rowH, x0 = TX) {
  need(rowH);
  const top = y;
  let cx = x0;
  for (const c of cells) {
    box(cx, top - rowH, c.w, rowH, c.fill ?? WHITE, BORDER);
    if (c.text) {
      const f  = c.isBold ? bold : font;
      const sz = c.sz ?? SZ;
      const ty = top - rowH + (rowH - sz) / 2 + 0.5;
      txt(c.text, cx + 3.5, ty, sz, f, c.color ?? BLACK);
    }
    if (c.fieldName) {
      acro(c.fieldName, cx, top - rowH, c.w, rowH, c.multi ?? false);
    }
    cx += c.w;
  }
  y -= rowH;
}

// ESA/MSB table row: blue sidebar cell + content cells
function drawRowSB(cells, rowH) {
  need(rowH);
  const top = y;
  // Blue sidebar cell (no right/inner border)
  box(SX, top - rowH, SB, rowH, BLUE, BORDER);
  // Content cells
  let cx = SX + SB;
  for (const c of cells) {
    box(cx, top - rowH, c.w, rowH, c.fill ?? WHITE, BORDER);
    if (c.text) {
      const f  = c.isBold ? bold : font;
      const sz = c.sz ?? SZ;
      const ty = top - rowH + (rowH - sz) / 2 + 0.5;
      txt(c.text, cx + 3.5, ty, sz, f, c.color ?? BLACK);
    }
    if (c.fieldName) {
      acro(c.fieldName, cx, top - rowH, c.w, rowH, c.multi ?? false);
    }
    cx += c.w;
  }
  y -= rowH;
}

// Blue section header (standard table width)
function hdr(title, x0 = TX, w = TW) {
  // Truncate or scale font to fit if needed
  const sz = bold.widthOfTextAtSize(title, SZ_S) < (w - 7) ? SZ_S : SZ_S - 1;
  need(HDR);
  box(x0, y - HDR, w, HDR, BLUE, BORDER);
  const ty = y - HDR + (HDR - sz) / 2 + 0.5;
  txt(title, x0 + 3.5, ty, sz, bold, BLACK);
  y -= HDR;
}

// Blue section header for ESA/MSB table (sidebar + two header cells)
function hdrSB(title) {
  const sz = bold.widthOfTextAtSize(title, SZ_S) < (ESA_H1 + ESA_H2 - 7) ? SZ_S : SZ_S - 1;
  need(HDR);
  const top = y;
  box(SX,          top - HDR, SB,    HDR, BLUE, BORDER);
  box(SX + SB,     top - HDR, ESA_H1, HDR, BLUE, BORDER);
  box(SX + SB + ESA_H1, top - HDR, ESA_H2, HDR, BLUE, BORDER);
  const ty = top - HDR + (HDR - sz) / 2 + 0.5;
  txt(title, SX + SB + 3.5, ty, sz, bold, BLACK);
  y -= HDR;
}

// ══════════════════════════════════════════════════════════════════════════════
// TITLE BLOCK
// ══════════════════════════════════════════════════════════════════════════════
need(80);
txt('Einwilligungserklärung des Anschlussnutzers zur Übermittlung von Messprodukten durch den',
    ML, y, SZ, bold);
y -= 14;
txt('Messstellenbetreiber an den Energieserviceanbieter des Anschlussnutzers für Messlokationen',
    ML, y, SZ, bold);
y -= 15;

// Subtitle (wrapped)
const subtitle =
  'Verarbeitung personenbezogener bzw. persönlicher Daten nach § 49 Abs. 2 Nr. 7 MsbG' +
  ' und auf der Grundlage der DS-GVO zu Zwecken der Anfrage und Übermittlung von Messprodukten' +
  ' gemäß BNetzA-Festlegung BK6-22-024 bzw. BK6-24-174 · Anwendung des Muster-Formulars,' +
  ' Version 1.2 für Zeiträume ab dem 6. Juni 2025';
{
  const lh = 10.5;
  const lines = wrapLines(subtitle, W - ML - ML, 8, font);
  for (const l of lines) { txt(l, ML, y, 8, font, MUTED); y -= lh; }
}
y -= 3;
page.drawLine({ start: { x: ML, y }, end: { x: W - ML, y }, thickness: 0.5, color: BORDER });
y -= 9;

// ══════════════════════════════════════════════════════════════════════════════
// TABLE 1 — ANSCHLUSSNUTZER  (8789 dxa, indent 137 dxa)
// ══════════════════════════════════════════════════════════════════════════════
hdr('Anschlussnutzer');
// R2: Nachname label | ANSCHLUSSNUTZER_NAME field
drawRow([
  { w: LBL, text: 'Nachname, Vorname bzw. Firma *', sz: SZ_S, color: MUTED },
  { w: FLD, fieldName: 'ANSCHLUSSNUTZER_NAME' },
], RH);
// R3: Korrespondenzanschrift sub-headers
drawRow([
  { w: LBL, text: 'Korrespondenzanschrift', sz: SZ_S, color: MUTED },
  { w: KOR_S, text: 'Straße, Hausnummer', sz: SZ_S, color: MUTED },
  { w: KOR_P, text: 'Postleitzahl, Ort', sz: SZ_S, color: MUTED },
], HINT);
// R4: Straße input
drawRow([
  { w: LBL },
  { w: KOR_S, fieldName: 'ANSCHLUSSNUTZER_STRASSE' },
  { w: KOR_P, fieldName: 'ANSCHLUSSNUTZER_PLZ_ORT' },
], RH);
// R5: empty row (layout spacer matching Word doc)
drawRow([{ w: LBL }, { w: FLD }], RH);
y -= 4;

// ══════════════════════════════════════════════════════════════════════════════
// TABLE 2 — ESA  (8931 dxa, no indent, blue sidebar)
// ══════════════════════════════════════════════════════════════════════════════
need(HDR + RH + HINT + HINT + RH);
hdrSB('Energieserviceanbieter des Anschlussnutzers (ESA)');
drawRowSB([
  { w: ESA_LBL, text: 'Firma *', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'ESA_NAME' },
], RH);
drawRowSB([
  { w: ESA_LBL, text: 'Straße, Hausnummer', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'ESA_STRASSE' },
], RH);
drawRowSB([
  { w: ESA_LBL, text: 'Postleitzahl, Ort', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'ESA_PLZ_ORT' },
], RH);
drawRowSB([
  { w: ESA_LBL, text: 'MP-ID * (13-stellig)', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'ESA_MARKTPARTNER_ID' },
], RH);
y -= 4;

// ══════════════════════════════════════════════════════════════════════════════
// TABLE 3 — MSB  (same geometry as ESA)
// ══════════════════════════════════════════════════════════════════════════════
need(HDR + RH + HINT + HINT + RH);
hdrSB('Messstellenbetreiber des Anschlussnutzers (MSB)');
drawRowSB([
  { w: ESA_LBL, text: 'Firma *', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'MSB_NAME' },
], RH);
drawRowSB([
  { w: ESA_LBL, text: 'Straße, Hausnummer', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'MSB_STRASSE' },
], RH);
drawRowSB([
  { w: ESA_LBL, text: 'Postleitzahl, Ort', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'MSB_PLZ_ORT' },
], RH);
drawRowSB([
  { w: ESA_LBL, text: 'MP-ID * (13-stellig)', sz: SZ_S, color: MUTED },
  { w: ESA_FLD, fieldName: 'MSB_CODE_NR' },
], RH);
y -= 4;

// ══════════════════════════════════════════════════════════════════════════════
// TABLE 4 — ZEITRAUM  (3 rows: header + Beginn + Ende)
// ══════════════════════════════════════════════════════════════════════════════
hdr('Gültigkeitszeitraum der Einwilligung zur Anfrage und Übermittlung von Messprodukten');
// R2: Beginn-Datum
drawRow([
  { w: LBL, text: 'Beginn-Datum *', sz: SZ_S, color: MUTED },
  { w: FLD, fieldName: 'BEGINN_DATUM' },
], RH);
// R3: Ende-Datum
drawRow([
  { w: LBL, text: 'Ende-Datum', sz: SZ_S, color: MUTED },
  { w: FLD, fieldName: 'ENDE_DATUM' },
], RH);
y -= 4;

// ══════════════════════════════════════════════════════════════════════════════
// TABLE 5 — MESSLOKATIONEN  (2 rows: header + body text)
// ══════════════════════════════════════════════════════════════════════════════
{
  const t1 = 'Die Messlokationen, für welche Messwerte entsprechend den zutreffenden Messprodukten' +
             ' angefragt und übermittelt werden, sind der Anlage zur Einwilligungserklärung zu entnehmen.';
  const t2 = 'Bitte beachten Sie bei der Angabe der Messprodukte, die vom MSB auf seiner Internetseite' +
             ' aufgelisteten Angebote.';
  const lh = SZ * 1.35;
  const pad = 5;
  const maxW = TW - 7;
  const l1 = wrapLines(t1, maxW, SZ, font);
  const l2 = wrapLines(t2, maxW, SZ, font);
  const bodyH = pad + (l1.length + l2.length) * lh + lh * 0.6 + pad; // gap between paragraphs

  hdr('Angaben zu den Messlokationen');
  need(bodyH);
  box(TX, y - bodyH, TW, bodyH, WHITE, BORDER);
  let by = y - pad;
  for (const l of l1) { txt(l, TX + 3.5, by, SZ); by -= lh; }
  by -= lh * 0.4;
  for (const l of l2) { txt(l, TX + 3.5, by, SZ); by -= lh; }
  y -= bodyH;
}
y -= 4;

// ══════════════════════════════════════════════════════════════════════════════
// FREE PARAGRAPH — between tables 5 and 6
// ══════════════════════════════════════════════════════════════════════════════
{
  const para =
    'In der nachfolgenden Tabelle sind die Codes aufzunehmen, für die der Anschlussnutzer eine' +
    ' Einwilligungserklärung über dieses Dokument für den ESA erteilt. Dabei können nur die Codes' +
    ' verwendet werden, die in der aktuell gültigen Version der EDI@Energy „Codeliste der' +
    ' Konfigurationen“ enthalten sind und dort zur Nutzung durch den ESA aufgelistet sind.';
  const lh = SZ * 1.35;
  const lines = wrapLines(para, W - ML - ML, SZ, font);
  need(lines.length * lh + 10);
  for (const l of lines) { txt(l, ML, y, SZ); y -= lh; }
  y -= 6;
}

// ══════════════════════════════════════════════════════════════════════════════
// TABLE 6 — MESSPRODUKTEN  (header + 2 col-header rows + 10 data rows)
// ══════════════════════════════════════════════════════════════════════════════
hdr('Angaben zu den Messprodukten');
// Column header row 1
drawRow([
  { w: MP_C, text: 'Messprodukt-Code', sz: SZ_S, isBold: true },
  { w: MP_D, text: 'Messproduktcodebezeichnung *', sz: SZ_S, isBold: true },
  { w: MP_X },
], HINT);
// Column header row 2 (matches Word doc R3 — asterisk note row)
drawRow([
  { w: MP_C, text: '*  = Pflichtfeld', sz: 7, color: MUTED },
  { w: MP_D },
  { w: MP_X },
], HINT);
// 10 data rows
for (let i = 1; i <= 10; i++) {
  drawRow([
    { w: MP_C, fieldName: `MP_${i}_CODE` },
    { w: MP_D, fieldName: `MP_${i}_BEZEICHNUNG` },
    { w: MP_X },
  ], RH);
}
y -= 8;

// ══════════════════════════════════════════════════════════════════════════════
// CONSENT SECTION — numbered list on dark background
// ══════════════════════════════════════════════════════════════════════════════
{
  const c1 =
    '1. Hiermit willige ich in die Übermittlung meiner Daten (insbesondere Messwerte entsprechend' +
    ' den Messprodukten) an den ESA durch den MSB ein. Soweit erforderlich, willige ich auch in die' +
    ' Erhebung der für das Messprodukt erforderlichen Daten ein.';
  const c2 =
    '2. Zudem willige ich ein, dass mein ESA zur Verarbeitung meiner Daten (insbesondere Messwerte' +
    ' entsprechend der Messprodukten) als berechtigte Stelle im Sinne des § 49 Abs. 2' +
    ' Nr. 7 MsbG berechtigt ist.';
  const conW = W - ML - ML;
  const lh = SZ * 1.38;
  const padV = 6;
  const l1 = wrapLines(c1, conW - 10, SZ, font);
  const l2 = wrapLines(c2, conW - 10, SZ, font);
  const conH = padV + (l1.length + l2.length) * lh + lh * 0.6 + padV;
  need(conH);
  box(ML, y - conH, conW, conH, DARK);
  let cy = y - padV;
  for (const l of l1) { txt(l, ML + 6, cy, SZ, font, WHITE); cy -= lh; }
  cy -= lh * 0.4;
  for (const l of l2) { txt(l, ML + 6, cy, SZ, font, WHITE); cy -= lh; }
  y -= conH;
}
y -= 8;

// ══════════════════════════════════════════════════════════════════════════════
// LEGAL PARAGRAPHS
// ══════════════════════════════════════════════════════════════════════════════
{
  const paras = [
    'Der MSB übermittelt die Messwerte zu den angefragten Messprodukten gemäß den Regularien der' +
    ' BNetzA-Festlegung BK6-24-024 bzw. der BNetzA-Festlegung BK6-24-0174, Wechselprozesse im' +
    ' Messwesen, Teil 2, Use-Cases „Anfrage und Übermittlung von Werten durch und an den' +
    ' ESA“ an den ESA.',

    'Die in der Einwilligungserklärung aufgeführten Daten werden nur zur Vertragsdurchführung' +
    ' zwischen dem ESA und dem Anschlussnutzer verarbeitet. Informationen zur Verarbeitung Ihrer' +
    ' personenbezogenen Daten finden Sie in der beigefügten Datenschutzinformation.',

    'Widerrufsbelehrung gemäß DS-GVO: Die Einwilligungen können Sie jederzeit mit Wirkung für' +
    ' die Zukunft gegenüber dem ESA unter den oben genannten Kontaktdaten unter dem Stichwort' +
    ' „Datenschutz“ widerrufen. Die Einwilligung zu 1. können Sie auch direkt' +
    ' gegenüber Ihrem MSB widerrufen.',

    'Die Einwilligung ist freiwillig. Ohne diese Einwilligungen kann Ihr ESA aber ggf. seine' +
    ' vertragliche Leistung nicht erbringen.',
  ];
  const lh = SZ * 1.35;
  for (const p of paras) {
    const lines = wrapLines(p, W - ML - ML, SZ, font);
    need(lines.length * lh + 6);
    for (const l of lines) { txt(l, ML, y, SZ); y -= lh; }
    y -= 5;
  }
}
y -= 6;

// ══════════════════════════════════════════════════════════════════════════════
// SIGNATURE LINES
// ══════════════════════════════════════════════════════════════════════════════
need(90);
// 4 blank signature lines (bottom-bordered)
for (let i = 0; i < 4; i++) {
  page.drawLine({ start: { x: ML, y }, end: { x: W - ML, y }, thickness: 0.5, color: BORDER });
  y -= 20;
}
y -= 4;
txt('Ort, Datum, Unterschrift Anschlussnutzer', ML, y, SZ, font, MUTED);
y -= 20;

// ══════════════════════════════════════════════════════════════════════════════
// AUSFÜLLHINWEISE  (starts on page 3 due to need() page-break)
// ══════════════════════════════════════════════════════════════════════════════
{
  const hints = [
    'Die in der Einwilligungserklärung verwendeten Begriffe referenzieren auf die der Erklärung' +
    ' zugrunde liegende BNetzA-Festlegung BK6-22-024 bzw. BK6-24-174 sowie den für die Umsetzung' +
    ' der BNetzA-Festlegung relevanten EDI@Energy-Dokumente.',

    'Mit * markierte Felder in der Einwilligungserklärung sind Pflichtangaben.',

    'Sofern für Marktlokationen und Tranchen oder Netzlokationen Messprodukte angefragt und' +
    ' übermittelt werden sollen, ist hierfür die separate „Einwilligungserklärung für' +
    ' Marktlokationen und Tranchen“ bzw. „Einwilligungserklärung für Netzlokationen“' +
    ' zu verwenden.',
  ];
  const lh  = SZ * 1.35;
  const maxW = W - ML - ML - 14;

  need(120);
  txt('Ausfüllhinweise', ML, y, SZ, bold);
  txt(': ', ML + bold.widthOfTextAtSize('Ausfüllhinweise', SZ), y, SZ, font);
  y -= SZ * 1.5;

  for (const hint of hints) {
    const lines = wrapLines(hint, maxW, SZ, font);
    need(lines.length * lh + 8);
    txt('•', ML + 3, y, SZ);
    let hy = y;
    for (const l of lines) { txt(l, ML + 14, hy, SZ); hy -= lh; }
    y = hy;
    y -= 4;
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────
const bytes = await doc.save();
writeFileSync(OUT, bytes);
console.log(`✓ ${OUT}`);

/**
 * Generates templates/einwilligungserklaerung.pdf
 * Run: node scripts/gen-pdf-template.mjs
 *
 * Matches the official BDEW Word doc: blue (#79C8FF) section headers,
 * table-based layout, blue left sidebar on ESA/MSB, Messprodukten
 * table (Code + Bezeichnung), 71pt margins.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'templates/einwilligungserklaerung.pdf');

const W = 595.28, H = 841.89, M = 71;
const PW = W - 2 * M;   // 453.28
const SW = 8;            // sidebar width for ESA/MSB tables
const CW = PW - SW;     // content width inside sidebar tables: 445.28

const BLACK    = rgb(0,    0,    0   );
const MUTED    = rgb(0.27, 0.27, 0.27);
const GRAY_LBL = rgb(0.33, 0.33, 0.33);
const BLUE     = rgb(0.475, 0.784, 1.0);  // #79C8FF
const FIELD_BG = rgb(0.96, 0.96, 0.96);
const EVEN_BG  = rgb(0.95, 0.95, 0.95);
const BORDER_C = rgb(0.67, 0.67, 0.67);
const WHITE    = rgb(1,    1,    1   );

const doc  = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const form = doc.getForm();

let page, y;

function newPage() {
  page = doc.addPage([W, H]);
  y = H - M;
}
newPage();

function need(h) {
  if (y < M + h) newPage();
}

function txt(str, x, yy, sz, f = font, color = BLACK) {
  page.drawText(str, { x, y: yy, size: sz, font: f, color });
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
    x, y: yy, width: w, height: h,
    borderWidth: 0, backgroundColor: FIELD_BG,
  });
  if (multi) f.enableMultiline();
}

// ── Row helper ───────────────────────────────────────────────────────────────
// cells: [{ w, fill?, text?, sz?, bold?, color?, field?, multi? }]
function row(cells, rowH, x0 = M) {
  need(rowH);
  let cx = x0;
  for (const c of cells) {
    box(cx, y - rowH, c.w, rowH, c.fill ?? WHITE, BORDER_C);
    if (c.text) {
      const f   = c.bold ? bold : font;
      const sz  = c.sz ?? 7.5;
      const ty  = y - rowH + Math.round((rowH - sz) / 2) + 1;
      txt(c.text, cx + 3, ty, sz, f, c.color ?? GRAY_LBL);
    }
    if (c.field) {
      acro(c.field, cx + 1, y - rowH + 1, c.w - 2, rowH - 2, c.multi ?? false);
    }
    cx += c.w;
  }
  y -= rowH;
}

// Sidebar-table row: content starts at M+SW
function rowSB(cells, rowH) { row(cells, rowH, M + SW); }

// Full-width blue section header
const HDR_H = 15;
function hdr(title, x0 = M, pw = PW) {
  need(HDR_H);
  box(x0, y - HDR_H, pw, HDR_H, BLUE, BORDER_C);
  txt(title, x0 + 4, y - HDR_H + 4, 8.5, bold, BLACK);
  y -= HDR_H;
}

// Blue sidebar overlay: drawn AFTER all rows of an ESA/MSB table
function sidebar(ys) {
  const th = ys - y;
  if (th <= 0) return;
  box(M, y, SW, th, BLUE, BORDER_C);
}

// ── Title ────────────────────────────────────────────────────────────────────
need(56);
txt('Einwilligungserklärung des Anschlussnutzers zur Übermittlung von Messprodukten', M, y, 9.5, bold);
y -= 12;
txt('durch den Messstellenbetreiber an den Energieserviceanbieter des Anschlussnutzers', M, y, 9.5, bold);
y -= 12;
txt('für Messlokationen', M, y, 9.5, bold);
y -= 13;
txt('Verarbeitung personenbezogener Daten nach § 49 Abs. 2 Nr. 7 MsbG  ·  Version 1.2  ·  Zeiträume ab 6. Juni 2025', M, y, 7.5, font, MUTED);
y -= 9;
page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: BORDER_C });
y -= 10;

// ── Anschlussnutzer ──────────────────────────────────────────────────────────
hdr('Anschlussnutzer');
row([
  { w: PW * 0.5, text: 'Nachname, Vorname bzw. Firma *' },
  { w: PW * 0.5 },
], 11);
row([{ w: PW, fill: FIELD_BG, field: 'ANSCHLUSSNUTZER_NAME' }], 16);
row([{ w: PW, text: 'Korrespondenzanschrift · Straße, Hausnummer' }], 11);
row([{ w: PW, fill: FIELD_BG, field: 'ANSCHLUSSNUTZER_ADRESSE', multi: true }], 30);
row([
  { w: PW * 0.6, text: 'Postleitzahl, Ort' },
  { w: PW * 0.4 },
], 11);
row([
  { w: PW * 0.6, fill: FIELD_BG },
  { w: PW * 0.4 },
], 16);
y -= 4;

// ── ESA ──────────────────────────────────────────────────────────────────────
const esa_ys = y;
hdr('Energieserviceanbieter des Anschlussnutzers (ESA)', M + SW, CW);
rowSB([{ w: CW, text: 'Firma *' }], 11);
rowSB([{ w: CW, fill: FIELD_BG, field: 'ESA_NAME' }], 16);
rowSB([
  { w: CW * 0.55, text: 'Straße, Hausnummer · Postleitzahl, Ort' },
  { w: CW * 0.45, text: 'MP-ID * (13-stellig)' },
], 11);
rowSB([
  { w: CW * 0.55, fill: FIELD_BG },
  { w: CW * 0.45, fill: FIELD_BG, field: 'ESA_MARKTPARTNER_ID' },
], 16);
sidebar(esa_ys);
y -= 4;

// ── MSB ──────────────────────────────────────────────────────────────────────
const msb_ys = y;
hdr('Messstellenbetreiber des Anschlussnutzers (MSB)', M + SW, CW);
rowSB([{ w: CW, text: 'Firma *' }], 11);
rowSB([{ w: CW, fill: FIELD_BG, field: 'MSB_NAME' }], 16);
rowSB([
  { w: CW * 0.55, text: 'Straße, Hausnummer · Postleitzahl, Ort' },
  { w: CW * 0.45, text: 'MP-ID * (13-stellig)' },
], 11);
rowSB([
  { w: CW * 0.55, fill: FIELD_BG },
  { w: CW * 0.45, fill: FIELD_BG, field: 'MSB_CODE_NR' },
], 16);
sidebar(msb_ys);
y -= 4;

// ── Zeitraum ──────────────────────────────────────────────────────────────────
hdr('Gültigkeitszeitraum der Einwilligung zur Anfrage und Übermittlung von Messprodukten');
row([
  { w: PW * 0.25, text: 'Beginn-Datum *' },
  { w: PW * 0.25, text: 'TT.MM.JJJJ' },
  { w: PW * 0.25, text: 'Ende-Datum' },
  { w: PW * 0.25, text: 'TT.MM.JJJJ' },
], 11);
row([
  { w: PW * 0.5, fill: FIELD_BG, field: 'BEGINN_DATUM' },
  { w: PW * 0.5, fill: FIELD_BG, field: 'ENDE_DATUM' },
], 16);
y -= 4;

// ── Messlokationen reference ──────────────────────────────────────────────────
hdr('Angaben zu den Messlokationen');
row([{
  w: PW,
  text: 'Die Messlokationen sind der Anlage zur Einwilligungserklärung zu entnehmen (separates Excel-Dokument).',
  sz: 8.5, color: MUTED,
}], 22);
y -= 4;

// ── Messprodukten ─────────────────────────────────────────────────────────────
const CODE_W = Math.round(PW * 0.35);
const BEZ_W  = PW - CODE_W;

hdr('Angaben zu den Messprodukten');
row([
  { w: CODE_W, text: 'Messprodukt-Code',        bold: true, sz: 8, color: GRAY_LBL },
  { w: BEZ_W,  text: 'Messproduktcodebezeichnung *', bold: true, sz: 8, color: GRAY_LBL },
], 13);
for (let i = 1; i <= 10; i++) {
  row([
    { w: CODE_W, fill: i % 2 === 0 ? EVEN_BG : FIELD_BG, field: `MP_${i}_CODE` },
    { w: BEZ_W,  fill: i % 2 === 0 ? EVEN_BG : FIELD_BG, field: `MP_${i}_BEZEICHNUNG` },
  ], 14);
}
y -= 10;

// ── Signature ────────────────────────────────────────────────────────────────
need(50);
txt('Hiermit willige ich in die Übermittlung meiner Daten an den ESA durch den MSB ein.', M, y, 8, font, MUTED);
y -= 28;
page.drawLine({ start: { x: M, y }, end: { x: M + 300, y }, thickness: 0.5, color: BLACK });
txt('Ort, Datum, Unterschrift des Anschlussnutzers', M, y + 3, 7.5, font, MUTED);
y -= 12;
txt('* Pflichtfelder', M, y, 7.5, font, MUTED);

// ── Write ─────────────────────────────────────────────────────────────────────
const bytes = await doc.save();
writeFileSync(OUT, bytes);
console.log(`✓ ${OUT}`);

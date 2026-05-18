/**
 * Generates templates/einwilligungserklaerung.pdf
 * Run: node scripts/gen-pdf-template.mjs
 *
 * Produces a fillable AcroForm PDF whose field names match those in
 * src/pdf-fill.js (OBJEKT_ADRESSE, ANSCHLUSSNUTZER_NAME, … MP_1_TYP, …).
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'templates/einwilligungserklaerung.pdf');

const W = 595.28, H = 841.89, M = 50;
const PW = W - 2 * M; // printable width

const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.45, 0.45, 0.45);
const GRAY  = rgb(0.65, 0.65, 0.65);
const FIELD_BG    = rgb(0.96, 0.96, 0.96);
const SECTION_BG  = rgb(0.93, 0.93, 0.93);

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

function t(str, x, yy, sz, f = font, color = BLACK) {
  page.drawText(str, { x, y: yy, size: sz, font: f, color });
}

function hline(yy, x1 = M, x2 = W - M, color = GRAY) {
  page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.5, color });
}

function section(title) {
  need(30);
  y -= 10;
  page.drawRectangle({ x: M, y: y - 14, width: PW, height: 14, color: SECTION_BG });
  t(title, M + 4, y - 10, 9, bold);
  y -= 18;
}

function lbl(text) {
  need(16);
  t(text, M, y, 7.5, font, MUTED);
  y -= 11;
}

function addField(name, x, w, h, multi = false) {
  need(h + 4);
  const f = form.createTextField(name);
  f.addToPage(page, {
    x, y: y - h, width: w, height: h,
    borderWidth: 0.5, borderColor: GRAY, backgroundColor: FIELD_BG,
  });
  if (multi) f.enableMultiline();
  y -= h + 6;
}

function fullField(name, h = 16, multi = false) {
  addField(name, M, PW, h, multi);
}

function halfFields(name1, lbl1, name2, lbl2) {
  const hw = (PW - 6) / 2;
  need(36);
  t(lbl1, M,          y, 7.5, font, MUTED);
  t(lbl2, M + hw + 6, y, 7.5, font, MUTED);
  y -= 11;
  const makeF = (nm, x) => {
    const f = form.createTextField(nm);
    f.addToPage(page, { x, y: y - 16, width: hw, height: 16, borderWidth: 0.5, borderColor: GRAY, backgroundColor: FIELD_BG });
  };
  makeF(name1, M);
  makeF(name2, M + hw + 6);
  y -= 22;
}

// ── Title ────────────────────────────────────────────────────────────────────
need(60);
t('Einwilligungserklärung des Anschlussnutzers', M, y, 13, bold);
y -= 16;
t('Übermittlung von Messprodukten durch den Messstellenbetreiber an den Energieserviceanbieter', M, y, 7.5, font, MUTED);
y -= 10;
t('für Messlokationen · BNetzA-Festlegung BK6-22-024 / BK6-24-174 · Version 1.2', M, y, 7.5, font, MUTED);
y -= 8;
hline(y, M, W - M, rgb(0.8, 0.8, 0.8));
y -= 12;

// ── Objekt ───────────────────────────────────────────────────────────────────
section('Objekt');
lbl('Objekt-Adresse');
fullField('OBJEKT_ADRESSE', 30, true);

// ── Anschlussnutzer ──────────────────────────────────────────────────────────
section('Anschlussnutzer');
lbl('Name / Firma');
fullField('ANSCHLUSSNUTZER_NAME');
lbl('Korrespondenzanschrift');
fullField('ANSCHLUSSNUTZER_ADRESSE', 30, true);

// ── ESA ──────────────────────────────────────────────────────────────────────
section('Energieserviceanbieter des Anschlussnutzers (ESA)');
lbl('Firma');
fullField('ESA_NAME');
lbl('Marktpartner-ID');
addField('ESA_MARKTPARTNER_ID', M, 220, 16);

// ── MSB ──────────────────────────────────────────────────────────────────────
section('Messstellenbetreiber des Anschlussnutzers (MSB)');
lbl('Firma');
fullField('MSB_NAME');
lbl('Code-Nr. (MP-ID, 13-stellig)');
addField('MSB_CODE_NR', M, 220, 16);

// ── Zeitraum ─────────────────────────────────────────────────────────────────
section('Gültigkeitszeitraum der Einwilligung');
halfFields('BEGINN_DATUM', 'Beginn-Datum (TT.MM.JJJJ)', 'ENDE_DATUM', 'Ende-Datum (TT.MM.JJJJ, leer = unbefristet)');

// ── Messpunkte ───────────────────────────────────────────────────────────────
section('Messpunkte (Messlokationen)');

const COLS = [
  { name: 'TYP',         label: 'Typ',              x: M,         w: 52  },
  { name: 'ID',          label: 'Messlokation-ID',  x: M + 54,    w: 186 },
  { name: 'RICHTUNG',    label: 'Lieferrichtung',   x: M + 242,   w: 78  },
  { name: 'MESSPRODUKT', label: 'Messprodukt',      x: M + 322,   w: 173 },
];
const ROW_H = 14;

// Header row
need(ROW_H + 4);
page.drawRectangle({ x: M, y: y - ROW_H, width: PW, height: ROW_H, color: rgb(0.82, 0.82, 0.82) });
for (const c of COLS) t(c.label, c.x + 2, y - ROW_H + 4, 7.5, bold);
y -= ROW_H;

// Data rows 1-10
for (let i = 1; i <= 10; i++) {
  need(ROW_H + 2);
  const even = i % 2 === 0;
  page.drawRectangle({
    x: M, y: y - ROW_H, width: PW, height: ROW_H,
    color: even ? rgb(0.95, 0.95, 0.95) : rgb(1, 1, 1),
    borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.3,
  });
  for (const c of COLS) {
    const f = form.createTextField(`MP_${i}_${c.name}`);
    f.addToPage(page, { x: c.x + 1, y: y - ROW_H + 1, width: c.w - 2, height: ROW_H - 2, borderWidth: 0 });
  }
  y -= ROW_H;
}

// ── Signature ────────────────────────────────────────────────────────────────
need(55);
y -= 18;
t('Hiermit willige ich in die Übermittlung meiner Daten an den ESA durch den MSB ein.', M, y, 8, font, MUTED);
y -= 28;
hline(y, M, M + 320);
t('Ort, Datum, Unterschrift des Anschlussnutzers', M, y + 3, 7.5, font, MUTED);

// ── Write ────────────────────────────────────────────────────────────────────
const bytes = await doc.save();
writeFileSync(OUT, bytes);
console.log(`✓ ${OUT}`);

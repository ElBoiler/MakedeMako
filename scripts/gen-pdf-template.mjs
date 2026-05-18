/**
 * Generates templates/einwilligungserklaerung.pdf
 * Run: node scripts/gen-pdf-template.mjs
 *
 * Matches the official BDEW Einwilligungserklärung (BK6-22-024 / BK6-24-174).
 * A4, Helvetica 10.5 pt, blue (#79C8FF) section headers, two pages.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'templates/einwilligungserklaerung.pdf');

const W = 595.28, H = 841.89, M = 71;   // A4, 71 pt margins
const PW = W - 2 * M;                    // 453.28 pt content width
const SW = 8;                            // sidebar width for ESA / MSB
const CW = PW - SW;                      // content inside sidebar: 445.28 pt

// ── Colours ──────────────────────────────────────────────────────────────────
const BLACK   = rgb(0,     0,     0    );
const DARK_BG = rgb(0.161, 0.161, 0.161); // #292929 — consent box background
const BLUE    = rgb(0.475, 0.784, 1.0  ); // #79C8FF — section headers / sidebar
const FLD_BG  = rgb(0.94,  0.94,  0.94 ); // input field background
const EVEN_BG = rgb(0.92,  0.92,  0.92 ); // alternating row in MP table
const BRD     = rgb(0.67,  0.67,  0.67 ); // border / rule colour
const WHITE   = rgb(1,     1,     1    );

// ── Sizes & row heights ───────────────────────────────────────────────────────
const SZ   = 10.5;   // standard text size (matches Word doc sz=21 = 10.5 pt)
const SZ_B = 11;     // consent / legal section text (Word sz=22 = 11 pt)

const LBL_H  = 14;   // label row height
const FLD_H  = 20;   // single-line input row height
const FLD_M  = 42;   // multi-line input row (Anschlussnutzer address)
const MP_H   = 18;   // Messprodukt table data row height

// ── pdf-lib setup ─────────────────────────────────────────────────────────────
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

function need(h) { if (y < M + h) newPage(); }

// ── Primitives ────────────────────────────────────────────────────────────────
function txt(str, x, yy, sz, f = font, color = BLACK) {
  page.drawText(str, { x, y: yy, size: sz, font: f, color });
}

/** Draw text centred on the page. */
function txtC(str, yy, sz, f = font, color = BLACK) {
  const w = f.widthOfTextAtSize(str, sz);
  const x = (W - w) / 2;
  page.drawText(str, { x, y: yy, size: sz, font: f, color });
}

function box(x, yy, w, h, fill, stroke = null) {
  page.drawRectangle({
    x, y: yy, width: w, height: h, color: fill,
    ...(stroke ? { borderColor: stroke, borderWidth: 0.5 } : {}),
  });
}

function acro(name, x, yy, w, h, multi = false) {
  const fld = form.createTextField(name);
  fld.addToPage(page, { x, y: yy, width: w, height: h, borderWidth: 0, backgroundColor: FLD_BG });
  if (multi) fld.enableMultiline();
}

// ── Text wrapping ─────────────────────────────────────────────────────────────
function wrapText(str, maxWidth, sz, f) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (f.widthOfTextAtSize(test, sz) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw a wrapped paragraph, returns y after last line. */
function drawPara(str, x, startY, maxW, sz = SZ, f = font, color = BLACK, lh = null) {
  const lineH = lh ?? sz + 3.5;
  const lines = wrapText(str, maxW, sz, f);
  let yy = startY;
  for (const ln of lines) {
    txt(ln, x, yy, sz, f, color);
    yy -= lineH;
  }
  return yy;
}

/** Height a wrapped paragraph + optional padding will occupy. */
function paraH(str, maxW, sz = SZ, f = font, pad = 0) {
  const lines = wrapText(str, maxW, sz, f);
  return Math.ceil(lines.length * (sz + 3.5) + pad);
}

// ── Table row ─────────────────────────────────────────────────────────────────
// cells: [{ w, fill?, text?, sz?, bold?, color?, wrap?, field?, multi? }]
function row(cells, rowH, x0 = M) {
  need(rowH);
  let cx = x0;
  for (const c of cells) {
    box(cx, y - rowH, c.w, rowH, c.fill ?? WHITE, BRD);
    const rf = c.bold ? bold : font;
    const rs = c.sz ?? SZ;
    if (c.text) {
      if (c.wrap) {
        // Multi-line cell text — top-aligned with 2.5 pt top padding
        const lines = wrapText(c.text, c.w - 8, rs, rf);
        const lh = rs + 3.5;
        let ty = y - rs - 2.5;
        for (const ln of lines) {
          txt(ln, cx + 4, ty, rs, rf, c.color ?? BLACK);
          ty -= lh;
        }
      } else {
        // Single-line cell text — vertically centred
        const ty = y - rowH + Math.round((rowH - rs) / 2) + 1;
        txt(c.text, cx + 4, ty, rs, rf, c.color ?? BLACK);
      }
    }
    if (c.field) {
      acro(c.field, cx + 1, y - rowH + 1, c.w - 2, rowH - 2, c.multi ?? false);
    }
    cx += c.w;
  }
  y -= rowH;
}

function rowSB(cells, rowH) { row(cells, rowH, M + SW); }

/** Blue section header row, auto-height to fit wrapped title text. */
function hdr(title, x0 = M, pw = PW) {
  const lines = wrapText(title, pw - 8, SZ, bold);
  const h = Math.max(16, lines.length === 1 ? 16 : lines.length * (SZ + 3) + 6);
  need(h);
  box(x0, y - h, pw, h, BLUE, BRD);
  if (lines.length === 1) {
    const ty = y - h + Math.round((h - SZ) / 2) + 1;
    txt(lines[0], x0 + 4, ty, SZ, bold, BLACK);
  } else {
    let ty = y - SZ - 3;
    for (const ln of lines) {
      txt(ln, x0 + 4, ty, SZ, bold, BLACK);
      ty -= SZ + 3;
    }
  }
  y -= h;
}

/** Blue sidebar drawn after all rows of an ESA/MSB table. */
function sidebar(ys) {
  const th = ys - y;
  if (th > 0) box(M, y, SW, th, BLUE, BRD);
}

/** Calculate row height needed for wrapped cell text (includes 7 pt padding). */
function cellH(text, cellW, sz = SZ, f = font) {
  return Math.ceil(paraH(text, cellW - 8, sz, f, 7));
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1
// ─────────────────────────────────────────────────────────────────────────────

// ── Title ─────────────────────────────────────────────────────────────────────
need(110);
y -= 4;
txtC('Einwilligungserklärung des Anschlussnutzers zur Übermittlung von Messprodukten durch den', y, SZ, bold);
y -= 14;
txtC('Messstellenbetreiber an den Energieserviceanbieter des Anschlussnutzers', y, SZ, bold);
y -= 14;
txtC('für Messlokationen', y, SZ, bold);
y -= 12;
txtC('Verarbeitung personenbezogener bzw. persönlicher Daten nach § 49 Abs. 2 Nr. 7 MsbG', y, SZ);
y -= 13;
txtC('und auf der Grundlage der DS-GVO zu Zwecken der Anfrage und Übermittlung von Messprodukten', y, SZ);
y -= 13;
txtC('gemäß BNetzA-Festlegung BK6-22-024 bzw. BK6-24-174', y, SZ);
y -= 13;
txtC('Anwendung des Muster-Formulars, Version 1.2 für Zeiträume ab dem 6. Juni 2025', y, SZ);
y -= 9;
page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: BRD });
y -= 8;

// ── Anschlussnutzer ───────────────────────────────────────────────────────────
hdr('Anschlussnutzer');
row([
  { w: PW * 0.55, text: 'Nachname, Vorname bzw. Firma *' },
  { w: PW * 0.45 },
], LBL_H);
row([{ w: PW, fill: FLD_BG, field: 'ANSCHLUSSNUTZER_NAME' }], FLD_H);
row([{ w: PW, text: 'Korrespondenzanschrift · Straße, Hausnummer' }], LBL_H);
row([{ w: PW, fill: FLD_BG, field: 'ANSCHLUSSNUTZER_ADRESSE', multi: true }], FLD_M);
row([
  { w: PW * 0.5, text: 'Postleitzahl, Ort' },
  { w: PW * 0.5 },
], LBL_H);
row([
  { w: PW * 0.5, fill: FLD_BG },
  { w: PW * 0.5 },
], FLD_H);
y -= 5;

// ── ESA ───────────────────────────────────────────────────────────────────────
const esa_ys = y;
hdr('Energieserviceanbieter des Anschlussnutzers (ESA)', M + SW, CW);
rowSB([{ w: CW, text: 'Firma *' }], LBL_H);
rowSB([{ w: CW, fill: FLD_BG, field: 'ESA_NAME' }], FLD_H);
rowSB([
  { w: CW * 0.55, text: 'Straße, Hausnummer · Postleitzahl, Ort' },
  { w: CW * 0.45, text: 'MP-ID * (13-stellig)' },
], LBL_H);
rowSB([
  { w: CW * 0.55, fill: FLD_BG },
  { w: CW * 0.45, fill: FLD_BG, field: 'ESA_MARKTPARTNER_ID' },
], FLD_H);
sidebar(esa_ys);
y -= 5;

// ── MSB ───────────────────────────────────────────────────────────────────────
const msb_ys = y;
hdr('Messstellenbetreiber des Anschlussnutzers (MSB)', M + SW, CW);
rowSB([{ w: CW, text: 'Firma *' }], LBL_H);
rowSB([{ w: CW, fill: FLD_BG, field: 'MSB_NAME' }], FLD_H);
rowSB([
  { w: CW * 0.55, text: 'Straße, Hausnummer · Postleitzahl, Ort' },
  { w: CW * 0.45, text: 'MP-ID * (13-stellig)' },
], LBL_H);
rowSB([
  { w: CW * 0.55, fill: FLD_BG },
  { w: CW * 0.45, fill: FLD_BG, field: 'MSB_CODE_NR' },
], FLD_H);
sidebar(msb_ys);
y -= 5;

// ── Zeitraum ──────────────────────────────────────────────────────────────────
hdr('Gültigkeitszeitraum der Einwilligung zur Anfrage und Übermittlung von Messprodukten');
row([
  { w: PW * 0.25, text: 'Beginn-Datum *' },
  { w: PW * 0.25, text: 'TT.MM.JJJJ' },
  { w: PW * 0.25, text: 'Ende-Datum' },
  { w: PW * 0.25, text: 'TT.MM.JJJJ' },
], LBL_H);
row([
  { w: PW * 0.5, fill: FLD_BG, field: 'BEGINN_DATUM' },
  { w: PW * 0.5, fill: FLD_BG, field: 'ENDE_DATUM' },
], FLD_H);
y -= 5;

// ── Messlokationen ────────────────────────────────────────────────────────────
const ML1 = 'Die Messlokationen, für welche Messwerte entsprechend den zutreffenden Messprodukten angefragt und übermittelt werden, sind der Anlage zur Einwilligungserklärung zu entnehmen.';
const ML2 = 'Bitte beachten Sie bei der Angabe der Messprodukte, die vom MSB auf seiner Internetseite aufgelisteten Angebote.';
hdr('Angaben zu den Messlokationen');
row([{ w: PW, text: ML1, wrap: true }], cellH(ML1, PW));
row([{ w: PW, text: ML2, wrap: true }], cellH(ML2, PW));
y -= 5;

// ── Messprodukten ─────────────────────────────────────────────────────────────
const MP_INTRO = 'In der nachfolgenden Tabelle sind die Codes aufzunehmen, für die der Anschlussnutzer eine Einwilligungserklärung über dieses Dokument für den ESA erteilt. Dabei können nur die Codes verwendet werden, die in der aktuell gültigen Version der EDI@Energy „Codeliste der Konfigurationen“ enthalten sind und dort zur Nutzung durch den ESA aufgelistet sind.';
hdr('Angaben zu den Messprodukten');
row([{ w: PW, text: MP_INTRO, wrap: true }], cellH(MP_INTRO, PW));

const CODE_W = Math.round(PW * 0.35);
const BEZ_W  = PW - CODE_W;
row([
  { w: CODE_W, text: 'Messprodukt-Code',             bold: true },
  { w: BEZ_W,  text: 'Messproduktcodebezeichnung *', bold: true },
], LBL_H + 2);
for (let i = 1; i <= 10; i++) {
  row([
    { w: CODE_W, fill: i % 2 === 0 ? EVEN_BG : FLD_BG, field: `MP_${i}_CODE` },
    { w: BEZ_W,  fill: i % 2 === 0 ? EVEN_BG : FLD_BG, field: `MP_${i}_BEZEICHNUNG` },
  ], MP_H);
}
y -= 10;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2  (content below will flow onto the second page via need())
// ─────────────────────────────────────────────────────────────────────────────

// ── Consent box (dark background, white text, numbered items) ─────────────────
const CONSENT_PAD = 10;
const CONSENT_TW  = PW - 2 * CONSENT_PAD;

const C1 = '1.  Hiermit willige ich in die Übermittlung meiner Daten (insbesondere Messwerte entsprechend den Messprodukten) an den ESA durch den MSB ein. Soweit erforderlich, willige ich auch in die Erhebung der für das Messprodukt erforderlichen Daten ein.';
const C2 = '2.  Zudem willige ich ein, dass mein ESA zur Verarbeitung meiner Daten (insbesondere Messwerte entsprechend der Messprodukten) als berechtigte Stelle im Sinne des § 49 Abs. 2 Nr. 7 MsbG berechtigt ist.';

const c1Lines = wrapText(C1, CONSENT_TW, SZ_B, font).length;
const c2Lines = wrapText(C2, CONSENT_TW, SZ_B, font).length;
const consentH = (c1Lines + c2Lines) * (SZ_B + 4) + 20;

need(consentH);
box(M, y - consentH, PW, consentH, DARK_BG);
let cy = y - SZ_B - CONSENT_PAD;
cy = drawPara(C1, M + CONSENT_PAD, cy, CONSENT_TW, SZ_B, font, WHITE, SZ_B + 4);
cy -= 4;
drawPara(C2, M + CONSENT_PAD, cy, CONSENT_TW, SZ_B, font, WHITE, SZ_B + 4);
y -= consentH;
y -= 8;

// ── Legal paragraphs ──────────────────────────────────────────────────────────
const LEGAL = [
  'Der MSB übermittelt die Messwerte zu den angefragten Messprodukten gemäß den Regularien der BNetzA-Festlegung BK6-24-024 bzw. der BNetzA-Festlegung BK6-24-0174, Wechselprozesse im Messwesen, Teil 2, Use-Cases „Anfrage und Übermittlung von Werten durch und an den ESA“ an den ESA.',
  'Die in der Einwilligungserklärung aufgeführten Daten werden nur zur Vertragsdurchführung zwischen dem ESA und dem Anschlussnutzer verarbeitet. Informationen zur Verarbeitung Ihrer personenbezogenen Daten finden Sie in der beigefügten Datenschutzinformation.',
  'Widerrufsbelehrung gemäß DS-GVO: Die Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft gegenüber dem ESA unter den oben genannten Kontaktdaten unter dem Stichwort „Datenschutz“ widerrufen. Die Einwilligung zu 1. können Sie auch direkt gegenüber Ihrem MSB widerrufen.',
  'Die Einwilligung ist freiwillig. Ohne diese Einwilligungen kann Ihr ESA aber ggf. seine vertragliche Leistung nicht erbringen.',
];
for (const para of LEGAL) {
  const h = paraH(para, PW, SZ_B, font, 8);
  need(h);
  y = drawPara(para, M, y, PW, SZ_B) - 4;
}

// ── Signature line ────────────────────────────────────────────────────────────
need(40);
y -= 12;
page.drawLine({ start: { x: M, y }, end: { x: M + 280, y }, thickness: 0.5, color: BLACK });
y -= SZ_B + 4;
txt('Ort, Datum, Unterschrift Anschlussnutzer', M, y, SZ_B);
y -= 14;

// ── Ausfüllhinweise ───────────────────────────────────────────────────────────
need(50);
page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: BRD });
y -= SZ_B + 5;
txt('Ausfüllhinweise:', M, y, SZ_B, bold);
y -= SZ_B + 4;
const NOTES = [
  'Die in der Einwilligungserklärung verwendeten Begriffe referenzieren auf die der Erklärung zugrunde liegende BNetzA-Festlegung BK6-22-024 bzw. BK6-24-174 sowie den für die Umsetzung der BNetzA-Festlegung relevanten EDI@Energy-Dokumente.',
  'Mit * markierte Felder in der Einwilligungserklärung sind Pflichtangaben.',
  'Sofern für Marktlokationen und Tranchen oder Netzlokationen Messprodukte angefragt und übermittelt werden sollen, ist hierfür die separate „Einwilligungserklärung für Marktlokationen und Tranchen“ bzw. „Einwilligungserklärung für Netzlokationen“ zu verwenden.',
];
for (const note of NOTES) {
  const h = paraH(note, PW, SZ_B, font, 6);
  need(h);
  y = drawPara(note, M, y, PW, SZ_B) - 4;
}

// ── Write file ────────────────────────────────────────────────────────────────
const bytes = await doc.save();
writeFileSync(OUT, bytes);
console.log(`✓ ${OUT}`);

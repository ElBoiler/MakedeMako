/**
 * One-time script: injects {TAG} placeholders into the blank data cells of
 * einwilligungserklaerung.docx so that fillDocx() can substitute real values.
 *
 * Run once after restoring a fresh template: node scripts/instrument-docx.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve }             from 'node:path';
import PizZip                  from 'pizzip';

const SRC  = resolve('templates/einwilligungserklaerung.docx');
const DEST = resolve('templates/einwilligungserklaerung.docx');

// ── row index → injection rule ─────────────────────────────────────────────
// cell: 'last' = last cell of row; number = 0-based cell index
// mode 'inject'  = cell is empty — add {TAG} run after </w:pPr>
// mode 'replace' = cell has placeholder text — strip all runs, inject {TAG}
const MAPPING = {
  1:  { cell: 'last', mode: 'inject',  tag: 'ANSCHLUSSNUTZER_NAME' },
  3:  { cell: 'last', mode: 'inject',  tag: 'ANSCHLUSSNUTZER_STRASSE' },
  4:  { cell: 'last', mode: 'inject',  tag: 'ANSCHLUSSNUTZER_PLZ_ORT' },
  6:  { cell: 'last', mode: 'inject',  tag: 'ESA_NAME' },
  7:  { cell: 'last', mode: 'inject',  tag: 'ESA_STRASSE' },
  8:  { cell: 'last', mode: 'inject',  tag: 'ESA_PLZ_ORT' },
  9:  { cell: 'last', mode: 'replace', tag: 'ESA_MARKTPARTNER_ID' },
  11: { cell: 'last', mode: 'inject',  tag: 'MSB_NAME' },
  12: { cell: 'last', mode: 'inject',  tag: 'MSB_STRASSE' },
  13: { cell: 'last', mode: 'inject',  tag: 'MSB_PLZ_ORT' },
  14: { cell: 'last', mode: 'replace', tag: 'MSB_CODE_NR' },
  16: { cell: 'last', mode: 'replace', tag: 'BEGINN_DATUM' },
  17: { cell: 'last', mode: 'replace', tag: 'ENDE_DATUM' },
  // Messprodukte loop row: open tag in first cell, close in last
  22: { cell: 'loop-row', codeTag: 'CODE', bezTag: 'BEZEICHNUNG', loopVar: 'MESSPRODUKTEN' },
  // Row 23 ("…" placeholder) is dropped entirely
  23: { cell: 'delete' },
};

// ── helpers ────────────────────────────────────────────────────────────────

function textRun(t) {
  return `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
}

function injectIntoCell(cellXml, tagText) {
  if (cellXml.includes('</w:pPr>')) {
    return cellXml.replace('</w:pPr>', `</w:pPr>${textRun(tagText)}`);
  }
  return cellXml.replace(/<w:p[ >]/, m => `${m}${textRun(tagText)}`);
}

function replaceInCell(cellXml, tagText) {
  const stripped = cellXml.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, '');
  return injectIntoCell(stripped, tagText);
}

function processCells(rowXml) {
  return [...rowXml.matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)];
}

function patchRow(rowXml, rule) {
  const cells = processCells(rowXml);
  if (!cells.length) return rowXml;

  if (rule.cell === 'loop-row') {
    const first = cells[0];
    const last  = cells[cells.length - 1];
    const newFirst = replaceInCell(first[0], `{#${rule.loopVar}}{${rule.codeTag}}`);
    const newLast  = replaceInCell(last[0],  `{${rule.bezTag}}{/${rule.loopVar}}`);
    return rowXml.slice(0, first.index) + newFirst +
           rowXml.slice(first.index + first[0].length, last.index) + newLast +
           rowXml.slice(last.index + last[0].length);
  }

  const targetCell = rule.cell === 'last'
    ? cells[cells.length - 1]
    : cells[rule.cell];

  const newCell = rule.mode === 'inject'
    ? injectIntoCell(targetCell[0], `{${rule.tag}}`)
    : replaceInCell(targetCell[0],  `{${rule.tag}}`);

  return rowXml.slice(0, targetCell.index) + newCell +
         rowXml.slice(targetCell.index + targetCell[0].length);
}

// ── main ───────────────────────────────────────────────────────────────────

const tpl = await readFile(SRC);
const zip  = new PizZip(tpl);
let xml    = zip.files['word/document.xml'].asText();

// Walk through the document keeping ALL non-row content intact.
// We interleave "text segments" (everything between rows) with "row segments".
const rowRegex = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
let rowIndex = 0;
let pos = 0;
const parts = [];

for (const m of xml.matchAll(rowRegex)) {
  // Preserve everything between the previous row end and this row start
  if (m.index > pos) parts.push(xml.slice(pos, m.index));

  const rule = MAPPING[rowIndex];
  if (rule?.cell === 'delete') {
    // drop row — do not push anything
  } else if (rule) {
    parts.push(patchRow(m[0], rule));
  } else {
    parts.push(m[0]);
  }

  pos = m.index + m[0].length;
  rowIndex++;
}
// Preserve trailing content after last row (closing tags, sectPr, etc.)
if (pos < xml.length) parts.push(xml.slice(pos));

zip.file('word/document.xml', parts.join(''));
const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
await writeFile(DEST, out);
console.log('✓', DEST);

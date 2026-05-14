// Generates minimal stand-in templates with the right tokens for tests.
// Run with: node tests/fixtures/build-fixtures.mjs
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---- DOCX ----
function buildDocxBytes() {
  const wordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t xml:space="preserve">Objekt: {OBJEKT_ADRESSE}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Anschlussnutzer: {ANSCHLUSSNUTZER_NAME}, {ANSCHLUSSNUTZER_ADRESSE}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">MSB: {MSB_NAME} ({MSB_CODE_NR})</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">ESA: {ESA_NAME} ({ESA_MARKTPARTNER_ID})</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Beginn: {BEGINN_DATUM}  Ende: {ENDE_DATUM}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">{#MESSPUNKTE}- {TYP} {ID} ({RICHTUNG}) [{MESSPRODUKT}]
{/MESSPUNKTE}</w:t></w:r></w:p>
</w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', wordXml);
  return zip.generate({ type: 'nodebuffer' });
}

// ---- PDF ----
async function buildPdfBytes() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  const form = pdf.getForm();
  const scalars = [
    'OBJEKT_ADRESSE', 'ANSCHLUSSNUTZER_NAME', 'ANSCHLUSSNUTZER_ADRESSE',
    'MSB_NAME', 'MSB_CODE_NR', 'ESA_NAME', 'ESA_MARKTPARTNER_ID',
    'BEGINN_DATUM', 'ENDE_DATUM',
  ];
  let y = 760;
  for (const name of scalars) {
    const f = form.createTextField(name);
    f.addToPage(page, { x: 200, y, width: 300, height: 16 });
    y -= 20;
  }
  for (let i = 1; i <= 10; i++) {
    for (const suffix of ['TYP', 'ID', 'RICHTUNG', 'MESSPRODUKT']) {
      const f = form.createTextField(`MP_${i}_${suffix}`);
      f.addToPage(page, { x: 0, y: -100, width: 1, height: 1 });
    }
  }
  return pdf.save();
}

// ---- XLSX ----
async function buildXlsxBytes() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Kontakt');
  ws.getCell('A1').value = 'Anbieter';
  ws.getCell('B1').value = '{{ESA_NAME}}';
  ws.getCell('A2').value = 'Marktpartner-ID';
  ws.getCell('B2').value = '{{ESA_MARKTPARTNER_ID}}';
  return wb.xlsx.writeBuffer();
}

await mkdir(resolve(root, 'templates'), { recursive: true });
await writeFile(resolve(root, 'templates/einwilligungserklaerung.docx'), buildDocxBytes());
await writeFile(resolve(root, 'templates/einwilligungserklaerung.pdf'), await buildPdfBytes());
await writeFile(resolve(root, 'templates/kontaktdatenblatt.xlsx'), Buffer.from(await buildXlsxBytes()));
console.log('templates/ regenerated');

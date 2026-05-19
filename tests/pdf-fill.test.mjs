import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { fillPdf } from '../src/pdf-fill.js';

const TEMPLATE = resolve('templates/einwilligungserklaerung.pdf');

const DATA = {
  ANSCHLUSSNUTZER_NAME: 'Müller GmbH',
  ANSCHLUSSNUTZER_STRASSE: 'Musterweg 5',
  ANSCHLUSSNUTZER_PLZ_ORT: '12345 Musterstadt',
  ESA_NAME: 'Advizeo Deutschland GmbH',
  ESA_STRASSE: 'Zum Gunterstal 6',
  ESA_PLZ_ORT: '66440 Blieskastel',
  ESA_MARKTPARTNER_ID: '9985220000009',
  MSB_NAME: 'Stromnetz Berlin GmbH',
  MSB_STRASSE: 'Puschkinallee 52',
  MSB_PLZ_ORT: '12435 Berlin',
  MSB_CODE_NR: '9900290000003',
  BEGINN_DATUM: '14.05.2023',
  ENDE_DATUM: 'offen',
  MESSPUNKTE: [
    { TYP: 'MaLo', ID: '11111111111', RICHTUNG: 'Verbrauch', MESSPRODUKT: '9991000000747' },
    { TYP: 'MeLo', ID: 'A'.repeat(33), RICHTUNG: 'Erzeugung', MESSPRODUKT: '9991000000789' },
  ],
  MESSPRODUKTEN: [
    { CODE: '9991000000747', BEZEICHNUNG: 'Viertelstundenwerte' },
    { CODE: '9991000000789', BEZEICHNUNG: 'Viertelstundenwerte Erzeugung' },
  ],
};

async function readField(pdfBytes, name) {
  const pdf = await PDFDocument.load(pdfBytes);
  return pdf.getForm().getTextField(name).getText();
}

test('fillPdf fills scalar AcroForm fields', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillPdf(tpl, DATA);
  assert.equal(await readField(out, 'ANSCHLUSSNUTZER_NAME'),    'Müller GmbH');
  assert.equal(await readField(out, 'ANSCHLUSSNUTZER_STRASSE'), 'Musterweg 5');
  assert.equal(await readField(out, 'ANSCHLUSSNUTZER_PLZ_ORT'), '12345 Musterstadt');
  assert.equal(await readField(out, 'MSB_NAME'),    'Stromnetz Berlin GmbH');
  assert.equal(await readField(out, 'MSB_CODE_NR'), '9900290000003');
  assert.equal(await readField(out, 'MSB_STRASSE'), 'Puschkinallee 52');
  assert.equal(await readField(out, 'MSB_PLZ_ORT'), '12435 Berlin');
  assert.equal(await readField(out, 'ESA_STRASSE'), 'Zum Gunterstal 6');
  assert.equal(await readField(out, 'ESA_PLZ_ORT'), '66440 Blieskastel');
  assert.equal(await readField(out, 'BEGINN_DATUM'), '14.05.2023');
  assert.equal(await readField(out, 'ENDE_DATUM'),   'offen');
});

test('fillPdf fills MP rows and clears rest', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillPdf(tpl, DATA);
  assert.equal(await readField(out, 'MP_1_CODE'),        '9991000000747');
  assert.equal(await readField(out, 'MP_1_BEZEICHNUNG'), 'Viertelstundenwerte');
  assert.equal(await readField(out, 'MP_2_CODE'),        '9991000000789');
  assert.equal(await readField(out, 'MP_3_CODE'),        '');
  assert.equal(await readField(out, 'MP_10_BEZEICHNUNG'), '');
});

test('fillPdf throws if MESSPRODUKTEN has more than 10 rows', async () => {
  const tpl = await readFile(TEMPLATE);
  const overflow = { ...DATA, MESSPRODUKTEN: Array.from({ length: 11 }, () => DATA.MESSPRODUKTEN[0]) };
  await assert.rejects(fillPdf(tpl, overflow), /Max 10/);
});

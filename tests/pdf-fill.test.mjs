import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { fillPdf } from '../src/pdf-fill.js';

const TEMPLATE = resolve('templates/einwilligungserklaerung.pdf');

const DATA = {
  OBJEKT_ADRESSE: 'Hauptstr. 1, 10115 Berlin',
  ANSCHLUSSNUTZER_NAME: 'Müller GmbH',
  ANSCHLUSSNUTZER_ADRESSE: 'Musterweg 5',
  MSB_NAME: 'Stromnetz Berlin GmbH',
  MSB_CODE_NR: '9900290000003',
  ESA_NAME: 'Advizeo Deutschland GmbH',
  ESA_MARKTPARTNER_ID: '9985220000009',
  BEGINN_DATUM: '14.05.2023',
  ENDE_DATUM: 'offen',
  MESSPUNKTE: [
    { TYP: 'MaLo', ID: '11111111111', RICHTUNG: 'Verbrauch', MESSPRODUKT: '9991000000747' },
    { TYP: 'MeLo', ID: 'A'.repeat(33), RICHTUNG: 'Erzeugung', MESSPRODUKT: '9991000000789' },
  ],
};

async function readField(pdfBytes, name) {
  const pdf = await PDFDocument.load(pdfBytes);
  return pdf.getForm().getTextField(name).getText();
}

test('fillPdf fills scalar AcroForm fields', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillPdf(tpl, DATA);
  assert.equal(await readField(out, 'OBJEKT_ADRESSE'), 'Hauptstr. 1, 10115 Berlin');
  assert.equal(await readField(out, 'MSB_CODE_NR'),    '9900290000003');
  assert.equal(await readField(out, 'BEGINN_DATUM'),   '14.05.2023');
});

test('fillPdf fills first N MP rows and clears rest', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillPdf(tpl, DATA);
  assert.equal(await readField(out, 'MP_1_TYP'), 'MaLo');
  assert.equal(await readField(out, 'MP_1_ID'),  '11111111111');
  assert.equal(await readField(out, 'MP_2_TYP'), 'MeLo');
  assert.equal(await readField(out, 'MP_3_TYP'), '');
  assert.equal(await readField(out, 'MP_10_ID'), '');
});

test('fillPdf throws if MESSPUNKTE has more than 10 rows', async () => {
  const tpl = await readFile(TEMPLATE);
  const overflow = { ...DATA, MESSPUNKTE: Array.from({ length: 11 }, () => DATA.MESSPUNKTE[0]) };
  await assert.rejects(fillPdf(tpl, overflow), /Max 10/);
});

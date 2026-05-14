import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { fillXlsx } from '../src/xlsx-fill.js';

const TEMPLATE = resolve('templates/kontaktdatenblatt.xlsx');

test('fillXlsx substitutes {{TOKENS}} in string cells', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillXlsx(tpl, {
    ESA_NAME: 'Advizeo Deutschland GmbH',
    ESA_MARKTPARTNER_ID: '9985220000009',
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  const ws = wb.getWorksheet('Kontakt');
  assert.equal(ws.getCell('B1').value, 'Advizeo Deutschland GmbH');
  assert.equal(ws.getCell('B2').value, '9985220000009');
});

test('fillXlsx preserves cells without tokens', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillXlsx(tpl, {});
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  const ws = wb.getWorksheet('Kontakt');
  assert.equal(ws.getCell('A1').value, 'Anbieter');
});

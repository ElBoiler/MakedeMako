import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { fillXlsx } from '../src/xlsx-fill.js';

async function makeTemplate(cells) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Test');
  for (const [addr, val] of Object.entries(cells)) ws.getCell(addr).value = val;
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

test('fillXlsx substitutes {{TOKENS}} in string cells', async () => {
  const tpl = await makeTemplate({ A1: 'Label', B1: '{{FOO}}', B2: '{{BAR}}' });
  const out = await fillXlsx(tpl, { FOO: 'hello', BAR: '42' });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  const ws = wb.getWorksheet('Test');
  assert.equal(ws.getCell('B1').value, 'hello');
  assert.equal(ws.getCell('B2').value, '42');
});

test('fillXlsx preserves cells without tokens', async () => {
  const tpl = await makeTemplate({ A1: 'Static', B1: '{{X}}' });
  const out = await fillXlsx(tpl, { X: 'replaced' });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out);
  const ws = wb.getWorksheet('Test');
  assert.equal(ws.getCell('A1').value, 'Static');
});

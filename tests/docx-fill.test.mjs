import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PizZip from 'pizzip';
import { fillDocx } from '../src/docx-fill.js';

// The official BDEW docx has no template tags and is downloaded as-is.
// This fixture is a minimal docx with template placeholders for unit-testing fillDocx.
const TEMPLATE = resolve('tests/fixtures/test-template.docx');

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
    { TYP: 'MaLo', ID: '12345678901', RICHTUNG: 'Verbrauch', MESSPRODUKT: '9991000000747' },
  ],
};

function extractText(docxBuf) {
  const zip = new PizZip(docxBuf);
  return zip.file('word/document.xml').asText();
}

test('fillDocx substitutes scalar tokens', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = fillDocx(tpl, DATA);
  const xml = extractText(Buffer.from(out));
  assert.match(xml, /Hauptstr\. 1, 10115 Berlin/);
  assert.match(xml, /Müller GmbH/);
  assert.match(xml, /Advizeo Deutschland GmbH/);
});

test('fillDocx expands Messpunkte loop', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = fillDocx(tpl, {
    ...DATA,
    MESSPUNKTE: [
      { TYP: 'MaLo', ID: '11111111111', RICHTUNG: 'Verbrauch', MESSPRODUKT: '9991000000747' },
      { TYP: 'MeLo', ID: 'D'.repeat(33), RICHTUNG: 'Erzeugung', MESSPRODUKT: '9991000000789' },
    ],
  });
  const xml = extractText(Buffer.from(out));
  assert.match(xml, /11111111111/);
  assert.match(xml, /D{33}/);
  assert.match(xml, /9991000000789/);
});

test('fillDocx throws on missing token', async () => {
  const tpl = await readFile(TEMPLATE);
  assert.throws(
    () => fillDocx(tpl, { OBJEKT_ADRESSE: 'x' }),
    /Multi error|missing tag/i,
  );
});

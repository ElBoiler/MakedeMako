import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/validate.js';

const GOOD = {
  objekt: { adresse: 'Hauptstr. 1, 10115 Berlin' },
  anschlussnutzer: { name: 'Müller GmbH', adresse: 'Musterweg 5' },
  msb: { name: 'Stromnetz Berlin', codeNr: '9900290000003', knownToAdvizeo: true },
  messpunkte: [
    { kind: 'MaLo', id: '12345678901', richtung: 'Verbrauch' },
  ],
  beginnDatum: '2023-05-14',
  endeDatum: '',
};

test('good input → no errors', () => {
  assert.deepEqual(validate(GOOD), {});
});

test('empty Objekt adresse → error', () => {
  const bad = structuredClone(GOOD);
  bad.objekt.adresse = '   ';
  assert.equal(validate(bad)['objekt.adresse'], 'Pflichtfeld');
});

test('non-13-digit Code-Nr → error', () => {
  const bad = structuredClone(GOOD);
  bad.msb.codeNr = '12345';
  assert.equal(validate(bad)['msb.codeNr'], 'Code-Nr. muss 13 Ziffern haben');
});

test('knownToAdvizeo null → error', () => {
  const bad = structuredClone(GOOD);
  bad.msb.knownToAdvizeo = null;
  assert.equal(validate(bad)['msb.knownToAdvizeo'], 'Bitte Ja oder Nein wählen');
});

test('MeLo ID wrong length → error', () => {
  const bad = structuredClone(GOOD);
  bad.messpunkte = [{ kind: 'MeLo', id: 'TOO_SHORT', richtung: 'Verbrauch' }];
  assert.equal(validate(bad)['messpunkte.0.id'], 'MeLo-ID: 33 Zeichen, A–Z und 0–9');
});

test('MeLo ID 33 char alphanumeric → ok', () => {
  const ok = structuredClone(GOOD);
  ok.messpunkte = [{ kind: 'MeLo', id: 'A'.repeat(33), richtung: 'Verbrauch' }];
  assert.equal(validate(ok)['messpunkte.0.id'], undefined);
});

test('MaLo ID non-11-digit → error', () => {
  const bad = structuredClone(GOOD);
  bad.messpunkte = [{ kind: 'MaLo', id: '123', richtung: 'Verbrauch' }];
  assert.equal(validate(bad)['messpunkte.0.id'], 'MaLo-ID: 11 Ziffern');
});

test('zero Messpunkte → error', () => {
  const bad = structuredClone(GOOD);
  bad.messpunkte = [];
  assert.equal(validate(bad)['messpunkte'], 'Mindestens 1 Messpunkt');
});

test('> 10 Messpunkte → error', () => {
  const bad = structuredClone(GOOD);
  bad.messpunkte = Array.from({ length: 11 }, () =>
    ({ kind: 'MaLo', id: '12345678901', richtung: 'Verbrauch' }));
  assert.equal(validate(bad)['messpunkte'], 'Max 10 Zeilen (PDF-Limit)');
});

test('Beginn-Datum in future → error', () => {
  const bad = structuredClone(GOOD);
  bad.beginnDatum = '2999-01-01';
  assert.equal(validate(bad)['beginnDatum'], 'Datum darf nicht in der Zukunft liegen');
});

test('Ende-Datum before Beginn-Datum → error', () => {
  const bad = structuredClone(GOOD);
  bad.beginnDatum = '2023-05-14';
  bad.endeDatum = '2020-01-01';
  assert.equal(validate(bad)['endeDatum'], 'Ende muss nach Beginn liegen');
});

test('Ende-Datum blank → ok', () => {
  const ok = structuredClone(GOOD);
  ok.endeDatum = '';
  assert.equal(validate(ok)['endeDatum'], undefined);
});

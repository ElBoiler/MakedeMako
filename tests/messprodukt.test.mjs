import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messprodukt } from '../src/messprodukt.js';

test('MeLo + Verbrauch → 9991000000771', () => {
  assert.equal(messprodukt('MeLo', 'Verbrauch'), '9991000000771');
});

test('MeLo + Erzeugung → 9991000000789', () => {
  assert.equal(messprodukt('MeLo', 'Erzeugung'), '9991000000789');
});

test('MaLo + Verbrauch → 9991000000747', () => {
  assert.equal(messprodukt('MaLo', 'Verbrauch'), '9991000000747');
});

test('MaLo + Erzeugung → 9991000000747', () => {
  assert.equal(messprodukt('MaLo', 'Erzeugung'), '9991000000747');
});

test('Unknown kind throws', () => {
  assert.throws(() => messprodukt('XXX', 'Verbrauch'), /Unknown kind/);
});

test('Unknown richtung throws', () => {
  assert.throws(() => messprodukt('MeLo', 'XXX'), /Unknown richtung/);
});

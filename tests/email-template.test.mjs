import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECT, BODY_LINES } from '../src/email-template.js';

test('SUBJECT references ESA marktpartner-ID 9985220000009', () => {
  assert.match(SUBJECT, /9985220000009/);
});

test('BODY_LINES mentions ESA, Lastgangdaten and Kontaktdatenblatt', () => {
  const text = BODY_LINES.join('\n');
  assert.match(text, /Energieserviceanbieter/);
  assert.match(text, /Lastgangdaten/);
  assert.match(text, /Kontaktdatenblatt/);
  assert.match(text, /Einwilligungserklärung/);
});

test('BODY_LINES is an array of strings (no line endings inside)', () => {
  assert.ok(Array.isArray(BODY_LINES));
  for (const line of BODY_LINES) {
    assert.equal(typeof line, 'string');
    assert.ok(!line.includes('\r'));
    assert.ok(!line.includes('\n'));
  }
});

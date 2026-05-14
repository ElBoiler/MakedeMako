import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simpleParser } from 'mailparser';
import { buildEml } from '../src/eml-build.js';

test('buildEml produces valid MIME with X-Unsent and two attachments', async () => {
  const eml = buildEml({
    subject: 'Anfrage ESA',
    bodyLines: ['Sehr geehrte Damen und Herren,', '', 'Bitte sehen.'],
    headers: { 'X-Unsent': '1' },
    attachments: [
      { name: 'a.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: new Uint8Array([1, 2, 3]) },
      { name: 'b.pdf',  contentType: 'application/pdf',                                                    bytes: new Uint8Array([4, 5, 6]) },
    ],
    date: new Date('2026-05-14T09:36:00Z'),
  });

  const parsed = await simpleParser(eml);
  assert.equal(parsed.subject, 'Anfrage ESA');
  assert.match(parsed.text, /Sehr geehrte Damen und Herren/);
  assert.equal(parsed.headers.get('x-unsent'), '1');
  assert.equal(parsed.attachments.length, 2);
  const names = parsed.attachments.map(a => a.filename).sort();
  assert.deepEqual(names, ['a.xlsx', 'b.pdf']);
});

test('buildEml uses CRLF line endings throughout', () => {
  const eml = buildEml({
    subject: 's', bodyLines: ['x'], headers: {}, attachments: [],
    date: new Date(0),
  });
  const lines = eml.split('\r\n');
  assert.ok(lines.length > 5);
  assert.ok(!eml.includes('\n\n'));
});

test('buildEml handles UTF-8 subject via RFC 2047', () => {
  const eml = buildEml({
    subject: 'Anfrage Müller',
    bodyLines: ['x'], headers: {}, attachments: [], date: new Date(0),
  });
  assert.match(eml, /=\?utf-8\?b\?/i);
});

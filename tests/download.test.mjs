import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadBundle } from '../src/download.js';

function fakeChrome() {
  const calls = [];
  return {
    api: {
      downloads: {
        download: async opts => { calls.push(opts); return calls.length; },
      },
    },
    calls,
  };
}

const FILES = [
  { name: 'a.docx', bytes: new Uint8Array([1]), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { name: 'b.pdf',  bytes: new Uint8Array([2]), mime: 'application/pdf' },
];

test('downloadBundle puts files in MaKo/<date>_<slug>/', async () => {
  const { api, calls } = fakeChrome();
  await downloadBundle({
    files: FILES,
    anschlussnutzer: 'Müller GmbH',
    today: new Date('2026-05-14T00:00:00Z'),
    chrome: api,
    URL: { createObjectURL: () => 'blob:fake' },
  });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.filename, /^MaKo\/2026-05-14_mueller-gmbh\//);
    assert.equal(call.conflictAction, 'uniquify');
  }
});

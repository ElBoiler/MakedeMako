import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, loadState, saveState, resetState } from '../src/form-state.js';

function fakeStorage() {
  let data = {};
  return {
    local: {
      get: async key => ({ [key]: data[key] }),
      set: async patch => Object.assign(data, patch),
      remove: async key => { delete data[key]; },
    },
  };
}

test('defaultState shape', () => {
  const today = new Date('2026-05-14T00:00:00Z');
  const s = defaultState(today);
  assert.equal(s.objekt.adresse, '');
  assert.equal(s.anschlussnutzer.name, '');
  assert.equal(s.msb.knownToAdvizeo, null);
  assert.equal(s.messpunkte.length, 1);
  assert.equal(s.messpunkte[0].kind, 'MaLo');
  assert.equal(s.messpunkte[0].richtung, 'Verbrauch');
  assert.equal(s.beginnDatum, '2023-05-14');
  assert.equal(s.endeDatum, '');
  assert.equal(s.esa.name, 'Advizeo Deutschland GmbH');
  assert.equal(s.esa.marktpartnerId, '9985220000009');
});

test('save/load round-trip', async () => {
  const storage = fakeStorage();
  const state = defaultState(new Date('2026-05-14'));
  state.objekt.adresse = 'Hauptstr. 1';
  await saveState(state, storage);
  const loaded = await loadState(storage);
  assert.equal(loaded.objekt.adresse, 'Hauptstr. 1');
});

test('loadState returns defaults if storage empty', async () => {
  const storage = fakeStorage();
  const loaded = await loadState(storage, new Date('2026-05-14'));
  assert.equal(loaded.objekt.adresse, '');
});

test('resetState clears storage', async () => {
  const storage = fakeStorage();
  await saveState(defaultState(new Date('2026-05-14')), storage);
  await resetState(storage);
  const reread = await storage.local.get('form');
  assert.equal(reread.form, undefined);
});

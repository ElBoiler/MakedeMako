# Address Split + PDF AcroForm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split address fields into Straße, PLZ, Ort across Objekt/Anschlussnutzer/MSB; add Photon autocomplete for two address blocks; extend BDEW autocomplete to fill MSB address; wire everything to a new PDF AcroForm field set.

**Architecture:** Pure data-model change (form-state → validate → toTemplateData) is separate from DOM changes (render.js + step1.js) and the one-time PDF build script. The docx template stays unchanged — toTemplateData() composes backward-compatible tokens from the split fields. All new tests use Node's built-in `--test` runner.

**Tech Stack:** Plain ES modules, Node --test, pdf-lib (dev dep, already installed), Photon geocoding API (free, no key), BDEW codes API (already wired).

**Working directory:** all paths relative to `C:\Users\thoma\Documents\Tools\Mako Automations\Formularis_ausfüllio\.claude\worktrees\nifty-sutherland-2fd3c1`

---

## File map

| File | Action |
|---|---|
| `src/form-state.js` | Modify — split `adresse` → `{ strasse, plz, ort }` in three places |
| `src/validate.js` | Modify — replace 2 adresse checks with 9 split-field checks |
| `src/address-autocomplete.js` | **Create** — Photon fetch + response mapping |
| `src/bdew-api.js` | Modify — add `strasse/plz/ort` to `searchMsb()` return |
| `src/ui/render.js` | Modify — add `addressBlock()` export |
| `styles.css` | Modify — add `.address-block` and `.addr-row2` layout rules |
| `src/ui/step1.js` | Modify — replace textareas, add Photon wiring, extend `selectMsb` |
| `src/main.js` | Modify — update `toTemplateData()` |
| `src/pdf-fill.js` | Modify — update `SCALARS` array |
| `scripts/add-pdf-fields.mjs` | **Create** — one-time AcroForm field injector |
| `manifest.json` | Modify — add Photon host permission |
| `tests/form-state.test.mjs` | **Create** |
| `tests/validate.test.mjs` | **Create** |
| `tests/address-autocomplete.test.mjs` | **Create** |
| `tests/bdew-api.test.mjs` | **Create** |

---

## Task 1: Data model — split address fields in form-state.js

**Files:**
- Modify: `src/form-state.js`
- Create: `tests/form-state.test.mjs`

- [ ] **Step 1.1 — Write the failing test**

Create `tests/form-state.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/form-state.js';

test('defaultState has split address fields for objekt', () => {
  const s = defaultState();
  assert.deepEqual(Object.keys(s.objekt).sort(), ['ort', 'plz', 'strasse']);
  assert.equal(s.objekt.strasse, '');
  assert.equal(s.objekt.plz, '');
  assert.equal(s.objekt.ort, '');
});

test('defaultState has split address fields for anschlussnutzer', () => {
  const s = defaultState();
  assert.equal(s.anschlussnutzer.strasse, '');
  assert.equal(s.anschlussnutzer.plz, '');
  assert.equal(s.anschlussnutzer.ort, '');
  assert.equal(typeof s.anschlussnutzer.adresse, 'undefined');
});

test('defaultState has address fields for msb', () => {
  const s = defaultState();
  assert.equal(s.msb.strasse, '');
  assert.equal(s.msb.plz, '');
  assert.equal(s.msb.ort, '');
});

test('defaultState still has all pre-existing fields', () => {
  const s = defaultState();
  assert.equal(typeof s.anschlussnutzer.name, 'string');
  assert.equal(typeof s.msb.codeNr, 'string');
  assert.equal(s.msb.knownToAdvizeo, null);
  assert.ok(Array.isArray(s.messpunkte));
  assert.ok(s.beginnDatum.match(/^\d{4}-\d{2}-\d{2}$/));
});
```

- [ ] **Step 1.2 — Run test to confirm it fails**

```
node --test tests/form-state.test.mjs
```

Expected: fails on `assert.equal(typeof s.anschlussnutzer.adresse, 'undefined')` (currently it exists).

- [ ] **Step 1.3 — Update form-state.js**

Replace the `defaultState` return value. Full file after edit:

```js
const KEY = 'form';

function isoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultState(today = new Date()) {
  const threeYearsAgo = new Date(Date.UTC(
    today.getUTCFullYear() - 3, today.getUTCMonth(), today.getUTCDate()
  ));
  return {
    objekt: { strasse: '', plz: '', ort: '' },
    anschlussnutzer: { name: '', strasse: '', plz: '', ort: '' },
    msb: { name: '', codeNr: '', strasse: '', plz: '', ort: '', knownToAdvizeo: null },
    messpunkte: [{ kind: 'MaLo', id: '', richtung: 'Verbrauch' }],
    beginnDatum: isoDate(threeYearsAgo),
    endeDatum: '',
    esa: { name: 'Advizeo Deutschland GmbH', marktpartnerId: '9985220000009' },
    step: 1,
  };
}

export async function loadState(storage = chrome.storage, today = new Date()) {
  const { [KEY]: stored } = await storage.local.get(KEY);
  if (!stored) return defaultState(today);
  return { ...defaultState(today), ...stored };
}

export async function saveState(state, storage = chrome.storage) {
  await storage.local.set({ [KEY]: state });
}

export async function resetState(storage = chrome.storage) {
  await storage.local.remove(KEY);
}
```

- [ ] **Step 1.4 — Run test to confirm it passes**

```
node --test tests/form-state.test.mjs
```

Expected: all 4 tests pass.

- [ ] **Step 1.5 — Commit**

```
git add src/form-state.js tests/form-state.test.mjs
git commit -m "feat: split address fields in form-state (strasse/plz/ort)"
```

---

## Task 2: Validation — replace adresse checks with 9 split-field checks

**Files:**
- Modify: `src/validate.js`
- Create: `tests/validate.test.mjs`

- [ ] **Step 2.1 — Write failing tests**

Create `tests/validate.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/validate.js';

function validBase() {
  return {
    objekt:          { strasse: 'Hauptstraße 1', plz: '10115', ort: 'Berlin' },
    anschlussnutzer: { name: 'Max Muster GmbH', strasse: 'Nebenstraße 2', plz: '20099', ort: 'Hamburg' },
    msb:             { name: 'Stadtwerke Test', codeNr: '9900000000001', strasse: 'Bahnhofstr. 5', plz: '30159', ort: 'Hannover', knownToAdvizeo: true },
    messpunkte:      [{ kind: 'MaLo', id: '12345678901', richtung: 'Verbrauch' }],
    beginnDatum:     '2022-01-01',
    endeDatum:       '',
  };
}

test('valid form has no errors', () => {
  const e = validate(validBase());
  assert.deepEqual(e, {});
});

test('empty objekt.strasse is required', () => {
  const form = validBase();
  form.objekt.strasse = '';
  const e = validate(form);
  assert.equal(e['objekt.strasse'], 'Pflichtfeld');
});

test('empty objekt.ort is required', () => {
  const form = validBase();
  form.objekt.ort = '';
  const e = validate(form);
  assert.equal(e['objekt.ort'], 'Pflichtfeld');
});

test('objekt.plz must be 5 digits', () => {
  const form = validBase();
  form.objekt.plz = '1234';
  const e = validate(form);
  assert.equal(e['objekt.plz'], 'PLZ muss 5 Ziffern haben');
});

test('objekt.plz rejects non-digits', () => {
  const form = validBase();
  form.objekt.plz = 'AB123';
  const e = validate(form);
  assert.equal(e['objekt.plz'], 'PLZ muss 5 Ziffern haben');
});

test('valid objekt.plz passes', () => {
  const form = validBase();
  form.objekt.plz = '10115';
  const e = validate(form);
  assert.equal(e['objekt.plz'], undefined);
});

test('empty anschlussnutzer.strasse is required', () => {
  const form = validBase();
  form.anschlussnutzer.strasse = '';
  const e = validate(form);
  assert.equal(e['anschlussnutzer.strasse'], 'Pflichtfeld');
});

test('anschlussnutzer.plz must be 5 digits', () => {
  const form = validBase();
  form.anschlussnutzer.plz = '999';
  const e = validate(form);
  assert.equal(e['anschlussnutzer.plz'], 'PLZ muss 5 Ziffern haben');
});

test('empty msb.strasse is required', () => {
  const form = validBase();
  form.msb.strasse = '';
  const e = validate(form);
  assert.equal(e['msb.strasse'], 'Pflichtfeld');
});

test('msb.plz must be 5 digits', () => {
  const form = validBase();
  form.msb.plz = '1234';
  const e = validate(form);
  assert.equal(e['msb.plz'], 'PLZ muss 5 Ziffern haben');
});

test('empty msb.ort is required', () => {
  const form = validBase();
  form.msb.ort = '';
  const e = validate(form);
  assert.equal(e['msb.ort'], 'Pflichtfeld');
});

test('old adresse key produces no errors (migration safety)', () => {
  const form = validBase();
  form.objekt.adresse = 'old value';
  const e = validate(form);
  assert.equal(e['objekt.adresse'], undefined);
});
```

- [ ] **Step 2.2 — Run test to confirm failures**

```
node --test tests/validate.test.mjs
```

Expected: several failures (validate still checks `objekt.adresse` etc.).

- [ ] **Step 2.3 — Update validate.js**

Full file after edit:

```js
const TEXT = s => String(s ?? '').trim();

function plz(val) {
  return /^\d{5}$/.test(TEXT(val));
}

export function validate(form, today = new Date()) {
  const e = {};

  if (!TEXT(form.objekt?.strasse))        e['objekt.strasse'] = 'Pflichtfeld';
  if (!plz(form.objekt?.plz))             e['objekt.plz']     = 'PLZ muss 5 Ziffern haben';
  if (!TEXT(form.objekt?.ort))            e['objekt.ort']     = 'Pflichtfeld';

  if (!TEXT(form.anschlussnutzer?.name))    e['anschlussnutzer.name']    = 'Pflichtfeld';
  if (!TEXT(form.anschlussnutzer?.strasse)) e['anschlussnutzer.strasse'] = 'Pflichtfeld';
  if (!plz(form.anschlussnutzer?.plz))      e['anschlussnutzer.plz']     = 'PLZ muss 5 Ziffern haben';
  if (!TEXT(form.anschlussnutzer?.ort))     e['anschlussnutzer.ort']     = 'Pflichtfeld';

  if (!TEXT(form.msb?.name)) e['msb.name'] = 'Pflichtfeld';

  const code = TEXT(form.msb?.codeNr);
  if (!/^\d{13}$/.test(code)) e['msb.codeNr'] = 'Code-Nr. muss 13 Ziffern haben';

  if (!TEXT(form.msb?.strasse)) e['msb.strasse'] = 'Pflichtfeld';
  if (!plz(form.msb?.plz))      e['msb.plz']     = 'PLZ muss 5 Ziffern haben';
  if (!TEXT(form.msb?.ort))     e['msb.ort']     = 'Pflichtfeld';

  if (form.msb?.knownToAdvizeo !== true && form.msb?.knownToAdvizeo !== false) {
    e['msb.knownToAdvizeo'] = 'Bitte Ja oder Nein wählen';
  }

  const rows = form.messpunkte ?? [];
  if (rows.length === 0) {
    e['messpunkte'] = 'Mindestens 1 Messpunkt';
  } else if (rows.length > 10) {
    e['messpunkte'] = 'Max 10 Zeilen (PDF-Limit)';
  } else {
    rows.forEach((row, i) => {
      const id = TEXT(row.id);
      if (row.kind === 'MeLo') {
        if (!/^[A-Z0-9]{33}$/.test(id)) e[`messpunkte.${i}.id`] = 'MeLo-ID: 33 Zeichen, A–Z und 0–9';
      } else if (row.kind === 'MaLo') {
        if (!/^\d{11}$/.test(id)) e[`messpunkte.${i}.id`] = 'MaLo-ID: 11 Ziffern';
      } else {
        e[`messpunkte.${i}.kind`] = 'Typ wählen';
      }
      if (row.richtung !== 'Verbrauch' && row.richtung !== 'Erzeugung') {
        e[`messpunkte.${i}.richtung`] = 'Lieferrichtung wählen';
      }
    });
  }

  const beginn = TEXT(form.beginnDatum);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginn)) {
    e['beginnDatum'] = 'Pflichtfeld';
  } else if (new Date(beginn + 'T00:00:00') > today) {
    e['beginnDatum'] = 'Datum darf nicht in der Zukunft liegen';
  }

  const ende = TEXT(form.endeDatum);
  if (ende) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ende)) {
      e['endeDatum'] = 'Ungültiges Datum';
    } else if (beginn && new Date(ende) <= new Date(beginn)) {
      e['endeDatum'] = 'Ende muss nach Beginn liegen';
    }
  }

  return e;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
```

- [ ] **Step 2.4 — Run tests**

```
node --test tests/validate.test.mjs
```

Expected: all 12 tests pass.

- [ ] **Step 2.5 — Commit**

```
git add src/validate.js tests/validate.test.mjs
git commit -m "feat: replace adresse validation with strasse/plz/ort checks"
```

---

## Task 3: Address autocomplete module

**Files:**
- Create: `src/address-autocomplete.js`
- Create: `tests/address-autocomplete.test.mjs`

- [ ] **Step 3.1 — Write failing tests**

Create `tests/address-autocomplete.test.mjs`:

```js
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Stub fetch globally before importing the module
const mockFetch = mock.fn();
globalThis.fetch = mockFetch;

const { fetchAddressSuggestions } = await import('../src/address-autocomplete.js');

function makeResponse(features) {
  return {
    ok: true,
    json: async () => ({ features }),
  };
}

test('maps street + housenumber into strasse', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([{
    properties: { street: 'Hauptstraße', housenumber: '12', postcode: '10115', city: 'Berlin' },
  }]));
  const results = await fetchAddressSuggestions('Hauptstr');
  assert.equal(results.length, 1);
  assert.equal(results[0].strasse, 'Hauptstraße 12');
  assert.equal(results[0].plz, '10115');
  assert.equal(results[0].ort, 'Berlin');
});

test('street without housenumber uses street alone', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([{
    properties: { street: 'Ringstraße', postcode: '01067', city: 'Dresden' },
  }]));
  const results = await fetchAddressSuggestions('Ring');
  assert.equal(results[0].strasse, 'Ringstraße');
});

test('falls back to town then village when city is missing', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([{
    properties: { street: 'Dorfweg', housenumber: '3', postcode: '98765', town: 'Kleindorf' },
  }]));
  const results = await fetchAddressSuggestions('Dorf');
  assert.equal(results[0].ort, 'Kleindorf');
});

test('filters out results without a street', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([
    { properties: { postcode: '10115', city: 'Berlin' } },
    { properties: { street: 'Goethestraße', housenumber: '1', postcode: '60313', city: 'Frankfurt' } },
  ]));
  const results = await fetchAddressSuggestions('Goethe');
  assert.equal(results.length, 1);
  assert.equal(results[0].strasse, 'Goethestraße 1');
});

test('label joins strasse, plz, ort', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([{
    properties: { street: 'Musterweg', housenumber: '7', postcode: '12345', city: 'Musterstadt' },
  }]));
  const results = await fetchAddressSuggestions('Muster');
  assert.equal(results[0].label, 'Musterweg 7, 12345, Musterstadt');
});

test('throws when fetch returns non-ok', async () => {
  mockFetch.mock.mockImplementationOnce(async () => ({ ok: false }));
  await assert.rejects(
    () => fetchAddressSuggestions('test'),
    /Adresssuche fehlgeschlagen/,
  );
});

test('passes countrycode=de and lang=de in URL', async () => {
  let capturedUrl;
  mockFetch.mock.mockImplementationOnce(async (url) => {
    capturedUrl = url;
    return makeResponse([]);
  });
  await fetchAddressSuggestions('berlin');
  assert.ok(capturedUrl.includes('countrycode=de'), 'missing countrycode');
  assert.ok(capturedUrl.includes('lang=de'), 'missing lang');
});
```

- [ ] **Step 3.2 — Run test to confirm failures**

```
node --test tests/address-autocomplete.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` — file does not exist yet.

- [ ] **Step 3.3 — Create src/address-autocomplete.js**

```js
const PHOTON = 'https://photon.komoot.io/api';

export async function fetchAddressSuggestions(query) {
  const url = `${PHOTON}?q=${encodeURIComponent(query)}&lang=de&limit=5&countrycode=de`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Adresssuche fehlgeschlagen');
  const json = await res.json();
  return (json.features ?? [])
    .map(f => {
      const p      = f.properties ?? {};
      const street = p.street ?? '';
      const nr     = p.housenumber ?? '';
      const strasse = nr ? `${street} ${nr}` : street;
      const plz    = p.postcode ?? '';
      const ort    = p.city ?? p.town ?? p.village ?? '';
      if (!strasse) return null;
      const label = [strasse, plz, ort].filter(Boolean).join(', ');
      return { label, strasse, plz, ort };
    })
    .filter(Boolean);
}
```

- [ ] **Step 3.4 — Run tests**

```
node --test tests/address-autocomplete.test.mjs
```

Expected: all 7 tests pass.

- [ ] **Step 3.5 — Commit**

```
git add src/address-autocomplete.js tests/address-autocomplete.test.mjs
git commit -m "feat: add Photon address autocomplete module"
```

---

## Task 4: BDEW API — add address fields to searchMsb

**Files:**
- Modify: `src/bdew-api.js`
- Create: `tests/bdew-api.test.mjs`

- [ ] **Step 4.1 — Write failing tests**

Create `tests/bdew-api.test.mjs`:

```js
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const mockFetch = mock.fn();
globalThis.fetch = mockFetch;

const { searchMsb } = await import('../src/bdew-api.js');

function makeResponse(records) {
  return {
    ok: true,
    json: async () => ({ Records: records }),
  };
}

test('searchMsb maps id, name, strasse, plz, ort', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([{
    Id: 42,
    Company: ' Stadtwerke Muster AG ',
    Street: 'Bahnhofstraße 10',
    ZipCode: '12345',
    City: 'Musterstadt',
  }]));
  const results = await searchMsb('stadtwerke');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 42);
  assert.equal(results[0].name, 'Stadtwerke Muster AG');
  assert.equal(results[0].strasse, 'Bahnhofstraße 10');
  assert.equal(results[0].plz, '12345');
  assert.equal(results[0].ort, 'Musterstadt');
});

test('searchMsb handles missing address fields gracefully', async () => {
  mockFetch.mock.mockImplementationOnce(async () => makeResponse([{
    Id: 1,
    Company: 'NoAddress GmbH',
  }]));
  const results = await searchMsb('no');
  assert.equal(results[0].strasse, '');
  assert.equal(results[0].plz, '');
  assert.equal(results[0].ort, '');
});

test('searchMsb throws on non-ok response', async () => {
  mockFetch.mock.mockImplementationOnce(async () => ({ ok: false }));
  await assert.rejects(() => searchMsb('x'), /BDEW-Suche fehlgeschlagen/);
});
```

- [ ] **Step 4.2 — Run test to confirm failures**

```
node --test tests/bdew-api.test.mjs
```

Expected: `results[0].strasse` is undefined (field not yet mapped).

- [ ] **Step 4.3 — Update src/bdew-api.js**

Full file after edit:

```js
const BASE = 'https://bdew-codes.de/Codenumbers/BDEWCodes';

export async function searchMsb(query) {
  const res = await fetch(
    `${BASE}/GetCompanyList?jtStartIndex=0&jtPageSize=20`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ filter: query }).toString(),
    },
  );
  if (!res.ok) throw new Error('BDEW-Suche fehlgeschlagen');
  const data = await res.json();
  return (data.Records ?? []).map(r => ({
    id:      r.Id,
    name:    r.Company.trim(),
    strasse: (r.Street   ?? '').trim(),
    plz:     (r.ZipCode  ?? '').trim(),
    ort:     (r.City     ?? '').trim(),
  }));
}

export async function fetchMsbCode(companyId) {
  const res = await fetch(
    `${BASE}/GetBdewCodeListOfCompany?companyId=${companyId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'jtStartIndex=0&jtPageSize=50',
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const msb = (data.Records ?? []).find(r => r.MarketFunctionName === 'Messstellenbetreiber');
  return msb?.BdewCode ?? null;
}
```

**Note:** The exact field names `Street`, `ZipCode`, `City` are assumed from common BDEW API patterns. If they differ, `console.log(r)` on a real result and update the field names accordingly — only these three lines change.

- [ ] **Step 4.4 — Run tests**

```
node --test tests/bdew-api.test.mjs
```

Expected: all 3 tests pass.

- [ ] **Step 4.5 — Commit**

```
git add src/bdew-api.js tests/bdew-api.test.mjs
git commit -m "feat: return strasse/plz/ort from searchMsb (BDEW API)"
```

---

## Task 5: UI helpers — addressBlock() in render.js and CSS

**Files:**
- Modify: `src/ui/render.js`
- Modify: `styles.css`

No automated test (DOM-only). Covered by manual QA in Task 6.

- [ ] **Step 5.1 — Add addressBlock() to render.js**

Append the following export to `src/ui/render.js` (after the existing `renderStepNav` function):

```js
export function addressBlock({ prefix, label, values, errors }) {
  const strId = `${prefix}.strasse`;
  const plzId = `${prefix}.plz`;
  const ortId = `${prefix}.ort`;
  return el('div', { class: 'address-block' },
    el('label', {}, label),
    el('div', { class: 'autocomplete-wrap' },
      el('input', {
        id: strId, type: 'text', value: values.strasse ?? '',
        autocomplete: 'off',
        ...(errors[strId] ? { class: 'invalid' } : {}),
      }),
      el('ul', {
        class: 'autocomplete-drop',
        id: `${prefix}-addr-drop`,
        role: 'listbox',
        hidden: 'hidden',
      }),
    ),
    errors[strId] ? el('div', { class: 'field-error' }, errors[strId]) : null,
    el('div', { class: 'addr-row2' },
      el('div', {},
        el('label', { for: plzId }, 'PLZ'),
        el('input', {
          id: plzId, type: 'text', value: values.plz ?? '',
          style: 'width: 6em',
          ...(errors[plzId] ? { class: 'invalid' } : {}),
        }),
        errors[plzId] ? el('div', { class: 'field-error' }, errors[plzId]) : null,
      ),
      el('div', { style: 'flex: 1' },
        el('label', { for: ortId }, 'Ort'),
        el('input', {
          id: ortId, type: 'text', value: values.ort ?? '',
          ...(errors[ortId] ? { class: 'invalid' } : {}),
        }),
        errors[ortId] ? el('div', { class: 'field-error' }, errors[ortId]) : null,
      ),
    ),
  );
}
```

- [ ] **Step 5.2 — Add CSS for address block layout**

Append to `styles.css`:

```css
.address-block { margin-top: 14px; }
.address-block > label { display: block; font-weight: 600; }
.addr-row2 {
  display: flex; gap: 8px; margin-top: 6px; max-width: 480px;
}
.addr-row2 > div { display: flex; flex-direction: column; }
.addr-row2 input { width: 100%; }
```

- [ ] **Step 5.3 — Commit**

```
git add src/ui/render.js styles.css
git commit -m "feat: add addressBlock() helper and addr-row2 CSS"
```

---

## Task 6: Step 1 UI — replace textareas, add Photon wiring, extend selectMsb

**Files:**
- Modify: `src/ui/step1.js`

This is a full rewrite of step1.js. Replace the entire file contents:

- [ ] **Step 6.1 — Replace src/ui/step1.js**

```js
import { el, field, radioGroup, addressBlock } from './render.js';
import { searchMsb, fetchMsbCode } from '../bdew-api.js';
import { fetchAddressSuggestions } from '../address-autocomplete.js';

export function renderStep1(state, errors, onChange) {
  return el('section', {},
    el('h2', {}, 'Stammdaten & Messstellenbetreiber'),

    addressBlock({
      prefix: 'objekt',
      label:  'Objekt-Adresse',
      values: state.objekt,
      errors,
    }),

    field({
      id:    'anschlussnutzer.name',
      label: 'Anschlussnutzer (Name)',
      value: state.anschlussnutzer.name,
      error: errors['anschlussnutzer.name'],
    }),

    addressBlock({
      prefix: 'anschlussnutzer',
      label:  'Anschlussnutzer (Adresse)',
      values: state.anschlussnutzer,
      errors,
    }),

    el('div', {},
      el('label', { for: 'msb.name' }, 'MSB Name'),
      el('div', { class: 'autocomplete-wrap' },
        el('input', {
          id: 'msb.name', type: 'text', value: state.msb.name, autocomplete: 'off',
          ...(errors['msb.name'] ? { class: 'invalid' } : {}),
        }),
        el('ul', { class: 'autocomplete-drop', id: 'msb-drop', role: 'listbox', hidden: 'hidden' }),
      ),
      errors['msb.name'] ? el('div', { class: 'field-error' }, errors['msb.name']) : null,
    ),

    field({
      id:    'msb.codeNr',
      label: 'MSB Code-Nr.',
      value: state.msb.codeNr,
      error: errors['msb.codeNr'],
    }),

    addressBlock({
      prefix: 'msb',
      label:  'MSB-Adresse',
      values: state.msb,
      errors,
    }),

    radioGroup({
      id:    'msb.knownToAdvizeo',
      label: 'Besteht bereits eine Kooperation mit Advizeo?',
      options: [
        { value: 'true',  label: 'Ja'   },
        { value: 'false', label: 'Nein' },
      ],
      value: state.msb.knownToAdvizeo === null ? '' : String(state.msb.knownToAdvizeo),
      error:  errors['msb.knownToAdvizeo'],
      helper: state.msb.knownToAdvizeo === false
        ? 'Zusätzlich wird eine MSB-Anfrage-E-Mail mit Kontaktdatenblatt generiert.'
        : null,
    }),
  );
}

let _msbTimer   = null;
const _addrTimers = {};

export function wireStep1(root, onChange, signal) {
  root.addEventListener('input', e => {
    const t = e.target;
    if (!t.id) return;
    onChange(t.id, t.value);
  }, { signal });

  root.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'radio' && t.name === 'msb.knownToAdvizeo') {
      onChange('msb.knownToAdvizeo', t.value === 'true');
    }
  }, { signal });

  wireMsbAutocomplete(root, onChange, signal);
  wireAddressAutocomplete(root, 'objekt',          onChange, signal);
  wireAddressAutocomplete(root, 'anschlussnutzer', onChange, signal);
}

// ── Photon address autocomplete ──────────────────────────────────────────────

function wireAddressAutocomplete(root, prefix, onChange, signal) {
  const input = root.querySelector(`[id="${prefix}.strasse"]`);
  const drop  = root.querySelector(`#${prefix}-addr-drop`);
  if (!input || !drop) return;

  input.addEventListener('input', () => {
    clearTimeout(_addrTimers[prefix]);
    const q = input.value.trim();
    if (q.length < 3) { hideDrop(drop); return; }
    _addrTimers[prefix] = setTimeout(
      () => fetchAndShowAddresses(q, drop, prefix, onChange, signal),
      300,
    );
  }, { signal });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape')   { hideDrop(drop); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); drop.querySelector('li')?.focus(); }
  }, { signal });

  drop.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.target.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); (e.target.previousElementSibling ?? input).focus(); }
    if (e.key === 'Escape')    { hideDrop(drop); input.focus(); }
    if (e.key === 'Enter')     { e.preventDefault(); e.target.click(); }
  }, { signal });

  document.addEventListener('mousedown', e => {
    if (!input.closest('.autocomplete-wrap')?.contains(e.target)) hideDrop(drop);
  }, { signal });
}

async function fetchAndShowAddresses(q, drop, prefix, onChange, signal) {
  let results;
  try { results = await fetchAddressSuggestions(q); } catch { return; }
  if (signal.aborted) return;
  drop.replaceChildren(
    ...results.map(r => {
      const li = document.createElement('li');
      li.textContent = r.label;
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');
      li.addEventListener('click', () => {
        hideDrop(drop);
        onChange(`${prefix}.strasse`, r.strasse);
        onChange(`${prefix}.plz`,     r.plz);
        onChange(`${prefix}.ort`,     r.ort);
      });
      return li;
    }),
  );
  drop.hidden = results.length === 0;
}

// ── BDEW MSB autocomplete ────────────────────────────────────────────────────

function wireMsbAutocomplete(root, onChange, signal) {
  const input = root.querySelector('[id="msb.name"]');
  const drop  = root.querySelector('#msb-drop');
  if (!input || !drop) return;

  input.addEventListener('input', () => {
    clearTimeout(_msbTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideDrop(drop); return; }
    _msbTimer = setTimeout(() => fetchAndShowMsb(q, drop, onChange, signal), 300);
  }, { signal });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape')    { hideDrop(drop); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); drop.querySelector('li')?.focus(); }
  }, { signal });

  drop.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.target.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); (e.target.previousElementSibling ?? input).focus(); }
    if (e.key === 'Escape')    { hideDrop(drop); input.focus(); }
    if (e.key === 'Enter')     { e.preventDefault(); e.target.click(); }
  }, { signal });

  document.addEventListener('mousedown', e => {
    if (!root.querySelector('.autocomplete-wrap')?.contains(e.target)) hideDrop(drop);
  }, { signal });
}

async function fetchAndShowMsb(q, drop, onChange, signal) {
  let results;
  try { results = await searchMsb(q); } catch { return; }
  if (signal.aborted) return;
  drop.replaceChildren(
    ...results.map(r => {
      const li = document.createElement('li');
      li.textContent = r.name;
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');
      li.addEventListener('click', () => selectMsb(r, drop, onChange));
      return li;
    }),
  );
  drop.hidden = results.length === 0;
}

function hideDrop(drop) {
  drop.hidden = true;
  drop.replaceChildren();
}

async function selectMsb(company, drop, onChange) {
  hideDrop(drop);
  onChange('msb.name',    company.name);
  onChange('msb.strasse', company.strasse);
  onChange('msb.plz',     company.plz);
  onChange('msb.ort',     company.ort);
  let code;
  try { code = await fetchMsbCode(company.id); } catch { return; }
  if (code) onChange('msb.codeNr', code);
}
```

- [ ] **Step 6.2 — Run full test suite to make sure nothing broke**

```
node --test tests/*.test.mjs
```

Expected: all tests pass (step1.js has no unit tests — DOM only).

- [ ] **Step 6.3 — Commit**

```
git add src/ui/step1.js
git commit -m "feat: replace address textareas with split fields + Photon autocomplete"
```

---

## Task 7: main.js — update toTemplateData()

**Files:**
- Modify: `src/main.js`

- [ ] **Step 7.1 — Update toTemplateData() in src/main.js**

Locate the `toTemplateData` function (line ~146) and replace its body:

```js
function toTemplateData(s) {
  const seen = new Set();
  const messprodukten = [];
  for (const row of s.messpunkte) {
    if (!row.id) continue;
    const code = messprodukt(row.kind, row.richtung);
    if (!seen.has(code)) {
      seen.add(code);
      messprodukten.push({ CODE: code, BEZEICHNUNG: BEZEICHNUNG[code] ?? '' });
    }
  }

  return {
    // Docx tokens — backward-compatible; template unchanged
    OBJEKT_ADRESSE:          `${s.objekt.strasse}\n${s.objekt.plz} ${s.objekt.ort}`.trim(),
    ANSCHLUSSNUTZER_NAME:    s.anschlussnutzer.name,
    ANSCHLUSSNUTZER_ADRESSE: `${s.anschlussnutzer.strasse}\n${s.anschlussnutzer.plz} ${s.anschlussnutzer.ort}`.trim(),

    // PDF AcroForm tokens
    ANSCHLUSSNUTZER_STRASSE: s.anschlussnutzer.strasse,
    ANSCHLUSSNUTZER_PLZ_ORT: `${s.anschlussnutzer.plz} ${s.anschlussnutzer.ort}`.trim(),
    MSB_NAME:                s.msb.name,
    MSB_CODE_NR:             s.msb.codeNr,
    MSB_STRASSE:             s.msb.strasse,
    MSB_PLZ_ORT:             `${s.msb.plz} ${s.msb.ort}`.trim(),
    ESA_NAME:                s.esa.name,
    ESA_STRASSE:             'Zum Gunterstal 6',
    ESA_PLZ_ORT:             '66440 Blieskastel',
    ESA_MARKTPARTNER_ID:     s.esa.marktpartnerId,
    BEGINN_DATUM:            germanDate(s.beginnDatum),
    ENDE_DATUM:              s.endeDatum ? germanDate(s.endeDatum) : 'offen',

    // Messpunkte for docx loop
    MESSPUNKTE: s.messpunkte.map(row => ({
      TYP:         row.kind,
      ID:          row.id,
      RICHTUNG:    row.richtung,
      MESSPRODUKT: messprodukt(row.kind, row.richtung),
    })),

    // Deduplicated messprodukt codes for PDF consent form
    MESSPRODUKTEN: messprodukten,
  };
}
```

- [ ] **Step 7.2 — Run full test suite**

```
node --test tests/*.test.mjs
```

Expected: all tests pass (toTemplateData has no direct unit test — its correctness is validated end-to-end by the generate flow).

- [ ] **Step 7.3 — Commit**

```
git add src/main.js
git commit -m "feat: update toTemplateData with split address tokens"
```

---

## Task 8: pdf-fill.js — update SCALARS array

**Files:**
- Modify: `src/pdf-fill.js`

- [ ] **Step 8.1 — Replace SCALARS in src/pdf-fill.js**

Find the `SCALARS` constant (line ~19) and replace it:

```js
const SCALARS = [
  'ANSCHLUSSNUTZER_NAME',
  'ANSCHLUSSNUTZER_STRASSE',
  'ANSCHLUSSNUTZER_PLZ_ORT',
  'ESA_NAME',
  'ESA_STRASSE',
  'ESA_PLZ_ORT',
  'ESA_MARKTPARTNER_ID',
  'MSB_NAME',
  'MSB_STRASSE',
  'MSB_PLZ_ORT',
  'MSB_CODE_NR',
  'BEGINN_DATUM',
  'ENDE_DATUM',
];
```

- [ ] **Step 8.2 — Run full test suite**

```
node --test tests/*.test.mjs
```

Expected: all tests pass.

- [ ] **Step 8.3 — Commit**

```
git add src/pdf-fill.js
git commit -m "feat: update pdf-fill SCALARS for split address fields"
```

---

## Task 9: Build script — add AcroForm fields to PDF template

**Files:**
- Create: `scripts/add-pdf-fields.mjs`
- Regenerate: `templates/einwilligungserklaerung.pdf`

The script uses `pdf-lib` (already in devDependencies) to add text fields to the Muster-Formular at hardcoded coordinates. Coordinates below are **estimated** based on the A4 layout — verify visually after first run and adjust constants as needed.

- [ ] **Step 9.1 — Create scripts/add-pdf-fields.mjs**

```js
import { PDFDocument, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

const PDF_IN  = 'templates/einwilligungserklaerung.pdf';
const PDF_OUT = 'templates/einwilligungserklaerung.pdf';

// ── Coordinate constants (points from bottom-left, A4 = 595.28 × 841.89) ───
// Adjust these if fields land outside their table cells after visual check.

const VAL_X  = 200;   // left edge of value column
const VAL_W  = 335;   // width of value column (to ~535pt)
const FH     = 14;    // field height

// Page 1 — Anschlussnutzer
const AN_NAME    = { page: 0, x: VAL_X, y: 640, w: VAL_W, h: FH };
const AN_STRASSE = { page: 0, x: VAL_X, y: 619, w: VAL_W, h: FH };
const AN_PLZ_ORT = { page: 0, x: VAL_X, y: 598, w: VAL_W, h: FH };

// Page 1 — ESA (read-only, pre-filled)
const ESA_NAME   = { page: 0, x: VAL_X, y: 555, w: VAL_W, h: FH };
const ESA_STR    = { page: 0, x: VAL_X, y: 534, w: VAL_W, h: FH };
const ESA_PLZ    = { page: 0, x: VAL_X, y: 513, w: VAL_W, h: FH };
const ESA_MPID   = { page: 0, x: VAL_X, y: 492, w: VAL_W, h: FH };

// Page 1 — MSB
const MSB_NAME   = { page: 0, x: VAL_X, y: 449, w: VAL_W, h: FH };
const MSB_STR    = { page: 0, x: VAL_X, y: 428, w: VAL_W, h: FH };
const MSB_PLZ    = { page: 0, x: VAL_X, y: 407, w: VAL_W, h: FH };
const MSB_CODE   = { page: 0, x: VAL_X, y: 386, w: VAL_W, h: FH };

// Page 1 — Zeitraum
const BEGINN     = { page: 0, x: VAL_X, y: 333, w: 160,   h: FH };
const ENDE       = { page: 0, x: VAL_X, y: 312, w: 160,   h: FH };

// Page 2 — Messprodukten table (10 rows)
const MP_CODE_X  = 57;
const MP_CODE_W  = 100;
const MP_BEZ_X   = 160;
const MP_BEZ_W   = 375;
const MP_ROW_START_Y = 663;
const MP_ROW_H   = 21;  // row pitch

// ── Helpers ─────────────────────────────────────────────────────────────────

function addField(form, pages, name, coords, readOnly = false) {
  const tf = form.createTextField(name);
  tf.addToPage(pages[coords.page], {
    x: coords.x, y: coords.y, width: coords.w, height: coords.h,
    borderWidth: 0,
    backgroundColor: rgb(1, 1, 0.85),  // pale yellow so fields are visible
  });
  if (readOnly) tf.enableReadOnly();
}

// ── Main ─────────────────────────────────────────────────────────────────────

const bytes = readFileSync(PDF_IN);
const pdf   = await PDFDocument.load(bytes);
const form  = pdf.getForm();
const pages = pdf.getPages();

// Anschlussnutzer
addField(form, pages, 'ANSCHLUSSNUTZER_NAME',    AN_NAME);
addField(form, pages, 'ANSCHLUSSNUTZER_STRASSE', AN_STRASSE);
addField(form, pages, 'ANSCHLUSSNUTZER_PLZ_ORT', AN_PLZ_ORT);

// ESA (read-only)
addField(form, pages, 'ESA_NAME',           ESA_NAME,  true);
addField(form, pages, 'ESA_STRASSE',        ESA_STR,   true);
addField(form, pages, 'ESA_PLZ_ORT',        ESA_PLZ,   true);
addField(form, pages, 'ESA_MARKTPARTNER_ID',ESA_MPID,  true);

// MSB
addField(form, pages, 'MSB_NAME',    MSB_NAME);
addField(form, pages, 'MSB_STRASSE', MSB_STR);
addField(form, pages, 'MSB_PLZ_ORT', MSB_PLZ);
addField(form, pages, 'MSB_CODE_NR', MSB_CODE);

// Zeitraum
addField(form, pages, 'BEGINN_DATUM', BEGINN);
addField(form, pages, 'ENDE_DATUM',   ENDE);

// Messprodukten (10 rows on page 2)
for (let i = 0; i < 10; i++) {
  const y = MP_ROW_START_Y - i * MP_ROW_H;
  addField(form, pages, `MP_${i + 1}_CODE`,       { page: 1, x: MP_CODE_X, y, w: MP_CODE_W, h: FH });
  addField(form, pages, `MP_${i + 1}_BEZEICHNUNG`,{ page: 1, x: MP_BEZ_X,  y, w: MP_BEZ_W,  h: FH });
}

const out = await pdf.save();
writeFileSync(PDF_OUT, out);
console.log(`Written: ${PDF_OUT}  (${Math.round(out.length / 1024)} KB)`);
console.log('Open in Adobe Reader / browser and verify each field sits inside its table cell.');
console.log('If a field is misaligned, adjust the coordinate constant in this script and re-run.');
```

- [ ] **Step 9.2 — Run the script**

```
node scripts/add-pdf-fields.mjs
```

Expected output:
```
Written: templates/einwilligungserklaerung.pdf  (NNN KB)
Open in Adobe Reader / browser and verify each field sits inside its table cell.
```

- [ ] **Step 9.3 — Open the PDF and verify field positions**

Open `templates/einwilligungserklaerung.pdf` in a browser (`file://...`) or Adobe Reader. You should see pale-yellow rectangles inside the table cells. Click each one to confirm it's interactive.

If any field is outside its cell: edit the corresponding coordinate constant at the top of `scripts/add-pdf-fields.mjs` and re-run Step 9.2. Repeat until all fields sit correctly.

Common adjustments:
- Field too high → decrease `y` by 5–10
- Field too low → increase `y` by 5–10
- Field too wide → decrease `w`
- Field overlaps left label column → increase `VAL_X`

- [ ] **Step 9.4 — Commit**

```
git add scripts/add-pdf-fields.mjs templates/einwilligungserklaerung.pdf
git commit -m "feat: add AcroForm fields to Einwilligungserklaerung PDF template"
```

---

## Task 10: manifest.json — add Photon host permission

**Files:**
- Modify: `manifest.json`

- [ ] **Step 10.1 — Add photon.komoot.io to host_permissions**

In `manifest.json`, change:

```json
"host_permissions": ["https://bdew-codes.de/*"],
```

to:

```json
"host_permissions": [
  "https://bdew-codes.de/*",
  "https://photon.komoot.io/*"
],
```

- [ ] **Step 10.2 — Run full test suite one last time**

```
node --test tests/*.test.mjs
```

Expected: all tests pass.

- [ ] **Step 10.3 — Commit**

```
git add manifest.json
git commit -m "feat: add photon.komoot.io host permission for address autocomplete"
```

---

## Final manual QA checklist

After all tasks complete, load the extension (`chrome://extensions` → Load unpacked → pick the worktree folder) and verify:

- [ ] Step 1 shows: Objekt-Adresse block (Straße input + PLZ/Ort row), Anschlussnutzer Name, Anschlussnutzer Adresse block, MSB Name autocomplete, MSB Code-Nr., MSB-Adresse block, Kooperation radio
- [ ] Typing 3+ chars in an Objekt or Anschlussnutzer Straße field shows a Photon dropdown; clicking a result fills all three sub-fields
- [ ] Typing 2+ chars in MSB Name shows the BDEW dropdown; clicking fills Name, Straße, PLZ, Ort, and (after a moment) Code-Nr.
- [ ] PLZ field rejects non-5-digit input (red border + error message)
- [ ] Generating with valid data downloads the PDF; open it and confirm all AcroForm fields contain the correct values
- [ ] Generating also downloads the .docx; open in Word and confirm address lines render correctly (street on one line, PLZ+Ort on the next)

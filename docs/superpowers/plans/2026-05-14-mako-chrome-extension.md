# MaKo Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension (`Formularis_ausfüllio`) that turns a 3-step wizard of customer data into a downloadable bundle of MaKo documents: a filled Einwilligungserklärung (.docx + signable .pdf) always, plus a Kontaktdatenblatt (.xlsx) and pre-drafted .eml when the MSB has no prior relationship with Advizeo.

**Architecture:** Single MV3 extension page (`form.html`) acting as a full-page wizard. No content scripts, no background work beyond opening the tab. Pure-JS modules under `src/`, vendored UMD libraries under `vendor/`. Templates (.docx with `{{TOKENS}}`, .pdf with named AcroForm fields, .xlsx) shipped inside the extension; the generation pipeline is `validate → fillDocx → fillPdf → (fillXlsx → buildEml) → chrome.downloads`. State persists in `chrome.storage.local`. No build step required to run the extension; Node + `npm install` is only used for tests and one-time vendor copying.

**Tech Stack:** Manifest V3, vanilla ES2022 modules, `docxtemplater` + `pizzip` for .docx, `pdf-lib` for .pdf AcroForm fill, `exceljs` for .xlsx, hand-rolled MIME for .eml. Node `--test` runner for unit tests, `mailparser` (dev-only) to assert .eml outputs.

**Spec:** `docs/superpowers/specs/2026-05-13-mako-chrome-extension-design.md`

---

## File map

Files this plan will create or touch:

```
manifest.json                                    Task 1
background.js                                    Task 1
form.html                                        Task 1, 13, 14, 15, 16
styles.css                                       Task 13, 14, 15, 16, 18
package.json                                     Task 1
.gitignore                                       Task 1
scripts/copy-vendor.mjs                          Task 2
vendor/                                          Task 2 (committed binaries)
src/messprodukt.js                               Task 3
src/slug.js                                      Task 4
src/validate.js                                  Task 5
src/email-template.js                            Task 6
src/form-state.js                                Task 7
src/docx-fill.js                                 Task 8
src/pdf-fill.js                                  Task 9
src/xlsx-fill.js                                 Task 10
src/eml-build.js                                 Task 11
src/download.js                                  Task 12
src/main.js                                      Task 17
src/ui/render.js                                 Task 13
src/ui/step1.js                                  Task 14
src/ui/step2.js                                  Task 15
src/ui/step3.js                                  Task 16
src/ui/modal.js                                  Task 18
templates/einwilligungserklaerung.docx           Task 8 (test fixture, replaced before ship)
templates/einwilligungserklaerung.pdf            Task 9 (test fixture, replaced before ship)
templates/kontaktdatenblatt.xlsx                 Task 10 (test fixture, replaced before ship)
tests/fixtures/build-fixtures.mjs                Task 8 (generator for stand-in templates)
tests/messprodukt.test.mjs                       Task 3
tests/slug.test.mjs                              Task 4
tests/validate.test.mjs                          Task 5
tests/email-template.test.mjs                    Task 6
tests/form-state.test.mjs                        Task 7
tests/docx-fill.test.mjs                         Task 8
tests/pdf-fill.test.mjs                          Task 9
tests/xlsx-fill.test.mjs                         Task 10
tests/eml-build.test.mjs                         Task 11
tests/download.test.mjs                          Task 12
icons/icon-16.png, icon-48.png, icon-128.png     Task 19 (placeholder)
README.md                                        Task 20
```

Each src file owns one responsibility (slug, validate, fill-format-X, eml-build, etc.). UI is split per wizard step. `main.js` is the only orchestrator.

---

## Task 1: Bootstrap MV3 extension skeleton

**Files:**
- Create: `manifest.json`, `background.js`, `form.html`, `package.json`, `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "formularis-ausfuellio",
  "version": "0.1.0",
  "description": "Chrome extension generating MaKo document bundles for Advizeo Deutschland",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "copy-vendor": "node scripts/copy-vendor.mjs"
  },
  "devDependencies": {
    "docxtemplater": "^3.50.0",
    "pizzip": "^3.1.7",
    "pdf-lib": "^1.17.1",
    "exceljs": "^4.4.0",
    "mailparser": "^3.7.1"
  }
}
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Formularis ausfüllio",
  "short_name": "MaKo",
  "version": "0.1.0",
  "description": "Generiert MaKo-Dokumente (Einwilligungserklärung, Kontaktdatenblatt, MSB-Anfrage) für Advizeo.",
  "default_locale": "de",
  "permissions": ["downloads", "storage"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_title": "MaKo Dokumente erstellen",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 4: Create `background.js`**

```js
// Single responsibility: open the wizard tab when the toolbar icon is clicked.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('form.html');
  const existing = await chrome.tabs.query({ url });
  if (existing.length > 0) {
    await chrome.tabs.update(existing[0].id, { active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});
```

- [ ] **Step 5: Create minimal `form.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>MaKo Dokumente erstellen</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="app"><p>Lade…</p></main>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create placeholder `src/main.js`**

```js
document.getElementById('app').innerHTML = '<h1>MaKo</h1><p>Skeleton OK.</p>';
```

- [ ] **Step 7: Create placeholder icons**

Create three blank PNG files (any image of the right dimensions) at `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`. The pink MAKO wordmark replaces them in Task 19.

```bash
# In bash with imagemagick installed; otherwise create any solid-pink PNG manually
mkdir -p icons
for size in 16 48 128; do
  magick -size ${size}x${size} xc:#E6007E icons/icon-${size}.png
done
```

If imagemagick is unavailable, save any 16×16 / 48×48 / 128×128 solid-pink PNGs by hand at those paths. The point is just to have valid manifest references.

- [ ] **Step 8: Run npm install**

```bash
npm install
```

Expected: `node_modules/` populated; `package-lock.json` created.

- [ ] **Step 9: Manual smoke test**

Open Chrome → `chrome://extensions` → Developer mode ON → "Load unpacked" → select repo root. Pin the MAKO icon. Click it. Expected: a new tab opens at `chrome-extension://<id>/form.html` showing "Skeleton OK." Confirm before committing.

- [ ] **Step 10: Commit**

```bash
git add manifest.json background.js form.html package.json package-lock.json .gitignore src/main.js icons/
git commit -m "chore: bootstrap MV3 extension skeleton"
```

---

## Task 2: Vendor third-party libraries for runtime

**Files:**
- Create: `scripts/copy-vendor.mjs`
- Create: `vendor/docxtemplater.js`, `vendor/pizzip.js`, `vendor/pdf-lib.min.js`, `vendor/exceljs.min.js`
- Create: `vendor/README.md`

**Why:** The extension itself has no build step. It needs UMD bundles of the libraries it uses, served from inside the extension folder (MV3 forbids remote code). We `npm install` for tests, then copy specific files into `vendor/`.

- [ ] **Step 1: Write the copy script**

Create `scripts/copy-vendor.mjs`:

```js
// Copies UMD browser bundles from node_modules into vendor/ for the extension.
// Re-run after `npm install` to refresh.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const copies = [
  ['node_modules/pizzip/dist/pizzip.js',                     'vendor/pizzip.js'],
  ['node_modules/docxtemplater/build/docxtemplater.js',      'vendor/docxtemplater.js'],
  ['node_modules/pdf-lib/dist/pdf-lib.min.js',               'vendor/pdf-lib.min.js'],
  ['node_modules/exceljs/dist/exceljs.min.js',               'vendor/exceljs.min.js'],
];

await mkdir(resolve(root, 'vendor'), { recursive: true });
for (const [from, to] of copies) {
  await copyFile(resolve(root, from), resolve(root, to));
  console.log(`copied ${from} → ${to}`);
}
```

- [ ] **Step 2: Run the copy script**

```bash
npm run copy-vendor
```

Expected output: 4 `copied …` lines. `vendor/` populated.

- [ ] **Step 3: Document vendored versions**

Create `vendor/README.md`:

```markdown
# Vendored libraries

Copied from `node_modules/` by `scripts/copy-vendor.mjs` (run `npm run copy-vendor`).

| File | npm package | Version source |
|---|---|---|
| `pizzip.js` | pizzip | `package.json` devDependency |
| `docxtemplater.js` | docxtemplater | `package.json` devDependency |
| `pdf-lib.min.js` | pdf-lib | `package.json` devDependency |
| `exceljs.min.js` | exceljs | `package.json` devDependency |

To update: bump the version in `package.json`, `npm install`, `npm run copy-vendor`, commit.
```

- [ ] **Step 4: Smoke-test that the bundles load in the extension**

Edit `form.html` body (above the `<script type="module">`) to:

```html
<script src="vendor/pizzip.js"></script>
<script src="vendor/docxtemplater.js"></script>
<script src="vendor/pdf-lib.min.js"></script>
<script src="vendor/exceljs.min.js"></script>
```

Edit `src/main.js` to:

```js
const ok = ['PizZip', 'docxtemplater', 'PDFLib', 'ExcelJS']
  .map(name => `${name}: ${typeof globalThis[name] !== 'undefined' ? 'OK' : 'MISSING'}`)
  .join('<br>');
document.getElementById('app').innerHTML = `<pre>${ok}</pre>`;
```

Reload the extension at `chrome://extensions` (click the ↻ icon on its card). Open the wizard tab. Expected: all four say `OK`.

- [ ] **Step 5: Commit**

```bash
git add scripts/copy-vendor.mjs vendor/ form.html src/main.js package.json
git commit -m "chore: vendor pizzip, docxtemplater, pdf-lib, exceljs for runtime"
```

---

## Task 3: `messprodukt.js` — Lieferrichtung → product code

**Files:**
- Create: `src/messprodukt.js`
- Test: `tests/messprodukt.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/messprodukt.test.mjs
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
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='messprodukt'
```

Expected: All tests fail with "Cannot find module '../src/messprodukt.js'".

- [ ] **Step 3: Implement**

```js
// src/messprodukt.js
const MAP = {
  MeLo: { Verbrauch: '9991000000771', Erzeugung: '9991000000789' },
  MaLo: { Verbrauch: '9991000000747', Erzeugung: '9991000000747' },
};

export function messprodukt(kind, richtung) {
  if (!MAP[kind]) throw new Error(`Unknown kind: ${kind}`);
  if (!MAP[kind][richtung]) throw new Error(`Unknown richtung: ${richtung}`);
  return MAP[kind][richtung];
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='messprodukt'
```

Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/messprodukt.js tests/messprodukt.test.mjs
git commit -m "feat(messprodukt): map (kind, richtung) → BDEW product code"
```

---

## Task 4: `slug.js` — filename slugification

**Files:**
- Create: `src/slug.js`
- Test: `tests/slug.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/slug.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug } from '../src/slug.js';

test('lowercase ASCII passes through', () => {
  assert.equal(slug('hello world'), 'hello-world');
});

test('umlauts folded ASCII-style', () => {
  assert.equal(slug('Müller GmbH'), 'mueller-gmbh');
});

test('eszett folded to ss', () => {
  assert.equal(slug('Großhandel'), 'grosshandel');
});

test('strips reserved filesystem chars', () => {
  assert.equal(slug('a/b:c*d?'), 'a-b-c-d');
});

test('collapses runs of dashes', () => {
  assert.equal(slug('a  -- b'), 'a-b');
});

test('trims leading/trailing dashes', () => {
  assert.equal(slug('-x-'), 'x');
});

test('truncates to 30 chars', () => {
  assert.equal(slug('a'.repeat(50)).length, 30);
});

test('empty input returns "untitled"', () => {
  assert.equal(slug(''), 'untitled');
  assert.equal(slug('   '), 'untitled');
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='slug'
```

Expected: "Cannot find module '../src/slug.js'".

- [ ] **Step 3: Implement**

```js
// src/slug.js
const FOLD = {
  ä: 'ae', ö: 'oe', ü: 'ue',
  Ä: 'ae', Ö: 'oe', Ü: 'ue',
  ß: 'ss',
};

export function slug(input) {
  const folded = String(input ?? '')
    .replace(/[äöüÄÖÜß]/g, ch => FOLD[ch])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return folded || 'untitled';
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='slug'
```

Expected: 8 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/slug.js tests/slug.test.mjs
git commit -m "feat(slug): ASCII-fold filenames with umlauts and reserved chars"
```

---

## Task 5: `validate.js` — form-state validator

**Files:**
- Create: `src/validate.js`
- Test: `tests/validate.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/validate.test.mjs
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
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='validate'
```

Expected: module not found.

- [ ] **Step 3: Implement**

```js
// src/validate.js
const TEXT = s => String(s ?? '').trim();

export function validate(form, today = new Date()) {
  const e = {};
  if (!TEXT(form.objekt?.adresse)) e['objekt.adresse'] = 'Pflichtfeld';
  if (!TEXT(form.anschlussnutzer?.name)) e['anschlussnutzer.name'] = 'Pflichtfeld';
  if (!TEXT(form.anschlussnutzer?.adresse)) e['anschlussnutzer.adresse'] = 'Pflichtfeld';
  if (!TEXT(form.msb?.name)) e['msb.name'] = 'Pflichtfeld';

  const code = TEXT(form.msb?.codeNr);
  if (!/^\d{13}$/.test(code)) e['msb.codeNr'] = 'Code-Nr. muss 13 Ziffern haben';

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

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='validate'
```

Expected: 12 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/validate.js tests/validate.test.mjs
git commit -m "feat(validate): per-field rules for form state"
```

---

## Task 6: `email-template.js` — Notion email strings (verbatim)

**Files:**
- Create: `src/email-template.js`
- Test: `tests/email-template.test.mjs`

The subject and body come straight from the Notion *3. MSB (bilateral): Ankündigung ESA* page. The body uses `\r\n` line endings (RFC 5322 requirement for .eml).

- [ ] **Step 1: Write the failing test**

```js
// tests/email-template.test.mjs
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
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='email-template'
```

- [ ] **Step 3: Implement**

```js
// src/email-template.js
// Source: Notion "3. MSB (bilateral): Ankündigung ESA"
// https://www.notion.so/153a9489ca3880d1a842d7840d104527

export const SUBJECT = 'Anfrage ESA 9985220000009 im Auftrag Anschlussnutzer';

export const BODY_LINES = [
  'Sehr geehrte Damen und Herren,',
  '',
  'als Energieserviceanbieter beabsichtigen wir für von Ihnen betreute Messstellen im Auftrag des Anschlussnutzers Lastgangdaten zu beziehen.',
  '',
  'Unser Kontaktdatenblatt finden Sie im Anhang dieser E-Mail.',
  '',
  'Unser AS4 Zertifikat ist über die Sub-CA "DARZ.CA" abrufbar. Hier finden Sie unser Zertifikat: https://api.makosoftware.de/downloads/certificates/edifact@makosoftware.de/public/raw für folgende 1:1-Kommunikationsadresse: edifact@makosoftware.de.',
  '',
  'Außerdem im Anhang finden Sie die Einwilligungserklärung des Anschlussnutzers.',
  '',
  'Wir möchten Sie bitten, uns in Ihrem System als Marktpartner zu hinterlegen und uns zu informieren, sobald wir den Bestellprozess per EDIFACT Nachricht anstoßen können.',
  '',
  'Bei Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.',
  '',
  'Mit freundlichen Grüßen',
  'Advizeo Deutschland GmbH',
];
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='email-template'
```

- [ ] **Step 5: Commit**

```bash
git add src/email-template.js tests/email-template.test.mjs
git commit -m "feat(email-template): MSB announcement subject + body (verbatim from Notion)"
```

---

## Task 7: `form-state.js` — model, defaults, autosave

**Files:**
- Create: `src/form-state.js`
- Test: `tests/form-state.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/form-state.test.mjs
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
  assert.equal(s.beginnDatum, '2023-05-14');           // today − 3 years
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
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='form-state'
```

- [ ] **Step 3: Implement**

```js
// src/form-state.js
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
    objekt: { adresse: '' },
    anschlussnutzer: { name: '', adresse: '' },
    msb: { name: '', codeNr: '', knownToAdvizeo: null },
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
  // Shallow-merge so newly added fields get defaults
  return { ...defaultState(today), ...stored };
}

export async function saveState(state, storage = chrome.storage) {
  await storage.local.set({ [KEY]: state });
}

export async function resetState(storage = chrome.storage) {
  await storage.local.remove(KEY);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='form-state'
```

- [ ] **Step 5: Commit**

```bash
git add src/form-state.js tests/form-state.test.mjs
git commit -m "feat(form-state): default shape + storage round-trip"
```

---

## Task 8: `docx-fill.js` — fill Einwilligungserklärung Word doc

**Files:**
- Create: `src/docx-fill.js`
- Create: `tests/fixtures/build-fixtures.mjs`
- Create: `templates/einwilligungserklaerung.docx` (built by fixture script)
- Test: `tests/docx-fill.test.mjs`

**Note:** The user will eventually replace `templates/einwilligungserklaerung.docx` with the real Advizeo-authored template. The fixture built here is a minimal, programmatically-generated stand-in with the right tokens so we can develop and test the filler. It must define the same token contract as the real template.

- [ ] **Step 1: Write the fixture builder**

Create `tests/fixtures/build-fixtures.mjs`:

```js
// Generates minimal stand-in templates with the right tokens for tests.
// Run with: node tests/fixtures/build-fixtures.mjs
// The Advizeo-authored real templates replace these before shipping.
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---- DOCX ----
function buildDocxBytes() {
  const wordXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t xml:space="preserve">Objekt: {OBJEKT_ADRESSE}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Anschlussnutzer: {ANSCHLUSSNUTZER_NAME}, {ANSCHLUSSNUTZER_ADRESSE}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">MSB: {MSB_NAME} ({MSB_CODE_NR})</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">ESA: {ESA_NAME} ({ESA_MARKTPARTNER_ID})</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Beginn: {BEGINN_DATUM}  Ende: {ENDE_DATUM}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">{#MESSPUNKTE}- {TYP} {ID} ({RICHTUNG}) [{MESSPRODUKT}]
{/MESSPUNKTE}</w:t></w:r></w:p>
</w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', wordXml);
  return zip.generate({ type: 'nodebuffer' });
}

// ---- PDF ----
async function buildPdfBytes() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  const form = pdf.getForm();
  const scalars = [
    'OBJEKT_ADRESSE', 'ANSCHLUSSNUTZER_NAME', 'ANSCHLUSSNUTZER_ADRESSE',
    'MSB_NAME', 'MSB_CODE_NR', 'ESA_NAME', 'ESA_MARKTPARTNER_ID',
    'BEGINN_DATUM', 'ENDE_DATUM',
  ];
  let y = 760;
  for (const name of scalars) {
    const f = form.createTextField(name);
    f.addToPage(page, { x: 200, y, width: 300, height: 16 });
    y -= 20;
  }
  for (let i = 1; i <= 10; i++) {
    for (const suffix of ['TYP', 'ID', 'RICHTUNG', 'MESSPRODUKT']) {
      const f = form.createTextField(`MP_${i}_${suffix}`);
      f.addToPage(page, { x: 0, y: -100, width: 1, height: 1 });
    }
  }
  return pdf.save();
}

// ---- XLSX ----
async function buildXlsxBytes() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Kontakt');
  ws.getCell('A1').value = 'Anbieter';
  ws.getCell('B1').value = '{{ESA_NAME}}';
  ws.getCell('A2').value = 'Marktpartner-ID';
  ws.getCell('B2').value = '{{ESA_MARKTPARTNER_ID}}';
  return wb.xlsx.writeBuffer();
}

await mkdir(resolve(root, 'templates'), { recursive: true });
await writeFile(resolve(root, 'templates/einwilligungserklaerung.docx'), buildDocxBytes());
await writeFile(resolve(root, 'templates/einwilligungserklaerung.pdf'), await buildPdfBytes());
await writeFile(resolve(root, 'templates/kontaktdatenblatt.xlsx'), Buffer.from(await buildXlsxBytes()));
console.log('templates/ regenerated');
```

- [ ] **Step 2: Run the fixture builder**

```bash
node tests/fixtures/build-fixtures.mjs
```

Expected: prints `templates/ regenerated`; three files appear in `templates/`.

- [ ] **Step 3: Write the failing test**

```js
// tests/docx-fill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PizZip from 'pizzip';
import { fillDocx } from '../src/docx-fill.js';

const TEMPLATE = resolve('templates/einwilligungserklaerung.docx');

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
      { TYP: 'MeLo', ID: 'D'.repeat(33),  RICHTUNG: 'Erzeugung', MESSPRODUKT: '9991000000789' },
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
```

- [ ] **Step 4: Run, expect fail**

```bash
npm test -- --test-name-pattern='docx-fill'
```

Expected: module not found.

- [ ] **Step 5: Implement**

```js
// src/docx-fill.js
// In Node (tests): uses the npm versions of pizzip + docxtemplater via dynamic import.
// In the extension (browser): expects globalThis.PizZip and globalThis.docxtemplater
// loaded by vendor/*.js script tags in form.html.

async function load() {
  if (typeof globalThis.PizZip !== 'undefined' && typeof globalThis.docxtemplater !== 'undefined') {
    return { PizZip: globalThis.PizZip, Docxtemplater: globalThis.docxtemplater };
  }
  const [PizZipMod, DocxtemplaterMod] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);
  return { PizZip: PizZipMod.default ?? PizZipMod, Docxtemplater: DocxtemplaterMod.default ?? DocxtemplaterMod };
}

// `templateBytes` is an ArrayBuffer / Uint8Array / Buffer.
// `data` is the token dictionary (see contract in design doc §5).
export function fillDocx(templateBytes, data) {
  // Sync API: we lazy-load synchronously by caching after first await elsewhere.
  // Tests call this after awaiting load(); browser code does the same in main.js.
  const PizZip = globalThis.PizZip ?? require('pizzip');
  const Docxtemplater = globalThis.docxtemplater ?? require('docxtemplater');
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{', end: '}' },
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'uint8array' });
}
```

**Note on delimiters:** the fixture uses single-brace `{TOKEN}` and `{#LOOP}/{/LOOP}` because that's docxtemplater's default. Real Advizeo templates should use the same syntax. If the spec's example `{{TOKEN}}` was authored differently, change the `delimiters` option to `{ start: '{{', end: '}}' }` — this is the only knob.

Since this file mixes `import` (top of file via `load()`) and `require`, simplify to a single sync path using ESM-only:

```js
// src/docx-fill.js  (final form)
import PizZipNode from 'pizzip';
import DocxtemplaterNode from 'docxtemplater';

function getPizZip()       { return globalThis.PizZip       ?? PizZipNode; }
function getDocxtemplater(){ return globalThis.docxtemplater ?? DocxtemplaterNode; }

export function fillDocx(templateBytes, data) {
  const PizZip = getPizZip();
  const Docxtemplater = getDocxtemplater();
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{', end: '}' },
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'uint8array' });
}
```

**Browser shim:** because `src/main.js` is `type=module`, the bare imports `'pizzip'` / `'docxtemplater'` won't resolve in the browser. We side-step by loading the UMD globals first (Task 2) and aliasing via `globalThis`. To stop the browser from even trying to resolve the bare imports, wrap them in a try/catch at module top:

```js
// src/docx-fill.js  (final final form)
let PizZipFallback, DocxtemplaterFallback;
try {
  // Only succeeds in Node where bare imports resolve via node_modules.
  ({ default: PizZipFallback } = await import('pizzip'));
  ({ default: DocxtemplaterFallback } = await import('docxtemplater'));
} catch { /* browser: globals provided by vendor/ scripts */ }

export function fillDocx(templateBytes, data) {
  const PizZip = globalThis.PizZip ?? PizZipFallback;
  const Docxtemplater = globalThis.docxtemplater ?? DocxtemplaterFallback;
  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{', end: '}' },
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'uint8array' });
}
```

- [ ] **Step 6: Run, expect pass**

```bash
npm test -- --test-name-pattern='docx-fill'
```

Expected: 3 passing tests.

- [ ] **Step 7: Commit**

```bash
git add src/docx-fill.js tests/docx-fill.test.mjs tests/fixtures/build-fixtures.mjs templates/
git commit -m "feat(docx-fill): docxtemplater wrapper + fixture template"
```

---

## Task 9: `pdf-fill.js` — fill AcroForm in Einwilligungserklärung PDF

**Files:**
- Create: `src/pdf-fill.js`
- Test: `tests/pdf-fill.test.mjs`
- (Uses `templates/einwilligungserklaerung.pdf` created in Task 8)

- [ ] **Step 1: Write the failing test**

```js
// tests/pdf-fill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { fillPdf } from '../src/pdf-fill.js';

const TEMPLATE = resolve('templates/einwilligungserklaerung.pdf');

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
    { TYP: 'MaLo', ID: '11111111111', RICHTUNG: 'Verbrauch', MESSPRODUKT: '9991000000747' },
    { TYP: 'MeLo', ID: 'A'.repeat(33), RICHTUNG: 'Erzeugung', MESSPRODUKT: '9991000000789' },
  ],
};

async function readField(pdfBytes, name) {
  const pdf = await PDFDocument.load(pdfBytes);
  return pdf.getForm().getTextField(name).getText();
}

test('fillPdf fills scalar AcroForm fields', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillPdf(tpl, DATA);
  assert.equal(await readField(out, 'OBJEKT_ADRESSE'), 'Hauptstr. 1, 10115 Berlin');
  assert.equal(await readField(out, 'MSB_CODE_NR'),    '9900290000003');
  assert.equal(await readField(out, 'BEGINN_DATUM'),   '14.05.2023');
});

test('fillPdf fills first N MP rows and clears rest', async () => {
  const tpl = await readFile(TEMPLATE);
  const out = await fillPdf(tpl, DATA);
  assert.equal(await readField(out, 'MP_1_TYP'), 'MaLo');
  assert.equal(await readField(out, 'MP_1_ID'),  '11111111111');
  assert.equal(await readField(out, 'MP_2_TYP'), 'MeLo');
  assert.equal(await readField(out, 'MP_3_TYP'), '');   // cleared
  assert.equal(await readField(out, 'MP_10_ID'), '');   // cleared
});

test('fillPdf throws if MESSPUNKTE has more than 10 rows', async () => {
  const tpl = await readFile(TEMPLATE);
  const overflow = { ...DATA, MESSPUNKTE: Array.from({ length: 11 }, () => DATA.MESSPUNKTE[0]) };
  await assert.rejects(fillPdf(tpl, overflow), /Max 10/);
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='pdf-fill'
```

- [ ] **Step 3: Implement**

```js
// src/pdf-fill.js
let PDFLibFallback;
try { ({ PDFDocument: PDFLibFallback } = await import('pdf-lib')); } catch {}

function getPDFDocument() {
  return globalThis.PDFLib?.PDFDocument ?? PDFLibFallback;
}

const SCALARS = [
  'OBJEKT_ADRESSE', 'ANSCHLUSSNUTZER_NAME', 'ANSCHLUSSNUTZER_ADRESSE',
  'MSB_NAME', 'MSB_CODE_NR', 'ESA_NAME', 'ESA_MARKTPARTNER_ID',
  'BEGINN_DATUM', 'ENDE_DATUM',
];
const MP_SUFFIXES = ['TYP', 'ID', 'RICHTUNG', 'MESSPRODUKT'];
const MAX_ROWS = 10;

export async function fillPdf(templateBytes, data) {
  if ((data.MESSPUNKTE?.length ?? 0) > MAX_ROWS) {
    throw new Error(`Max ${MAX_ROWS} Messpunkte im PDF`);
  }
  const PDFDocument = getPDFDocument();
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  for (const name of SCALARS) {
    const value = data[name] ?? '';
    setText(form, name, String(value));
  }

  const rows = data.MESSPUNKTE ?? [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const row = rows[i] ?? null;
    for (const suffix of MP_SUFFIXES) {
      const fieldName = `MP_${i + 1}_${suffix}`;
      setText(form, fieldName, row ? String(row[suffix] ?? '') : '');
    }
  }

  return pdf.save();
}

function setText(form, name, value) {
  try {
    form.getTextField(name).setText(value);
  } catch (cause) {
    const e = new Error(`PDF-Vorlage hat Feld '${name}' nicht. Vorlage prüfen.`);
    e.cause = cause;
    throw e;
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='pdf-fill'
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/pdf-fill.js tests/pdf-fill.test.mjs
git commit -m "feat(pdf-fill): pdf-lib AcroForm fill with 10-row Messpunkte cap"
```

---

## Task 10: `xlsx-fill.js` — fill Kontaktdatenblatt Excel

**Files:**
- Create: `src/xlsx-fill.js`
- Test: `tests/xlsx-fill.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/xlsx-fill.test.mjs
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
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='xlsx-fill'
```

- [ ] **Step 3: Implement**

```js
// src/xlsx-fill.js
let ExcelJSFallback;
try { ExcelJSFallback = (await import('exceljs')).default; } catch {}

function getExcelJS() { return globalThis.ExcelJS ?? ExcelJSFallback; }

const TOKEN_RE = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

export async function fillXlsx(templateBytes, data) {
  const ExcelJS = getExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  wb.eachSheet(ws => {
    ws.eachRow(row => {
      row.eachCell({ includeEmpty: false }, cell => {
        if (typeof cell.value === 'string' && TOKEN_RE.test(cell.value)) {
          cell.value = cell.value.replace(TOKEN_RE, (_, key) => data[key] ?? '');
        }
      });
    });
  });
  return wb.xlsx.writeBuffer();
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='xlsx-fill'
```

- [ ] **Step 5: Commit**

```bash
git add src/xlsx-fill.js tests/xlsx-fill.test.mjs
git commit -m "feat(xlsx-fill): {{token}} substitution in xlsx string cells"
```

---

## Task 11: `eml-build.js` — RFC 5322 multipart/mixed builder

**Files:**
- Create: `src/eml-build.js`
- Test: `tests/eml-build.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/eml-build.test.mjs
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
  assert.ok(!eml.includes('\n\n'));    // no bare LF pairs
});

test('buildEml handles UTF-8 subject via RFC 2047', () => {
  const eml = buildEml({
    subject: 'Anfrage Müller',
    bodyLines: ['x'], headers: {}, attachments: [], date: new Date(0),
  });
  // RFC 2047 encoded-word
  assert.match(eml, /=\?utf-8\?b\?/i);
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='eml-build'
```

- [ ] **Step 3: Implement**

```js
// src/eml-build.js
// RFC 5322 / RFC 2045 multipart/mixed builder.
// Output: string of CRLF-delimited lines, ready to write as an .eml file.

const CRLF = '\r\n';

function rfc2822Date(d) {
  // e.g. "Wed, 14 May 2026 09:36:00 +0000"
  return d.toUTCString().replace('GMT', '+0000');
}

function encodeHeaderUtf8(value) {
  // RFC 2047 encoded-word if non-ASCII present.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const b64 = base64FromString(value);
  return `=?utf-8?B?${b64}?=`;
}

function base64FromString(s) {
  const bytes = new TextEncoder().encode(s);
  return base64FromBytes(bytes);
}

function base64FromBytes(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function quotedPrintable(text) {
  // Minimal QP: encode non-ASCII as =XX, keep ASCII, keep CRLF.
  let out = '';
  const bytes = new TextEncoder().encode(text);
  let lineLen = 0;
  for (const b of bytes) {
    let chunk;
    if (b === 0x0d || b === 0x0a) {
      out += String.fromCharCode(b);
      lineLen = 0;
      continue;
    }
    if (b === 0x3d /* = */ || b < 0x20 || b > 0x7e) {
      chunk = '=' + b.toString(16).toUpperCase().padStart(2, '0');
    } else {
      chunk = String.fromCharCode(b);
    }
    if (lineLen + chunk.length > 75) {
      out += '=' + CRLF;
      lineLen = 0;
    }
    out += chunk;
    lineLen += chunk.length;
  }
  return out;
}

function base64Wrapped(bytes, width = 76) {
  const b64 = base64FromBytes(bytes);
  const lines = [];
  for (let i = 0; i < b64.length; i += width) lines.push(b64.slice(i, i + width));
  return lines.join(CRLF);
}

function randomBoundary() {
  const r = Math.random().toString(36).slice(2);
  return `----=_MaKo_${Date.now().toString(36)}_${r}`;
}

export function buildEml({ subject, bodyLines, headers = {}, attachments = [], date = new Date() }) {
  const boundary = randomBoundary();
  const out = [];

  out.push('From: ');
  out.push('To: ');
  out.push(`Subject: ${encodeHeaderUtf8(subject)}`);
  out.push(`Date: ${rfc2822Date(date)}`);
  out.push('MIME-Version: 1.0');
  for (const [k, v] of Object.entries(headers)) out.push(`${k}: ${v}`);
  out.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  out.push('');

  // Text body part
  out.push(`--${boundary}`);
  out.push('Content-Type: text/plain; charset=UTF-8');
  out.push('Content-Transfer-Encoding: quoted-printable');
  out.push('');
  out.push(quotedPrintable(bodyLines.join(CRLF)));

  // Attachment parts
  for (const att of attachments) {
    out.push(`--${boundary}`);
    out.push(`Content-Type: ${att.contentType}; name="${att.name}"`);
    out.push('Content-Transfer-Encoding: base64');
    out.push(`Content-Disposition: attachment; filename="${att.name}"`);
    out.push('');
    out.push(base64Wrapped(att.bytes));
  }
  out.push(`--${boundary}--`);
  out.push('');

  return out.join(CRLF);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='eml-build'
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/eml-build.js tests/eml-build.test.mjs
git commit -m "feat(eml-build): RFC 5322 multipart/mixed builder with X-Unsent flag"
```

---

## Task 12: `download.js` — chrome.downloads wrapper with folder + slug naming

**Files:**
- Create: `src/download.js`
- Test: `tests/download.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/download.test.mjs
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
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- --test-name-pattern='download'
```

- [ ] **Step 3: Implement**

```js
// src/download.js
import { slug } from './slug.js';

function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function downloadBundle({
  files,
  anschlussnutzer,
  today = new Date(),
  chrome = globalThis.chrome,
  URL = globalThis.URL,
}) {
  const folder = `MaKo/${isoDate(today)}_${slug(anschlussnutzer)}/`;
  for (const file of files) {
    const blob = new Blob([file.bytes], { type: file.mime });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: folder + file.name,
      conflictAction: 'uniquify',
      saveAs: false,
    });
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- --test-name-pattern='download'
```

- [ ] **Step 5: Commit**

```bash
git add src/download.js tests/download.test.mjs
git commit -m "feat(download): bundle files into Downloads/MaKo/<date>_<slug>/"
```

---

## Task 13: Wizard shell — HTML layout + styles

**Files:**
- Modify: `form.html`
- Modify: `styles.css` (create)
- Create: `src/ui/render.js`

- [ ] **Step 1: Rewrite `form.html`**

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>MaKo Dokumente erstellen</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <h1>MaKo Dokumente erstellen</h1>
    <button id="resetBtn" class="ghost">Zurücksetzen</button>
  </header>
  <div class="layout">
    <nav class="sidebar">
      <ol id="stepNav">
        <li data-step="1"><span class="stepNum">1</span> Stammdaten &amp; MSB</li>
        <li data-step="2"><span class="stepNum">2</span> Messpunkte</li>
        <li data-step="3"><span class="stepNum">3</span> Zeitraum &amp; Vorschau</li>
      </ol>
    </nav>
    <main id="stepBody" class="step-body"></main>
  </div>
  <footer class="footer">
    <button id="backBtn"     class="secondary">Zurück</button>
    <button id="nextBtn"     class="primary">Weiter</button>
    <button id="generateBtn" class="primary" hidden>Generieren</button>
  </footer>

  <div id="modalRoot"></div>

  <script src="vendor/pizzip.js"></script>
  <script src="vendor/docxtemplater.js"></script>
  <script src="vendor/pdf-lib.min.js"></script>
  <script src="vendor/exceljs.min.js"></script>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `styles.css`**

```css
:root {
  --pink: #E6007E;
  --pink-dark: #B30062;
  --bg: #fafafa;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --border: #d8d8d8;
  --danger: #c0392b;
  --ok: #2e7d32;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 14px/1.45 -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
  color: var(--fg);
  background: var(--bg);
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-bottom: 1px solid var(--border); background: white;
}
.header h1 { font-size: 18px; margin: 0; color: var(--pink); }
.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 110px); }
.sidebar { border-right: 1px solid var(--border); padding: 24px 16px; background: white; }
.sidebar ol { list-style: none; padding: 0; margin: 0; }
.sidebar li { padding: 10px 12px; border-radius: 6px; color: var(--muted); cursor: default; }
.sidebar li.active { background: rgba(230, 0, 126, 0.08); color: var(--fg); }
.sidebar li.error  { color: var(--danger); }
.sidebar li.done .stepNum::before { content: "✓ "; color: var(--ok); }
.stepNum { display: inline-block; min-width: 1.2em; font-weight: 600; }
.step-body { padding: 32px 48px; max-width: 900px; }
.step-body h2 { margin-top: 0; }
.footer {
  display: flex; gap: 12px; justify-content: flex-end;
  padding: 12px 24px; border-top: 1px solid var(--border); background: white;
}
button {
  font: inherit; padding: 8px 16px; border-radius: 6px; border: 1px solid transparent;
  cursor: pointer;
}
button.primary   { background: var(--pink); color: white; }
button.primary:hover { background: var(--pink-dark); }
button.primary:disabled { background: #ddd; color: #999; cursor: not-allowed; }
button.secondary { background: white; color: var(--fg); border-color: var(--border); }
button.ghost     { background: transparent; color: var(--muted); border: none; }
label { display: block; margin-top: 14px; font-weight: 600; }
input[type=text], input[type=date], textarea, select {
  width: 100%; max-width: 480px; padding: 8px 10px; border: 1px solid var(--border);
  border-radius: 6px; font: inherit; background: white;
}
input.invalid, textarea.invalid, select.invalid { border-color: var(--danger); }
.field-error { color: var(--danger); font-size: 12px; margin-top: 4px; }
.helper { color: var(--muted); font-size: 12px; margin-top: 4px; }
.radios { display: flex; gap: 16px; }
.radios label { font-weight: 400; margin-top: 0; }
table.mp { width: 100%; max-width: 720px; border-collapse: collapse; margin-top: 12px; }
table.mp th, table.mp td { padding: 8px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
.chip { display: inline-block; padding: 3px 8px; background: #eee; border-radius: 10px; font-size: 12px; }
.preview-box {
  margin-top: 16px; padding: 16px; background: white; border: 1px solid var(--border); border-radius: 8px;
}
.preview-box ul { margin: 8px 0 0 18px; padding: 0; }
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: white; border-radius: 8px; max-width: 520px; padding: 24px;
}
.modal h3 { margin-top: 0; }
.modal details { margin-top: 12px; }
```

- [ ] **Step 3: Create `src/ui/render.js`**

```js
// src/ui/render.js
// Helpers shared by the step renderers.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'hidden' && !v) {}
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function field({ id, label, type = 'text', value = '', error, helper, multiline = false }) {
  const inputEl = multiline
    ? el('textarea', { id, rows: 3 }, value)
    : el('input', { id, type, value });
  if (error) inputEl.classList.add('invalid');
  return el('div', {},
    el('label', { for: id }, label),
    inputEl,
    error  ? el('div', { class: 'field-error' }, error) : null,
    helper ? el('div', { class: 'helper' }, helper)     : null,
  );
}

export function radioGroup({ id, label, options, value, error, helper }) {
  const radios = options.map(opt =>
    el('label', {},
      el('input', { type: 'radio', name: id, value: opt.value, ...(opt.value === value ? { checked: 'checked' } : {}) }),
      ' ', opt.label,
    )
  );
  return el('div', {},
    el('label', {}, label),
    el('div', { class: 'radios' }, ...radios),
    error  ? el('div', { class: 'field-error' }, error) : null,
    helper ? el('div', { class: 'helper' }, helper)     : null,
  );
}

export function renderStepNav(currentStep, errorsByStep) {
  const nav = document.getElementById('stepNav');
  for (const li of nav.querySelectorAll('li')) {
    const step = Number(li.dataset.step);
    li.classList.toggle('active', step === currentStep);
    li.classList.toggle('error',  !!errorsByStep[step]);
    li.classList.toggle('done',   step < currentStep && !errorsByStep[step]);
  }
}
```

- [ ] **Step 4: Update `src/main.js` to render the empty shell**

```js
// src/main.js
import { renderStepNav } from './ui/render.js';

document.getElementById('stepBody').innerHTML = '<p>Schritt 1 — folgt in Task 14.</p>';
renderStepNav(1, {});
```

- [ ] **Step 5: Manual smoke test**

Reload the extension, open the wizard. Expected: header with pink "MaKo Dokumente erstellen", sidebar with three steps (step 1 highlighted), empty body, footer with Zurück/Weiter buttons.

- [ ] **Step 6: Commit**

```bash
git add form.html styles.css src/ui/render.js src/main.js
git commit -m "feat(ui): wizard shell — header, sidebar, footer, step nav"
```

---

## Task 14: Step 1 UI — Stammdaten & MSB

**Files:**
- Create: `src/ui/step1.js`
- Modify: `src/main.js`

- [ ] **Step 1: Implement `src/ui/step1.js`**

```js
// src/ui/step1.js
import { el, field, radioGroup } from './render.js';

export function renderStep1(state, errors, onChange) {
  const onInput = path => e => onChange(path, e.target.value);
  const onRadio = path => e => onChange(path, e.target.value === 'true');

  return el('section', {},
    el('h2', {}, 'Stammdaten & Messstellenbetreiber'),

    field({ id: 'objekt.adresse',           label: 'Objekt-Adresse',           multiline: true,
            value: state.objekt.adresse,          error: errors['objekt.adresse'] }),
    field({ id: 'anschlussnutzer.name',     label: 'Anschlussnutzer (Name)',
            value: state.anschlussnutzer.name,    error: errors['anschlussnutzer.name'] }),
    field({ id: 'anschlussnutzer.adresse',  label: 'Anschlussnutzer (Adresse)', multiline: true,
            value: state.anschlussnutzer.adresse, error: errors['anschlussnutzer.adresse'] }),
    field({ id: 'msb.name',                 label: 'MSB Name',
            value: state.msb.name,                error: errors['msb.name'] }),
    field({ id: 'msb.codeNr',               label: 'MSB Code-Nr.',
            value: state.msb.codeNr,              error: errors['msb.codeNr'],
            helper: 'Nachschlagen auf bdew-codes.de ↗' }),

    el('div', { class: 'helper' },
      el('a', { href: 'https://bdew-codes.de/Codenumbers/BDEWCodes/CodeOverview', target: '_blank', rel: 'noopener' },
        'MSB auf bdew-codes.de nachschlagen ↗'),
    ),

    radioGroup({
      id: 'msb.knownToAdvizeo',
      label: 'Besteht bereits eine Kooperation mit Advizeo?',
      options: [
        { value: 'true',  label: 'Ja'   },
        { value: 'false', label: 'Nein' },
      ],
      value: state.msb.knownToAdvizeo === null ? '' : String(state.msb.knownToAdvizeo),
      error: errors['msb.knownToAdvizeo'],
      helper: state.msb.knownToAdvizeo === false
        ? 'Zusätzlich wird eine MSB-Anfrage-E-Mail mit Kontaktdatenblatt generiert.'
        : null,
    }),
  );

  // Wiring happens in main.js (event delegation)
}

export function wireStep1(root, onChange) {
  root.addEventListener('input', e => {
    const t = e.target;
    if (!t.id) return;
    onChange(t.id, t.value);
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'radio' && t.name === 'msb.knownToAdvizeo') {
      onChange('msb.knownToAdvizeo', t.value === 'true');
    }
  });
}
```

- [ ] **Step 2: Update `src/main.js` to wire it**

```js
// src/main.js
import { loadState, saveState, resetState } from './form-state.js';
import { validate } from './validate.js';
import { renderStepNav } from './ui/render.js';
import { renderStep1, wireStep1 } from './ui/step1.js';

const state = await loadState(chrome.storage);
const stepBody = document.getElementById('stepBody');

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts.at(-1)] = value;
}

function errorsByStep(errors) {
  const e = {};
  for (const key of Object.keys(errors)) {
    if (key.startsWith('objekt') || key.startsWith('anschlussnutzer') || key.startsWith('msb')) e[1] = true;
    else if (key.startsWith('messpunkte')) e[2] = true;
    else e[3] = true;
  }
  return e;
}

async function rerender() {
  const errors = validate(state);
  renderStepNav(state.step, errorsByStep(errors));
  stepBody.replaceChildren(renderStep1(state, errors, onChange));
  wireStep1(stepBody, onChange);
}

async function onChange(path, value) {
  setByPath(state, path, value);
  await saveState(state, chrome.storage);
  rerender();
}

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('Alle Eingaben zurücksetzen?')) return;
  await resetState(chrome.storage);
  location.reload();
});

rerender();
```

- [ ] **Step 3: Manual smoke test**

Reload the extension, open the wizard. Expected:
- Step 1 fields render.
- Typing into "Anschlussnutzer (Name)" updates a value and (silently) persists to `chrome.storage.local`.
- Closing and reopening the wizard restores the typed value.
- Empty required fields show "Pflichtfeld" once the field has been touched and is empty.
- The radio "Nein" reveals the helper text.

- [ ] **Step 4: Commit**

```bash
git add src/ui/step1.js src/main.js
git commit -m "feat(ui): Step 1 — Stammdaten & MSB with live validation + autosave"
```

---

## Task 15: Step 2 UI — Messpunkte dynamic rows

**Files:**
- Create: `src/ui/step2.js`
- Modify: `src/main.js`

- [ ] **Step 1: Implement `src/ui/step2.js`**

```js
// src/ui/step2.js
import { el } from './render.js';
import { messprodukt } from '../messprodukt.js';

export function renderStep2(state, errors, ops) {
  const rows = state.messpunkte.map((row, i) => renderRow(row, i, errors, ops));

  return el('section', {},
    el('h2', {}, 'Messpunkte'),
    el('p', { class: 'helper' }, 'Mindestens 1 Messpunkt. PDF-Layout unterstützt max. 10 Zeilen.'),

    el('table', { class: 'mp' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Typ'),
        el('th', {}, 'ID'),
        el('th', {}, 'Lieferrichtung'),
        el('th', {}, 'Messprodukt'),
        el('th', {}, ''),
      )),
      el('tbody', {}, ...rows),
    ),

    el('div', { style: 'margin-top: 12px' },
      el('button', { class: 'secondary', type: 'button', onclick: () => ops.addRow() }, '+ Messpunkt hinzufügen'),
    ),

    errors['messpunkte'] ? el('div', { class: 'field-error' }, errors['messpunkte']) : null,
  );
}

function renderRow(row, i, errors, ops) {
  const code = safeCode(row);
  return el('tr', { 'data-idx': String(i) },
    el('td', {},
      selectEl(`messpunkte.${i}.kind`, row.kind, ['MaLo', 'MeLo'], ops.change),
    ),
    el('td', {},
      el('input', {
        type: 'text', id: `messpunkte.${i}.id`,
        value: row.id, oninput: e => ops.change(`messpunkte.${i}.id`, e.target.value),
        class: errors[`messpunkte.${i}.id`] ? 'invalid' : '',
        style: 'min-width: 280px; font-family: monospace',
      }),
      errors[`messpunkte.${i}.id`] ? el('div', { class: 'field-error' }, errors[`messpunkte.${i}.id`]) : null,
    ),
    el('td', {},
      selectEl(`messpunkte.${i}.richtung`, row.richtung, ['Verbrauch', 'Erzeugung'], ops.change),
    ),
    el('td', {},
      el('span', { class: 'chip' }, code ?? '—'),
    ),
    el('td', {},
      el('button', { class: 'ghost', type: 'button', onclick: () => ops.removeRow(i) }, '✕'),
    ),
  );
}

function selectEl(id, value, options, onChange) {
  const sel = el('select', {
    id,
    onchange: e => onChange(id, e.target.value),
  }, ...options.map(o => el('option', { value: o, ...(o === value ? { selected: 'selected' } : {}) }, o)));
  return sel;
}

function safeCode(row) {
  try { return messprodukt(row.kind, row.richtung); } catch { return null; }
}
```

- [ ] **Step 2: Update `src/main.js` to support Step 2 and step navigation**

Modify `src/main.js` to a step-aware version:

```js
// src/main.js
import { loadState, saveState, resetState } from './form-state.js';
import { validate } from './validate.js';
import { renderStepNav } from './ui/render.js';
import { renderStep1, wireStep1 } from './ui/step1.js';
import { renderStep2 } from './ui/step2.js';

const state = await loadState(chrome.storage);
const stepBody = document.getElementById('stepBody');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const generateBtn = document.getElementById('generateBtn');

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur = isNaN(p) ? cur[p] : cur[Number(p)];
  }
  cur[parts.at(-1)] = value;
}

function errorsByStep(errors) {
  const e = {};
  for (const key of Object.keys(errors)) {
    if (key.startsWith('messpunkte')) e[2] = true;
    else if (['beginnDatum', 'endeDatum'].some(k => key.startsWith(k))) e[3] = true;
    else e[1] = true;
  }
  return e;
}

const ops = {
  change: async (path, value) => {
    setByPath(state, path, value);
    await saveState(state, chrome.storage);
    rerender();
  },
  addRow: async () => {
    if (state.messpunkte.length >= 10) return;
    state.messpunkte.push({ kind: 'MaLo', id: '', richtung: 'Verbrauch' });
    await saveState(state, chrome.storage);
    rerender();
  },
  removeRow: async i => {
    state.messpunkte.splice(i, 1);
    if (state.messpunkte.length === 0) state.messpunkte.push({ kind: 'MaLo', id: '', richtung: 'Verbrauch' });
    await saveState(state, chrome.storage);
    rerender();
  },
};

function rerender() {
  const errors = validate(state);
  renderStepNav(state.step, errorsByStep(errors));
  stepBody.replaceChildren(rendererFor(state.step)(state, errors, ops));
  if (state.step === 1) wireStep1(stepBody, ops.change);
  updateFooter(errors);
}

function rendererFor(step) {
  if (step === 1) return renderStep1;
  if (step === 2) return renderStep2;
  return () => document.createTextNode('Schritt 3 — folgt in Task 16.');
}

function updateFooter(errors) {
  backBtn.disabled = state.step === 1;
  nextBtn.hidden = state.step === 3;
  generateBtn.hidden = state.step !== 3;
}

backBtn.addEventListener('click', async () => {
  state.step = Math.max(1, state.step - 1);
  await saveState(state, chrome.storage);
  rerender();
});
nextBtn.addEventListener('click', async () => {
  state.step = Math.min(3, state.step + 1);
  await saveState(state, chrome.storage);
  rerender();
});
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('Alle Eingaben zurücksetzen?')) return;
  await resetState(chrome.storage);
  location.reload();
});

rerender();
```

- [ ] **Step 3: Manual smoke test**

Reload the extension. Go through to step 2 via Weiter. Expected:
- One default row (MaLo / blank / Verbrauch / 9991000000747 chip).
- "+ Messpunkt hinzufügen" adds rows up to 10.
- "✕" removes rows (keeps at least one).
- Selecting MeLo + Erzeugung updates the Messprodukt chip to `9991000000789`.
- Entering an invalid ID shows the validation message inline.

- [ ] **Step 4: Commit**

```bash
git add src/ui/step2.js src/main.js
git commit -m "feat(ui): Step 2 — dynamic Messpunkte rows with auto Messprodukt chip"
```

---

## Task 16: Step 3 UI — Zeitraum & Vorschau

**Files:**
- Create: `src/ui/step3.js`
- Modify: `src/main.js`

- [ ] **Step 1: Implement `src/ui/step3.js`**

```js
// src/ui/step3.js
import { el, field } from './render.js';
import { slug } from '../slug.js';
import { SUBJECT, BODY_LINES } from '../email-template.js';

function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function renderStep3(state, errors, ops) {
  const today = isoDate(new Date());
  const filename = `Einwilligungserklaerung_${slug(state.anschlussnutzer.name)}`;
  const isNewMsb = state.msb.knownToAdvizeo === false;

  const filesList = [
    `${filename}.docx`,
    `${filename}.pdf`,
    ...(isNewMsb ? [
      'Kontaktdatenblatt.xlsx',
      `MSB-Anfrage_${slug(state.msb.name)}.eml`,
    ] : []),
  ];

  return el('section', {},
    el('h2', {}, 'Zeitraum & Vorschau'),

    field({
      id: 'beginnDatum', label: 'Beginn-Datum', type: 'date',
      value: state.beginnDatum, error: errors['beginnDatum'],
      helper: `Standard: heute minus 3 Jahre (${state.beginnDatum}).`,
    }),

    el('div', {},
      el('label', { for: 'endeDatum' }, 'Ende-Datum (offen lassen für ‘unbefristet’)'),
      el('input', {
        id: 'endeDatum', type: 'date', value: state.endeDatum,
        oninput: e => ops.change('endeDatum', e.target.value),
      }),
      errors['endeDatum'] ? el('div', { class: 'field-error' }, errors['endeDatum']) : null,
    ),

    el('div', { class: 'preview-box' },
      el('strong', {}, 'Folgende Dateien werden in einem Unterordner heruntergeladen:'),
      el('div', { class: 'helper' }, `Downloads/MaKo/${today}_${slug(state.anschlussnutzer.name)}/`),
      el('ul', {}, ...filesList.map(f => el('li', {}, f))),
      isNewMsb ? el('details', {},
        el('summary', {}, 'E-Mail Vorschau'),
        el('p', {}, el('strong', {}, 'Betreff: '), SUBJECT),
        el('pre', { style: 'white-space: pre-wrap; font: inherit' }, BODY_LINES.slice(0, 6).join('\n') + '\n…'),
      ) : null,
    ),
  );
}

export function wireStep3(root, onChange) {
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'beginnDatum') onChange('beginnDatum', t.value);
  });
}
```

- [ ] **Step 2: Wire Step 3 in `src/main.js`**

Modify the `rendererFor` and `rerender` blocks of `src/main.js`:

```js
// imports near top:
import { renderStep3, wireStep3 } from './ui/step3.js';

// inside rerender(), after replaceChildren(...) and the step1 wiring:
if (state.step === 3) wireStep3(stepBody, ops.change);

// rendererFor:
function rendererFor(step) {
  if (step === 1) return renderStep1;
  if (step === 2) return renderStep2;
  return renderStep3;
}
```

- [ ] **Step 3: Manual smoke test**

Reload, advance to step 3. Expected:
- Beginn-Datum shows today−3y.
- Ende-Datum empty.
- Preview shows 2 filenames (MSB known = Ja) or 4 (Nein).
- Setting Ende-Datum before Beginn-Datum shows the validation error.

- [ ] **Step 4: Commit**

```bash
git add src/ui/step3.js src/main.js
git commit -m "feat(ui): Step 3 — Zeitraum + Vorschau (file list + email preview)"
```

---

## Task 17: Generation pipeline — wire Generieren to the fillers and download

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add the pipeline function in `src/main.js`**

Append to `src/main.js` (above the trailing `rerender()` call):

```js
import { fillDocx } from './docx-fill.js';
import { fillPdf } from './pdf-fill.js';
import { fillXlsx } from './xlsx-fill.js';
import { buildEml } from './eml-build.js';
import { downloadBundle } from './download.js';
import { messprodukt } from './messprodukt.js';
import { SUBJECT, BODY_LINES } from './email-template.js';
import { slug } from './slug.js';
import { validate, hasErrors } from './validate.js';

function germanDate(iso) {
  if (!iso) return 'offen';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function toTemplateData(state) {
  return {
    OBJEKT_ADRESSE:         state.objekt.adresse,
    ANSCHLUSSNUTZER_NAME:   state.anschlussnutzer.name,
    ANSCHLUSSNUTZER_ADRESSE:state.anschlussnutzer.adresse,
    MSB_NAME:               state.msb.name,
    MSB_CODE_NR:            state.msb.codeNr,
    ESA_NAME:               state.esa.name,
    ESA_MARKTPARTNER_ID:    state.esa.marktpartnerId,
    BEGINN_DATUM:           germanDate(state.beginnDatum),
    ENDE_DATUM:             state.endeDatum ? germanDate(state.endeDatum) : 'offen',
    MESSPUNKTE: state.messpunkte.map(row => ({
      TYP: row.kind,
      ID: row.id,
      RICHTUNG: row.richtung,
      MESSPRODUKT: messprodukt(row.kind, row.richtung),
    })),
  };
}

async function fetchTemplate(path) {
  const res = await fetch(chrome.runtime.getURL(path));
  if (!res.ok) throw new Error(`Vorlage fehlt: ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function generate() {
  const errors = validate(state);
  if (hasErrors(errors)) {
    state.step = stepWithFirstError(errors);
    rerender();
    return;
  }
  const data = toTemplateData(state);
  const fileBase = `Einwilligungserklaerung_${slug(state.anschlussnutzer.name)}`;
  const files = [];

  try {
    const docxTpl = await fetchTemplate('templates/einwilligungserklaerung.docx');
    const docxBytes = fillDocx(docxTpl, data);
    files.push({ name: `${fileBase}.docx`, bytes: docxBytes,
                 mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const pdfTpl = await fetchTemplate('templates/einwilligungserklaerung.pdf');
    const pdfBytes = await fillPdf(pdfTpl, data);
    files.push({ name: `${fileBase}.pdf`, bytes: pdfBytes, mime: 'application/pdf' });

    if (state.msb.knownToAdvizeo === false) {
      const xlsxTpl = await fetchTemplate('templates/kontaktdatenblatt.xlsx');
      const xlsxBytes = new Uint8Array(await fillXlsx(xlsxTpl, data));
      files.push({ name: 'Kontaktdatenblatt.xlsx', bytes: xlsxBytes,
                   mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const eml = buildEml({
        subject: SUBJECT,
        bodyLines: BODY_LINES,
        headers: { 'X-Unsent': '1' },
        attachments: [
          { name: 'Kontaktdatenblatt.xlsx', contentType: files[2].mime, bytes: xlsxBytes },
          { name: `${fileBase}.pdf`,        contentType: 'application/pdf', bytes: pdfBytes },
        ],
      });
      files.push({
        name: `MSB-Anfrage_${slug(state.msb.name)}.eml`,
        bytes: new TextEncoder().encode(eml),
        mime: 'message/rfc822',
      });
    }

    await downloadBundle({ files, anschlussnutzer: state.anschlussnutzer.name });
    showSuccess(files);
  } catch (err) {
    showError(err);
  }
}

function stepWithFirstError(errors) {
  const k = Object.keys(errors)[0];
  if (k.startsWith('messpunkte')) return 2;
  if (k.startsWith('beginnDatum') || k.startsWith('endeDatum')) return 3;
  return 1;
}

function showSuccess(files) {
  stepBody.innerHTML = '';
  const list = document.createElement('ul');
  for (const f of files) {
    const li = document.createElement('li'); li.textContent = f.name; list.appendChild(li);
  }
  const h = document.createElement('h2'); h.textContent = 'Fertig — Dateien wurden heruntergeladen';
  const again = document.createElement('button'); again.className = 'primary'; again.textContent = 'Neue MaKo';
  again.addEventListener('click', async () => { await resetState(chrome.storage); location.reload(); });
  stepBody.append(h, list, again);
  backBtn.hidden = nextBtn.hidden = generateBtn.hidden = true;
}

function showError(err) {
  import('./ui/modal.js').then(({ showModal }) => showModal({
    title: 'Generierung fehlgeschlagen',
    body: err.message,
    detail: err.stack || String(err.cause || ''),
  }));
}

generateBtn.addEventListener('click', generate);
```

- [ ] **Step 2: Manual smoke test (the integration)**

Reload. Fill in valid data for all three steps. Pick "Nein" on MSB-Kooperation. Click Generieren. Expected:
- Four files land in `Downloads/MaKo/<date>_<slug>/`
- Double-click the .eml → Outlook opens it as a draft with To: empty, subject set, two attachments
- The .pdf opens in Acrobat with AcroForm fields populated
- The .docx opens in Word with tokens replaced

Repeat with "Ja": expect 2 files (no xlsx, no eml).

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat(main): generation pipeline — validate, fill, build .eml, download"
```

---

## Task 18: Error modal & friendly failure UX

**Files:**
- Create: `src/ui/modal.js`

- [ ] **Step 1: Implement `src/ui/modal.js`**

```js
// src/ui/modal.js
import { el } from './render.js';

export function showModal({ title, body, detail }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';

  const close = () => { root.innerHTML = ''; };
  const backdrop = el('div', { class: 'modal-backdrop', onclick: e => { if (e.target === backdrop) close(); } },
    el('div', { class: 'modal' },
      el('h3', {}, title),
      el('p', {}, body),
      detail ? el('details', {},
        el('summary', {}, 'Technische Details'),
        el('pre', { style: 'white-space: pre-wrap; font-size: 11px' }, detail),
      ) : null,
      el('div', { style: 'text-align: right; margin-top: 16px' },
        el('button', { class: 'primary', onclick: close }, 'OK'),
      ),
    ),
  );
  root.appendChild(backdrop);
}
```

- [ ] **Step 2: Smoke test the modal**

Temporarily break a template path in `src/main.js` (`'templates/MISSING.docx'`), reload, fill the form, click Generieren. Expected: modal appears with title "Generierung fehlgeschlagen", body "Vorlage fehlt: templates/MISSING.docx", expandable technical details. Revert the path before committing.

- [ ] **Step 3: Commit**

```bash
git add src/ui/modal.js
git commit -m "feat(ui): error modal for generation failures with detail panel"
```

---

## Task 19: Icon — MAKO wordmark in Advizeo pink

**Files:**
- Replace: `icons/icon-16.png`, `icon-48.png`, `icon-128.png`

- [ ] **Step 1: Decide on the pink hex**

If the Advizeo brand pink hex is known, use it. Otherwise default to `#E6007E` and flag for review in the README's "Open Questions" section.

- [ ] **Step 2: Generate the icons**

Save as `icons/icon-16.png`, `icon-48.png`, `icon-128.png`. Either:

- Open Figma/Photopea, type "MAKO" in a clean sans (Inter Bold / Helvetica Bold) on a transparent background in the pink. Export at 16/48/128 px. The wordmark must remain legible at 16 px — use a heavy weight and tight letter-spacing.
- Or use imagemagick:

```bash
for size in 16 48 128; do
  magick -background none -fill "#E6007E" -font Helvetica-Bold \
    -gravity center -size ${size}x${size} \
    label:"MAKO" icons/icon-${size}.png
done
```

- [ ] **Step 3: Manual check**

Reload the extension. Pin the icon. Check that the MAKO wordmark is readable at toolbar size (16 px on most setups).

- [ ] **Step 4: Commit**

```bash
git add icons/
git commit -m "design: MAKO wordmark icon in Advizeo pink"
```

---

## Task 20: README + manual QA checklist

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# Formularis_ausfüllio

Chrome extension generating MaKo document bundles for Advizeo Deutschland.

## What it does

A 3-step wizard for the MaKo "Erstmalige Umsetzung" workflow. You enter
Anschlussnutzer, MSB, and Messpunkt data; the extension produces a downloadable
bundle:

- Always: `Einwilligungserklaerung_<slug>.docx` + `.pdf`
- If MSB has no prior relationship with Advizeo: also `Kontaktdatenblatt.xlsx` and `MSB-Anfrage_<msb>.eml` (a pre-drafted email; double-click to open as a draft in Outlook).

## Install (non-technical)

1. Unzip the folder anywhere on your machine.
2. Open Chrome → visit `chrome://extensions`.
3. Toggle "Entwicklermodus" / "Developer mode" ON (top right).
4. Click "Entpackte Erweiterung laden" / "Load unpacked".
5. Select the unzipped folder.
6. Pin the MAKO icon from the puzzle-piece menu.

## Use

Click the MAKO icon to open the wizard. Fill the three steps. Click **Generieren**. Files appear in `Downloads/MaKo/<YYYY-MM-DD>_<anschlussnutzer-slug>/`.

If Outlook doesn't open the `.eml` on double-click: right-click → "Öffnen mit" → Outlook.

## Updating templates

The three templates live in `templates/`. To replace them:

1. Edit/replace the file (.docx, .pdf, or .xlsx). Token names must match the contract in `docs/superpowers/specs/2026-05-13-mako-chrome-extension-design.md` §5.
2. Re-zip the extension folder.
3. In `chrome://extensions` click the ↻ icon on the extension card to reload.

## Development

```bash
npm install
npm run copy-vendor    # copies UMD bundles into vendor/
npm test               # runs node --test on tests/
```

To regenerate the stand-in test templates:

```bash
node tests/fixtures/build-fixtures.mjs
```

## Manual QA checklist

After every template change, run through this list before shipping:

- [ ] Wizard installs via "Load unpacked" on a clean Chrome profile
- [ ] Step 1: invalid Code-Nr. shows inline validation; Ja/Nein toggle reveals helper
- [ ] Step 2: Add/remove rows; Messprodukt chip updates with Verbrauch/Erzeugung toggle
- [ ] Step 3: Beginn-Datum defaults to today−3y; Ende-before-Beginn shows error
- [ ] Generieren (MSB known = Ja) → 2 files in Downloads subfolder
- [ ] Generieren (MSB known = Nein) → 4 files in Downloads subfolder
- [ ] Open generated .docx in Word → tokens replaced, Messpunkte rows match
- [ ] Open generated .pdf in Adobe Sign → fields populated, signature area free
- [ ] Open generated .eml in Outlook → opens as new draft, subject/body correct, attachments present
- [ ] Umlauts (ä/ö/ü/ß) render correctly in all three formats and in filenames (ASCII-folded)

## Open questions

- Final Advizeo pink hex for the MAKO icon (current: `#E6007E`)
- Final Advizeo-authored .docx, .pdf, .xlsx templates with the §5 token names

## License

Internal Advizeo tool. Not for redistribution.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with install + QA checklist"
```

---

## Self-review (run by writer before handing off)

**Spec coverage check** — each section of the spec mapped to a task:

| Spec section | Covered by |
|---|---|
| §1 Purpose / §2 I/O | Task 17 (pipeline) + Task 14–16 (UI) |
| §3 Architecture / file map | Task 1 (skeleton), Task 2 (vendor) |
| §4 Data model | Task 7 (form-state) |
| §5 Token contract (scalars + MP loop + 10-row PDF) | Task 8, Task 9, Task 10 |
| §6 Validation | Task 5 |
| §7 Wizard flow (3 steps) | Tasks 13–16 |
| §8 Generation pipeline + .eml + naming | Task 11, Task 12, Task 17 |
| §9 Error handling (modal) | Task 18 |
| §10 Testing | Tests created alongside each task |
| §11 Out of scope | Honoured — no content scripts, no Graph/Gmail, no Notion lookup |
| §12 Open questions | Surfaced in README (Task 20) |

**Placeholder scan:** no "TBD" / "TODO" / "implement later" / "add appropriate error handling" — all error paths show the exact code or message.

**Type consistency:**
- `fillDocx(bytes, data)` — Task 8, Task 17 ✓
- `fillPdf(bytes, data)` — Task 9, Task 17 ✓ (async)
- `fillXlsx(bytes, data)` — Task 10, Task 17 ✓ (async, returns ArrayBuffer wrapped in `new Uint8Array(...)`)
- `buildEml({subject, bodyLines, headers, attachments, date})` — Task 11, Task 17 ✓
- `downloadBundle({files, anschlussnutzer, today?, chrome?, URL?})` — Task 12, Task 17 ✓
- `validate(form)` → flat error map keyed by dotted path — Task 5, Task 14–17 ✓
- Token names identical across docx (`{TYP}` in loop, scalar `{ESA_NAME}`), pdf (`MP_1_TYP`, `ESA_NAME`), xlsx (`{{ESA_NAME}}`). Note the deliberate delimiter difference: single-brace `{X}` for docxtemplater default, plain field name for AcroForm, double-brace `{{X}}` for xlsx custom regex — documented in spec §5 and reinforced in each filler test.

Plan is complete and internally consistent.

# Address Field Split + PDF AcroForm Integration

**Status:** Ready for implementation
**Author:** Thomas Boyle (thomas.boyle@advizeo.io)
**Date:** 2026-05-19
**Extends:** `2026-05-13-mako-chrome-extension-design.md`

## 1. Motivation

The original design used single multiline `adresse` fields for Objekt and Anschlussnutzer, and left MSB address uncollected entirely. The official Einwilligungserklärung PDF has separate rows for "Straße, Hausnummer" and "Postleitzahl, Ort" across all three parties. Splitting PLZ and Ort into dedicated fields:

- Enables German PLZ validation (`/^\d{5}$/`)
- Maps directly to PDF AcroForm row structure (one field per PDF row)
- Allows address autocomplete to populate structured fields precisely
- Lets the BDEW company autocomplete fill MSB address from the same API call that already fills Name + Code-Nr.

Street and Hausnummer are kept as a single combined string (e.g. `"Hauptstraße 12"`) everywhere — users enter them together, Photon returns them concatenated, and the BDEW API returns them as one field.

## 2. Data model changes (`form-state.js`)

Replace the flat `adresse` strings and extend `msb`:

```js
// Before
objekt:          { adresse: '' }
anschlussnutzer: { name: '', adresse: '' }
msb:             { name: '', codeNr: '', knownToAdvizeo: null }

// After
objekt:          { strasse: '', plz: '', ort: '' }
anschlussnutzer: { name: '', strasse: '', plz: '', ort: '' }
msb:             { name: '', codeNr: '', strasse: '', plz: '', ort: '', knownToAdvizeo: null }
```

`defaultState()` initialises all new fields as `''`.

**Migration:** `chrome.storage.local` may hold old state with `adresse` keys. The existing spread-merge in `loadState` (`{ ...defaultState(), ...stored }`) handles this gracefully — old `adresse` values are ignored, new fields default to `''`. Users will need to re-enter address data once after the update.

## 3. Validation changes (`validate.js`)

Replace the two `adresse` checks with 9 new checks (3 per address block):

| Field path | Rule | Error message |
|---|---|---|
| `objekt.strasse` | non-empty after trim | `'Pflichtfeld'` |
| `objekt.plz` | `/^\d{5}$/` | `'PLZ muss 5 Ziffern haben'` |
| `objekt.ort` | non-empty after trim | `'Pflichtfeld'` |
| `anschlussnutzer.strasse` | non-empty after trim | `'Pflichtfeld'` |
| `anschlussnutzer.plz` | `/^\d{5}$/` | `'PLZ muss 5 Ziffern haben'` |
| `anschlussnutzer.ort` | non-empty after trim | `'Pflichtfeld'` |
| `msb.strasse` | non-empty after trim | `'Pflichtfeld'` |
| `msb.plz` | `/^\d{5}$/` | `'PLZ muss 5 Ziffern haben'` |
| `msb.ort` | non-empty after trim | `'Pflichtfeld'` |

All existing MSB Name / Code-Nr. / knownToAdvizeo and date rules are unchanged.

## 4. Address autocomplete service

Use **Photon** (`photon.komoot.io`) for Objekt-Adresse and Anschlussnutzer-Adresse. Free, no API key, purpose-built for address typeahead, returns structured components.

**Query:**
```
GET https://photon.komoot.io/api?q=<input>&lang=de&limit=5&countrycode=de
```

**Response shape** (relevant fields):
```json
{
  "features": [{
    "properties": {
      "street": "Hauptstraße",
      "housenumber": "12",
      "postcode": "10115",
      "city": "Berlin"
    }
  }]
}
```

**New file: `src/address-autocomplete.js`**

```js
const PHOTON = 'https://photon.komoot.io/api';

export async function fetchAddressSuggestions(query) {
  const url = `${PHOTON}?q=${encodeURIComponent(query)}&lang=de&limit=5&countrycode=de`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Adresssuche fehlgeschlagen');
  const json = await res.json();
  return (json.features ?? [])
    .map(f => {
      const p       = f.properties ?? {};
      const street  = p.street ?? '';
      const nr      = p.housenumber ?? '';
      const strasse = nr ? `${street} ${nr}` : street;
      const plz     = p.postcode ?? '';
      const ort     = p.city ?? p.town ?? p.village ?? '';
      if (!strasse) return null;
      const label = [strasse, plz, ort].filter(Boolean).join(', ');
      return { label, strasse, plz, ort };
    })
    .filter(Boolean);
}
```

`manifest.json` gets `"https://photon.komoot.io/*"` added to `host_permissions`.

## 5. Step 1 UI changes (`src/ui/step1.js`)

### Address block layout

Replace each `field({ multiline: true })` with a 2-row structured address block:

```
[Straße + Hausnummer ─────────────────────────────────────]
[PLZ ────────] [Ort ──────────────────────────────────────]
```

The Straße input gets an autocomplete dropdown beneath it (same `autocomplete-wrap` / `ul.autocomplete-drop` pattern already used for MSB Name). Selecting a suggestion fires `onChange` for `strasse`, `plz`, and `ort` in one go.

The three address blocks and their autocomplete sources:

| Block | Fields | Autocomplete source |
|---|---|---|
| Objekt-Adresse | `objekt.strasse`, `objekt.plz`, `objekt.ort` | Photon |
| Anschlussnutzer-Adresse | `anschlussnutzer.strasse`, `anschlussnutzer.plz`, `anschlussnutzer.ort` | Photon |
| MSB-Adresse | `msb.strasse`, `msb.plz`, `msb.ort` | BDEW (via `selectMsb`, see §6) |

### wireStep1 additions

`wireStep1` calls `wireAddressAutocomplete(root, 'objekt', onChange, signal)` and `wireAddressAutocomplete(root, 'anschlussnutzer', onChange, signal)` — a shared function that debounces Photon calls on the respective Straße input (300 ms), renders the dropdown, and on selection fires `onChange` for all three sub-fields.

The MSB address block is plain inputs; it is filled programmatically by `selectMsb` (§6) when the user picks an MSB from the BDEW dropdown, and is freely editable afterwards.

### render.js addition

Add an `addressBlock({ prefix, label, state, errors })` export to `render.js` that renders the 2-row layout and the autocomplete wrapper around the Straße input. Imported by `step1.js`.

## 6. BDEW API extension (`src/bdew-api.js`)

`GetCompanyList` `Records` contain address fields alongside `Id` and `Company`. Extend `searchMsb()` to pass them through:

```js
return (data.Records ?? []).map(r => ({
  id:      r.Id,
  name:    r.Company.trim(),
  strasse: (r.Street ?? '').trim(),   // exact field name to confirm with console.log during dev
  plz:     (r.ZipCode ?? '').trim(),
  ort:     (r.City ?? '').trim(),
}));
```

No street-splitting logic is needed — the BDEW API returns street + number as one string, which maps directly to our `strasse` field.

Extend `selectMsb()` in `step1.js` to fire `onChange` for all three address fields after filling name:

```js
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

## 7. Token contract (`src/main.js` → `toTemplateData()`)

### PDF tokens (new)

Add split tokens for the three address blocks. These are used by `pdf-fill.js` to fill the AcroForm fields:

```js
ANSCHLUSSNUTZER_STRASSE: s.anschlussnutzer.strasse,
ANSCHLUSSNUTZER_PLZ_ORT: `${s.anschlussnutzer.plz} ${s.anschlussnutzer.ort}`.trim(),

MSB_STRASSE:    s.msb.strasse,
MSB_PLZ_ORT:    `${s.msb.plz} ${s.msb.ort}`.trim(),

OBJEKT_STRASSE:  s.objekt.strasse,
OBJEKT_PLZ_ORT:  `${s.objekt.plz} ${s.objekt.ort}`.trim(),
```

### Docx tokens (backward-compatible, no template changes needed)

`toTemplateData()` continues to emit `OBJEKT_ADRESSE` and `ANSCHLUSSNUTZER_ADRESSE` for the `.docx` template by composing them from the split fields:

```js
OBJEKT_ADRESSE:          `${s.objekt.strasse}\n${s.objekt.plz} ${s.objekt.ort}`.trim(),
ANSCHLUSSNUTZER_ADRESSE: `${s.anschlussnutzer.strasse}\n${s.anschlussnutzer.plz} ${s.anschlussnutzer.ort}`.trim(),
```

The `.docx` template is **not changed**. `docxtemplater` receives `linebreaks: true` so the `\n` renders as a paragraph break in Word.

There is no `MSB_ADRESSE` token in the docx template today; `MSB_STRASSE` and `MSB_PLZ_ORT` are PDF-only tokens.

## 8. PDF AcroForm integration

### 8.1 AcroForm field inventory

The Einwilligungserklärung PDF (3 pages) needs these AcroForm text fields:

**Page 1 — Anschlussnutzer block**

| Field name | PDF row label |
|---|---|
| `ANSCHLUSSNUTZER_NAME` | Nachname, Vorname bzw. Firma |
| `ANSCHLUSSNUTZER_STRASSE` | Korrespondenzanschrift — Straße, Hausnummer |
| `ANSCHLUSSNUTZER_PLZ_ORT` | Korrespondenzanschrift — Postleitzahl, Ort |

**Page 1 — ESA block** (pre-filled by extension; read-only for recipient)

| Field name | Static value |
|---|---|
| `ESA_NAME` | Advizeo Deutschland GmbH |
| `ESA_STRASSE` | Zum Gunterstal 6 |
| `ESA_PLZ_ORT` | 66440 Blieskastel |
| `ESA_MARKTPARTNER_ID` | 9985220000009 |

**Page 1 — MSB block**

| Field name | PDF row label |
|---|---|
| `MSB_NAME` | Firma |
| `MSB_STRASSE` | Straße, Hausnummer |
| `MSB_PLZ_ORT` | Postleitzahl, Ort |
| `MSB_CODE_NR` | MP-ID |

**Page 1 — Gültigkeitszeitraum**

| Field name | PDF row label |
|---|---|
| `BEGINN_DATUM` | Beginn-Datum |
| `ENDE_DATUM` | Ende-Datum |

**Page 2 — Angaben zu den Messprodukten (10 rows)**

| Field names | PDF column |
|---|---|
| `MP_1_CODE` … `MP_10_CODE` | Messprodukt-Code |
| `MP_1_BEZEICHNUNG` … `MP_10_BEZEICHNUNG` | Messproduktcodebezeichnung |

### 8.2 Build script: `scripts/add-pdf-fields.mjs`

A one-time Node.js script that loads the original Muster-Formular PDF and adds AcroForm text fields using pdf-lib (installed as a dev dependency — not the vendored browser build), then writes the result back to `templates/einwilligungserklaerung.pdf`.

```
npm install --save-dev pdf-lib   # dev only; not bundled into the extension
node scripts/add-pdf-fields.mjs
```

The script:
1. Loads `templates/einwilligungserklaerung.pdf`
2. Creates a `PDFTextField` for each field in §8.1 at hardcoded `{ x, y, width, height }` coordinates matching each table cell
3. Calls `field.enableReadOnly()` on all four ESA fields
4. Saves back to the same path

Coordinates are declared as named constants at the top of the script and must be verified visually after the first run (open in Adobe Reader / browser, confirm each field sits inside its cell). Edit constants and re-run as needed.

Re-run whenever the Muster-Formular version changes (currently v1.2, 24 März 2025).

### 8.3 `pdf-fill.js` changes

Update the `SCALARS` array to match the new field names:

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

`MP_SUFFIXES` stays `['CODE', 'BEZEICHNUNG']` — unchanged.

## 9. manifest.json change

Add to `host_permissions`:
```json
"https://photon.komoot.io/*"
```

`bdew-codes.de` should already be present from the MSB autocomplete work.

## 10. Files changed / created

| File | Change |
|---|---|
| `src/form-state.js` | Split `adresse` → `strasse/plz/ort`; add MSB address fields |
| `src/validate.js` | Replace 2 adresse checks with 9 split-field checks |
| `src/address-autocomplete.js` | **New** — Photon fetch + result mapping |
| `src/bdew-api.js` | Return `strasse/plz/ort` from `searchMsb()` |
| `src/ui/step1.js` | Replace textareas with address blocks; wire Photon autocomplete; extend `selectMsb` |
| `src/ui/render.js` | Add `addressBlock()` helper |
| `src/main.js` | Add PDF address tokens; keep docx tokens backward-compatible |
| `src/pdf-fill.js` | Update `SCALARS` array |
| `scripts/add-pdf-fields.mjs` | **New** — one-time AcroForm field injector |
| `templates/einwilligungserklaerung.pdf` | Regenerated by script with AcroForm fields |
| `manifest.json` | Add `photon.komoot.io` host permission |

The `.docx` and `.xlsx` templates require **no changes**.

## 11. Out of scope

- Objekt-Adresse tokens (`OBJEKT_STRASSE`, `OBJEKT_PLZ_ORT`) are added to `toTemplateData()` for forward use but the current docx template does not reference them — no docx change required.
- MSB address is not re-validated against the BDEW response after autocomplete; users can edit freely.
- Non-German PLZ formats (Austrian 4-digit, etc.) are out of scope; `/^\d{5}$/` stays.

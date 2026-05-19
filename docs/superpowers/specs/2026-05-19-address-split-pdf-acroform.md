# Address Field Split + PDF AcroForm Integration

**Status:** Ready for implementation
**Author:** Thomas Boyle (thomas.boyle@advizeo.io)
**Date:** 2026-05-19
**Extends:** `2026-05-13-mako-chrome-extension-design.md`

## 1. Motivation

The original design used single multiline `adresse` fields for Objekt, Anschlussnutzer, and left MSB address uncollected. The official Einwilligungserklärung PDF has separate rows for "Straße, Hausnummer" and "Postleitzahl, Ort" across all three parties. Splitting the input fields:

- Maps 1:1 to PDF AcroForm field structure
- Enables German PLZ validation
- Allows address autocomplete to populate structured fields
- Lets the BDEW company autocomplete fill MSB address from the same API call that already fills Name + Code-Nr.

## 2. Data model changes

Replace the flat `adresse` strings in `form-state.js`:

```js
// Before
objekt:          { adresse: '' }
anschlussnutzer: { name: '', adresse: '' }
msb:             { name: '', codeNr: '', knownToAdvizeo: null }

// After
objekt: {
  strasse: '', hausnummer: '', plz: '', ort: ''
}
anschlussnutzer: {
  name: '', strasse: '', hausnummer: '', plz: '', ort: ''
}
msb: {
  name: '', codeNr: '',
  strasse: '', hausnummer: '', plz: '', ort: '',
  knownToAdvizeo: null
}
```

`defaultState()` initialises all new fields as `''`.

**Migration:** `chrome.storage.local` may hold old state with `adresse` keys. The existing spread-merge in `loadState` (`{ ...defaultState(), ...stored }`) handles this gracefully — old `adresse` values are ignored (not carried forward), new fields default to `''`. Users will need to re-enter address data once after the update.

## 3. Validation changes (`validate.js`)

Replace the two `adresse` checks. New rules are identical across all three address blocks:

| Field path | Rule | Error message |
|---|---|---|
| `objekt.strasse` | non-empty after trim | `'Pflichtfeld'` |
| `objekt.hausnummer` | non-empty after trim | `'Pflichtfeld'` |
| `objekt.plz` | `/^\d{5}$/` | `'PLZ muss 5 Ziffern haben'` |
| `objekt.ort` | non-empty after trim | `'Pflichtfeld'` |
| `anschlussnutzer.strasse` | non-empty after trim | `'Pflichtfeld'` |
| `anschlussnutzer.hausnummer` | non-empty after trim | `'Pflichtfeld'` |
| `anschlussnutzer.plz` | `/^\d{5}$/` | `'PLZ muss 5 Ziffern haben'` |
| `anschlussnutzer.ort` | non-empty after trim | `'Pflichtfeld'` |
| `msb.strasse` | non-empty after trim | `'Pflichtfeld'` |
| `msb.hausnummer` | non-empty after trim | `'Pflichtfeld'` |
| `msb.plz` | `/^\d{5}$/` | `'PLZ muss 5 Ziffern haben'` |
| `msb.ort` | non-empty after trim | `'Pflichtfeld'` |

All existing MSB and date rules are unchanged.

## 4. Address autocomplete service

Use **Photon** (`photon.komoot.io`) for the Objekt-Adresse and Anschlussnutzer-Adresse autocomplete. Photon is OpenStreetMap-based, free, requires no API key, and returns structured address components.

**Query:**
```
GET https://photon.komoot.io/api?q=<input>&lang=de&limit=5&countrycode=de
```

**Response shape** (relevant fields):
```json
{
  "features": [{
    "properties": {
      "name": "...",
      "street": "Hauptstraße",
      "housenumber": "12",
      "postcode": "10115",
      "city": "Berlin",
      "state": "Berlin"
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
      const p = f.properties ?? {};
      const strasse    = p.street ?? '';
      const hausnummer = p.housenumber ?? '';
      const plz        = p.postcode ?? '';
      const ort        = p.city ?? p.town ?? p.village ?? '';
      if (!strasse) return null;
      const label = [strasse, hausnummer, plz, ort].filter(Boolean).join(' ');
      return { label, strasse, hausnummer, plz, ort };
    })
    .filter(Boolean);
}
```

`manifest.json` gets `"https://photon.komoot.io/*"` added to `host_permissions`.

## 5. Step 1 UI changes (`src/ui/step1.js`)

### Address block layout

Replace each `field({ multiline: true })` with a reusable `addressBlock()` helper (defined in `step1.js`). Visual layout:

```
[Straße ─────────────────────────────────] [Hausnummer ──]
[PLZ ────] [Ort ──────────────────────────────────────────]
```

Straße input gets an autocomplete dropdown beneath it (same `autocomplete-wrap` / `ul.autocomplete-drop` pattern already used for MSB Name). Selecting a suggestion fills all four fields of that address block by firing `onChange` for each path.

The three address blocks:

| Block prefix | Autocomplete source | Fields wired |
|---|---|---|
| `objekt.*` | Photon | strasse, hausnummer, plz, ort |
| `anschlussnutzer.*` | Photon | strasse, hausnummer, plz, ort |
| `msb.*` | BDEW (see §6) | strasse, hausnummer, plz, ort |

### wireStep1 additions

`wireStep1` calls `wireAddressAutocomplete(root, 'objekt', onChange, signal)` and `wireAddressAutocomplete(root, 'anschlussnutzer', onChange, signal)` — a function that debounces Photon calls on the Straße input (300 ms), renders a dropdown, and on click fires `onChange` for all four sub-fields.

The existing `wireMsbAutocomplete` continues to handle the MSB Name typeahead; `selectMsb` is extended as described in §6.

### render.js addition

Add an `addressBlock({ prefix, label, state, errors })` export to `render.js` that renders the 2×2 grid and the autocomplete wrapper around the Straße input. Both `step1.js` and future steps can import it.

## 6. BDEW API extension (`src/bdew-api.js`)

The `GetCompanyList` response `Records` contains address fields alongside `Id` and `Company`. Update `searchMsb()` to pass them through:

```js
return (data.Records ?? []).map(r => ({
  id:          r.Id,
  name:        r.Company.trim(),
  strasse:     (r.Street ?? '').trim(),        // field name TBC — log raw r during dev
  hausnummer:  '',                              // BDEW typically returns Street as combined
  plz:         (r.ZipCode ?? '').trim(),
  ort:         (r.City ?? '').trim(),
}));
```

**Note on Street parsing:** The BDEW API likely returns "Straße Hausnummer" as a single `Street` field rather than splitting them. The implementation should attempt a simple split on the last whitespace-separated token that looks like a number (`/\s+(\d+\w*)$/`). If the split fails (no numeric suffix found), put the whole value in `strasse` and leave `hausnummer` blank — the user can correct it manually.

`selectMsb()` in `step1.js` is extended to fire `onChange` for all four address fields after filling name + codeNr:

```js
async function selectMsb(company, drop, onChange) {
  hideDrop(drop);
  onChange('msb.name',       company.name);
  onChange('msb.strasse',    company.strasse);
  onChange('msb.hausnummer', company.hausnummer);
  onChange('msb.plz',        company.plz);
  onChange('msb.ort',        company.ort);
  let code;
  try { code = await fetchMsbCode(company.id); } catch { return; }
  if (code) onChange('msb.codeNr', code);
}
```

## 7. Token contract update (`src/main.js` → `toTemplateData()`)

Remove `OBJEKT_ADRESSE` and `ANSCHLUSSNUTZER_ADRESSE`. Add split tokens for all three address blocks:

```js
OBJEKT_STRASSE_HAUSNUMMER:           `${s.objekt.strasse} ${s.objekt.hausnummer}`.trim(),
OBJEKT_PLZ_ORT:                      `${s.objekt.plz} ${s.objekt.ort}`.trim(),

ANSCHLUSSNUTZER_STRASSE_HAUSNUMMER:  `${s.anschlussnutzer.strasse} ${s.anschlussnutzer.hausnummer}`.trim(),
ANSCHLUSSNUTZER_PLZ_ORT:             `${s.anschlussnutzer.plz} ${s.anschlussnutzer.ort}`.trim(),

MSB_STRASSE_HAUSNUMMER:              `${s.msb.strasse} ${s.msb.hausnummer}`.trim(),
MSB_PLZ_ORT:                         `${s.msb.plz} ${s.msb.ort}`.trim(),
```

The `.docx` template (`einwilligungserklaerung.docx`) must be updated to use the new token names. Tokens to replace:

| Old token | New tokens |
|---|---|
| `{OBJEKT_ADRESSE}` | `{OBJEKT_STRASSE_HAUSNUMMER}` + line break + `{OBJEKT_PLZ_ORT}` |
| `{ANSCHLUSSNUTZER_ADRESSE}` | `{ANSCHLUSSNUTZER_STRASSE_HAUSNUMMER}` + line break + `{ANSCHLUSSNUTZER_PLZ_ORT}` |

(The `.docx` template currently uses single-brace delimiters per the `docxtemplater` config in `docx-fill.js`.)

## 8. PDF AcroForm integration

### 8.1 AcroForm field inventory

The Einwilligungserklärung PDF (3 pages) needs these AcroForm text fields:

**Page 1 — Anschlussnutzer block**

| Field name | PDF row label |
|---|---|
| `ANSCHLUSSNUTZER_NAME` | Nachname, Vorname bzw. Firma |
| `ANSCHLUSSNUTZER_STRASSE_HAUSNUMMER` | Korrespondenzanschrift — Straße, Hausnummer |
| `ANSCHLUSSNUTZER_PLZ_ORT` | Korrespondenzanschrift — Postleitzahl, Ort |

**Page 1 — ESA block** (static values; pre-filled by extension, not editable by recipient)

| Field name | Value |
|---|---|
| `ESA_NAME` | Advizeo Deutschland GmbH |
| `ESA_STRASSE_HAUSNUMMER` | Zum Gunterstal 6 |
| `ESA_PLZ_ORT` | 66440 Blieskastel |
| `ESA_MARKTPARTNER_ID` | 9985220000009 |

**Page 1 — MSB block**

| Field name | PDF row label |
|---|---|
| `MSB_NAME` | Firma |
| `MSB_STRASSE_HAUSNUMMER` | Straße, Hausnummer |
| `MSB_PLZ_ORT` | Postleitzahl, Ort |
| `MSB_CODE_NR` | MP-ID |

**Page 1 — Gültigkeitszeitraum**

| Field name | PDF row label |
|---|---|
| `BEGINN_DATUM` | Beginn-Datum |
| `ENDE_DATUM` | Ende-Datum |

**Page 2 — Angaben zu den Messprodukten (10 rows)**

| Field names | PDF columns |
|---|---|
| `MP_1_CODE` … `MP_10_CODE` | Messprodukt-Code |
| `MP_1_BEZEICHNUNG` … `MP_10_BEZEICHNUNG` | Messproduktcodebezeichnung |

### 8.2 Build script: `scripts/add-pdf-fields.mjs`

A one-time Node.js script that loads the original PDF, adds AcroForm text fields at the correct positions using pdf-lib (via a local `require`/`import` of the package — not the vendored browser build), and writes the result back to `templates/einwilligungserklaerung.pdf`.

The script:
1. Loads `templates/einwilligungserklaerung.pdf`
2. Adds a `PDFTextField` for each field in §8.1 at hardcoded `{ x, y, width, height }` coordinates matching each table cell in the Muster-Formular layout
3. Sets `field.enableReadOnly()` for all ESA fields (filled but not user-editable)
4. Saves back to the same path

Coordinate constants are defined at the top of the script and must be verified visually after the first run (open in Adobe Reader, confirm fields sit inside the correct cells). Adjustments are made by editing the constants and re-running.

The script is run once per template version change: `node scripts/add-pdf-fields.mjs`.
It is not part of the extension load — only the output PDF ships.

### 8.3 `pdf-fill.js` changes

Update the `SCALARS` array to the full new set:

```js
const SCALARS = [
  'ANSCHLUSSNUTZER_NAME',
  'ANSCHLUSSNUTZER_STRASSE_HAUSNUMMER',
  'ANSCHLUSSNUTZER_PLZ_ORT',
  'ESA_NAME',
  'ESA_STRASSE_HAUSNUMMER',
  'ESA_PLZ_ORT',
  'ESA_MARKTPARTNER_ID',
  'MSB_NAME',
  'MSB_STRASSE_HAUSNUMMER',
  'MSB_PLZ_ORT',
  'MSB_CODE_NR',
  'BEGINN_DATUM',
  'ENDE_DATUM',
];
```

`MP_SUFFIXES` stays `['CODE', 'BEZEICHNUNG']` — no change there.

## 9. manifest.json change

Add to `host_permissions`:
```json
"https://photon.komoot.io/*"
```

(The `bdew-codes.de` permission should already be present from the MSB autocomplete work.)

## 10. Files changed / created

| File | Change |
|---|---|
| `src/form-state.js` | Split `adresse` fields; add MSB address fields |
| `src/validate.js` | Replace 2 adresse checks with 12 split-field checks |
| `src/address-autocomplete.js` | **New** — Photon fetch + result mapping |
| `src/bdew-api.js` | Return address fields from `searchMsb()`; Street split logic |
| `src/ui/step1.js` | Replace textareas with address blocks; wire Photon autocomplete; extend `selectMsb` |
| `src/ui/render.js` | Add `addressBlock()` helper |
| `src/main.js` | Update `toTemplateData()` with new tokens |
| `src/pdf-fill.js` | Update `SCALARS` array |
| `scripts/add-pdf-fields.mjs` | **New** — one-time AcroForm field injector |
| `templates/einwilligungserklaerung.pdf` | Regenerated by script with AcroForm fields |
| `templates/einwilligungserklaerung.docx` | Manual: replace old address tokens |
| `manifest.json` | Add `photon.komoot.io` host permission |

## 11. Out of scope

- Objekt-Adresse does not appear in the Einwilligungserklärung PDF — it goes into the `.docx` template and any other documents that use `OBJEKT_*` tokens. No change to the PDF needed for it beyond the token rename in the docx template.
- MSB address is not validated against the BDEW API response — users can edit it freely after autocomplete fills it.
- Non-German addresses (e.g. Austrian PLZ = 4 digits) are out of scope; `/^\d{5}$/` PLZ validation stays.

# MaKo Chrome Extension — Design

**Status:** Draft for review
**Author:** Thomas Boyle (thomas.boyle@advizeo.io)
**Date:** 2026-05-13
**Working name:** `Formularis_ausfüllio`

## 1. Purpose

Reduce the manual document work in step 3 of Advizeo's MaKo "Erstmalige Umsetzung"
process (per Notion: *House of Advizeo Deutschland → MaKo → 3. MSB (bilateral):
Ankündigung ESA*). A non-technical user enters a small set of customer data into
a Chrome-extension wizard and gets back the document bundle needed to either
(a) inform an existing-relationship MSB of new metering points, or
(b) announce Advizeo as ESA to a new MSB.

Out of scope: scraping BDEW Codes, scraping MakoFlow, sending email via Graph/Gmail,
EDIFACT message generation, signed-PDF round-tripping with the customer.

## 2. Inputs and outputs

### Inputs (user-entered)

- Objekt-Adresse (real estate address, multiline)
- Anschlussnutzer Name + Adresse
- MSB Name + Code-Nr. (13-digit BDEW code)
- Kooperation mit Advizeo bereits bestehend? — Ja / Nein
- 1..N Messpunkte, each row:
  - Typ: MeLo or MaLo
  - ID (33-char alphanumeric MeLo, or 11-digit MaLo)
  - Lieferrichtung: Verbrauch or Erzeugung
- Beginn-Datum (default: today − 3 years)
- Ende-Datum (default: blank/"offen")

### Output bundle — always

- `Einwilligungserklaerung_<slug>.docx` — editable Word version
- `Einwilligungserklaerung_<slug>.pdf` — signable PDF version (AcroForm)

### Output bundle — additionally if "Kooperation bestehend = Nein"

- `Kontaktdatenblatt.xlsx`
- `MSB-Anfrage_<msb-slug>.eml` — pre-drafted email; attachments:
  Kontaktdatenblatt + unsigned consent PDF; To: blank;
  Subject + body from Notion template verbatim.

All outputs land in `Downloads/MaKo/YYYY-MM-DD_<anschlussnutzer-slug>/`.

## 3. Architecture

Manifest V3 Chrome extension. No host permissions, no content scripts, no
background work beyond opening the wizard tab. The wizard runs as a regular
extension page with autosave to `chrome.storage.local`.

```
formularis-ausfuellio/
├── manifest.json                # MV3, permission: "downloads"
├── icons/                       # 16/48/128 PNGs — "MAKO" wordmark in Advizeo pink
├── background.js                # action.onClicked → chrome.tabs.create({url:'form.html'})
├── form.html                    # the wizard shell
├── styles.css
├── src/
│   ├── main.js                  # wizard state machine, step routing, autosave
│   ├── form-state.js            # in-memory model + chrome.storage.local persistence
│   ├── validate.js              # validation rules (see §6)
│   ├── messprodukt.js           # (kind, richtung) → Messprodukt code lookup
│   ├── docx-fill.js             # docxtemplater glue
│   ├── pdf-fill.js              # pdf-lib glue (AcroForm field-name fill)
│   ├── xlsx-fill.js             # exceljs glue
│   ├── eml-build.js             # RFC 5322 multipart/mixed builder with X-Unsent: 1
│   ├── email-template.js        # German subject + body strings from Notion
│   └── download.js              # chrome.downloads wrapper with naming + slugging
├── templates/
│   ├── einwilligungserklaerung.docx   # provided by Advizeo, with {{TOKEN}} placeholders
│   ├── einwilligungserklaerung.pdf    # provided by Advizeo, AcroForm fields named per §5
│   └── kontaktdatenblatt.xlsx          # provided by Advizeo (filled if tokens present)
└── vendor/                      # bundled docxtemplater, pizzip, pdf-lib, exceljs
```

**No build step.** Plain JS modules + vendored libs. Distribution: zip → "Load
unpacked" in `chrome://extensions`. Update path = re-zip and re-install.

### Library choices

- `docxtemplater` + `pizzip` — token + loop substitution in .docx
- `pdf-lib` — fill AcroForm fields in the .pdf template
- `exceljs` — token substitution in .xlsx
- Native `Blob` + base64 — .eml MIME assembly (no helper library)

### Distribution

Zip the extension folder, ship via SharePoint/email. Non-technical install
instructions in `README.md`:

> 1. Unzip the folder anywhere
> 2. Visit `chrome://extensions`
> 3. Enable "Developer mode" (top right toggle)
> 4. Click "Load unpacked" → pick the unzipped folder
> 5. Pin the MAKO icon to the toolbar

## 4. Data model

```js
{
  objekt: { adresse: "" },
  anschlussnutzer: { name: "", adresse: "" },
  msb: {
    name: "",
    codeNr: "",                                // 13 digits
    knownToAdvizeo: null                       // true | false
  },
  messpunkte: [
    {
      kind: "MeLo" | "MaLo",
      id: "",
      richtung: "Verbrauch" | "Erzeugung",
      messprodukt: ""                          // derived, not user-entered
    }
  ],
  beginnDatum: "YYYY-MM-DD",                   // default today − 3y
  endeDatum: "",                               // default blank ("offen")

  // Static, baked in
  esa: {
    name: "Advizeo Deutschland GmbH",
    marktpartnerId: "9985220000009"
  }
}
```

**Messprodukt derivation** (in `messprodukt.js`):

| kind | richtung | code |
|---|---|---|
| MeLo | Verbrauch | 9991000000771 |
| MeLo | Erzeugung | 9991000000789 |
| MaLo | Verbrauch | 9991000000747 |
| MaLo | Erzeugung | 9991000000747 |

The Unterzeichner (signature) line is intentionally *not* part of the data model.
Both templates leave the signature region blank so the recipient (Anschlussnutzer)
fills name / Ort / Datum themselves — by hand or via a digital signing tool.

## 5. Template token contract

Token names are case-sensitive `{{LIKE_THIS}}` for docx/xlsx and the same string
as the AcroForm field name in PDF (no curly braces in PDF field names).

### Scalar tokens (.docx, .xlsx, .pdf)

| Token | Source | Format |
|---|---|---|
| `OBJEKT_ADRESSE` | `form.objekt.adresse` | text, line breaks preserved in docx |
| `ANSCHLUSSNUTZER_NAME` | `form.anschlussnutzer.name` | text |
| `ANSCHLUSSNUTZER_ADRESSE` | `form.anschlussnutzer.adresse` | text |
| `MSB_NAME` | `form.msb.name` | text |
| `MSB_CODE_NR` | `form.msb.codeNr` | 13 digits |
| `ESA_NAME` | static `"Advizeo Deutschland GmbH"` | text |
| `ESA_MARKTPARTNER_ID` | static `"9985220000009"` | text |
| `BEGINN_DATUM` | formatted `TT.MM.JJJJ` | `13.05.2023` |
| `ENDE_DATUM` | formatted `TT.MM.JJJJ` or `"offen"` if blank | `offen` |

### Messpunkte (.docx)

Authored inside a `{#MESSPUNKTE} … {/MESSPUNKTE}` loop in a table row. Per
iteration: `TYP`, `ID`, `RICHTUNG`, `MESSPRODUKT`.

### Messpunkte (.pdf) — fixed 10-row layout

AcroForm has no loops. PDF template pre-draws 10 rows with field names:

```
MP_1_TYP, MP_1_ID, MP_1_RICHTUNG, MP_1_MESSPRODUKT,
MP_2_TYP, MP_2_ID, MP_2_RICHTUNG, MP_2_MESSPRODUKT,
...
MP_10_TYP, MP_10_ID, MP_10_RICHTUNG, MP_10_MESSPRODUKT
```

Extension fills rows 1..N from the form and clears (writes empty string to) the
remaining 10−N rows. The form blocks Generate if N > 10 with message "Max 10
Zeilen (PDF-Limit). Bitte mehrere Anfragen senden oder PDF-Vorlage erweitern."

### Kontaktdatenblatt (.xlsx)

The current SharePoint version is largely static contact data; tokens are only
required if Advizeo decides to make any field dynamic (none today). The
extension still runs `xlsx-fill.js` against it so future tokens just work.

## 6. Validation

Rules enforced inline (on blur) and re-checked before "Generieren":

| Field | Rule | Message |
|---|---|---|
| Required free-text fields | non-empty after trim | "Pflichtfeld" |
| `msb.codeNr` | `^\d{13}$` | "Code-Nr. muss 13 Ziffern haben" |
| MeLo `id` | `^[A-Z0-9]{33}$` (uppercased on blur) | "MeLo-ID: 33 Zeichen, A–Z und 0–9" |
| MaLo `id` | `^\d{11}$` | "MaLo-ID: 11 Ziffern" |
| `beginnDatum` | valid date ≤ today | "Datum darf nicht in der Zukunft liegen" |
| `endeDatum` | blank OR > `beginnDatum` | "Ende muss nach Beginn liegen" |
| Messpunkte | ≥ 1 row; ≤ 10 | "Mindestens 1 Messpunkt" / "Max 10 Zeilen (PDF-Limit)" |

The Generieren button stays disabled while any rule fails. Sidebar shows a red
dot next to the step that owns the broken field.

## 7. Wizard flow

3-step wizard, full-page, sticky footer Back / Next / Generieren.

```
Step 1: Stammdaten & MSB
   - Objekt Adresse (multiline)
   - Anschlussnutzer Name
   - Anschlussnutzer Adresse (multiline)
   - MSB Name
   - MSB Code-Nr. (13 digits, validated)
   - "Besteht bereits eine Kooperation mit Advizeo?" [Ja]/[Nein] radio
     - Helper under "Nein": "Zusätzlich wird eine MSB-Anfrage-E-Mail
       mit Kontaktdatenblatt generiert."
   - Link: "MSB nachschlagen auf bdew-codes.de ↗" (target=_blank)

Step 2: Messpunkte
   - Table with rows:
       Typ [MeLo|MaLo] · ID · Lieferrichtung [Verbrauch|Erzeugung]
       · Messprodukt (auto, read-only chip) · ✕
   - [+ Messpunkt hinzufügen]

Step 3: Zeitraum & Vorschau
   - Beginn-Datum (default today − 3y)
   - Ende-Datum (default blank, "Offen lassen" toggle)
   - Vorschau-Panel:
       - List of files that will be downloaded (count depends on Step 1 radio)
       - For new-MSB: first 6 lines of email subject + body
   - [Generieren] → produces files; success screen with file list +
     [Neue MaKo] / [Diese Daten beibehalten]
```

Autosave runs on every field change; closing/re-opening the tab restores the
wizard at the last step the user was on. "Reset" in the header clears state.

## 8. Generation pipeline

Click of **Generieren** runs in `main.js`, sequential, all in-browser:

```
1. validate(form)                          → block on failure
2. for row in messpunkte: row.messprodukt = derive(row.kind, row.richtung)
3. docxBytes = await fetch(getURL('templates/einwilligungserklaerung.docx'))
4. filledDocx = fillDocx(docxBytes, data)
5. pdfBytes  = await fetch(getURL('templates/einwilligungserklaerung.pdf'))
6. filledPdf = fillPdf(pdfBytes, data)     // fills MP_1..N, clears MP_(N+1)..10
7. if form.msb.knownToAdvizeo === false:
     xlsxBytes  = await fetch(getURL('templates/kontaktdatenblatt.xlsx'))
     filledXlsx = fillXlsx(xlsxBytes, data)
     eml = buildEml({
       subject: emailTemplate.subject,
       body:    emailTemplate.body,
       headers: { 'X-Unsent': '1' },
       attachments: [
         { name: 'Kontaktdatenblatt.xlsx',                bytes: filledXlsx },
         { name: 'Einwilligungserklaerung_<slug>.pdf',    bytes: filledPdf  }
       ]
     })
8. downloadAll(folder='MaKo/<date>_<slug>/', files=...)
9. show success view
```

Each `fill*` function is pure (input bytes + data → output bytes), independently
testable.

### .eml structure

`multipart/mixed`, UTF-8, `X-Unsent: 1` (Outlook flag = "open as draft"):

```
From:
To:
Subject: Anfrage ESA 9985220000009 im Auftrag Anschlussnutzer
Date: Wed, 13 May 2026 21:36:00 +0200
MIME-Version: 1.0
X-Unsent: 1
Content-Type: multipart/mixed; boundary="<random>"

--<random>
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

<German body text from Notion template, verbatim, CRLF line endings>

--<random>
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="Kontaktdatenblatt.xlsx"
Content-Transfer-Encoding: base64

<base64-encoded xlsx>

--<random>
Content-Type: application/pdf
Content-Disposition: attachment; filename="Einwilligungserklaerung_<slug>.pdf"
Content-Transfer-Encoding: base64

<base64-encoded pdf>
--<random>--
```

### Filename slugging

`slug(s) = ascii-fold(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)`

Reserved chars stripped before the slug is fed to `chrome.downloads.download`
(which enforces `:`, `<`, `>`, `|`, `?`, `*`, `"`, `\`, `/` rules of its own).
`conflictAction: 'uniquify'` suffixes `(1)`, `(2)` for same-day duplicates.

## 9. Error handling

| Failure | Cause | UX |
|---|---|---|
| Template file missing | `templates/*` removed/corrupt | Modal: "Vorlage fehlt: <path>". Raw error in `<details>` |
| docxtemplater render error | Unknown token / malformed `{#LOOP}` | Modal naming the offending token |
| pdf-lib field missing | Template AcroForm missing e.g. `MP_3_ID` | Modal: "PDF-Vorlage hat Feld 'MP_3_ID' nicht. Vorlage prüfen." |
| Download denied by user | Browser blocks the download | Inline banner, retry button, state preserved |
| .eml not opening in Outlook | OS-level file association | Out of extension's control. README documents the right-click workaround. |

## 10. Testing

Node `--test` runner (no external framework). Goldens reviewed by eye.

```
tests/
├── fixtures/
│   ├── input-msb-known.json
│   ├── input-msb-new.json
│   ├── expected.docx              # snapshot
│   ├── expected.pdf
│   └── expected.eml
├── docx-fill.test.mjs             # diff vs snapshot bytes
├── pdf-fill.test.mjs              # parse output, assert AcroForm values
├── eml-build.test.mjs             # parse with `mailparser`, assert headers + parts
├── messprodukt.test.mjs           # 4 row-kinds → 3 codes
└── validation.test.mjs            # good/bad inputs
```

`npm test` runs all five. `UPDATE_SNAPSHOTS=1 npm test` refreshes goldens after
intentional template changes.

Manual QA checklist (README, run after every template change):

- [ ] Open .eml in Outlook → appears as draft, To: empty, subject + body correct, both attachments present
- [ ] Open .pdf in Adobe Sign → form fields fillable, signature area available
- [ ] Open .docx in Word → tokens replaced, table rows match Messpunkte
- [ ] Umlauts (ä/ö/ü/ß) render correctly across all three formats
- [ ] Fresh "Load unpacked" install works end-to-end on a clean Chrome profile

## 11. Out of scope (now)

- Sending email via Microsoft Graph / Gmail (would need OAuth setup)
- Scraping BDEW Codes or MakoFlow (user types MSB data manually; link to BDEW page is provided)
- Looking up "MSB known to Advizeo" automatically against the Notion Kooperation database
- EDIFACT REQOTE / QUOTE handling (covered by MakoFlow proper, post-ESA)
- Multi-language UI (German only)
- Chrome Web Store listing (using "Load unpacked" for v1)

## 12. Open questions

- **Exact Advizeo pink hex** for the MAKO icon (current best guess: `#E6007E`). Will confirm before generating icons.
- **Final templates** (.docx, .pdf, .xlsx) need to be authored by Advizeo with the token names from §5 before the extension can run end-to-end.

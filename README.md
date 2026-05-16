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

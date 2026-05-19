const TEXT = s => String(s ?? '').trim();
function plz(val) { return /^\d{5}$/.test(TEXT(val)); }

export function validate(form, today = new Date()) {
  const e = {};

  if (!TEXT(form.objekt?.strasse))           e['objekt.strasse'] = 'Pflichtfeld';
  if (!plz(form.objekt?.plz))                e['objekt.plz']     = 'PLZ muss 5 Ziffern haben';
  if (!TEXT(form.objekt?.ort))               e['objekt.ort']     = 'Pflichtfeld';

  if (!TEXT(form.anschlussnutzer?.name))     e['anschlussnutzer.name']    = 'Pflichtfeld';
  if (!TEXT(form.anschlussnutzer?.strasse))  e['anschlussnutzer.strasse'] = 'Pflichtfeld';
  if (!plz(form.anschlussnutzer?.plz))       e['anschlussnutzer.plz']     = 'PLZ muss 5 Ziffern haben';
  if (!TEXT(form.anschlussnutzer?.ort))      e['anschlussnutzer.ort']     = 'Pflichtfeld';

  if (!TEXT(form.msb?.name))                 e['msb.name'] = 'Pflichtfeld';

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
    } else if (beginn && ende <= beginn) {
      e['endeDatum'] = 'Ende muss nach Beginn liegen';
    }
  }

  return e;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

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
      el('label', { for: 'endeDatum' }, "Ende-Datum (offen lassen für 'unbefristet')"),
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

export function wireStep3(root, onChange, signal) {
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'beginnDatum') onChange('beginnDatum', t.value);
  }, { signal });
}

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

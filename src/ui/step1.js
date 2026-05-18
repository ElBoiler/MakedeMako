import { el, field, radioGroup } from './render.js';
import { searchMsb, fetchMsbCode } from '../bdew-api.js';

export function renderStep1(state, errors, onChange) {
  return el('section', {},
    el('h2', {}, 'Stammdaten & Messstellenbetreiber'),

    field({ id: 'objekt.adresse',           label: 'Objekt-Adresse',           multiline: true,
            value: state.objekt.adresse,          error: errors['objekt.adresse'] }),
    field({ id: 'anschlussnutzer.name',     label: 'Anschlussnutzer (Name)',
            value: state.anschlussnutzer.name,    error: errors['anschlussnutzer.name'] }),
    field({ id: 'anschlussnutzer.adresse',  label: 'Anschlussnutzer (Adresse)', multiline: true,
            value: state.anschlussnutzer.adresse, error: errors['anschlussnutzer.adresse'] }),

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

    field({ id: 'msb.codeNr',               label: 'MSB Code-Nr.',
            value: state.msb.codeNr,              error: errors['msb.codeNr'] }),

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
}

let _acTimer = null;

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
}

function wireMsbAutocomplete(root, onChange, signal) {
  const input = root.querySelector('[id="msb.name"]');
  const drop  = root.querySelector('#msb-drop');
  if (!input || !drop) return;

  input.addEventListener('input', () => {
    clearTimeout(_acTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideDrop(drop); return; }
    _acTimer = setTimeout(() => fetchAndShow(q, drop, onChange, signal), 300);
  }, { signal });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideDrop(drop); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      drop.querySelector('li')?.focus();
    }
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

async function fetchAndShow(q, drop, onChange, signal) {
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
  onChange('msb.name', company.name);
  let code;
  try { code = await fetchMsbCode(company.id); } catch { return; }
  if (code) onChange('msb.codeNr', code);
}

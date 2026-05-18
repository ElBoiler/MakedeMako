import { el, radioGroup }          from './render.js';
import { acField, wireAc }          from './autocomplete.js';
import { searchMsb, fetchMsbCode }  from '../bdew-api.js';
import { searchAddress }            from '../nominatim-api.js';

// Fields that manage their own onChange (on blur/select only, not on every keystroke).
// Excluded from the generic input-delegation so that typing does NOT fire onChange
// and trigger a rerender while the debounced search is in flight.
const AC_FIELDS = new Set([
  'msb.name', 'msb.codeNr', 'objekt.adresse', 'anschlussnutzer.adresse',
]);

// ── Render ─────────────────────────────────────────────────────────────────

export function renderStep1(state, errors, onChange) {
  return el('section', {},
    el('h2', {}, 'Stammdaten & Messstellenbetreiber'),

    acField({ id: 'objekt.adresse',           label: 'Objekt-Adresse',
              value: state.objekt.adresse,          error: errors['objekt.adresse'],  multiline: true }),

    acField({ id: 'anschlussnutzer.name',     label: 'Anschlussnutzer (Name)',
              value: state.anschlussnutzer.name,    error: errors['anschlussnutzer.name'] }),

    acField({ id: 'anschlussnutzer.adresse',  label: 'Anschlussnutzer (Adresse)',
              value: state.anschlussnutzer.adresse, error: errors['anschlussnutzer.adresse'], multiline: true }),

    acField({ id: 'msb.name',                 label: 'MSB Name',
              value: state.msb.name,                error: errors['msb.name'] }),

    acField({ id: 'msb.codeNr',               label: 'MSB Code-Nr.',
              value: state.msb.codeNr,              error: errors['msb.codeNr'] }),

    radioGroup({
      id:      'msb.knownToAdvizeo',
      label:   'Besteht bereits eine Kooperation mit Advizeo?',
      options: [
        { value: 'true',  label: 'Ja'   },
        { value: 'false', label: 'Nein' },
      ],
      value:  state.msb.knownToAdvizeo === null ? '' : String(state.msb.knownToAdvizeo),
      error:  errors['msb.knownToAdvizeo'],
      helper: state.msb.knownToAdvizeo === false
        ? 'Zusätzlich wird eine MSB-Anfrage-E-Mail mit Kontaktdatenblatt generiert.'
        : null,
    }),
  );
}

// ── Wiring ─────────────────────────────────────────────────────────────────

export function wireStep1(root, onChange, signal) {
  // Generic delegation — skip autocomplete fields; they call onChange on blur/select only
  root.addEventListener('input', e => {
    const t = e.target;
    if (!t.id || AC_FIELDS.has(t.id)) return;
    onChange(t.id, t.value);
  }, { signal });

  root.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'radio' && t.name === 'msb.knownToAdvizeo') {
      onChange('msb.knownToAdvizeo', t.value === 'true');
    }
  }, { signal });

  _wireAddressAc(root, 'objekt.adresse',           onChange, signal);
  _wireAddressAc(root, 'anschlussnutzer.adresse',  onChange, signal);
  _wireMsbNameAc(root, onChange, signal);
  _wireMsbCodeAc(root, onChange, signal);
}

// ── Address autocomplete (Nominatim / OpenStreetMap) ───────────────────────

function _wireAddressAc(root, fieldId, onChange, signal) {
  wireAc(root, {
    id:     fieldId,
    signal,
    onBlur: v => onChange(fieldId, v),
    search: async q => {
      const results = await searchAddress(q);
      return results.map(r => ({
        label:    r.display.replace('\n', ', '),  // one-line label in the dropdown
        sublabel: null,
        select:   () => {
          onChange(fieldId, r.display);           // textarea stores multi-line value
          const inp = root.querySelector(`[id="${fieldId}"]`);
          if (inp) inp.value = r.display;         // sync visible value immediately
        },
      }));
    },
  });
}

// ── MSB name field: type name or code → fills name + code ─────────────────
// The BDEW filter matches both company names and BDEW code fragments,
// so "Netze BW" and "9903916" both return the same company.

function _wireMsbNameAc(root, onChange, signal) {
  wireAc(root, {
    id:     'msb.name',
    signal,
    onBlur: v => onChange('msb.name', v),
    search: async q => {
      const companies = await searchMsb(q);
      return companies.map(c => ({
        label:    c.name,
        sublabel: 'Messstellenbetreiber',
        select:   async () => {
          // Set name immediately in both state and DOM (don't wait for rerender)
          _setField(root, 'msb.name', c.name, onChange);
          try {
            const code = await fetchMsbCode(c.id);
            if (code) _setField(root, 'msb.codeNr', code, onChange);
          } catch { /* user can enter code manually */ }
        },
      }));
    },
  });
}

// ── MSB code field: type code fragment or name → fills code + name ─────────

function _wireMsbCodeAc(root, onChange, signal) {
  wireAc(root, {
    id:     'msb.codeNr',
    signal,
    onBlur: v => onChange('msb.codeNr', v),
    search: async q => {
      const companies = await searchMsb(q);
      return companies.map(c => ({
        label:    c.name,
        sublabel: 'Code wird geladen …',
        select:   async () => {
          _setField(root, 'msb.name', c.name, onChange);
          try {
            const code = await fetchMsbCode(c.id);
            if (code) _setField(root, 'msb.codeNr', code, onChange);
          } catch { /* ignore */ }
        },
      }));
    },
  });
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Update state AND the live DOM input in one shot. */
function _setField(root, id, value, onChange) {
  onChange(id, value);
  // querySelector targets the current DOM (which may have been rerendered);
  // direct assignment makes the value visible immediately without waiting for
  // the next rerender cycle.
  const inp = root.querySelector(`[id="${id}"]`);
  if (inp) inp.value = value;
}

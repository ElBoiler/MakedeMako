import { el, addressBlock, field, radioGroup } from './render.js';
import { acField, wireAc }                      from './autocomplete.js';
import { searchMsb, fetchMsbCode, fetchMsbDetail } from '../bdew-api.js';
import { fetchAddressSuggestions }              from '../address-autocomplete.js';

// Fields that manage their own onChange (on blur/select only, not on every keystroke).
// Excluded from the generic input-delegation so that typing does NOT fire onChange
// and trigger a rerender while the debounced search is in flight.
const AC_FIELDS = new Set([
  'objekt.strasse', 'anschlussnutzer.strasse', 'msb.strasse',
  'msb.name', 'msb.codeNr',
]);

// ── Render ─────────────────────────────────────────────────────────────────

export function renderStep1(state, errors, onChange) {
  return el('section', {},
    el('h2', {}, 'Stammdaten & Messstellenbetreiber'),

    addressBlock({
      prefix: 'objekt',
      label:  'Objekt-Adresse',
      values: state.objekt,
      errors,
    }),

    acField({ id: 'anschlussnutzer.name', label: 'Anschlussnutzer (Name)',
              value: state.anschlussnutzer.name, error: errors['anschlussnutzer.name'] }),

    addressBlock({
      prefix: 'anschlussnutzer',
      label:  'Anschlussnutzer (Adresse)',
      values: state.anschlussnutzer,
      errors,
    }),

    acField({ id: 'msb.name',   label: 'MSB Name',
              value: state.msb.name,   error: errors['msb.name'] }),

    acField({ id: 'msb.codeNr', label: 'MSB Code-Nr.',
              value: state.msb.codeNr, error: errors['msb.codeNr'] }),

    addressBlock({
      prefix: 'msb',
      label:  'MSB Adresse',
      values: state.msb,
      errors,
    }),

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

  _wireAddressAc(root, 'objekt',          onChange, signal);
  _wireAddressAc(root, 'anschlussnutzer', onChange, signal);
  _wireAddressAc(root, 'msb',             onChange, signal);
  _wireMsbNameAc(root, onChange, signal);
  _wireMsbCodeAc(root, onChange, signal);
}

// ── Address autocomplete (Photon / Komoot) ─────────────────────────────────

function _wireAddressAc(root, prefix, onChange, signal) {
  wireAc(root, {
    id:     `${prefix}.strasse`,
    signal,
    onBlur: v => onChange(`${prefix}.strasse`, v),
    search: async q => {
      const results = await fetchAddressSuggestions(q);
      return results.map(r => ({
        label:    r.label,
        sublabel: null,
        select:   () => {
          _setField(root, `${prefix}.strasse`, r.strasse, onChange);
          _setField(root, `${prefix}.plz`,     r.plz,     onChange);
          _setField(root, `${prefix}.ort`,     r.ort,     onChange);
        },
      }));
    },
  });
}

// ── MSB name field: type name or code → fills name + code + address ────────
// The BDEW filter matches both company names and BDEW code fragments,
// so "Netze BW" and "9903916" both return the same company.

function _wireMsbNameAc(root, onChange, signal) {
  wireAc(root, {
    id:     'msb.name',
    signal,
    onBlur: v => onChange('msb.name', v),
    search:  q => _msbSearch(root, q, onChange),
  });
}

// ── MSB code field: type code fragment or name → fills code + name + address

function _wireMsbCodeAc(root, onChange, signal) {
  wireAc(root, {
    id:     'msb.codeNr',
    signal,
    onBlur: v => onChange('msb.codeNr', v),
    search:  q => _msbSearch(root, q, onChange),
  });
}

// ── shared MSB search — pre-fetches codes in parallel ──────────────────────
// Codes are resolved before the dropdown appears, so:
//  • The sublabel shows the actual code (or "Kein MSB-Code")
//  • Selection is instant — no second async hop needed

async function _msbSearch(root, q, onChange) {
  const companies = await searchMsb(q);

  // Fetch MSB records in parallel; null means company has no Messstellenbetreiber role
  const records = await Promise.all(
    companies.map(c => fetchMsbCode(c.id).catch(() => null)),
  );

  // Filter to companies with a Messstellenbetreiber role only
  const msb = companies
    .map((c, i) => ({ c, rec: records[i] }))
    .filter(({ rec }) => rec !== null);

  // Fetch address details for each valid MSB record in parallel
  const details = await Promise.all(
    msb.map(({ rec }) => fetchMsbDetail(rec.recordId).catch(() => ({ strasse: '', plz: '', ort: '' }))),
  );

  return msb.map(({ c, rec }, i) => ({
    label:    c.name,
    sublabel: rec.code,
    select:   () => {
      _setField(root, 'msb.name',    c.name,              onChange);
      _setField(root, 'msb.codeNr',  rec.code,            onChange);
      _setField(root, 'msb.strasse', details[i].strasse,  onChange);
      _setField(root, 'msb.plz',     details[i].plz,      onChange);
      _setField(root, 'msb.ort',     details[i].ort,      onChange);
    },
  }));
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Update state AND the live DOM input in one shot. */
function _setField(root, id, value, onChange) {
  onChange(id, value);
  const inp = root.querySelector(`[id="${id}"]`);
  if (inp) inp.value = value;
}

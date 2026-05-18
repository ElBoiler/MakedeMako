import { el, field, radioGroup } from './render.js';

export function renderStep1(state, errors, onChange) {
  return el('section', {},
    el('h2', {}, 'Stammdaten & Messstellenbetreiber'),

    field({ id: 'objekt.adresse',           label: 'Objekt-Adresse',           multiline: true,
            value: state.objekt.adresse,          error: errors['objekt.adresse'] }),
    field({ id: 'anschlussnutzer.name',     label: 'Anschlussnutzer (Name)',
            value: state.anschlussnutzer.name,    error: errors['anschlussnutzer.name'] }),
    field({ id: 'anschlussnutzer.adresse',  label: 'Anschlussnutzer (Adresse)', multiline: true,
            value: state.anschlussnutzer.adresse, error: errors['anschlussnutzer.adresse'] }),
    field({ id: 'msb.name',                 label: 'MSB Name',
            value: state.msb.name,                error: errors['msb.name'] }),
    field({ id: 'msb.codeNr',               label: 'MSB Code-Nr.',
            value: state.msb.codeNr,              error: errors['msb.codeNr'],
            helper: 'Nachschlagen auf bdew-codes.de ↗' }),

    el('div', { class: 'helper' },
      el('a', { href: 'https://bdew-codes.de/Codenumbers/BDEWCodes/CodeOverview', target: '_blank', rel: 'noopener' },
        'MSB auf bdew-codes.de nachschlagen ↗'),
    ),

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
}

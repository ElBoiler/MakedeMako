const KEY = 'form';

function isoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultState(today = new Date()) {
  const threeYearsAgo = new Date(Date.UTC(
    today.getUTCFullYear() - 3, today.getUTCMonth(), today.getUTCDate()
  ));
  return {
    objekt: { adresse: '' },
    anschlussnutzer: { name: '', adresse: '' },
    msb: { name: '', codeNr: '', knownToAdvizeo: null },
    messpunkte: [{ kind: 'MaLo', id: '', richtung: 'Verbrauch' }],
    beginnDatum: isoDate(threeYearsAgo),
    endeDatum: '',
    esa: { name: 'Advizeo Deutschland GmbH', marktpartnerId: '9985220000009' },
    step: 1,
  };
}

export async function loadState(storage = chrome.storage, today = new Date()) {
  const { [KEY]: stored } = await storage.local.get(KEY);
  if (!stored) return defaultState(today);
  return { ...defaultState(today), ...stored };
}

export async function saveState(state, storage = chrome.storage) {
  await storage.local.set({ [KEY]: state });
}

export async function resetState(storage = chrome.storage) {
  await storage.local.remove(KEY);
}

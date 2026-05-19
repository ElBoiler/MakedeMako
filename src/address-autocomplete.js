const PHOTON = 'https://photon.komoot.io/api';

/**
 * Search for German addresses via Photon (Komoot).
 * Returns structured { label, strasse, plz, ort } objects.
 * @param {string} query
 * @returns {Promise<Array<{ label: string, strasse: string, plz: string, ort: string }>>}
 */
export async function fetchAddressSuggestions(query) {
  const url = `${PHOTON}?q=${encodeURIComponent(query)}&lang=de&limit=5&countrycode=de`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Adresssuche fehlgeschlagen');
  const json = await res.json();

  return (json.features ?? [])
    .map(f => {
      const p = f.properties ?? {};
      const street = p.street ?? '';
      const nr     = p.housenumber ?? '';
      const strasse = nr ? `${street} ${nr}` : street;
      const plz  = p.postcode ?? '';
      const ort  = p.city ?? p.town ?? p.village ?? '';
      if (!strasse) return null;
      const label = [strasse, plz, ort].filter(Boolean).join(', ');
      return { label, strasse, plz, ort };
    })
    .filter(Boolean);
}

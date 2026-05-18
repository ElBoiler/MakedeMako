/**
 * Address autocomplete via Nominatim (OpenStreetMap).
 * Usage policy: https://operations.osmfoundation.org/policies/nominatim/
 * — Must include a descriptive User-Agent.
 * — With the 320ms debounce in wireAc the rate stays well under 1 req/s.
 */

const BASE = 'https://nominatim.openstreetmap.org/search';
const UA   = 'Advizeo-MaKo-Extension/1.0 (thomas.boyle@advizeo.io)';

/**
 * Search for German addresses.
 * @param {string} query
 * @returns {Promise<Array<{ display: string }>>}
 */
export async function searchAddress(query) {
  const url = new URL(BASE);
  url.searchParams.set('q',               query);
  url.searchParams.set('format',          'json');
  url.searchParams.set('limit',           '6');
  url.searchParams.set('countrycodes',    'de');
  url.searchParams.set('accept-language', 'de');
  url.searchParams.set('addressdetails',  '1');

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Adresssuche fehlgeschlagen');
  const data = await res.json();

  return data
    .map(r => ({ display: _fmt(r), raw: r }))
    .filter(r => r.display.length > 0);
}

function _fmt(r) {
  const a    = r.address ?? {};
  const road = a.road ?? a.pedestrian ?? a.path ?? a.footway ?? '';
  const num  = a.house_number ?? '';
  const zip  = a.postcode ?? '';
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? '';

  const street = [road, num].filter(Boolean).join(' ');
  const locale = [zip, city].filter(Boolean).join(' ');

  if (street && locale) return `${street}\n${locale}`;
  if (street)           return street;
  if (locale)           return locale;
  return r.display_name ?? '';
}

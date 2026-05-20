/**
 * BDEW Codenumbers API wrappers.
 * All endpoints are public and require no authentication.
 *
 * The `filter` param on GetCompanyList matches both company names AND BDEW
 * code fragments, so searching "Netze BW", "9903916", or "9903916000000"
 * all return Netze BW GmbH.  This enables true bidirectional lookup.
 */

const BASE = 'https://bdew-codes.de/Codenumbers/BDEWCodes';

// ── Company search ─────────────────────────────────────────────────────────

/**
 * Search companies by name or BDEW code fragment.
 * @param {string} query  — partial company name OR partial BDEW code
 * @returns {Promise<Array<{ id: number, name: string }>>}
 */
export async function searchMsb(query) {
  const res = await fetch(
    `${BASE}/GetCompanyList?jtStartIndex=0&jtPageSize=20`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ filter: query }).toString(),
    },
  );
  if (!res.ok) throw new Error('BDEW-Suche fehlgeschlagen');
  const data = await res.json();
  return (data.Records ?? []).map(r => ({
    id:     r.Id,
    name:   r.Company.trim(),
    strasse: (r.Street   ?? '').trim(),
    plz:    (r.ZipCode   ?? '').trim(),
    ort:    (r.City      ?? '').trim(),
  }));
}

// ── Code lookup ────────────────────────────────────────────────────────────

/**
 * Fetch the Messstellenbetreiber BDEW code and record ID for a given company.
 * @param {number} companyId  — the `id` field from searchMsb()
 * @returns {Promise<{ code: string, recordId: number } | null>}  null if no MSB role
 */
export async function fetchMsbCode(companyId) {
  const res = await fetch(
    `${BASE}/GetBdewCodeListOfCompany?companyId=${companyId}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    'jtStartIndex=0&jtPageSize=50',
    },
  );
  if (!res.ok) {
    console.warn('[bdew] fetchMsbCode HTTP', res.status, 'for companyId', companyId);
    return null;
  }
  const data = await res.json();
  const records = data.Records ?? [];

  const msb = records.find(r => r.MarketFunctionName?.trim() === 'Messstellenbetreiber');
  if (!msb?.BdewCode) return null;
  return { code: msb.BdewCode, recordId: msb.Id };
}

/**
 * Fetch address details for a specific BDEW code record.
 * The endpoint returns HTML — parse with DOMParser.
 * @param {number} bdewId  — the record `Id` from fetchMsbCode()
 * @returns {Promise<{ strasse: string, plz: string, ort: string }>}
 */
export async function fetchMsbDetail(bdewId) {
  const res = await fetch(`${BASE}/BdewCodeDetailInfo?bdewId=${bdewId}`);
  if (!res.ok) return { strasse: '', plz: '', ort: '' };
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  function getValue(labelPrefix) {
    for (const label of doc.querySelectorAll('label')) {
      if (label.textContent.trim().startsWith(labelPrefix)) {
        const val = label.closest('td')?.nextElementSibling;
        return val?.querySelector('div')?.textContent.trim() ?? '';
      }
    }
    return '';
  }

  return {
    strasse: getValue('Straße'),  // "Straße und Hausnummer"
    plz:     getValue('PLZ'),
    ort:     getValue('Stadt'),
  };
}

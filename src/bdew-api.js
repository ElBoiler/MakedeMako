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
  return (data.Records ?? []).map(r => ({ id: r.Id, name: r.Company.trim() }));
}

// ── Code lookup ────────────────────────────────────────────────────────────

/**
 * Fetch the Messstellenbetreiber BDEW code for a given company.
 * @param {number} companyId  — the `id` field from searchMsb()
 * @returns {Promise<string|null>}  BDEW code string or null if company has no MSB role
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

  // Prefer the explicit Messstellenbetreiber role; fall back to first available code.
  // (Some companies are listed without an explicit role label — their one BdewCode
  //  is the MSB code regardless of what MarketFunctionName says.)
  const msb = records.find(r => r.MarketFunctionName?.trim() === 'Messstellenbetreiber')
    ?? records[0];

  if (!msb) {
    console.warn('[bdew] no BDEW records for companyId', companyId, data);
    return null;
  }
  if (!msb.BdewCode) {
    console.warn('[bdew] record has no BdewCode for companyId', companyId, msb);
    return null;
  }
  return msb.BdewCode;
}

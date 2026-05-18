const BASE = 'https://bdew-codes.de/Codenumbers/BDEWCodes';

export async function searchMsb(query) {
  const res = await fetch(
    `${BASE}/GetCompanyList?jtStartIndex=0&jtPageSize=20`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ filter: query }).toString(),
    },
  );
  if (!res.ok) throw new Error('BDEW-Suche fehlgeschlagen');
  const data = await res.json();
  return (data.Records ?? []).map(r => ({ id: r.Id, name: r.Company.trim() }));
}

export async function fetchMsbCode(companyId) {
  const res = await fetch(
    `${BASE}/GetBdewCodeListOfCompany?companyId=${companyId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'jtStartIndex=0&jtPageSize=50',
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const msb = (data.Records ?? []).find(r => r.MarketFunctionName === 'Messstellenbetreiber');
  return msb?.BdewCode ?? null;
}

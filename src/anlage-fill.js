let ExcelJSFallback;
try { ExcelJSFallback = (await import('exceljs')).default; } catch {}

function getExcelJS() { return globalThis.ExcelJS ?? ExcelJSFallback; }

const SHEET = 'Messlokationen';
const FIRST_DATA_ROW = 5; // rows 5-14 are numbered 1-10
const ID_COL      = 2;   // column B = "Messlokation **"
const STRASSE_COL = 3;   // column C = "Straße"
const HAUSNR_COL  = 4;   // column D = "Hausnummer"
const PLZ_COL     = 5;   // column E = "Postleitzahl"
const ORT_COL     = 6;   // column F = "Ort"

// Split "Musterstraße 12a" → ["Musterstraße", "12a"]
function splitStrasse(raw) {
  const m = /^(.*?)\s+(\d+\S*)$/.exec((raw ?? '').trim());
  return m ? [m[1], m[2]] : [raw ?? '', ''];
}

export async function fillAnlage(templateBytes, data) {
  const ExcelJS = getExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Anlage-Vorlage: Arbeitsblatt "${SHEET}" nicht gefunden`);

  const messpunkte = data.MESSPUNKTE ?? [];
  const [strasse, hausnr] = splitStrasse(data.OBJEKT_STRASSE);
  const plz = data.OBJEKT_PLZ ?? '';
  const ort = data.OBJEKT_ORT ?? '';

  for (let i = 0; i < 10; i++) {
    const row     = ws.getRow(FIRST_DATA_ROW + i);
    const hasData = i < messpunkte.length;
    row.getCell(ID_COL).value      = hasData ? (messpunkte[i].ID || null) : null;
    row.getCell(STRASSE_COL).value = hasData ? (strasse           || null) : null;
    row.getCell(HAUSNR_COL).value  = hasData ? (hausnr            || null) : null;
    row.getCell(PLZ_COL).value     = hasData ? (plz               || null) : null;
    row.getCell(ORT_COL).value     = hasData ? (ort               || null) : null;
    row.commit();
  }

  return wb.xlsx.writeBuffer();
}

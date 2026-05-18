let ExcelJSFallback;
try { ExcelJSFallback = (await import('exceljs')).default; } catch {}

function getExcelJS() { return globalThis.ExcelJS ?? ExcelJSFallback; }

const SHEET = 'Messlokationen';
const FIRST_DATA_ROW = 5; // rows 5-14 are numbered 1-10
const ID_COL = 2;         // column B = "Messlokation **"

export async function fillAnlage(templateBytes, data) {
  const ExcelJS = getExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Anlage-Vorlage: Arbeitsblatt "${SHEET}" nicht gefunden`);

  const rows = data.MESSPUNKTE ?? [];
  for (let i = 0; i < 10; i++) {
    const row = ws.getRow(FIRST_DATA_ROW + i);
    row.getCell(ID_COL).value = i < rows.length ? (rows[i].ID || null) : null;
    row.commit();
  }

  return wb.xlsx.writeBuffer();
}

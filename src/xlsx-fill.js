let ExcelJSFallback;
try { ExcelJSFallback = (await import('exceljs')).default; } catch {}

function getExcelJS() { return globalThis.ExcelJS ?? ExcelJSFallback; }

const tokenRe = () => /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

export async function fillXlsx(templateBytes, data) {
  const ExcelJS = getExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  wb.eachSheet(ws => {
    ws.eachRow(row => {
      row.eachCell({ includeEmpty: false }, cell => {
        if (typeof cell.value === 'string' && tokenRe().test(cell.value)) {
          cell.value = cell.value.replace(tokenRe(), (_, key) => data[key] ?? '');
        }
      });
    });
  });
  return wb.xlsx.writeBuffer();
}

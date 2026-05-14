const ok = ['PizZip', 'docxtemplater', 'PDFLib', 'ExcelJS']
  .map(name => `${name}: ${typeof globalThis[name] !== 'undefined' ? 'OK' : 'MISSING'}`)
  .join('<br>');
document.getElementById('app').innerHTML = `<pre>${ok}</pre>`;

let PizZipFallback, DocxtemplaterFallback;
try {
  ({ default: PizZipFallback } = await import('pizzip'));
  ({ default: DocxtemplaterFallback } = await import('docxtemplater'));
} catch { /* browser: globals provided by vendor/ scripts */ }

export function fillDocx(templateBytes, data) {
  const PizZip = globalThis.PizZip ?? PizZipFallback;
  const Docxtemplater = globalThis.docxtemplater ?? DocxtemplaterFallback;
  const zip = new PizZip(templateBytes);
  const missingTags = [];
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{', end: '}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter(part) {
      if (!part.module) {
        missingTags.push(part.value);
      }
      return '';
    },
  });
  doc.render(data);
  if (missingTags.length > 0) {
    throw new Error(`Multi error - missing tag(s): ${missingTags.join(', ')}`);
  }
  return doc.getZip().generate({ type: 'uint8array' });
}

let PDFLibFallback, PDFNameLib, PDFStringLib;
try {
  const pdfLib = await import('pdf-lib');
  PDFLibFallback = pdfLib.PDFDocument;
  PDFNameLib = pdfLib.PDFName;
  PDFStringLib = pdfLib.PDFString;
} catch {}

function getPDFDocument() {
  return globalThis.PDFLib?.PDFDocument ?? PDFLibFallback;
}
function getPDFName() {
  return globalThis.PDFLib?.PDFName ?? PDFNameLib;
}
function getPDFString() {
  return globalThis.PDFLib?.PDFString ?? PDFStringLib;
}

const SCALARS = [
  'ANSCHLUSSNUTZER_NAME', 'ANSCHLUSSNUTZER_STRASSE', 'ANSCHLUSSNUTZER_PLZ_ORT',
  'ESA_NAME', 'ESA_STRASSE', 'ESA_PLZ_ORT', 'ESA_MARKTPARTNER_ID',
  'MSB_NAME', 'MSB_STRASSE', 'MSB_PLZ_ORT', 'MSB_CODE_NR',
  'BEGINN_DATUM', 'ENDE_DATUM',
];
const MP_SUFFIXES = ['CODE', 'BEZEICHNUNG'];
const MAX_ROWS = 10;

export async function fillPdf(templateBytes, data) {
  if ((data.MESSPRODUKTEN?.length ?? 0) > MAX_ROWS) {
    throw new Error(`Max ${MAX_ROWS} Messprodukte im PDF`);
  }
  const PDFDocument = getPDFDocument();
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  for (const name of SCALARS) {
    const value = data[name] ?? '';
    setText(form, name, String(value));
  }

  const rows = data.MESSPRODUKTEN ?? [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const row = rows[i] ?? null;
    for (const suffix of MP_SUFFIXES) {
      const fieldName = `MP_${i + 1}_${suffix}`;
      setText(form, fieldName, row ? String(row[suffix] ?? '') : '');
    }
  }

  return pdf.save();
}

function setText(form, name, value) {
  try {
    const field = form.getTextField(name);
    if (value === '') {
      // pdf-lib's setText('') leaves getText() returning undefined.
      // Set the raw AcroField 'V' entry to an empty PDFString so
      // subsequent getText() calls return '' consistently.
      const PDFName = getPDFName();
      const PDFString = getPDFString();
      field.acroField.dict.set(PDFName.of('V'), PDFString.of(''));
    } else {
      field.setText(value);
    }
  } catch (cause) {
    const e = new Error(`PDF-Vorlage hat Feld '${name}' nicht. Vorlage prüfen.`);
    e.cause = cause;
    throw e;
  }
}

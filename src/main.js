import { loadState, saveState, resetState, defaultState } from './form-state.js';
import { validate, hasErrors } from './validate.js';
import { renderStepNav } from './ui/render.js';
import { renderStep1, wireStep1 } from './ui/step1.js';
import { renderStep2 } from './ui/step2.js';
import { renderStep3, wireStep3 } from './ui/step3.js';
import { fillDocx } from './docx-fill.js';
import { fillPdf } from './pdf-fill.js';
import { fillXlsx } from './xlsx-fill.js';
import { buildEml } from './eml-build.js';
import { downloadBundle } from './download.js';
import { messprodukt } from './messprodukt.js';
import { SUBJECT, BODY_LINES } from './email-template.js';
import { slug } from './slug.js';

const state = await loadState(chrome.storage);
const stepBody = document.getElementById('stepBody');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const generateBtn = document.getElementById('generateBtn');

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur = isNaN(p) ? cur[p] : cur[Number(p)];
  }
  cur[parts.at(-1)] = value;
}

function errorsByStep(errors) {
  const e = {};
  for (const key of Object.keys(errors)) {
    if (key.startsWith('messpunkte')) e[2] = true;
    else if (['beginnDatum', 'endeDatum'].some(k => key.startsWith(k))) e[3] = true;
    else e[1] = true;
  }
  return e;
}

const ops = {
  change: async (path, value) => {
    setByPath(state, path, value);
    await saveState(state, chrome.storage);
    rerender();
  },
  addRow: async () => {
    if (state.messpunkte.length >= 10) return;
    state.messpunkte.push({ kind: 'MaLo', id: '', richtung: 'Verbrauch' });
    await saveState(state, chrome.storage);
    rerender();
  },
  removeRow: async i => {
    state.messpunkte.splice(i, 1);
    if (state.messpunkte.length === 0) state.messpunkte.push({ kind: 'MaLo', id: '', richtung: 'Verbrauch' });
    await saveState(state, chrome.storage);
    rerender();
  },
};

function rerender() {
  const errors = validate(state);
  renderStepNav(state.step, errorsByStep(errors));
  stepBody.replaceChildren(rendererFor(state.step)(state, errors, ops));
  if (state.step === 1) wireStep1(stepBody, ops.change);
  if (state.step === 3) wireStep3(stepBody, ops.change);
  updateFooter(errors);
}

function rendererFor(step) {
  if (step === 1) return renderStep1;
  if (step === 2) return renderStep2;
  return renderStep3;
}

function updateFooter(errors) {
  backBtn.disabled = state.step === 1;
  nextBtn.hidden = state.step === 3;
  generateBtn.hidden = state.step !== 3;
}

backBtn.addEventListener('click', async () => {
  state.step = Math.max(1, state.step - 1);
  await saveState(state, chrome.storage);
  rerender();
});
nextBtn.addEventListener('click', async () => {
  state.step = Math.min(3, state.step + 1);
  await saveState(state, chrome.storage);
  rerender();
});
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('Alle Eingaben zurücksetzen?')) return;
  await resetState(chrome.storage);
  location.reload();
});

function germanDate(iso) {
  if (!iso) return 'offen';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function toTemplateData(s) {
  return {
    OBJEKT_ADRESSE:          s.objekt.adresse,
    ANSCHLUSSNUTZER_NAME:    s.anschlussnutzer.name,
    ANSCHLUSSNUTZER_ADRESSE: s.anschlussnutzer.adresse,
    MSB_NAME:                s.msb.name,
    MSB_CODE_NR:             s.msb.codeNr,
    ESA_NAME:                s.esa.name,
    ESA_MARKTPARTNER_ID:     s.esa.marktpartnerId,
    BEGINN_DATUM:            germanDate(s.beginnDatum),
    ENDE_DATUM:              s.endeDatum ? germanDate(s.endeDatum) : 'offen',
    MESSPUNKTE: s.messpunkte.map(row => ({
      TYP: row.kind,
      ID: row.id,
      RICHTUNG: row.richtung,
      MESSPRODUKT: messprodukt(row.kind, row.richtung),
    })),
  };
}

async function fetchTemplate(path) {
  const res = await fetch(chrome.runtime.getURL(path));
  if (!res.ok) throw new Error(`Vorlage fehlt: ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function generate() {
  const errors = validate(state);
  if (hasErrors(errors)) {
    state.step = stepWithFirstError(errors);
    rerender();
    return;
  }

  const data = toTemplateData(state);
  const fileBase = `Einwilligungserklaerung_${slug(state.anschlussnutzer.name)}`;
  const files = [];

  try {
    const docxTpl = await fetchTemplate('templates/einwilligungserklaerung.docx');
    const docxBytes = fillDocx(docxTpl, data);
    files.push({ name: `${fileBase}.docx`, bytes: docxBytes,
                 mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const pdfTpl = await fetchTemplate('templates/einwilligungserklaerung.pdf');
    const pdfBytes = await fillPdf(pdfTpl, data);
    files.push({ name: `${fileBase}.pdf`, bytes: pdfBytes, mime: 'application/pdf' });

    if (state.msb.knownToAdvizeo === false) {
      const xlsxTpl = await fetchTemplate('templates/kontaktdatenblatt.xlsx');
      const xlsxBytes = new Uint8Array(await fillXlsx(xlsxTpl, data));
      files.push({ name: 'Kontaktdatenblatt.xlsx', bytes: xlsxBytes,
                   mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const eml = buildEml({
        subject: SUBJECT,
        bodyLines: BODY_LINES,
        headers: { 'X-Unsent': '1' },
        attachments: [
          { name: 'Kontaktdatenblatt.xlsx', contentType: files[2].mime, bytes: xlsxBytes },
          { name: `${fileBase}.pdf`,        contentType: 'application/pdf', bytes: pdfBytes },
        ],
      });
      files.push({
        name: `MSB-Anfrage_${slug(state.msb.name)}.eml`,
        bytes: new TextEncoder().encode(eml),
        mime: 'message/rfc822',
      });
    }

    await downloadBundle({ files, anschlussnutzer: state.anschlussnutzer.name });
    showSuccess(files);
  } catch (err) {
    showError(err);
  }
}

function stepWithFirstError(errors) {
  const k = Object.keys(errors)[0];
  if (k.startsWith('messpunkte')) return 2;
  if (k.startsWith('beginnDatum') || k.startsWith('endeDatum')) return 3;
  return 1;
}

function showSuccess(files) {
  stepBody.innerHTML = '';
  const list = document.createElement('ul');
  for (const f of files) {
    const li = document.createElement('li'); li.textContent = f.name; list.appendChild(li);
  }
  const h = document.createElement('h2'); h.textContent = 'Fertig — Dateien wurden heruntergeladen';
  const again = document.createElement('button'); again.className = 'primary'; again.textContent = 'Neue MaKo';
  again.addEventListener('click', async () => { await resetState(chrome.storage); location.reload(); });
  stepBody.append(h, list, again);
  backBtn.hidden = nextBtn.hidden = generateBtn.hidden = true;
}

function showError(err) {
  import('./ui/modal.js').then(({ showModal }) => showModal({
    title: 'Generierung fehlgeschlagen',
    body: err.message,
    detail: err.stack || String(err.cause || ''),
  }));
}

generateBtn.addEventListener('click', generate);

rerender();

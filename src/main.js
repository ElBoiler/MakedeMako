import { loadState, saveState, resetState } from './form-state.js';
import { validate } from './validate.js';
import { renderStepNav } from './ui/render.js';
import { renderStep1, wireStep1 } from './ui/step1.js';
import { renderStep2 } from './ui/step2.js';

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
  updateFooter(errors);
}

function rendererFor(step) {
  if (step === 1) return renderStep1;
  if (step === 2) return renderStep2;
  return () => document.createTextNode('Schritt 3 — folgt in Task 16.');
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

rerender();

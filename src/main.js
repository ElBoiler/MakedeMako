import { loadState, saveState, resetState } from './form-state.js';
import { validate } from './validate.js';
import { renderStepNav } from './ui/render.js';
import { renderStep1, wireStep1 } from './ui/step1.js';

const state = await loadState(chrome.storage);
const stepBody = document.getElementById('stepBody');

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts.at(-1)] = value;
}

function errorsByStep(errors) {
  const e = {};
  for (const key of Object.keys(errors)) {
    if (key.startsWith('objekt') || key.startsWith('anschlussnutzer') || key.startsWith('msb')) e[1] = true;
    else if (key.startsWith('messpunkte')) e[2] = true;
    else e[3] = true;
  }
  return e;
}

async function rerender() {
  const errors = validate(state);
  renderStepNav(state.step, errorsByStep(errors));
  stepBody.replaceChildren(renderStep1(state, errors, onChange));
  wireStep1(stepBody, onChange);
}

async function onChange(path, value) {
  setByPath(state, path, value);
  await saveState(state, chrome.storage);
  rerender();
}

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('Alle Eingaben zurücksetzen?')) return;
  await resetState(chrome.storage);
  location.reload();
});

rerender();
